-- Sprint 2 (ARCHITECTURE §5.3, §5.6): save a recording attempt, its word results and weak words.
--
-- save_attempt(p jsonb) updates or inserts by the client-generated id, so one attempt is saved in
-- two steps: first the take (audio, duration, timing metrics), later its assessment (scores,
-- words, raw JSON). Keys missing from p leave the stored value as is.
-- p: { id, lecture_id?, slide_id?, sentence_id?, mode, reference_text?, recognized_text?,
--      audio_path?, duration_sec, pron_score?, accuracy?, fluency?, completeness?, prosody?,
--      wpm?, filler_count?, long_pause_count?, metrics?, azure_raw?, ai_feedback?,
--      words?: [{ word, accuracy, error_type, offset_ms, duration_ms, phonemes }] }
-- Weak words (§5.6) are updated only the first time an attempt gets words, so retries do not
-- count twice: a word below 70 or mispronounced/omitted is upserted; a good score on a word that
-- is already weak is recorded too, and the word is mastered when its last 3 scores are ≥ 85.

create or replace function public.save_attempt(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := (p ->> 'id')::uuid;
  v_had_words boolean;
  v_word jsonb;
  v_value text;
  v_acc numeric;
  v_weak boolean;
  v_scores numeric[];
  v_n integer;
begin
  if v_id is null then
    raise exception 'save_attempt needs an id' using errcode = '22023';
  end if;

  -- Update first: an update-only payload (the assessment) has no mode, which an insert requires.
  update public.attempts a set
    reference_text   = case when p ? 'reference_text'   then p ->> 'reference_text'                 else a.reference_text end,
    recognized_text  = case when p ? 'recognized_text'  then p ->> 'recognized_text'                else a.recognized_text end,
    audio_path       = case when p ? 'audio_path'       then p ->> 'audio_path'                     else a.audio_path end,
    duration_sec     = case when p ? 'duration_sec'     then (p ->> 'duration_sec')::numeric        else a.duration_sec end,
    pron_score       = case when p ? 'pron_score'       then (p ->> 'pron_score')::numeric          else a.pron_score end,
    accuracy         = case when p ? 'accuracy'         then (p ->> 'accuracy')::numeric            else a.accuracy end,
    fluency          = case when p ? 'fluency'          then (p ->> 'fluency')::numeric             else a.fluency end,
    completeness     = case when p ? 'completeness'     then (p ->> 'completeness')::numeric        else a.completeness end,
    prosody          = case when p ? 'prosody'          then (p ->> 'prosody')::numeric             else a.prosody end,
    wpm              = case when p ? 'wpm'              then (p ->> 'wpm')::numeric                 else a.wpm end,
    filler_count     = case when p ? 'filler_count'     then (p ->> 'filler_count')::int            else a.filler_count end,
    long_pause_count = case when p ? 'long_pause_count' then (p ->> 'long_pause_count')::int        else a.long_pause_count end,
    metrics          = case when p ? 'metrics'          then p -> 'metrics'                         else a.metrics end,
    azure_raw        = case when p ? 'azure_raw'        then p -> 'azure_raw'                       else a.azure_raw end,
    ai_feedback      = case when p ? 'ai_feedback'      then p -> 'ai_feedback'                     else a.ai_feedback end
  where a.id = v_id;

  -- RLS hides other users' attempts, so their ids fall through to the insert and fail on the key.
  if not found then
    insert into public.attempts (
      id, lecture_id, slide_id, sentence_id, mode, reference_text, recognized_text, audio_path,
      duration_sec, pron_score, accuracy, fluency, completeness, prosody, wpm, filler_count,
      long_pause_count, metrics, azure_raw, ai_feedback
    )
    values (
      v_id,
      (p ->> 'lecture_id')::uuid,
      (p ->> 'slide_id')::uuid,
      (p ->> 'sentence_id')::uuid,
      p ->> 'mode',
      p ->> 'reference_text',
      p ->> 'recognized_text',
      p ->> 'audio_path',
      coalesce((p ->> 'duration_sec')::numeric, 0),
      (p ->> 'pron_score')::numeric,
      (p ->> 'accuracy')::numeric,
      (p ->> 'fluency')::numeric,
      (p ->> 'completeness')::numeric,
      (p ->> 'prosody')::numeric,
      (p ->> 'wpm')::numeric,
      (p ->> 'filler_count')::int,
      (p ->> 'long_pause_count')::int,
      p -> 'metrics',
      p -> 'azure_raw',
      p -> 'ai_feedback'
    );
  end if;

  if jsonb_typeof(p -> 'words') is distinct from 'array' then
    return v_id;
  end if;

  select exists (select 1 from public.word_results where attempt_id = v_id) into v_had_words;
  delete from public.word_results where attempt_id = v_id;
  insert into public.word_results (attempt_id, position, word, accuracy, error_type, offset_ms, duration_ms, phonemes)
  select v_id,
         ordinality::int,
         value ->> 'word',
         (value ->> 'accuracy')::numeric,
         value ->> 'error_type',
         (value ->> 'offset_ms')::int,
         (value ->> 'duration_ms')::int,
         value -> 'phonemes'
  from jsonb_array_elements(p -> 'words') with ordinality;

  if v_had_words then
    return v_id;
  end if;

  for v_word in select value from jsonb_array_elements(p -> 'words') loop
    v_value := lower(regexp_replace(v_word ->> 'word', '[^[:alnum:]'']+', '', 'g'));
    v_acc := (v_word ->> 'accuracy')::numeric;
    continue when v_value = '' or v_acc is null or v_word ->> 'error_type' = 'Insertion';
    v_weak := v_acc < 70 or v_word ->> 'error_type' in ('Mispronunciation', 'Omission');

    select recent_scores into v_scores
    from public.weak_items
    where user_id = (select auth.uid()) and kind = 'word' and value = v_value
    for update;

    if found then
      v_scores := v_scores || v_acc;
      v_n := coalesce(array_length(v_scores, 1), 0);
      v_scores := v_scores[greatest(1, v_n - 4):v_n];
      v_n := coalesce(array_length(v_scores, 1), 0);
      update public.weak_items
      set recent_scores = v_scores,
          avg_accuracy  = (select round(avg(s), 1) from unnest(v_scores) s),
          occurrences   = occurrences + v_weak::int,
          status        = case
                            when v_n >= 3 and (select min(s) from unnest(v_scores[v_n - 2:v_n]) s) >= 85 then 'mastered'
                            else 'active'
                          end,
          last_seen_at  = now()
      where user_id = (select auth.uid()) and kind = 'word' and value = v_value;
    elsif v_weak then
      insert into public.weak_items (kind, value, occurrences, avg_accuracy, recent_scores, last_seen_at)
      values ('word', v_value, 1, v_acc, array[v_acc], now());
    end if;
  end loop;

  return v_id;
end;
$$;

revoke execute on function public.save_attempt(jsonb) from public, anon;
grant execute on function public.save_attempt(jsonb) to authenticated;

-- Run history per lecture, newest first.
create index attempts_lecture_created_idx on public.attempts (lecture_id, created_at desc);
drop index public.attempts_lecture_idx;

-- Sprint 1 (ARCHITECTURE §5.1, §5.7): import a deck's slides with a first script, and save a
-- slide's script as sentences while keeping the ids of the sentences that survive an edit.

-- Keeps the author's line breaks: the first sentence of each paragraph of a slide script.
alter table public.sentences
  add column starts_paragraph boolean not null default false;

-- Sentences are read and rewritten per slide, in order.
drop index public.sentences_slide_idx;
create index sentences_slide_position_idx on public.sentences (slide_id, position);

-- ---------------------------------------------------------------------------
-- import_slides: all slides of a new deck and their first sentences, in one transaction.
-- p_slides: [{ title, source_text, source_notes, sentences: [{ text, starts_paragraph }] }]
-- ---------------------------------------------------------------------------

create or replace function public.import_slides(p_lecture_id uuid, p_slides jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(p_slides) is distinct from 'array' or jsonb_array_length(p_slides) = 0 then
    raise exception 'p_slides must be a non-empty array' using errcode = '22023';
  end if;

  -- RLS: only the owner's lecture is visible. The lock serializes concurrent imports.
  perform 1 from public.lectures where id = p_lecture_id for update;
  if not found then
    raise exception 'lecture % not found', p_lecture_id using errcode = 'P0002';
  end if;
  if exists (select 1 from public.slides where lecture_id = p_lecture_id) then
    raise exception 'lecture % already has slides', p_lecture_id using errcode = '23505';
  end if;

  with input as (
    select value as slide, ordinality::int as position
    from jsonb_array_elements(p_slides) with ordinality
  ),
  inserted as (
    insert into public.slides (lecture_id, position, title, source_text, source_notes)
    select p_lecture_id,
           position,
           nullif(btrim(slide ->> 'title'), ''),
           nullif(slide ->> 'source_text', ''),
           nullif(slide ->> 'source_notes', '')
    from input
    returning id, position
  )
  insert into public.sentences (lecture_id, slide_id, position, text, starts_paragraph)
  select p_lecture_id,
         inserted.id,
         s.ordinality::int,
         s.value ->> 'text',
         coalesce((s.value ->> 'starts_paragraph')::boolean, false)
  from inserted
  join input using (position)
  cross join lateral jsonb_array_elements(coalesce(input.slide -> 'sentences', '[]'::jsonb)) with ordinality as s;

  update public.lectures set updated_at = now() where id = p_lecture_id;
  return jsonb_array_length(p_slides);
end;
$$;

-- ---------------------------------------------------------------------------
-- save_slide_script: replaces a slide's sentences with the given ordered list.
-- p_sentences: [{ id | null, text, starts_paragraph }]. An id keeps that sentence (and its
-- cached reference audio while the text is unchanged); null inserts a new sentence; stored
-- sentences missing from the list are deleted.
-- ---------------------------------------------------------------------------

create or replace function public.save_slide_script(p_slide_id uuid, p_sentences jsonb)
returns setof public.sentences
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lecture_id uuid;
  v_expected integer;
  v_updated integer;
begin
  if jsonb_typeof(p_sentences) is distinct from 'array' then
    raise exception 'p_sentences must be an array' using errcode = '22023';
  end if;

  -- RLS: only the owner's slides are visible. The lock serializes overlapping autosaves.
  select lecture_id into v_lecture_id from public.slides where id = p_slide_id for update;
  if v_lecture_id is null then
    raise exception 'slide % not found', p_slide_id using errcode = 'P0002';
  end if;

  delete from public.sentences t
  where t.slide_id = p_slide_id
    and not exists (
      select 1 from jsonb_array_elements(p_sentences) e where (e ->> 'id')::uuid = t.id
    );

  -- Kept sentences: new position and text. Audio and "Americanize" notes belong to the old
  -- text, so they are cleared when the text changed.
  with input as (
    select (value ->> 'id')::uuid as id,
           value ->> 'text' as text,
           coalesce((value ->> 'starts_paragraph')::boolean, false) as starts_paragraph,
           ordinality::int as position
    from jsonb_array_elements(p_sentences) with ordinality
    where value ->> 'id' is not null
  )
  update public.sentences t
  set position            = i.position,
      starts_paragraph    = i.starts_paragraph,
      text                = i.text,
      original_text       = case when t.text = i.text then t.original_text end,
      change_notes        = case when t.text = i.text then t.change_notes end,
      ref_voice           = case when t.text = i.text then t.ref_voice end,
      ref_audio_path      = case when t.text = i.text then t.ref_audio_path end,
      ref_audio_slow_path = case when t.text = i.text then t.ref_audio_slow_path end,
      ref_word_timings    = case when t.text = i.text then t.ref_word_timings end
  from input i
  where t.id = i.id and t.slide_id = p_slide_id;
  get diagnostics v_updated = row_count;

  select count(*) into v_expected from jsonb_array_elements(p_sentences) e where e ->> 'id' is not null;
  if v_updated <> v_expected then
    raise exception 'some sentence ids do not belong to slide %', p_slide_id using errcode = '22023';
  end if;

  insert into public.sentences (lecture_id, slide_id, position, text, starts_paragraph)
  select v_lecture_id,
         p_slide_id,
         ordinality::int,
         value ->> 'text',
         coalesce((value ->> 'starts_paragraph')::boolean, false)
  from jsonb_array_elements(p_sentences) with ordinality
  where value ->> 'id' is null;

  update public.lectures set updated_at = now() where id = v_lecture_id;

  return query select * from public.sentences where slide_id = p_slide_id order by position;
end;
$$;

-- Logged-in users only (Supabase grants new functions to anon by default).
revoke execute on function public.import_slides(uuid, jsonb) from public, anon;
grant execute on function public.import_slides(uuid, jsonb) to authenticated;
revoke execute on function public.save_slide_script(uuid, jsonb) from public, anon;
grant execute on function public.save_slide_script(uuid, jsonb) to authenticated;

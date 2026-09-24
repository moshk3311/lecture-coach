-- Progress and usage views (ARCHITECTURE §6).
-- security_invoker = true makes every view respect the RLS of its underlying tables.

-- Average scores per local (Israel) day.
create view public.v_daily_progress
with (security_invoker = true) as
select
  a.user_id,
  (a.created_at at time zone 'Asia/Jerusalem')::date as day,
  count(*)::int                                      as attempts,
  round(avg(a.pron_score), 1)                        as pron_score,
  round(avg(a.accuracy), 1)                          as accuracy,
  round(avg(a.fluency), 1)                           as fluency,
  round(avg(a.prosody), 1)                           as prosody,
  round(sum(a.duration_sec) / 60.0, 1)               as minutes
from public.attempts a
group by 1, 2;

-- Average accuracy per phoneme over the last 30 days (from word_results.phonemes).
create view public.v_phoneme_stats
with (security_invoker = true) as
select
  a.user_id,
  p.value ->> 'phoneme'                                 as phoneme,
  count(*)::int                                         as occurrences,
  round(avg((p.value ->> 'accuracy')::numeric), 1)      as avg_accuracy
from public.attempts a
join public.word_results w on w.attempt_id = a.id
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(w.phonemes) = 'array' then w.phonemes else '[]'::jsonb end
) as p(value)
where a.created_at >= now() - interval '30 days'
  and p.value ? 'phoneme'
group by 1, 2;

-- Azure audio minutes used this calendar month (UTC), for the quota guard.
create view public.v_month_usage
with (security_invoker = true) as
select
  a.user_id,
  date_trunc('month', now(), 'UTC')                    as month_start,
  round(coalesce(sum(a.duration_sec), 0) / 60.0, 1)    as minutes,
  count(*)::int                                        as attempts
from public.attempts a
where a.created_at >= date_trunc('month', now(), 'UTC')
group by 1;

revoke all on public.v_daily_progress, public.v_phoneme_stats, public.v_month_usage from anon;
grant select on public.v_daily_progress, public.v_phoneme_stats, public.v_month_usage to authenticated;

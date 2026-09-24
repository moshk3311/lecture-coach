-- Lecture Coach — initial schema (ARCHITECTURE §6): tables, triggers, indexes, RLS, grants.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.lectures (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title          text not null,
  audience       text,
  target_minutes int,
  pptx_path      text,
  status         text not null default 'draft'
                 check (status in ('draft', 'practicing', 'ready', 'archived')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.slides (
  id              uuid primary key default gen_random_uuid(),
  lecture_id      uuid not null references public.lectures(id) on delete cascade,
  position        int not null,
  title           text,
  source_text     text,        -- extracted from PPTX
  source_notes    text,        -- PPTX speaker notes
  intent_notes    text,        -- what the user wants to say (any language)
  image_path      text,        -- rendered slide PNG
  transition_line text,        -- "Before you click" bridge sentence
  planned_seconds int,         -- manual override; null = computed
  keywords        text[],      -- memorization level L3
  memo_level      int not null default 0,
  unique (lecture_id, position)
);

create table public.sentences (
  id                  uuid primary key default gen_random_uuid(),
  lecture_id          uuid not null references public.lectures(id) on delete cascade,
  slide_id            uuid references public.slides(id) on delete cascade,
  position            int not null,
  text                text not null,
  original_text       text,     -- before "Americanize"
  change_notes        jsonb,    -- [{from, to, reason_he}]
  ref_voice           text,
  ref_audio_path      text,
  ref_audio_slow_path text,
  ref_word_timings    jsonb,    -- [{word, offset_ms, duration_ms}]
  updated_at          timestamptz not null default now()
);

create table public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  lecture_id    uuid not null references public.lectures(id) on delete cascade,
  slide_id      uuid references public.slides(id) on delete set null,
  role          text not null check (role in ('user', 'assistant')),
  content       text not null,
  proposed_edit jsonb,         -- optional structured edit proposal
  created_at    timestamptz not null default now()
);

create table public.attempts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lecture_id       uuid references public.lectures(id) on delete set null,
  slide_id         uuid references public.slides(id) on delete set null,
  sentence_id      uuid references public.sentences(id) on delete set null,
  mode             text not null check (mode in ('sentence', 'slide', 'drill', 'full_run', 'free')),
  reference_text   text,
  recognized_text  text,
  audio_path       text,       -- null after retention cleanup
  duration_sec     numeric not null,
  pron_score       numeric,
  accuracy         numeric,
  fluency          numeric,
  completeness     numeric,
  prosody          numeric,
  wpm              numeric,
  filler_count     int,
  long_pause_count int,
  metrics          jsonb,      -- pauses, per-slide timings, etc.
  azure_raw        jsonb,
  ai_feedback      jsonb,
  created_at       timestamptz not null default now()
);

create table public.word_results (
  id          bigint generated always as identity primary key,
  attempt_id  uuid not null references public.attempts(id) on delete cascade,
  position    int not null,
  word        text not null,
  accuracy    numeric,
  error_type  text,
  offset_ms   int,
  duration_ms int,
  phonemes    jsonb            -- [{phoneme, accuracy, nbest:[{phoneme, score}]}]
);

create table public.weak_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind              text not null check (kind in ('word', 'phoneme')),
  value             text not null,
  occurrences       int not null default 0,
  avg_accuracy      numeric,
  recent_scores     numeric[] not null default '{}',  -- last 5
  status            text not null default 'active' check (status in ('active', 'mastered')),
  last_seen_at      timestamptz,
  last_practiced_at timestamptz,
  unique (user_id, kind, value)
);

create table public.user_settings (
  user_id           uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  voice             text not null default 'en-US-AndrewNeural',
  slow_rate         text not null default '-25%',
  send_audio_to_llm boolean not null default true,   -- needed for corrections; user can turn off
  privacy_ack       boolean not null default false,
  azure_minutes_cap int not null default 300
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger lectures_set_updated_at
  before update on public.lectures
  for each row execute function public.set_updated_at();

create trigger sentences_set_updated_at
  before update on public.sentences
  for each row execute function public.set_updated_at();

-- Every new auth user gets a settings row with defaults.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Indexes (slides(lecture_id, position) is covered by its unique constraint)
-- ---------------------------------------------------------------------------

create index lectures_user_updated_idx       on public.lectures (user_id, updated_at desc);
create index sentences_lecture_position_idx  on public.sentences (lecture_id, position);
create index sentences_slide_idx             on public.sentences (slide_id);
create index chat_messages_lecture_idx       on public.chat_messages (lecture_id, created_at);
create index chat_messages_slide_idx         on public.chat_messages (slide_id);
create index attempts_user_created_idx       on public.attempts (user_id, created_at desc);
create index attempts_lecture_idx            on public.attempts (lecture_id);
create index attempts_slide_idx              on public.attempts (slide_id);
create index attempts_sentence_idx           on public.attempts (sentence_id);
create index word_results_attempt_idx        on public.word_results (attempt_id);
create index weak_items_user_status_idx      on public.weak_items (user_id, status);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.lectures      enable row level security;
alter table public.slides        enable row level security;
alter table public.sentences     enable row level security;
alter table public.chat_messages enable row level security;
alter table public.attempts      enable row level security;
alter table public.word_results  enable row level security;
alter table public.weak_items    enable row level security;
alter table public.user_settings enable row level security;

-- Tables with user_id: the owner only.
create policy "lectures: owner" on public.lectures
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "attempts: owner" on public.attempts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "weak_items: owner" on public.weak_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "user_settings: owner" on public.user_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Child tables: through the owning lecture / attempt.
create policy "slides: lecture owner" on public.slides
  for all to authenticated
  using (exists (
    select 1 from public.lectures l
    where l.id = slides.lecture_id and l.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.lectures l
    where l.id = slides.lecture_id and l.user_id = (select auth.uid())
  ));

create policy "sentences: lecture owner" on public.sentences
  for all to authenticated
  using (exists (
    select 1 from public.lectures l
    where l.id = sentences.lecture_id and l.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.lectures l
    where l.id = sentences.lecture_id and l.user_id = (select auth.uid())
  ));

create policy "chat_messages: lecture owner" on public.chat_messages
  for all to authenticated
  using (exists (
    select 1 from public.lectures l
    where l.id = chat_messages.lecture_id and l.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.lectures l
    where l.id = chat_messages.lecture_id and l.user_id = (select auth.uid())
  ));

create policy "word_results: attempt owner" on public.word_results
  for all to authenticated
  using (exists (
    select 1 from public.attempts a
    where a.id = word_results.attempt_id and a.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.attempts a
    where a.id = word_results.attempt_id and a.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- Keep-alive probe (GitHub Actions calls it daily so the free project never pauses).
-- Returns a constant; reads nothing.
-- ---------------------------------------------------------------------------

create or replace function public.ping()
returns text
language sql
stable
set search_path = ''
as $$
  select 'ok'::text;
$$;

-- ---------------------------------------------------------------------------
-- Grants: everything requires a logged-in user, except ping().
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke execute on function public.set_updated_at()  from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.ping()            from public;
grant  execute on function public.ping()            to anon, authenticated;

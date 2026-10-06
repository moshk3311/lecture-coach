-- Sprint 2b (ARCHITECTURE §5.8): the owner's coach tips, imported from NotebookLM by Claude.
-- The app only reads them; the content never lives in the repo.

create table public.coach_tips (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slug          text not null,
  category      text not null
                check (category in ('delivery','structure','humor','stage','practice','mindset')),
  triggers      text[] not null default '{}',
  rotating      boolean not null default false,
  title_he      text not null,
  body_he       text not null,
  example_en    text,
  sources       jsonb not null default '[]',
  active        boolean not null default true,
  updated_at    timestamptz not null default now(),
  unique (user_id, slug)
);

create trigger coach_tips_set_updated_at
  before update on public.coach_tips
  for each row execute function public.set_updated_at();

alter table public.coach_tips enable row level security;

create policy "coach_tips: owner" on public.coach_tips
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

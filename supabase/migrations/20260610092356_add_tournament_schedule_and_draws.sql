alter table public.tournaments
  add column if not exists ends_on date,
  add column if not exists playable_weekdays smallint[] not null default '{}'::smallint[],
  add column if not exists playable_start_time time,
  add column if not exists playable_end_time time,
  add column if not exists schedule_notes text;

do $$
begin
  alter type public.live_stream_type add value if not exists 'draw';
exception
  when duplicate_object then null;
end $$;

create table if not exists public.tournament_draws (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  mode text not null check (mode in ('demo', 'official')),
  status text not null default 'completed' check (status in ('completed', 'cancelled')),
  seed text not null,
  duration_seconds integer not null default 150 check (duration_seconds between 10 and 300),
  teams_snapshot jsonb not null default '[]'::jsonb,
  groups jsonb not null default '[]'::jsonb,
  bracket jsonb not null default '[]'::jsonb,
  youtube_watch_url text,
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

create unique index if not exists tournament_draws_one_official_per_tournament
on public.tournament_draws(tournament_id)
where mode = 'official';

create index if not exists tournament_draws_tournament_created_at_idx
on public.tournament_draws(tournament_id, created_at desc);

alter table public.tournament_draws enable row level security;

create policy "public can read tournament draws"
on public.tournament_draws for select
using (true);

create policy "organizers can create tournament draws"
on public.tournament_draws for insert
to authenticated
with check (
  created_by = auth.uid()
  and app_private.can_manage_tournament(tournament_id)
);

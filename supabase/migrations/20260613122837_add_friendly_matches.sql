create table public.friendly_matches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  home_team_id uuid not null references public.teams(id) on delete cascade,
  away_team_id uuid references public.teams(id) on delete set null,
  venue_id uuid references public.venues(id) on delete set null,
  field_mode public.field_mode not null default '5v5',
  invite_code text not null unique,
  title text not null default 'Amistoso barrial',
  note text,
  scheduled_at timestamptz,
  status text not null default 'open' check (status in ('open', 'accepted', 'scheduled', 'result_pending', 'final', 'cancelled')),
  home_score integer check (home_score >= 0),
  away_score integer check (away_score >= 0),
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  result_locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index friendly_matches_home_team_idx on public.friendly_matches(home_team_id, created_at desc);
create index friendly_matches_away_team_idx on public.friendly_matches(away_team_id, created_at desc);
create index friendly_matches_status_idx on public.friendly_matches(status, scheduled_at);

create trigger friendly_matches_touch_updated_at
before update on public.friendly_matches
for each row execute function app_private.touch_updated_at();

alter table public.friendly_matches enable row level security;

create policy "public can read friendly matches"
on public.friendly_matches for select
using (true);

create policy "team owners can create friendly matches"
on public.friendly_matches for insert
to authenticated
with check (
  created_by = auth.uid()
  and app_private.owns_team(home_team_id)
);

create policy "team owners can update friendly matches"
on public.friendly_matches for update
to authenticated
using (
  app_private.has_role('admin')
  or created_by = auth.uid()
  or app_private.owns_team(home_team_id)
  or (away_team_id is not null and app_private.owns_team(away_team_id))
  or (status = 'open' and away_team_id is null)
)
with check (
  app_private.has_role('admin')
  or created_by = auth.uid()
  or app_private.owns_team(home_team_id)
  or (away_team_id is not null and app_private.owns_team(away_team_id))
);

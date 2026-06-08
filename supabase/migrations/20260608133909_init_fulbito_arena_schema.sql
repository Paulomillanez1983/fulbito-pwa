create extension if not exists "pgcrypto";

create type public.app_role as enum (
  'player',
  'captain',
  'venue_owner',
  'organizer',
  'referee',
  'admin'
);

create type public.team_member_role as enum ('player', 'captain', 'coach');
create type public.tournament_format as enum ('league', 'world_cup', 'knockout');
create type public.tournament_status as enum ('draft', 'registration', 'active', 'completed', 'archived');
create type public.field_mode as enum ('5v5', '7v7', '11v11');
create type public.match_status as enum (
  'scheduled',
  'live',
  'result_pending',
  'confirmation_pending',
  'final',
  'disputed',
  'postponed',
  'cancelled'
);
create type public.result_review_status as enum ('pending', 'accepted', 'rejected');
create type public.result_confirmation_status as enum ('confirmed', 'disputed');

create schema if not exists app_private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Jugador Fulbito',
  avatar_url text,
  bio text,
  neighborhood text,
  favorite_position text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  name text not null,
  slug text not null unique,
  neighborhood text not null,
  address text,
  phone text,
  surface text,
  field_modes public.field_mode[] not null default array['5v5'::public.field_mode, '7v7'::public.field_mode],
  price_per_hour integer not null default 0,
  inscription_fee integer not null default 0,
  commission_rate numeric(5,2) not null default 8,
  cover_url text,
  status text not null default 'pending',
  open_hours text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  home_venue_id uuid references public.venues(id) on delete set null,
  name text not null,
  slug text not null unique,
  short_name text not null,
  badge_url text,
  primary_color text not null default '#eec15c',
  neighborhood text,
  founded_year integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  role public.team_member_role not null default 'player',
  display_name text not null,
  alias text,
  jersey_number integer,
  position text,
  photo_url text,
  goals integer not null default 0,
  yellow_cards integer not null default 0,
  red_cards integer not null default 0,
  created_at timestamptz not null default now(),
  unique (team_id, profile_id)
);

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid references public.profiles(id) on delete set null,
  venue_id uuid references public.venues(id) on delete set null,
  name text not null,
  slug text not null unique,
  format public.tournament_format not null default 'world_cup',
  status public.tournament_status not null default 'registration',
  field_mode public.field_mode not null default '7v7',
  max_teams integer,
  registration_fee integer not null default 0,
  starts_on date,
  rules text,
  hero_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tournament_teams (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  group_code text,
  seed integer,
  status text not null default 'approved',
  created_at timestamptz not null default now(),
  primary key (tournament_id, team_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete set null,
  home_team_id uuid references public.teams(id) on delete set null,
  away_team_id uuid references public.teams(id) on delete set null,
  phase text not null default 'groups',
  round_name text not null,
  group_code text,
  match_order integer not null default 0,
  scheduled_at timestamptz,
  status public.match_status not null default 'scheduled',
  home_score integer,
  away_score integer,
  result_locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.match_result_submissions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  submitted_by uuid references public.profiles(id) on delete set null,
  source_role public.app_role not null,
  home_score integer not null check (home_score >= 0),
  away_score integer not null check (away_score >= 0),
  status public.result_review_status not null default 'pending',
  note text,
  created_at timestamptz not null default now()
);

create table public.result_confirmations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  status public.result_confirmation_status not null,
  note text,
  created_at timestamptz not null default now(),
  unique (match_id, team_id)
);

create table public.lineups (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  submitted_by uuid references public.profiles(id) on delete set null,
  formation text not null default '2-3-1',
  field_mode public.field_mode not null default '7v7',
  created_at timestamptz not null default now(),
  unique (match_id, team_id)
);

create table public.lineup_slots (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references public.lineups(id) on delete cascade,
  team_member_id uuid references public.team_members(id) on delete set null,
  position_key text not null,
  label text not null,
  x numeric(5,2) not null,
  y numeric(5,2) not null,
  unique (lineup_id, position_key)
);

create index on public.venues(owner_id);
create index on public.teams(owner_id);
create index on public.team_members(team_id);
create index on public.tournaments(organizer_id);
create index on public.tournament_teams(team_id);
create index on public.matches(tournament_id, scheduled_at);
create index on public.match_result_submissions(match_id);
create index on public.result_confirmations(match_id);

create or replace function app_private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function app_private.touch_updated_at();

create trigger venues_touch_updated_at
before update on public.venues
for each row execute function app_private.touch_updated_at();

create trigger teams_touch_updated_at
before update on public.teams
for each row execute function app_private.touch_updated_at();

create trigger tournaments_touch_updated_at
before update on public.tournaments
for each row execute function app_private.touch_updated_at();

create trigger matches_touch_updated_at
before update on public.matches
for each row execute function app_private.touch_updated_at();

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
  safe_role public.app_role;
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'Jugador Fulbito'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  requested_role = coalesce(new.raw_user_meta_data ->> 'selected_role', 'player');
  if requested_role in ('player', 'captain', 'venue_owner', 'organizer') then
    safe_role = requested_role::public.app_role;
  else
    safe_role = 'player'::public.app_role;
  end if;

  insert into public.user_roles (user_id, role)
  values (new.id, safe_role)
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function app_private.handle_new_user();

create or replace function app_private.has_role(target_role public.app_role)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = target_role
  );
$$;

create or replace function app_private.has_any_role(target_roles public.app_role[])
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = any(target_roles)
  );
$$;

create or replace function app_private.owns_team(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teams
    where id = target_team_id
      and owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.team_members
    where team_id = target_team_id
      and profile_id = auth.uid()
      and role in ('captain', 'coach')
  );
$$;

create or replace function app_private.can_manage_tournament(target_tournament_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select app_private.has_role('admin')
    or exists (
      select 1
      from public.tournaments t
      where t.id = target_tournament_id
        and t.organizer_id = auth.uid()
    )
    or exists (
      select 1
      from public.tournaments t
      join public.venues v on v.id = t.venue_id
      where t.id = target_tournament_id
        and v.owner_id = auth.uid()
    );
$$;

create or replace function app_private.can_manage_match(target_match_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select app_private.has_any_role(array['admin'::public.app_role, 'referee'::public.app_role])
    or exists (
      select 1
      from public.matches m
      where m.id = target_match_id
        and app_private.can_manage_tournament(m.tournament_id)
    )
    or exists (
      select 1
      from public.matches m
      join public.venues v on v.id = m.venue_id
      where m.id = target_match_id
        and v.owner_id = auth.uid()
    );
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.venues enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_teams enable row level security;
alter table public.matches enable row level security;
alter table public.match_result_submissions enable row level security;
alter table public.result_confirmations enable row level security;
alter table public.lineups enable row level security;
alter table public.lineup_slots enable row level security;

create policy "profiles are public arena cards"
on public.profiles for select
using (true);

create policy "users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "users can read own roles"
on public.user_roles for select
to authenticated
using (user_id = auth.uid() or app_private.has_role('admin'));

create policy "users can choose allowed roles"
on public.user_roles for insert
to authenticated
with check (
  user_id = auth.uid()
  and role in ('player', 'captain', 'venue_owner', 'organizer')
);

create policy "public can read venues"
on public.venues for select
using (true);

create policy "venue owners can create venues"
on public.venues for insert
to authenticated
with check (
  owner_id = auth.uid()
  and app_private.has_any_role(array['venue_owner'::public.app_role, 'organizer'::public.app_role, 'admin'::public.app_role])
);

create policy "venue owners can update venues"
on public.venues for update
to authenticated
using (owner_id = auth.uid() or app_private.has_role('admin'))
with check (owner_id = auth.uid() or app_private.has_role('admin'));

create policy "public can read teams"
on public.teams for select
using (true);

create policy "authenticated users can create teams"
on public.teams for insert
to authenticated
with check (owner_id = auth.uid());

create policy "team owners can update teams"
on public.teams for update
to authenticated
using (owner_id = auth.uid() or app_private.has_role('admin'))
with check (owner_id = auth.uid() or app_private.has_role('admin'));

create policy "public can read team members"
on public.team_members for select
using (true);

create policy "team owners can manage members"
on public.team_members for insert
to authenticated
with check (app_private.owns_team(team_id) or profile_id = auth.uid());

create policy "team owners can update members"
on public.team_members for update
to authenticated
using (app_private.owns_team(team_id) or profile_id = auth.uid())
with check (app_private.owns_team(team_id) or profile_id = auth.uid());

create policy "public can read tournaments"
on public.tournaments for select
using (true);

create policy "organizers can create tournaments"
on public.tournaments for insert
to authenticated
with check (
  organizer_id = auth.uid()
  and app_private.has_any_role(array['organizer'::public.app_role, 'venue_owner'::public.app_role, 'admin'::public.app_role])
);

create policy "organizers can update tournaments"
on public.tournaments for update
to authenticated
using (app_private.can_manage_tournament(id))
with check (app_private.can_manage_tournament(id));

create policy "public can read tournament teams"
on public.tournament_teams for select
using (true);

create policy "captains and organizers can enroll teams"
on public.tournament_teams for insert
to authenticated
with check (
  app_private.owns_team(team_id)
  or app_private.can_manage_tournament(tournament_id)
);

create policy "captains and organizers can update tournament teams"
on public.tournament_teams for update
to authenticated
using (
  app_private.owns_team(team_id)
  or app_private.can_manage_tournament(tournament_id)
)
with check (
  app_private.owns_team(team_id)
  or app_private.can_manage_tournament(tournament_id)
);

create policy "public can read matches"
on public.matches for select
using (true);

create policy "organizers can create matches"
on public.matches for insert
to authenticated
with check (app_private.can_manage_tournament(tournament_id));

create policy "officials can update matches"
on public.matches for update
to authenticated
using (app_private.can_manage_match(id))
with check (app_private.can_manage_match(id));

create policy "public can read result submissions"
on public.match_result_submissions for select
using (true);

create policy "officials and captains can submit results"
on public.match_result_submissions for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and (
    app_private.can_manage_match(match_id)
    or app_private.has_role('referee')
    or exists (
      select 1
      from public.matches m
      where m.id = match_id
        and (app_private.owns_team(m.home_team_id) or app_private.owns_team(m.away_team_id))
    )
  )
);

create policy "officials can review result submissions"
on public.match_result_submissions for update
to authenticated
using (app_private.can_manage_match(match_id))
with check (app_private.can_manage_match(match_id));

create policy "public can read confirmations"
on public.result_confirmations for select
using (true);

create policy "captains can confirm their result"
on public.result_confirmations for insert
to authenticated
with check (
  profile_id = auth.uid()
  and app_private.owns_team(team_id)
);

create policy "captains can update their confirmation"
on public.result_confirmations for update
to authenticated
using (profile_id = auth.uid() and app_private.owns_team(team_id))
with check (profile_id = auth.uid() and app_private.owns_team(team_id));

create policy "public can read lineups"
on public.lineups for select
using (true);

create policy "team staff can manage lineups"
on public.lineups for insert
to authenticated
with check (submitted_by = auth.uid() and app_private.owns_team(team_id));

create policy "team staff can update lineups"
on public.lineups for update
to authenticated
using (app_private.owns_team(team_id))
with check (app_private.owns_team(team_id));

create policy "public can read lineup slots"
on public.lineup_slots for select
using (true);

create policy "team staff can manage lineup slots"
on public.lineup_slots for insert
to authenticated
with check (
  exists (
    select 1
    from public.lineups l
    where l.id = lineup_id
      and app_private.owns_team(l.team_id)
  )
);

create policy "team staff can update lineup slots"
on public.lineup_slots for update
to authenticated
using (
  exists (
    select 1
    from public.lineups l
    where l.id = lineup_id
      and app_private.owns_team(l.team_id)
  )
)
with check (
  exists (
    select 1
    from public.lineups l
    where l.id = lineup_id
      and app_private.owns_team(l.team_id)
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('team-badges', 'team-badges', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('player-photos', 'player-photos', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('venue-photos', 'venue-photos', true, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "public can read arena media"
on storage.objects for select
using (bucket_id in ('team-badges', 'player-photos', 'venue-photos'));

create policy "authenticated can upload arena media"
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('team-badges', 'player-photos', 'venue-photos')
  and owner = auth.uid()
);

create policy "owners can update arena media"
on storage.objects for update
to authenticated
using (
  bucket_id in ('team-badges', 'player-photos', 'venue-photos')
  and owner = auth.uid()
)
with check (
  bucket_id in ('team-badges', 'player-photos', 'venue-photos')
  and owner = auth.uid()
);

create policy "owners can delete arena media"
on storage.objects for delete
to authenticated
using (
  bucket_id in ('team-badges', 'player-photos', 'venue-photos')
  and owner = auth.uid()
);

insert into public.venues (id, name, slug, neighborhood, address, phone, surface, field_modes, price_per_hour, inscription_fee, commission_rate, status, open_hours)
values
  ('11111111-1111-4111-8111-111111111111', 'Arena La Diez', 'arena-la-diez', 'Villa del Parque', 'Terrada 1234', '+54 9 11 5555 1010', 'Sintetico premium', array['5v5'::public.field_mode, '7v7'::public.field_mode], 42000, 18000, 8, 'verified', '17:00 a 01:00'),
  ('22222222-2222-4222-8222-222222222222', 'Potrero San Martin', 'potrero-san-martin', 'Barracas', 'Luna 550', '+54 9 11 5555 2020', 'Sintetico LED', array['5v5'::public.field_mode, '7v7'::public.field_mode], 38000, 16000, 8, 'verified', '18:00 a 00:30'),
  ('33333333-3333-4333-8333-333333333333', 'El Fortin F7', 'el-fortin-f7', 'Almagro', 'Guardia Vieja 3100', '+54 9 11 5555 3030', 'Sintetico mixto', array['7v7'::public.field_mode, '11v11'::public.field_mode], 50000, 22000, 9, 'partner', '16:00 a 02:00')
on conflict (id) do nothing;

insert into public.teams (id, home_venue_id, name, slug, short_name, primary_color, neighborhood, founded_year)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Los Pibes FC', 'los-pibes-fc', 'LPF', '#eec15c', 'Almagro', 2021),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'La Cantera', 'la-cantera', 'LCT', '#40c8ff', 'Barracas', 2020),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '33333333-3333-4333-8333-333333333333', 'Barrio Norte', 'barrio-norte', 'BN', '#5b7cff', 'Palermo', 2019),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111', 'Atletico Potrero', 'atletico-potrero', 'ATP', '#ff6475', 'Boedo', 2022)
on conflict (id) do nothing;

insert into public.team_members (team_id, role, display_name, alias, jersey_number, position, goals)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'captain', 'Nico Gomez', 'Nico', 1, 'Arquero', 0),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'player', 'Facu Molina', 'Facu', 10, 'Enganche', 6),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'player', 'Joaco Ruiz', 'Joaco', 9, 'Delantero', 4),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'captain', 'Rama Soto', 'Rama', 8, 'Volante', 3),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'player', 'Gonza Silva', 'Gonza', 9, 'Delantero', 5),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'captain', 'Seba Mena', 'Seba', 5, 'Volante', 2),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'captain', 'Leo Cabrera', 'Leo', 4, 'Defensa', 1)
on conflict do nothing;

insert into public.tournaments (id, venue_id, name, slug, format, status, field_mode, max_teams, registration_fee, starts_on, rules)
values (
  '99999999-9999-4999-8999-999999999999',
  '11111111-1111-4111-8111-111111111111',
  'Fulbito Arena Apertura',
  'fulbito-arena-apertura',
  'world_cup',
  'active',
  '7v7',
  16,
  18000,
  current_date + 7,
  'Fase de grupos, playoffs y final. Resultado oficial validado por veedor, cancha u organizador.'
)
on conflict (id) do nothing;

insert into public.tournament_teams (tournament_id, team_id, group_code, seed)
values
  ('99999999-9999-4999-8999-999999999999', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A', 1),
  ('99999999-9999-4999-8999-999999999999', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'A', 2),
  ('99999999-9999-4999-8999-999999999999', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'B', 3),
  ('99999999-9999-4999-8999-999999999999', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'B', 4)
on conflict do nothing;

insert into public.matches (id, tournament_id, venue_id, home_team_id, away_team_id, phase, round_name, group_code, match_order, scheduled_at, status, home_score, away_score)
values
  ('12121212-1212-4121-8121-121212121212', '99999999-9999-4999-8999-999999999999', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'groups', 'Fecha 1', 'A', 1, now() + interval '3 days', 'scheduled', null, null),
  ('23232323-2323-4232-8232-232323232323', '99999999-9999-4999-8999-999999999999', '33333333-3333-4333-8333-333333333333', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'groups', 'Fecha 1', 'B', 2, now() + interval '3 days 2 hours', 'scheduled', null, null),
  ('34343434-3434-4343-8343-343434343434', '99999999-9999-4999-8999-999999999999', '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'groups', 'Fecha 0', 'Interzona', 0, now() - interval '2 days', 'final', 3, 1)
on conflict (id) do nothing;

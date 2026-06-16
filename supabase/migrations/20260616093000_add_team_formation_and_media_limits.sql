create table if not exists public.team_formation_settings (
  team_id uuid primary key references public.teams(id) on delete cascade,
  field_mode public.field_mode not null default '7v7',
  formation text not null default '2-3-1',
  slot_order text[] not null default '{}'::text[],
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_media_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null,
  target_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists profile_media_updates_user_month_idx
on public.profile_media_updates(user_id, target_type, created_at desc);

alter table public.team_formation_settings enable row level security;
alter table public.profile_media_updates enable row level security;

drop policy if exists "public can read team formation settings" on public.team_formation_settings;
create policy "public can read team formation settings"
on public.team_formation_settings for select
using (true);

drop policy if exists "team owners can insert formation settings" on public.team_formation_settings;
create policy "team owners can insert formation settings"
on public.team_formation_settings for insert
to authenticated
with check (app_private.owns_team(team_id) and updated_by = auth.uid());

drop policy if exists "team owners can update formation settings" on public.team_formation_settings;
create policy "team owners can update formation settings"
on public.team_formation_settings for update
to authenticated
using (app_private.owns_team(team_id))
with check (app_private.owns_team(team_id) and updated_by = auth.uid());

drop policy if exists "users can read own media update logs" on public.profile_media_updates;
create policy "users can read own media update logs"
on public.profile_media_updates for select
to authenticated
using (user_id = auth.uid() or app_private.has_role('admin'));

drop policy if exists "users can insert own media update logs" on public.profile_media_updates;
create policy "users can insert own media update logs"
on public.profile_media_updates for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "team owners can delete members" on public.team_members;
create policy "team owners can delete members"
on public.team_members for delete
to authenticated
using (app_private.owns_team(team_id));

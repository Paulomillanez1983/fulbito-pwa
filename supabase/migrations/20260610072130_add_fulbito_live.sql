create type public.live_stream_permission_status as enum ('active', 'suspended', 'expired');
create type public.live_stream_mode as enum ('external_link', 'official_auto', 'official_manual');
create type public.live_stream_type as enum ('match', 'final', 'training', 'press', 'other');
create type public.live_stream_lifecycle_status as enum ('scheduled', 'ready', 'testing', 'live', 'complete', 'cancelled', 'failed');
create type public.live_stream_visibility as enum ('public', 'unlisted', 'private');
create type public.live_stream_channel_status as enum ('active', 'busy', 'disabled');

create table public.app_feature_flags (
  key text primary key,
  enabled boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.live_stream_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  handle text not null,
  provider text not null default 'youtube',
  channel_url text,
  is_official boolean not null default false,
  supports_auto_mock boolean not null default true,
  status public.live_stream_channel_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.live_stream_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  can_use_external_link boolean not null default true,
  can_use_official_auto boolean not null default false,
  max_streams_per_day integer not null default 2,
  max_streams_per_week integer not null default 8,
  allowed_stream_types public.live_stream_type[] not null default array['match'::public.live_stream_type],
  allowed_channel_ids uuid[] not null default '{}',
  status public.live_stream_permission_status not null default 'active',
  enabled_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tournament_id)
);

create table public.live_stream_events (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  channel_id uuid references public.live_stream_channels(id) on delete set null,
  mode public.live_stream_mode not null,
  stream_type public.live_stream_type not null default 'match',
  title text not null,
  description text,
  youtube_watch_url text,
  youtube_embed_url text,
  youtube_broadcast_id text,
  youtube_stream_id text,
  lifecycle_status public.live_stream_lifecycle_status not null default 'scheduled',
  visibility public.live_stream_visibility not null default 'public',
  sponsor_name text,
  sponsor_url text,
  manual_view_count integer not null default 0,
  manual_peak_viewers integer not null default 0,
  manual_notes text,
  scheduled_start_at timestamptz,
  actual_started_at timestamptz,
  actual_ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.live_stream_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  live_stream_event_id uuid references public.live_stream_events(id) on delete cascade,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index on public.live_stream_permissions(user_id, tournament_id, status);
create index on public.live_stream_events(tournament_id, lifecycle_status);
create index on public.live_stream_events(match_id);
create index on public.live_stream_events(created_by_user_id, created_at desc);
create index on public.live_stream_events(channel_id, scheduled_start_at);
create index on public.live_stream_audit_logs(live_stream_event_id, created_at desc);

create trigger app_feature_flags_touch_updated_at
before update on public.app_feature_flags
for each row execute function app_private.touch_updated_at();

create trigger live_stream_channels_touch_updated_at
before update on public.live_stream_channels
for each row execute function app_private.touch_updated_at();

create trigger live_stream_permissions_touch_updated_at
before update on public.live_stream_permissions
for each row execute function app_private.touch_updated_at();

create trigger live_stream_events_touch_updated_at
before update on public.live_stream_events
for each row execute function app_private.touch_updated_at();

alter table public.app_feature_flags enable row level security;
alter table public.live_stream_channels enable row level security;
alter table public.live_stream_permissions enable row level security;
alter table public.live_stream_events enable row level security;
alter table public.live_stream_audit_logs enable row level security;

create policy "public can read feature flags"
on public.app_feature_flags for select
using (true);

create policy "admins can manage feature flags"
on public.app_feature_flags for all
to authenticated
using (app_private.has_role('admin'))
with check (app_private.has_role('admin'));

create policy "public can read live stream channels"
on public.live_stream_channels for select
using (true);

create policy "admins can manage live stream channels"
on public.live_stream_channels for all
to authenticated
using (app_private.has_role('admin'))
with check (app_private.has_role('admin'));

create policy "admins and owners can read live stream permissions"
on public.live_stream_permissions for select
to authenticated
using (
  user_id = auth.uid()
  or app_private.has_role('admin')
  or app_private.can_manage_tournament(tournament_id)
);

create policy "admins can manage live stream permissions"
on public.live_stream_permissions for all
to authenticated
using (app_private.has_role('admin'))
with check (app_private.has_role('admin'));

create policy "public can read live stream events"
on public.live_stream_events for select
using (true);

create policy "tournament managers can create live stream events"
on public.live_stream_events for insert
to authenticated
with check (
  created_by_user_id = auth.uid()
  and app_private.can_manage_tournament(tournament_id)
);

create policy "tournament managers can update own live stream events"
on public.live_stream_events for update
to authenticated
using (
  app_private.has_role('admin')
  or app_private.can_manage_tournament(tournament_id)
)
with check (
  app_private.has_role('admin')
  or app_private.can_manage_tournament(tournament_id)
);

create policy "admins and event actors can read live stream audit logs"
on public.live_stream_audit_logs for select
to authenticated
using (
  app_private.has_role('admin')
  or actor_user_id = auth.uid()
  or exists (
    select 1
    from public.live_stream_events lse
    where lse.id = live_stream_event_id
      and app_private.can_manage_tournament(lse.tournament_id)
  )
);

create policy "authenticated can create live stream audit logs"
on public.live_stream_audit_logs for insert
to authenticated
with check (actor_user_id = auth.uid() or app_private.has_role('admin'));

insert into public.app_feature_flags (key, enabled)
values ('FULBITO_LIVE_ENABLED', true)
on conflict (key) do update set enabled = excluded.enabled;

insert into public.live_stream_channels (name, handle, provider, channel_url, is_official, supports_auto_mock, status)
values
  ('Fulbito TV', '@FulbitoLIVE', 'youtube', 'https://www.youtube.com/@FulbitoLIVE', true, true, 'active'),
  ('Fulbito LATAM', '@fulbitolatam', 'youtube', 'https://www.youtube.com/@fulbitolatam', true, false, 'active')
on conflict do nothing;

insert into public.live_stream_permissions (
  user_id,
  tournament_id,
  can_use_external_link,
  can_use_official_auto,
  max_streams_per_day,
  max_streams_per_week,
  allowed_stream_types,
  status,
  enabled_by_user_id
)
select
  pr.requester_id,
  pr.target_id,
  true,
  true,
  3,
  12,
  array['match'::public.live_stream_type, 'final'::public.live_stream_type],
  'active',
  pr.reviewed_by
from public.payment_requests pr
where pr.plan_code = 'tournament_pro'
  and pr.target_type = 'tournament'
  and pr.status = 'approved'
  and pr.target_id is not null
on conflict (user_id, tournament_id) do update
set
  can_use_external_link = true,
  can_use_official_auto = true,
  max_streams_per_day = greatest(public.live_stream_permissions.max_streams_per_day, 3),
  max_streams_per_week = greatest(public.live_stream_permissions.max_streams_per_week, 12),
  allowed_stream_types = array['match'::public.live_stream_type, 'final'::public.live_stream_type],
  status = 'active',
  enabled_by_user_id = coalesce(excluded.enabled_by_user_id, public.live_stream_permissions.enabled_by_user_id);

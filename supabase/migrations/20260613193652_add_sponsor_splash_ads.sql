alter table public.ad_campaigns
  add column if not exists splash_enabled boolean not null default false,
  add column if not exists splash_cta_label text not null default 'Ver sponsor',
  add column if not exists splash_close_after_seconds integer not null default 5 check (splash_close_after_seconds between 3 and 30),
  add column if not exists splash_frequency_hours integer not null default 12 check (splash_frequency_hours between 0 and 168),
  add column if not exists splash_creative_url text;

create table if not exists public.ad_campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null default auth.uid(),
  anon_id text,
  event_type text not null check (event_type in ('impression', 'click', 'dismiss')),
  placement text not null default 'sponsor_splash',
  source_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ad_campaign_events_has_actor check (user_id is not null or anon_id is not null)
);

create index if not exists ad_campaign_events_campaign_created_idx
on public.ad_campaign_events (campaign_id, created_at desc);

create index if not exists ad_campaign_events_user_created_idx
on public.ad_campaign_events (user_id, created_at desc)
where user_id is not null;

create index if not exists ad_campaign_events_anon_created_idx
on public.ad_campaign_events (anon_id, created_at desc)
where anon_id is not null;

alter table public.ad_campaign_events enable row level security;

drop policy if exists "clients can insert ad campaign events" on public.ad_campaign_events;
create policy "clients can insert ad campaign events"
on public.ad_campaign_events for insert
to anon, authenticated
with check (
  event_type in ('impression', 'click', 'dismiss')
  and placement in ('sponsor_splash', 'arena_led')
  and (user_id is null or user_id = auth.uid())
  and exists (
    select 1
    from public.ad_campaigns campaign
    where campaign.id = campaign_id
      and campaign.status = 'active'
      and campaign.starts_at <= now()
      and (campaign.ends_at is null or campaign.ends_at >= now())
  )
);

drop policy if exists "admins can read ad campaign events" on public.ad_campaign_events;
create policy "admins can read ad campaign events"
on public.ad_campaign_events for select
to authenticated
using (app_private.has_role('admin'));

drop policy if exists "admins can delete ad campaign events" on public.ad_campaign_events;
create policy "admins can delete ad campaign events"
on public.ad_campaign_events for delete
to authenticated
using (app_private.has_role('admin'));

update public.ad_campaigns
set splash_enabled = true,
    splash_cta_label = 'Abrir canal',
    splash_close_after_seconds = 5,
    splash_frequency_hours = 12
where advertiser_name = 'Fulbito TV'
  and target_url ilike '%youtube%';

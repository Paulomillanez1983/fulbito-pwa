do $$
begin
  create type public.ad_campaign_status as enum ('pending', 'active', 'paused', 'rejected', 'expired');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.ad_campaign_scope as enum ('local', 'national');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  advertiser_name text not null,
  headline text not null,
  body text,
  logo_url text,
  target_url text,
  placement text not null default 'arena_led',
  scope public.ad_campaign_scope not null default 'local',
  latitude numeric(9,6),
  longitude numeric(9,6),
  radius_km integer not null default 50 check (radius_km between 1 and 5000),
  status public.ad_campaign_status not null default 'pending',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_campaigns_local_has_coordinates check (
    scope = 'national'
    or (latitude is not null and longitude is not null)
  )
);

create index if not exists ad_campaigns_status_dates_idx
on public.ad_campaigns (status, starts_at, ends_at);

create index if not exists ad_campaigns_scope_location_idx
on public.ad_campaigns (scope, latitude, longitude);

drop trigger if exists ad_campaigns_touch_updated_at on public.ad_campaigns;
create trigger ad_campaigns_touch_updated_at
before update on public.ad_campaigns
for each row execute function app_private.touch_updated_at();

alter table public.ad_campaigns enable row level security;

drop policy if exists "public can read active ad campaigns" on public.ad_campaigns;
create policy "public can read active ad campaigns"
on public.ad_campaigns for select
using (
  app_private.has_role('admin')
  or (
    status = 'active'
    and starts_at <= now()
    and (ends_at is null or ends_at >= now())
  )
);

drop policy if exists "admins can create ad campaigns" on public.ad_campaigns;
create policy "admins can create ad campaigns"
on public.ad_campaigns for insert
to authenticated
with check (app_private.has_role('admin'));

drop policy if exists "admins can update ad campaigns" on public.ad_campaigns;
create policy "admins can update ad campaigns"
on public.ad_campaigns for update
to authenticated
using (app_private.has_role('admin'))
with check (app_private.has_role('admin'));

drop policy if exists "admins can delete ad campaigns" on public.ad_campaigns;
create policy "admins can delete ad campaigns"
on public.ad_campaigns for delete
to authenticated
using (app_private.has_role('admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ad-assets', 'ad-assets', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

drop policy if exists "public can read ad assets" on storage.objects;
create policy "public can read ad assets"
on storage.objects for select
using (bucket_id = 'ad-assets');

drop policy if exists "admins can upload ad assets" on storage.objects;
create policy "admins can upload ad assets"
on storage.objects for insert
to authenticated
with check (bucket_id = 'ad-assets' and app_private.has_role('admin'));

drop policy if exists "admins can update ad assets" on storage.objects;
create policy "admins can update ad assets"
on storage.objects for update
to authenticated
using (bucket_id = 'ad-assets' and app_private.has_role('admin'))
with check (bucket_id = 'ad-assets' and app_private.has_role('admin'));

drop policy if exists "admins can delete ad assets" on storage.objects;
create policy "admins can delete ad assets"
on storage.objects for delete
to authenticated
using (bucket_id = 'ad-assets' and app_private.has_role('admin'));

insert into public.ad_campaigns (
  advertiser_name,
  headline,
  body,
  target_url,
  scope,
  status,
  starts_at,
  ends_at,
  sort_order
)
values
  ('Fulbito TV', 'Segui Fulbito TV', 'Sorteos, vivos y finales en YouTube', 'https://www.youtube.com/@FulbitoLIVE?sub_confirmation=1', 'national', 'active', now(), now() + interval '30 days', 10),
  ('Fulbito Live', 'Fulbito Live', 'Transmisiones externas por YouTube', 'https://www.youtube.com/@FulbitoLIVE?sub_confirmation=1', 'national', 'active', now(), now() + interval '30 days', 20)
on conflict do nothing;

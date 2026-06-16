alter table public.venues
  add column if not exists logo_url text,
  add column if not exists marker_url text,
  add column if not exists card_url text,
  add column if not exists hero_url text,
  add column if not exists media_frame jsonb default '{}'::jsonb;

alter table public.teams
  add column if not exists badge_icon_url text,
  add column if not exists badge_card_url text,
  add column if not exists badge_frame jsonb default '{}'::jsonb;

alter table public.team_members
  add column if not exists avatar_url text,
  add column if not exists card_photo_url text,
  add column if not exists photo_frame jsonb default '{}'::jsonb;

alter table public.venues
  alter column media_frame drop not null;

alter table public.teams
  alter column badge_frame drop not null;

alter table public.team_members
  alter column photo_frame drop not null;

update public.venues
set
  hero_url = coalesce(hero_url, cover_url),
  card_url = coalesce(card_url, cover_url),
  marker_url = coalesce(marker_url, cover_url),
  logo_url = coalesce(logo_url, cover_url)
where cover_url is not null
  and cover_url <> '';

update public.teams
set
  badge_icon_url = coalesce(badge_icon_url, badge_url),
  badge_card_url = coalesce(badge_card_url, badge_url)
where badge_url is not null
  and badge_url <> '';

update public.team_members
set
  avatar_url = coalesce(avatar_url, photo_url),
  card_photo_url = coalesce(card_photo_url, photo_url)
where photo_url is not null
  and photo_url <> '';

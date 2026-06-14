alter table public.ad_campaigns
  add column if not exists splash_creative_scale numeric(4,2) not null default 1.00,
  add column if not exists splash_creative_animation text not null default 'stadium_bounce',
  add column if not exists splash_sound_variant text not null default 'stadium_whistle';

do $$
begin
  alter table public.ad_campaigns
    add constraint ad_campaigns_splash_creative_scale_range
    check (splash_creative_scale between 0.55 and 1.55);
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.ad_campaigns
    add constraint ad_campaigns_splash_creative_animation_check
    check (splash_creative_animation in ('none', 'soft_zoom', 'stadium_bounce', 'pulse_glow', 'slide_pan'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.ad_campaigns
    add constraint ad_campaigns_splash_sound_variant_check
    check (splash_sound_variant in ('off', 'classic_whistle', 'stadium_whistle', 'crowd_goal'));
exception
  when duplicate_object then null;
end
$$;

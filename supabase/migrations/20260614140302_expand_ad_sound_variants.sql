alter table public.ad_campaigns
  drop constraint if exists ad_campaigns_splash_sound_variant_check;

alter table public.ad_campaigns
  add constraint ad_campaigns_splash_sound_variant_check
  check (
    splash_sound_variant in (
      'off',
      'classic_whistle',
      'stadium_whistle',
      'double_whistle',
      'kickoff_hype',
      'crowd_goal',
      'final_whistle',
      'stadium_horn',
      'penalty_alert'
    )
  );

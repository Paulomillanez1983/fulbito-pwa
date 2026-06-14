alter table public.venues
  add column if not exists phone_country_iso text not null default 'AR',
  add column if not exists phone_country_code text not null default '+54',
  add column if not exists phone_national text,
  add column if not exists format_prices jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'venues_format_prices_object'
      and conrelid = 'public.venues'::regclass
  ) then
    alter table public.venues
      add constraint venues_format_prices_object
      check (jsonb_typeof(format_prices) = 'object');
  end if;
end $$;

update public.venues
set phone_national = regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')
where phone_national is null
  and coalesce(phone, '') <> '';

update public.venues v
set format_prices = coalesce((
  select jsonb_object_agg(mode_value::text, v.price_per_hour)
  from unnest(v.field_modes) as mode_value
), '{}'::jsonb)
where v.price_per_hour > 0
  and v.format_prices = '{}'::jsonb;

alter table public.venues
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6);

create index if not exists venues_coordinates_idx
  on public.venues (latitude, longitude)
  where latitude is not null and longitude is not null;

alter table public.venues
  add column if not exists gallery_urls jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'venues_gallery_urls_array'
      and conrelid = 'public.venues'::regclass
  ) then
    alter table public.venues
      add constraint venues_gallery_urls_array
      check (jsonb_typeof(gallery_urls) = 'array');
  end if;
end $$;

update public.venues
set gallery_urls = case
  when cover_url is not null and cover_url <> '' then jsonb_build_array(cover_url)
  else '[]'::jsonb
end
where gallery_urls = '[]'::jsonb;

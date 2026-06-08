create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
  safe_role public.app_role;
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'Jugador Fulbito'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  requested_role = coalesce(new.raw_user_meta_data ->> 'selected_role', 'player');
  if requested_role in ('player', 'captain', 'venue_owner', 'organizer', 'referee') then
    safe_role = requested_role::public.app_role;
  else
    safe_role = 'player'::public.app_role;
  end if;

  insert into public.user_roles (user_id, role)
  values (new.id, safe_role)
  on conflict do nothing;

  return new;
end;
$$;

drop policy if exists "users can choose allowed roles" on public.user_roles;

create policy "users can choose allowed roles"
on public.user_roles for insert
to authenticated
with check (
  user_id = auth.uid()
  and role in ('player', 'captain', 'venue_owner', 'organizer', 'referee')
);

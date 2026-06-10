create table public.billing_plan_settings (
  plan_code public.billing_plan_code primary key,
  title text not null,
  kicker text not null,
  description text not null,
  amount integer not null check (amount >= 0),
  features text[] not null default '{}',
  is_active boolean not null default true,
  sort_order integer not null default 100,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger billing_plan_settings_touch_updated_at
before update on public.billing_plan_settings
for each row execute function app_private.touch_updated_at();

alter table public.billing_plan_settings enable row level security;

create policy "public can read billing plan settings"
on public.billing_plan_settings for select
using (true);

create policy "admins can insert billing plan settings"
on public.billing_plan_settings for insert
to authenticated
with check (app_private.has_role('admin'));

create policy "admins can update billing plan settings"
on public.billing_plan_settings for update
to authenticated
using (app_private.has_role('admin'))
with check (app_private.has_role('admin'));

insert into public.billing_plan_settings (plan_code, title, kicker, description, amount, features, sort_order)
values
  ('team_pro', 'Equipo Pro', 'Identidad del club', 'Fotos, escudo premium, cartas estilo juego y estadisticas del plantel.', 5000, array['Fotos de jugadores', 'Cartas FIFA style', 'MVP y ranking'], 10),
  ('tournament_pro', 'Torneo Pro', 'Camino a la copa', 'Fixture avanzado, grupos, eliminatorias visuales y portada compartible.', 15000, array['Fixture premium', 'Llave eliminatoria', 'Portada social'], 20),
  ('sponsor', 'Sponsor local', 'Publicidad barrial', 'Marca visible dentro del torneo, fecha, MVP y piezas para compartir.', 20000, array['Banner de fecha', 'MVP presentado por', 'Logo en cards'], 30),
  ('featured_venue', 'Cancha destacada', 'Visibilidad sin comision', 'La cancha aparece destacada sin que Fulbito cobre alquileres ni reservas.', 8000, array['Mapa destacado', 'Sede partner', 'Contacto visible'], 40)
on conflict (plan_code) do update
set
  title = excluded.title,
  kicker = excluded.kicker,
  description = excluded.description,
  amount = excluded.amount,
  features = excluded.features,
  sort_order = excluded.sort_order;

drop policy if exists "organizers can create tournaments" on public.tournaments;

create policy "authenticated users can create tournaments"
on public.tournaments for insert
to authenticated
with check (organizer_id = auth.uid());

drop policy if exists "venue owners can create venues" on public.venues;

create policy "authenticated users can create venues"
on public.venues for insert
to authenticated
with check (owner_id = auth.uid());

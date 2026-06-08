insert into public.team_members (team_id, role, display_name, alias, jersey_number, position, goals)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'player', 'Tomi Medina', 'Tomi', 3, 'Defensa', 1),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'player', 'Beto Cabrera', 'Beto', 4, 'Defensa', 0),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'player', 'Rulo Alvarez', 'Rulo', 5, 'Volante', 2),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'player', 'Mati Romero', 'Mati', 7, 'Volante', 3),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'player', 'Eze Duarte', 'Eze', 11, 'Delantero', 2)
on conflict do nothing;

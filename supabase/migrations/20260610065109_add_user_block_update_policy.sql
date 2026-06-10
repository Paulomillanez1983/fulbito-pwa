create policy "admins can update user blocks"
on public.user_blocks for update
to authenticated
using (app_private.has_role('admin'))
with check (app_private.has_role('admin'));

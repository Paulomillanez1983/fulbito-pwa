create table public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocked_user_id uuid not null unique references public.profiles(id) on delete cascade,
  blocked_by uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create index on public.user_blocks(blocked_by, created_at desc);

alter table public.user_blocks enable row level security;

create policy "admins can read user blocks"
on public.user_blocks for select
to authenticated
using (app_private.has_role('admin') or blocked_user_id = auth.uid());

create policy "admins can create user blocks"
on public.user_blocks for insert
to authenticated
with check (app_private.has_role('admin') and blocked_by = auth.uid());

create policy "admins can delete user blocks"
on public.user_blocks for delete
to authenticated
using (app_private.has_role('admin'));

drop policy if exists "users can create own payment requests" on public.payment_requests;

create policy "users can create own payment requests"
on public.payment_requests for insert
to authenticated
with check (
  requester_id = auth.uid()
  and status = 'pending_review'
  and not exists (
    select 1
    from public.user_blocks ub
    where ub.blocked_user_id = auth.uid()
  )
);

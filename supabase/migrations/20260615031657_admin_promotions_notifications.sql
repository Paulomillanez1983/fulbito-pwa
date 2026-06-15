create table public.billing_promotions (
  id uuid primary key default gen_random_uuid(),
  plan_code public.billing_plan_code not null,
  title text not null,
  badge text not null default 'Promo Fulbito',
  description text,
  discount_type text not null default 'percent' check (discount_type in ('percent', 'fixed')),
  discount_value integer not null check (discount_value >= 0),
  applies_to_renewals boolean not null default true,
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index billing_promotions_plan_active_idx
on public.billing_promotions(plan_code, is_active, starts_at, ends_at);

create trigger billing_promotions_touch_updated_at
before update on public.billing_promotions
for each row execute function app_private.touch_updated_at();

alter table public.billing_promotions enable row level security;

create policy "public can read active billing promotions"
on public.billing_promotions for select
using (
  app_private.has_role('admin')
  or (
    is_active
    and starts_at <= now()
    and (ends_at is null or ends_at >= now())
  )
);

create policy "admins can insert billing promotions"
on public.billing_promotions for insert
to authenticated
with check (app_private.has_role('admin'));

create policy "admins can update billing promotions"
on public.billing_promotions for update
to authenticated
using (app_private.has_role('admin'))
with check (app_private.has_role('admin'));

create policy "admins can delete billing promotions"
on public.billing_promotions for delete
to authenticated
using (app_private.has_role('admin'));

create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  notification_type text not null default 'info',
  target_type text,
  target_id uuid,
  action_url text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'unread' check (status in ('unread', 'read', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index user_notifications_user_status_created_idx
on public.user_notifications(user_id, status, created_at desc);

create index user_notifications_target_idx
on public.user_notifications(target_type, target_id);

alter table public.user_notifications enable row level security;

create policy "users and admins can read notifications"
on public.user_notifications for select
to authenticated
using (user_id = auth.uid() or app_private.has_role('admin'));

create policy "admins can insert notifications"
on public.user_notifications for insert
to authenticated
with check (app_private.has_role('admin'));

create policy "users can update own notification status"
on public.user_notifications for update
to authenticated
using (user_id = auth.uid() or app_private.has_role('admin'))
with check (user_id = auth.uid() or app_private.has_role('admin'));

create policy "admins can delete notifications"
on public.user_notifications for delete
to authenticated
using (app_private.has_role('admin'));

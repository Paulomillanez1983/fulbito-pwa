create type public.billing_plan_code as enum (
  'team_pro',
  'tournament_pro',
  'sponsor',
  'featured_venue'
);

create type public.payment_request_status as enum (
  'pending_review',
  'approved',
  'rejected',
  'cancelled'
);

create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  plan_code public.billing_plan_code not null,
  target_type text not null check (target_type in ('team', 'tournament', 'sponsor', 'venue')),
  target_id uuid,
  title text not null,
  amount integer not null check (amount > 0),
  status public.payment_request_status not null default 'pending_review',
  proof_path text,
  proof_filename text,
  payer_note text,
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_messages (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid not null references public.payment_requests(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.account_entitlements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  plan_code public.billing_plan_code not null,
  target_type text not null check (target_type in ('team', 'tournament', 'sponsor', 'venue')),
  target_id uuid,
  source_payment_request_id uuid references public.payment_requests(id) on delete set null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, plan_code, target_type, target_id)
);

create index on public.payment_requests(requester_id, created_at desc);
create index on public.payment_requests(status, created_at desc);
create index on public.payment_messages(payment_request_id, created_at);
create index on public.account_entitlements(owner_id, plan_code);

create trigger payment_requests_touch_updated_at
before update on public.payment_requests
for each row execute function app_private.touch_updated_at();

alter table public.payment_requests enable row level security;
alter table public.payment_messages enable row level security;
alter table public.account_entitlements enable row level security;

create policy "users and admins can read payment requests"
on public.payment_requests for select
to authenticated
using (requester_id = auth.uid() or app_private.has_role('admin'));

create policy "users can create own payment requests"
on public.payment_requests for insert
to authenticated
with check (
  requester_id = auth.uid()
  and status = 'pending_review'
);

create policy "users can keep own requests pending or cancelled"
on public.payment_requests for update
to authenticated
using (
  requester_id = auth.uid()
  and status in ('pending_review', 'rejected')
)
with check (
  requester_id = auth.uid()
  and status in ('pending_review', 'cancelled')
);

create policy "admins can review payment requests"
on public.payment_requests for update
to authenticated
using (app_private.has_role('admin'))
with check (app_private.has_role('admin'));

create policy "users and admins can read payment messages"
on public.payment_messages for select
to authenticated
using (
  app_private.has_role('admin')
  or exists (
    select 1
    from public.payment_requests pr
    where pr.id = payment_request_id
      and pr.requester_id = auth.uid()
  )
);

create policy "participants can write payment messages"
on public.payment_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and (
    app_private.has_role('admin')
    or exists (
      select 1
      from public.payment_requests pr
      where pr.id = payment_request_id
        and pr.requester_id = auth.uid()
    )
  )
);

create policy "owners and admins can read entitlements"
on public.account_entitlements for select
to authenticated
using (owner_id = auth.uid() or app_private.has_role('admin'));

create policy "admins can create entitlements"
on public.account_entitlements for insert
to authenticated
with check (app_private.has_role('admin'));

create policy "admins can update entitlements"
on public.account_entitlements for update
to authenticated
using (app_private.has_role('admin'))
with check (app_private.has_role('admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create policy "owners and admins can read payment proofs"
on storage.objects for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (owner = auth.uid() or app_private.has_role('admin'))
);

create policy "authenticated can upload payment proofs"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'payment-proofs'
  and owner = auth.uid()
);

create policy "owners and admins can update payment proofs"
on storage.objects for update
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (owner = auth.uid() or app_private.has_role('admin'))
)
with check (
  bucket_id = 'payment-proofs'
  and (owner = auth.uid() or app_private.has_role('admin'))
);

create policy "owners and admins can delete payment proofs"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (owner = auth.uid() or app_private.has_role('admin'))
);

create policy "authenticated can read team pro entitlements"
on public.account_entitlements for select
to authenticated
using (
  plan_code = 'team_pro'
  and target_type = 'team'
);

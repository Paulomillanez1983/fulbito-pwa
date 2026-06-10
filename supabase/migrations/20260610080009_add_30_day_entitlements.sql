update public.account_entitlements
set expires_at = starts_at + interval '30 days'
where expires_at is null;

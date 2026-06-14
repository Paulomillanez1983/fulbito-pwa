import { AdminVenuesPanel } from "@/components/admin-venues-panel";
import { LoginPanel } from "@/components/login-panel";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AccountEntitlement, AppRole, ArenaVenue, PaymentRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

type AdminProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

type AdminVenue = ArenaVenue & {
  created_at?: string;
  updated_at?: string;
};

export default async function AdminVenuesPage() {
  const env = getSupabaseEnv();
  const supabase = await createSupabaseServerClient();

  if (!env.configured || !supabase) {
    return (
      <main className="admin-shell">
        <section className="admin-hero">
          <span>Canchas</span>
          <h1>Supabase no esta configurado</h1>
          <p>Configura las variables de entorno para administrar sedes.</p>
        </section>
      </main>
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return (
      <main className="admin-shell">
        <section className="admin-hero">
          <span>Canchas</span>
          <h1>Entrar como admin</h1>
          <p>Conecta tu cuenta de Google y despues vuelve a abrir /admin/canchas.</p>
        </section>
        <LoginPanel configured={env.configured} />
      </main>
    );
  }

  const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roles = ((rolesData ?? []).map((item) => item.role) as AppRole[]) || [];

  if (!roles.includes("admin")) {
    return (
      <main className="admin-shell">
        <header className="admin-topbar">
          <a href="/">Fulbito Arena</a>
          <span>Sin rol admin</span>
        </header>
        <section className="admin-hero">
          <span>Canchas</span>
          <h1>Esta cuenta no tiene rol admin</h1>
          <p>Para administrar canchas, agrega el rol admin a tu usuario en Supabase.</p>
        </section>
      </main>
    );
  }

  const [venuesResult, requestsResult, entitlementsResult] = await Promise.all([
    supabase.from("venues").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("payment_requests").select("*").eq("plan_code", "featured_venue").order("created_at", { ascending: false }).limit(200),
    supabase.from("account_entitlements").select("*").eq("plan_code", "featured_venue").order("created_at", { ascending: false }).limit(500)
  ]);

  const venues = (venuesResult.data ?? []) as AdminVenue[];
  const requests = (requestsResult.data ?? []) as PaymentRequest[];
  const entitlements = (entitlementsResult.data ?? []) as AccountEntitlement[];
  const profileIds = Array.from(new Set([
    ...venues.map((venue) => venue.owner_id).filter(Boolean),
    ...requests.map((request) => request.requester_id).filter(Boolean)
  ] as string[]));
  const profilesResult = profileIds.length
    ? await supabase.from("profiles").select("id,display_name,avatar_url").in("id", profileIds)
    : { data: [] };

  return (
    <AdminVenuesPanel
      adminId={user.id}
      entitlements={entitlements}
      profiles={(profilesResult.data ?? []) as AdminProfile[]}
      requests={requests}
      venues={venues}
    />
  );
}

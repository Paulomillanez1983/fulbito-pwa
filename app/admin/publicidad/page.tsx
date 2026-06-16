import { AdminAdvertisingPanel } from "@/components/admin-advertising-panel";
import { LoginPanel } from "@/components/login-panel";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AdCampaign, AdCampaignEvent, AppRole, ArenaVenue, PaymentRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

type AdminProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

type AdvertisingVenue = Pick<ArenaVenue, "id" | "name" | "neighborhood" | "address" | "phone" | "cover_url" | "logo_url" | "marker_url" | "card_url" | "hero_url" | "price_per_hour" | "status">;

export default async function AdminAdvertisingPage() {
  const env = getSupabaseEnv();
  const supabase = await createSupabaseServerClient();

  if (!env.configured || !supabase) {
    return (
      <main className="admin-shell">
        <section className="admin-hero">
          <span>Publicidad</span>
          <h1>Supabase no esta configurado</h1>
          <p>Configura las variables de entorno para administrar sponsors.</p>
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
          <span>Publicidad</span>
          <h1>Entrar como admin</h1>
          <p>Conecta tu cuenta de Google y despues vuelve a abrir /admin/publicidad.</p>
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
          <span>Publicidad</span>
          <h1>Esta cuenta no tiene rol admin</h1>
          <p>Para aprobar y publicar sponsors, agrega el rol admin a tu usuario en Supabase.</p>
        </section>
      </main>
    );
  }

  const [requestsResult, adCampaignsResult, adCampaignEventsResult, venuesResult] = await Promise.all([
    supabase.from("payment_requests").select("*").in("plan_code", ["sponsor", "featured_venue"]).order("created_at", { ascending: false }).limit(200),
    supabase.from("ad_campaigns").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false }).limit(300),
    supabase.from("ad_campaign_events").select("*").order("created_at", { ascending: false }).limit(3000),
    supabase.from("venues").select("id,name,neighborhood,address,phone,cover_url,logo_url,marker_url,card_url,hero_url,price_per_hour,status").order("created_at", { ascending: false }).limit(300)
  ]);

  const requests = (requestsResult.data ?? []) as PaymentRequest[];
  const profileIds = Array.from(new Set(requests.map((item) => item.requester_id).filter(Boolean)));
  const profilesResult = profileIds.length
    ? await supabase.from("profiles").select("id,display_name,avatar_url").in("id", profileIds)
    : { data: [] };

  return (
    <AdminAdvertisingPanel
      adminId={user.id}
      adCampaignEvents={(adCampaignEventsResult.data ?? []) as AdCampaignEvent[]}
      adCampaigns={(adCampaignsResult.data ?? []) as AdCampaign[]}
      profiles={(profilesResult.data ?? []) as AdminProfile[]}
      requests={requests}
      venues={(venuesResult.data ?? []) as AdvertisingVenue[]}
    />
  );
}

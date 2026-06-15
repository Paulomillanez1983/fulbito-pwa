import { AdminPricingPanel } from "@/components/admin-pricing-panel";
import { LoginPanel } from "@/components/login-panel";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole, BillingPlanSetting, BillingPromotion } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const env = getSupabaseEnv();
  const supabase = await createSupabaseServerClient();

  if (!env.configured || !supabase) {
    return (
      <main className="admin-shell">
        <section className="admin-hero">
          <span>Precios</span>
          <h1>Supabase no esta configurado</h1>
          <p>Configura las variables de entorno para administrar precios y promociones.</p>
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
          <span>Precios</span>
          <h1>Entrar como admin</h1>
          <p>Conecta tu cuenta de Google y despues vuelve a abrir /admin/precios.</p>
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
          <span>Precios</span>
          <h1>Esta cuenta no tiene rol admin</h1>
          <p>Para administrar precios y campanias, agrega el rol admin a tu usuario en Supabase.</p>
        </section>
      </main>
    );
  }

  const [plansResult, promotionsResult] = await Promise.all([
    supabase.from("billing_plan_settings").select("*").order("sort_order", { ascending: true }),
    supabase.from("billing_promotions").select("*").order("created_at", { ascending: false }).limit(200)
  ]);

  return (
    <AdminPricingPanel
      adminId={user.id}
      initialPlans={(plansResult.data ?? []) as BillingPlanSetting[]}
      initialPromotions={(promotionsResult.data ?? []) as BillingPromotion[]}
    />
  );
}

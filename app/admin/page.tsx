import { AdminPaymentsPanel } from "@/components/admin-payments-panel";
import { LoginPanel } from "@/components/login-panel";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole, PaymentMessage, PaymentRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

type AdminProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

export default async function AdminPage() {
  const env = getSupabaseEnv();
  const supabase = await createSupabaseServerClient();

  if (!env.configured || !supabase) {
    return (
      <main className="admin-shell">
        <section className="admin-hero">
          <span>Panel administrador</span>
          <h1>Supabase no esta configurado</h1>
          <p>Configura las variables de entorno para revisar pagos manuales.</p>
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
          <span>Panel administrador</span>
          <h1>Entrar como admin</h1>
          <p>Conecta tu cuenta de Google y despues vuelve a abrir /admin.</p>
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
          <span>Panel administrador</span>
          <h1>Esta cuenta no tiene rol admin</h1>
          <p>Para aprobar comprobantes, agrega el rol admin a tu usuario en Supabase.</p>
        </section>
      </main>
    );
  }

  const [requestsResult, messagesResult] = await Promise.all([
    supabase.from("payment_requests").select("*").order("created_at", { ascending: false }).limit(80),
    supabase.from("payment_messages").select("*").order("created_at", { ascending: true }).limit(300)
  ]);

  const requests = (requestsResult.data ?? []) as PaymentRequest[];
  const messages = (messagesResult.data ?? []) as PaymentMessage[];
  const profileIds = Array.from(new Set([...requests.map((item) => item.requester_id), ...messages.map((item) => item.sender_id)]));
  const profilesResult = profileIds.length
    ? await supabase.from("profiles").select("id,display_name,avatar_url").in("id", profileIds)
    : { data: [] };

  return (
    <AdminPaymentsPanel
      adminId={user.id}
      messages={messages}
      profiles={(profilesResult.data ?? []) as AdminProfile[]}
      requests={requests}
      roles={roles}
    />
  );
}

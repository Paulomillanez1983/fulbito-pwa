import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import type { AccountEntitlement } from "@/lib/types";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, userId: "", error: NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 }) };

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { supabase, userId: "", error: NextResponse.json({ error: "Entra con Google." }, { status: 401 }) };

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!role) return { supabase, userId: auth.user.id, error: NextResponse.json({ error: "Esta cuenta no tiene rol admin." }, { status: 403 }) };
  return { supabase, userId: auth.user.id, error: null };
}

function entitlementName(entitlement: AccountEntitlement) {
  if (entitlement.plan_code === "tournament_pro") return "Torneo Pro";
  if (entitlement.plan_code === "team_pro") return "Equipo Pro";
  if (entitlement.plan_code === "featured_venue") return "Cancha Pro";
  return "Sponsor local";
}

function notificationKey(type: string, entitlementId: string) {
  return `${type}:${entitlementId}`;
}

type NotificationInsert = {
  user_id: string;
  title: string;
  body: string;
  notification_type: string;
  target_type: string;
  target_id: string;
  priority: string;
  created_by: string | null;
  metadata: {
    plan_code: AccountEntitlement["plan_code"];
    target_type: AccountEntitlement["target_type"];
    target_id: string | null;
    expires_at: string | null;
  };
};

function isNotificationInsert(row: NotificationInsert | null): row is NotificationInsert {
  return Boolean(row);
}

export async function POST() {
  const { supabase, userId, error } = await requireAdmin();
  if (error || !supabase) return error;

  const result = await generateRenewalNotifications(supabase, userId);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!expected) return NextResponse.json({ error: "CRON_SECRET no esta configurado." }, { status: 503 });
  if (authHeader !== `Bearer ${expected}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY no esta configurado." }, { status: 503 });

  const result = await generateRenewalNotifications(supabase, null);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}

async function generateRenewalNotifications(supabase: SupabaseClient, userId: string | null) {
  const now = new Date();
  const inThreeDays = new Date(now.getTime() + 3 * 86400000);
  const expiredSince = new Date(now.getTime() - 30 * 86400000);
  const duplicateWindow = new Date(now.getTime() - 2 * 86400000).toISOString();

  const { data: entitlementsData, error: entitlementsError } = await supabase
    .from("account_entitlements")
    .select("*")
    .not("expires_at", "is", null)
    .gte("expires_at", expiredSince.toISOString())
    .lte("expires_at", inThreeDays.toISOString())
    .limit(2000);
  if (entitlementsError) return { error: entitlementsError.message };

  const entitlements = (entitlementsData ?? []) as AccountEntitlement[];
  const { data: existingData, error: existingError } = await supabase
    .from("user_notifications")
    .select("notification_type,target_id,user_id,created_at")
    .in("notification_type", ["renewal_expiring", "renewal_expired"])
    .gte("created_at", duplicateWindow)
    .limit(4000);
  if (existingError) return { error: existingError.message };

  const existingKeys = new Set((existingData ?? []).map((item) => notificationKey(item.notification_type, String(item.target_id))));
  const rows = entitlements
    .map((entitlement) => {
      const expiresAt = entitlement.expires_at ? new Date(entitlement.expires_at).getTime() : null;
      if (!expiresAt || !Number.isFinite(expiresAt)) return null;
      const type = expiresAt >= now.getTime() ? "renewal_expiring" : "renewal_expired";
      if (existingKeys.has(notificationKey(type, entitlement.id))) return null;
      const name = entitlementName(entitlement);
      if (type === "renewal_expiring") {
        const days = Math.max(1, Math.ceil((expiresAt - now.getTime()) / 86400000));
        return {
          user_id: entitlement.owner_id,
          title: `${name} vence en ${days} dia${days === 1 ? "" : "s"}`,
          body: "Tu membresia mensual esta por terminar. Podes renovar con las promociones activas antes de que se pausen los beneficios Pro.",
          notification_type: type,
          target_type: "entitlement",
          target_id: entitlement.id,
          priority: "high",
          created_by: userId,
          metadata: {
            plan_code: entitlement.plan_code,
            target_type: entitlement.target_type,
            target_id: entitlement.target_id,
            expires_at: entitlement.expires_at
          }
        };
      }
      return {
        user_id: entitlement.owner_id,
        title: `${name} quedo pausado`,
        body: "No se recibio el pago de renovacion. Tus datos no se borran, pero fotos, cartas, publicidad y funciones Pro quedan bloqueadas hasta renovar.",
        notification_type: type,
        target_type: "entitlement",
        target_id: entitlement.id,
        priority: "high",
        created_by: userId,
        metadata: {
          plan_code: entitlement.plan_code,
          target_type: entitlement.target_type,
          target_id: entitlement.target_id,
          expires_at: entitlement.expires_at
        }
      };
    })
    .filter(isNotificationInsert);

  if (rows.length) {
    const { error: insertError } = await supabase.from("user_notifications").insert(rows);
    if (insertError) return { error: insertError.message };
  }

  return {
    expiring: rows.filter((row) => row && row.notification_type === "renewal_expiring").length,
    expired: rows.filter((row) => row && row.notification_type === "renewal_expired").length
  };
}

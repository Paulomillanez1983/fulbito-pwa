import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AccountEntitlement, PaymentMessage, PaymentRequest } from "@/lib/types";

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

export async function POST(request: NextRequest) {
  const { supabase, userId, error } = await requireAdmin();
  if (error || !supabase) return error;

  const body = await request.json();
  const requestId = String(body.requestId || "").trim();
  const status = String(body.status || "").trim();
  const note = String(body.note || "").trim();

  if (!requestId) return NextResponse.json({ error: "Falta la solicitud." }, { status: 400 });
  if (status !== "approved" && status !== "rejected") return NextResponse.json({ error: "Estado invalido." }, { status: 400 });

  const { data: existing, error: existingError } = await supabase
    .from("payment_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 400 });
  if (!existing) return NextResponse.json({ error: "No se encontro el comprobante." }, { status: 404 });

  const { data: reviewed, error: reviewError } = await supabase
    .from("payment_requests")
    .update({
      status,
      admin_note: note || (status === "approved" ? "Comprobante validado." : "Comprobante no validado."),
      reviewed_by: userId,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", requestId)
    .select()
    .single();

  if (reviewError) return NextResponse.json({ error: reviewError.message }, { status: 400 });

  if (status === "approved") {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const entitlement: Omit<AccountEntitlement, "id" | "starts_at" | "created_at"> = {
      owner_id: existing.requester_id,
      plan_code: existing.plan_code,
      target_type: existing.target_type,
      target_id: existing.target_id,
      source_payment_request_id: existing.id,
      expires_at: expiresAt
    };
    const { error: entitlementError } = await supabase.from("account_entitlements").upsert(entitlement, {
      onConflict: "owner_id,plan_code,target_type,target_id"
    });
    if (entitlementError) return NextResponse.json({ error: entitlementError.message }, { status: 400 });

    if (existing.plan_code === "tournament_pro" && existing.target_type === "tournament" && existing.target_id) {
      const { error: livePermissionError } = await supabase
        .from("live_stream_permissions")
        .upsert({
          user_id: existing.requester_id,
          tournament_id: existing.target_id,
          can_use_external_link: true,
          can_use_official_auto: true,
          max_streams_per_day: 3,
          max_streams_per_week: 12,
          allowed_stream_types: ["match", "final", "draw"],
          status: "active",
          enabled_by_user_id: userId
        }, { onConflict: "user_id,tournament_id" });
      if (livePermissionError) return NextResponse.json({ error: livePermissionError.message }, { status: 400 });
    }

    if (existing.plan_code === "featured_venue" && existing.target_type === "venue" && existing.target_id) {
      const { error: venueError } = await supabase
        .from("venues")
        .update({ status: "verified" })
        .eq("id", existing.target_id);
      if (venueError) return NextResponse.json({ error: venueError.message }, { status: 400 });
    }
  }

  const messageBody = status === "approved"
    ? "Comprobante aprobado. Tu beneficio premium ya esta activo."
    : `Comprobante rechazado: ${note || "necesitamos revisar el archivo."}`;
  const { data: message, error: messageError } = await supabase
    .from("payment_messages")
    .insert({
      payment_request_id: requestId,
      sender_id: userId,
      body: messageBody
    })
    .select()
    .single();

  if (messageError) return NextResponse.json({ error: messageError.message }, { status: 400 });

  return NextResponse.json({
    request: reviewed as PaymentRequest,
    message: message as PaymentMessage
  });
}

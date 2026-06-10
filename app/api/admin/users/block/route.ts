import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PaymentMessage, PaymentRequest, UserBlock } from "@/lib/types";

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
  const blockedUserId = String(body.userId || "").trim();
  const action = String(body.action || "block").trim();
  const reason = String(body.reason || "Comprobantes invalidos o abuso de solicitudes.").trim();

  if (!blockedUserId) return NextResponse.json({ error: "Falta el usuario." }, { status: 400 });
  if (blockedUserId === userId) return NextResponse.json({ error: "No podes bloquear tu propia cuenta admin." }, { status: 400 });

  if (action === "unblock") {
    const { error: deleteError } = await supabase.from("user_blocks").delete().eq("blocked_user_id", blockedUserId);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });
    return NextResponse.json({ block: null, requests: [], messages: [] });
  }

  const { data: block, error: blockError } = await supabase
    .from("user_blocks")
    .upsert({
      blocked_user_id: blockedUserId,
      blocked_by: userId,
      reason
    }, { onConflict: "blocked_user_id" })
    .select()
    .single();

  if (blockError) return NextResponse.json({ error: blockError.message }, { status: 400 });

  const { data: cancellableRequests, error: listError } = await supabase
    .from("payment_requests")
    .select("*")
    .eq("requester_id", blockedUserId)
    .in("status", ["pending_review", "rejected"]);

  if (listError) return NextResponse.json({ error: listError.message }, { status: 400 });

  const requestIds = ((cancellableRequests ?? []) as PaymentRequest[]).map((item) => item.id);
  let cancelledRequests: PaymentRequest[] = [];
  let messages: PaymentMessage[] = [];

  if (requestIds.length) {
    const { data: updated, error: updateError } = await supabase
      .from("payment_requests")
      .update({
        status: "cancelled",
        admin_note: reason,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString()
      })
      .in("id", requestIds)
      .select();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    cancelledRequests = (updated ?? []) as PaymentRequest[];

    const { data: insertedMessages, error: messageError } = await supabase
      .from("payment_messages")
      .insert(requestIds.map((paymentRequestId) => ({
        payment_request_id: paymentRequestId,
        sender_id: userId,
        body: `Cuenta bloqueada para nuevos comprobantes: ${reason}`
      })))
      .select();

    if (messageError) return NextResponse.json({ error: messageError.message }, { status: 400 });
    messages = (insertedMessages ?? []) as PaymentMessage[];
  }

  return NextResponse.json({
    block: block as UserBlock,
    requests: cancelledRequests,
    messages
  });
}

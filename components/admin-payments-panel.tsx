"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, Clock3, ExternalLink, LoaderCircle, MessageCircle, Send, XCircle } from "lucide-react";
import { formatPaymentMoney, mergePaymentPlans, paymentStatusMeta } from "@/lib/payments";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AccountEntitlement, AppRole, BillingPlanSetting, PaymentMessage, PaymentRequest } from "@/lib/types";

const statusIcons: Record<PaymentRequest["status"], typeof Clock3> = {
  pending_review: Clock3,
  approved: CheckCircle2,
  rejected: XCircle,
  cancelled: XCircle
};

type AdminProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function Requester({ profile }: { profile?: AdminProfile }) {
  return (
    <div className="admin-requester">
      {profile?.avatar_url ? <img alt="" src={profile.avatar_url} /> : <span>{profile?.display_name?.[0] ?? "F"}</span>}
      <div>
        <strong>{profile?.display_name ?? "Usuario Fulbito"}</strong>
        <small>Solicitante</small>
      </div>
    </div>
  );
}

function AdminPlanPrices({
  adminId,
  initialPlans
}: {
  adminId: string;
  initialPlans: BillingPlanSetting[];
}) {
  const [settings, setSettings] = useState(initialPlans);
  const [busyCode, setBusyCode] = useState("");
  const [notice, setNotice] = useState("");
  const plans = mergePaymentPlans(settings);

  async function submit(event: FormEvent<HTMLFormElement>, planCode: BillingPlanSetting["plan_code"]) {
    event.preventDefault();
    setNotice("");
    setBusyCode(planCode);
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount") || 0);
    const plan = plans.find((item) => item.code === planCode);
    if (!plan) {
      setNotice("No se encontro el plan.");
      setBusyCode("");
      return;
    }
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("billing_plan_settings")
        .upsert({
          plan_code: plan.code,
          title: plan.title,
          kicker: plan.kicker,
          description: plan.description,
          amount: Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : plan.amount,
          features: plan.features,
          is_active: true,
          updated_by: adminId
        }, { onConflict: "plan_code" })
        .select()
        .single();
      if (error) throw error;
      setSettings((current) => {
        const next = data as BillingPlanSetting;
        const exists = current.some((item) => item.plan_code === next.plan_code);
        return exists ? current.map((item) => item.plan_code === next.plan_code ? next : item) : [...current, next];
      });
      setNotice("Precio actualizado.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo actualizar el precio.");
    } finally {
      setBusyCode("");
    }
  }

  return (
    <section className="admin-plan-prices">
      <header>
        <span>Precios Pro</span>
        <h2>Modificar valores</h2>
        <p>Estos importes se reflejan en el onboarding de usuarios sin tocar codigo.</p>
      </header>
      <div>
        {plans.map((plan) => (
          <form key={plan.code} onSubmit={(event) => submit(event, plan.code)}>
            <div>
              <strong>{plan.title}</strong>
              <small>{plan.kicker}</small>
            </div>
            <input defaultValue={plan.amount} inputMode="numeric" name="amount" />
            <button disabled={busyCode === plan.code} type="submit">
              {busyCode === plan.code ? <LoaderCircle className="button-spinner" size={16} /> : null}
              Guardar precio
            </button>
          </form>
        ))}
      </div>
      {notice ? <p>{notice}</p> : null}
    </section>
  );
}

export function AdminPaymentsPanel({
  adminId,
  requests: initialRequests,
  messages: initialMessages,
  profiles,
  billingPlans,
  roles
}: {
  adminId: string;
  requests: PaymentRequest[];
  messages: PaymentMessage[];
  profiles: AdminProfile[];
  billingPlans: BillingPlanSetting[];
  roles: AppRole[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [messages, setMessages] = useState(initialMessages);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  const profileMap = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.id, profile]));
  }, [profiles]);

  const messagesByRequest = useMemo(() => {
    return messages.reduce<Record<string, PaymentMessage[]>>((groups, item) => {
      groups[item.payment_request_id] = groups[item.payment_request_id] ?? [];
      groups[item.payment_request_id].push(item);
      return groups;
    }, {});
  }, [messages]);

  function replaceRequest(next: PaymentRequest) {
    setRequests((current) => current.map((item) => item.id === next.id ? next : item));
  }

  function addMessage(message: PaymentMessage) {
    setMessages((current) => [...current, message]);
  }

  async function openProof(request: PaymentRequest) {
    setNotice("");
    if (!request.proof_path) {
      setNotice("Esta solicitud no tiene comprobante adjunto.");
      return;
    }
    setBusyId(request.id);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(request.proof_path, 600);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo abrir el comprobante.");
    } finally {
      setBusyId("");
    }
  }

  async function sendAdminMessage(requestId: string, body: string) {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("payment_messages")
      .insert({
        payment_request_id: requestId,
        sender_id: adminId,
        body
      })
      .select()
      .single();
    if (error) throw error;
    addMessage(data as PaymentMessage);
  }

  async function reviewRequest(request: PaymentRequest, status: "approved" | "rejected", note: string) {
    setNotice("");
    setBusyId(request.id);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("payment_requests")
        .update({
          status,
          admin_note: note,
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString()
        })
        .eq("id", request.id)
        .select()
        .single();
      if (error) throw error;

      if (status === "approved") {
        const entitlement: Omit<AccountEntitlement, "id" | "starts_at" | "created_at"> = {
          owner_id: request.requester_id,
          plan_code: request.plan_code,
          target_type: request.target_type,
          target_id: request.target_id,
          source_payment_request_id: request.id,
          expires_at: null
        };
        const { error: entitlementError } = await supabase.from("account_entitlements").upsert(entitlement, {
          onConflict: "owner_id,plan_code,target_type,target_id"
        });
        if (entitlementError) throw entitlementError;
      }

      replaceRequest(data as PaymentRequest);
      await sendAdminMessage(request.id, status === "approved" ? "Pago aprobado. Beneficio Pro activado." : `Pago rechazado: ${note || "necesitamos revisar el comprobante."}`);
      setNotice(status === "approved" ? "Pago aprobado y Pro activado." : "Pago rechazado y usuario notificado.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo revisar la solicitud.");
    } finally {
      setBusyId("");
    }
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>, requestId: string) {
    event.preventDefault();
    setNotice("");
    const form = new FormData(event.currentTarget);
    const body = String(form.get("body") || "").trim();
    if (!body) return;
    setBusyId(requestId);
    try {
      await sendAdminMessage(requestId, body);
      event.currentTarget.reset();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo enviar el mensaje.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <a href="/">Fulbito Arena</a>
        <span>{roles.includes("admin") ? "Admin activo" : "Sin rol admin"}</span>
      </header>

      <section className="admin-hero">
        <span>Panel administrador</span>
        <h1>Comprobantes y activaciones Pro</h1>
        <p>Revisa pagos manuales, responde el chat interno y activa beneficios sin cobrar alquileres de canchas.</p>
      </section>

      <section className="admin-stats">
        <article><strong>{requests.filter((item) => item.status === "pending_review").length}</strong><span>Pendientes</span></article>
        <article><strong>{requests.filter((item) => item.status === "approved").length}</strong><span>Aprobados</span></article>
        <article><strong>{formatPaymentMoney(requests.reduce((total, item) => item.status === "approved" ? total + item.amount : total, 0))}</strong><span>Activado</span></article>
      </section>

      <AdminPlanPrices adminId={adminId} initialPlans={billingPlans} />

      {notice ? <p className="admin-notice">{notice}</p> : null}

      <section className="admin-payment-list">
        {requests.length ? requests.map((request) => {
          const meta = paymentStatusMeta[request.status];
          const StatusIcon = statusIcons[request.status];
          const requestMessages = messagesByRequest[request.id] ?? [];
          const requester = profileMap.get(request.requester_id);
          const busy = busyId === request.id;
          return (
            <article className="admin-payment-card" key={request.id}>
              <header>
                <Requester profile={requester} />
                <b className={`payment-status payment-status--${meta.tone}`}>
                  <StatusIcon size={15} />
                  {meta.label}
                </b>
              </header>
              <div className="admin-payment-card__body">
                <div>
                  <span>{request.plan_code.replaceAll("_", " ").toUpperCase()}</span>
                  <h2>{request.title}</h2>
                  <strong>{formatPaymentMoney(request.amount)}</strong>
                  <small>{formatDate(request.created_at)} / {request.proof_filename ?? "sin archivo"}</small>
                  {request.payer_note ? <p>{request.payer_note}</p> : null}
                </div>
                <button disabled={busy} onClick={() => openProof(request)} type="button">
                  {busy ? <LoaderCircle className="button-spinner" size={17} /> : <ExternalLink size={17} />}
                  Ver comprobante
                </button>
              </div>

              <div className="admin-review-actions">
                <button disabled={busy || request.status === "approved"} onClick={() => reviewRequest(request, "approved", "Comprobante validado.")} type="button">
                  <CheckCircle2 size={17} />
                  Aprobar Pro
                </button>
                <button disabled={busy || request.status === "rejected"} onClick={() => reviewRequest(request, "rejected", "Comprobante no validado. Envia uno nuevo o aclara el pago.")} type="button">
                  <XCircle size={17} />
                  Rechazar
                </button>
              </div>

              <section className="admin-chat">
                <header>
                  <MessageCircle size={17} />
                  <strong>Chat interno</strong>
                </header>
                <div>
                  {requestMessages.length ? requestMessages.map((message) => (
                    <p className={message.sender_id === adminId ? "is-admin" : ""} key={message.id}>
                      <span>{message.body}</span>
                      <small>{formatDate(message.created_at)}</small>
                    </p>
                  )) : <p><span>Sin mensajes.</span></p>}
                </div>
                <form onSubmit={(event) => submitMessage(event, request.id)}>
                  <input name="body" placeholder="Responder al usuario" />
                  <button disabled={busy} type="submit" aria-label="Enviar respuesta">
                    {busy ? <LoaderCircle className="button-spinner" size={16} /> : <Send size={16} />}
                  </button>
                </form>
              </section>
            </article>
          );
        }) : (
          <article className="admin-empty">
            <Clock3 size={24} />
            <strong>No hay comprobantes todavia.</strong>
            <span>Cuando un usuario envie un pago desde Fulbito Pro, aparece aca.</span>
          </article>
        )}
      </section>
    </main>
  );
}

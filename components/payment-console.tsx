"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, Clipboard, Clock3, Crown, LoaderCircle, MessageCircle, Send, Sparkles, Upload, XCircle } from "lucide-react";
import { LoginPanel } from "@/components/login-panel";
import { formatPaymentMoney, paymentAccount, paymentPlans, paymentStatusMeta } from "@/lib/payments";
import type { PaymentPlan } from "@/lib/payments";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ArenaData, PaymentMessage, PaymentRequest } from "@/lib/types";

const statusIcons: Record<PaymentRequest["status"], typeof Clock3> = {
  pending_review: Clock3,
  approved: CheckCircle2,
  rejected: XCircle,
  cancelled: XCircle
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

async function optimizeProofFile(file: File) {
  if (file.type === "application/pdf" || !file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.8));
  if (!blob) return file;
  const filename = file.name.replace(/\.[^.]+$/, "") || "comprobante";
  return new File([blob], `${filename}.webp`, { type: "image/webp" });
}

function getTargetOptions(plan: PaymentPlan, data: ArenaData) {
  if (plan.targetType === "team") {
    return data.teams.map((team) => ({ id: team.id, label: team.name }));
  }
  if (plan.targetType === "tournament") {
    return data.activeTournament ? [{ id: data.activeTournament.id, label: data.activeTournament.name }] : [];
  }
  if (plan.targetType === "venue") {
    return data.venues.map((venue) => ({ id: venue.id, label: venue.name }));
  }
  return [];
}

function PlanPaymentForm({
  plan,
  data,
  onCreated
}: {
  plan: PaymentPlan;
  data: ArenaData;
  onCreated: (request: PaymentRequest, message?: PaymentMessage) => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const targetOptions = getTargetOptions(plan, data);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!data.user) {
      setMessage("Primero entra con Google.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const proof = form.get("proofFile");
    if (!(proof instanceof File) || proof.size === 0) {
      setMessage("Adjunta el comprobante de transferencia.");
      return;
    }

    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const optimizedProof = await optimizeProofFile(proof);
      const extension = optimizedProof.type === "application/pdf" ? "pdf" : optimizedProof.type === "image/webp" ? "webp" : optimizedProof.name.split(".").pop()?.toLowerCase() || "jpg";
      const proofPath = `${data.user.id}/${Date.now().toString(36)}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(proofPath, optimizedProof, {
        cacheControl: "3600",
        contentType: optimizedProof.type || undefined,
        upsert: false
      });
      if (uploadError) throw uploadError;

      const note = String(form.get("payerNote") || "").trim();
      const targetId = String(form.get("targetId") || "").trim() || null;
      const { data: createdRequest, error: requestError } = await supabase
        .from("payment_requests")
        .insert({
          requester_id: data.user.id,
          plan_code: plan.code,
          target_type: plan.targetType,
          target_id: targetId,
          title: plan.title,
          amount: plan.amount,
          proof_path: proofPath,
          proof_filename: proof.name,
          payer_note: note || null
        })
        .select()
        .single();
      if (requestError) throw requestError;

      let createdMessage: PaymentMessage | undefined;
      const { data: messageData, error: messageError } = await supabase
        .from("payment_messages")
        .insert({
          payment_request_id: createdRequest.id,
          sender_id: data.user.id,
          body: note || `Comprobante enviado para ${plan.title}.`
        })
        .select()
        .single();
      if (messageError) throw messageError;
      createdMessage = messageData as PaymentMessage;

      onCreated(createdRequest as PaymentRequest, createdMessage);
      event.currentTarget.reset();
      setMessage("Comprobante enviado. Queda pendiente de aprobacion.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo enviar el comprobante.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="plan-payment-form" onSubmit={submit}>
      {targetOptions.length ? (
        <select name="targetId" defaultValue={targetOptions[0]?.id}>
          {targetOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      ) : null}
      <input name="payerNote" placeholder="Nota para admin: importe, nombre, alias o sponsor" />
      <label className="proof-upload">
        <Upload size={17} />
        <span>Adjuntar comprobante</span>
        <input accept="image/png,image/jpeg,image/webp,application/pdf" name="proofFile" type="file" />
      </label>
      <button disabled={pending} type="submit">
        {pending ? <LoaderCircle className="button-spinner" size={17} /> : <Send size={17} />}
        {pending ? "Enviando" : "Enviar comprobante"}
      </button>
      {message ? <small>{message}</small> : null}
    </form>
  );
}

function PaymentThread({
  request,
  messages,
  userId,
  onMessage
}: {
  request: PaymentRequest;
  messages: PaymentMessage[];
  userId: string;
  onMessage: (message: PaymentMessage) => void;
}) {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const meta = paymentStatusMeta[request.status];
  const StatusIcon = statusIcons[request.status];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    const form = new FormData(event.currentTarget);
    const body = String(form.get("body") || "").trim();
    if (!body) return;
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("payment_messages")
        .insert({
          payment_request_id: request.id,
          sender_id: userId,
          body
        })
        .select()
        .single();
      if (error) throw error;
      onMessage(data as PaymentMessage);
      event.currentTarget.reset();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo enviar el mensaje.");
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="payment-thread">
      <header>
        <div>
          <strong>{request.title}</strong>
          <span>{formatPaymentMoney(request.amount)} / {formatDate(request.created_at)}</span>
        </div>
        <b className={`payment-status payment-status--${meta.tone}`}>
          <StatusIcon size={15} />
          {meta.label}
        </b>
      </header>
      {request.proof_filename ? <small>Comprobante: {request.proof_filename}</small> : null}
      <div className="payment-thread__messages">
        {messages.length ? messages.map((item) => (
          <p className={item.sender_id === userId ? "is-mine" : ""} key={item.id}>
            <span>{item.body}</span>
            <small>{formatDate(item.created_at)}</small>
          </p>
        )) : <p><span>Sin mensajes todavia.</span></p>}
      </div>
      <form onSubmit={submit}>
        <input name="body" placeholder="Escribir mensaje al admin" />
        <button disabled={pending} type="submit" aria-label="Enviar mensaje">
          {pending ? <LoaderCircle className="button-spinner" size={16} /> : <Send size={16} />}
        </button>
      </form>
      {request.admin_note ? <small>Admin: {request.admin_note}</small> : null}
      {notice ? <small>{notice}</small> : null}
    </article>
  );
}

export function PaymentConsole({ data }: { data: ArenaData }) {
  const [requests, setRequests] = useState(data.paymentRequests);
  const [messages, setMessages] = useState(data.paymentMessages);
  const [copied, setCopied] = useState("");
  const hasApprovedPro = data.entitlements.length > 0 || requests.some((request) => request.status === "approved");

  const messagesByRequest = useMemo(() => {
    return messages.reduce<Record<string, PaymentMessage[]>>((groups, item) => {
      groups[item.payment_request_id] = groups[item.payment_request_id] ?? [];
      groups[item.payment_request_id].push(item);
      return groups;
    }, {});
  }, [messages]);

  function onCreated(request: PaymentRequest, message?: PaymentMessage) {
    setRequests((current) => [request, ...current]);
    if (message) setMessages((current) => [...current, message]);
  }

  function onMessage(message: PaymentMessage) {
    setMessages((current) => [...current, message]);
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(`${label} copiado`);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("No se pudo copiar");
    }
  }

  return (
    <section className="console-panel payment-console" id="pro">
      <div className="payment-console__head">
        <span>Fulbito Pro</span>
        <h2>Pagos manuales sin tocar plata de canchas</h2>
        <p>Transferis a Fulbito, envias el comprobante y el admin activa el beneficio. La cancha sigue cobrando alquileres por fuera.</p>
      </div>

      <div className="payment-account">
        <article>
          <Crown size={20} />
          <div>
            <strong>Cuenta de cobro Fulbito</strong>
            <span>Usar solo para servicios digitales de la app.</span>
          </div>
        </article>
        <button onClick={() => copyValue(paymentAccount.alias, "Alias")} type="button">
          <span>Alias</span>
          <strong>{paymentAccount.alias}</strong>
          <Clipboard size={16} />
        </button>
        <button onClick={() => copyValue(paymentAccount.cvu, "CVU")} type="button">
          <span>CVU</span>
          <strong>{paymentAccount.cvu}</strong>
          <Clipboard size={16} />
        </button>
        {copied ? <small>{copied}</small> : null}
      </div>

      {hasApprovedPro ? (
        <div className="pro-active-banner">
          <CheckCircle2 size={20} />
          <span>Tenes beneficios Pro activos en esta cuenta.</span>
        </div>
      ) : null}

      <div className="payment-plan-grid">
        {paymentPlans.map((plan) => (
          <article className="payment-plan-card" key={plan.code}>
            <div>
              <Sparkles size={18} />
              <span>{plan.kicker}</span>
            </div>
            <h3>{plan.title}</h3>
            <strong>{formatPaymentMoney(plan.amount)}</strong>
            <p>{plan.description}</p>
            <ul>
              {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            {data.user ? (
              <PlanPaymentForm data={data} onCreated={onCreated} plan={plan} />
            ) : (
              <div className="payment-login-box">
                <span>Entra con Google para enviar comprobante.</span>
              </div>
            )}
          </article>
        ))}
      </div>

      {data.user ? (
        <section className="payment-inbox">
          <header>
            <MessageCircle size={18} />
            <div>
              <strong>Chat con administracion</strong>
              <span>Seguimiento de comprobantes y activaciones.</span>
            </div>
          </header>
          {requests.length ? requests.map((request) => (
            <PaymentThread
              key={request.id}
              messages={messagesByRequest[request.id] ?? []}
              onMessage={onMessage}
              request={request}
              userId={data.user!.id}
            />
          )) : <p className="empty-payment-state">Todavia no enviaste comprobantes.</p>}
        </section>
      ) : (
        <LoginPanel configured={data.configured} />
      )}
    </section>
  );
}

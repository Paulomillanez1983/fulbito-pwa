"use client";

import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, Clipboard, Clock3, Crown, LoaderCircle, MessageCircle, Send, Sparkles, Upload, XCircle } from "lucide-react";
import { SlideSubmitButton } from "@/components/slide-submit-button";
import { formatPaymentMoney, mergePaymentPlans, paymentAccount, paymentStatusMeta } from "@/lib/payments";
import type { PaymentPlan, PaymentTargetType } from "@/lib/payments";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ArenaData, FieldMode, PaymentMessage, PaymentRequest, TournamentFormat } from "@/lib/types";

const statusIcons: Record<PaymentRequest["status"], typeof Clock3> = {
  pending_review: Clock3,
  approved: CheckCircle2,
  rejected: XCircle,
  cancelled: XCircle
};

const tournamentFormatOptions: Array<{ value: TournamentFormat; label: string; note: string }> = [
  { value: "world_cup", label: "Grupos + eliminatorias", note: "Ideal para Mundial barrial" },
  { value: "knockout", label: "Eliminacion directa", note: "Llave rapida hasta la final" },
  { value: "league", label: "Todos contra todos", note: "Tabla larga por puntos" }
];

const tournamentFormatLabels: Record<TournamentFormat, string> = {
  league: "Todos contra todos",
  world_cup: "Grupos + eliminatorias",
  knockout: "Eliminacion directa"
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

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

async function uploadProof(userId: string, fileValue: FormDataEntryValue | null) {
  if (!(fileValue instanceof File) || fileValue.size === 0) throw new Error("Adjunta el comprobante de transferencia.");
  const supabase = createSupabaseBrowserClient();
  const optimizedProof = await optimizeProofFile(fileValue);
  const extension = optimizedProof.type === "application/pdf" ? "pdf" : optimizedProof.type === "image/webp" ? "webp" : optimizedProof.name.split(".").pop()?.toLowerCase() || "jpg";
  const proofPath = `${userId}/${Date.now().toString(36)}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("payment-proofs").upload(proofPath, optimizedProof, {
    cacheControl: "3600",
    contentType: optimizedProof.type || undefined,
    upsert: false
  });
  if (error) throw error;
  return { proofPath, proofFilename: fileValue.name };
}

async function createPaymentRequest({
  userId,
  plan,
  targetType,
  targetId,
  title,
  note,
  proofFile
}: {
  userId: string;
  plan: PaymentPlan;
  targetType: PaymentTargetType;
  targetId: string | null;
  title: string;
  note: string;
  proofFile: FormDataEntryValue | null;
}) {
  const supabase = createSupabaseBrowserClient();
  const { data: existingRequest, error: existingError } = await supabase
    .from("payment_requests")
    .select("id")
    .eq("requester_id", userId)
    .eq("plan_code", plan.code)
    .eq("status", "pending_review")
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existingRequest) throw new Error("Ya tenes un comprobante pendiente para este plan. Espera la revision del admin.");

  const proof = await uploadProof(userId, proofFile);
  const { data: request, error: requestError } = await supabase
    .from("payment_requests")
    .insert({
      requester_id: userId,
      plan_code: plan.code,
      target_type: targetType,
      target_id: targetId,
      title,
      amount: plan.amount,
      proof_path: proof.proofPath,
      proof_filename: proof.proofFilename,
      payer_note: note || null
    })
    .select()
    .single();
  if (requestError) {
    await supabase.storage.from("payment-proofs").remove([proof.proofPath]);
    throw requestError;
  }

  const { data: message, error: messageError } = await supabase
    .from("payment_messages")
    .insert({
      payment_request_id: request.id,
      sender_id: userId,
      body: note || `Comprobante enviado para ${title}.`
    })
    .select()
    .single();
  if (messageError) throw messageError;

  return { request: request as PaymentRequest, message: message as PaymentMessage };
}

function InlinePaymentAccount({ amount }: { amount: number }) {
  const [copied, setCopied] = useState("");

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(`${label} copiado`);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopied("No se pudo copiar");
    }
  }

  return (
    <div className="inline-payment-account">
      <span>Transferi {formatPaymentMoney(amount)} y adjunta el comprobante</span>
      <button onClick={() => copyValue(paymentAccount.alias, "Alias")} type="button">
        <span>Alias</span>
        <b>{paymentAccount.alias}</b>
        <Clipboard size={15} />
      </button>
      <button onClick={() => copyValue(paymentAccount.cvu, "CVU")} type="button">
        <span>CVU</span>
        <b>{paymentAccount.cvu}</b>
        <Clipboard size={15} />
      </button>
      {copied ? <small>{copied}</small> : null}
    </div>
  );
}

function ProofField({
  ready,
  sent,
  disabled,
  onReady
}: {
  ready: boolean;
  sent?: boolean;
  disabled?: boolean;
  onReady: (ready: boolean) => void;
}) {
  return (
    <label className={`proof-upload ${sent ? "is-sent" : ""} ${disabled ? "is-disabled" : ""}`}>
      <Upload size={17} />
      <span>{sent ? "Comprobante enviado" : ready ? "Comprobante adjunto" : "Adjuntar comprobante"}</span>
      <input
        accept="image/png,image/jpeg,image/webp,application/pdf"
        disabled={disabled || sent}
        name="proofFile"
        onChange={(event) => {
          const file = event.target.files?.[0];
          onReady(Boolean(file));
        }}
        type="file"
      />
    </label>
  );
}

function SubmitButton({ pending, idle, disabled, sent }: { pending: boolean; idle: string; disabled: boolean; sent: boolean }) {
  return (
    <SlideSubmitButton complete={sent} disabled={disabled} idle={idle} pendingLabel="Enviando" submitting={pending} />
  );
}

function isRequestPending(request?: PaymentRequest) {
  return request?.status === "pending_review";
}

function TeamProForm({
  plan,
  data,
  existingRequest,
  onCreated
}: {
  plan: PaymentPlan;
  data: ArenaData;
  existingRequest?: PaymentRequest;
  onCreated: (request: PaymentRequest, message?: PaymentMessage) => void;
}) {
  const [mode, setMode] = useState(data.teams.length ? "existing" : "new");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(isRequestPending(existingRequest) ? "Ya enviaste un comprobante. Espera la revision del admin." : "");
  const [proofReady, setProofReady] = useState(false);
  const [sent, setSent] = useState(isRequestPending(existingRequest));
  const submitLockedRef = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (sent || submitLockedRef.current) return setMessage("Comprobante ya enviado. Espera la revision del admin.");
    if (!data.user) return setMessage("Entra con Google para continuar.");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    submitLockedRef.current = true;
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      let teamId = String(form.get("teamId") || "");
      let teamName = data.teams.find((team) => team.id === teamId)?.name ?? "";

      if (mode === "new" || !teamId) {
        teamName = String(form.get("teamName") || "").trim();
        if (!teamName) throw new Error("El equipo necesita nombre.");
        const shortName = String(form.get("shortName") || teamName.slice(0, 3)).trim().slice(0, 4).toUpperCase();
        const { data: team, error } = await supabase
          .from("teams")
          .insert({
            owner_id: data.user.id,
            name: teamName,
            slug: `${slugify(teamName)}-${Date.now().toString(36)}`,
            short_name: shortName,
            neighborhood: String(form.get("neighborhood") || "").trim() || null,
            primary_color: "#eec15c"
          })
          .select("id,name")
          .single();
        if (error) throw error;
        teamId = team.id;
        teamName = team.name;
      }

      const note = String(form.get("payerNote") || "").trim() || `Equipo: ${teamName}`;
      const created = await createPaymentRequest({
        userId: data.user.id,
        plan,
        targetType: "team",
        targetId: teamId,
        title: `Equipo Pro - ${teamName}`,
        note,
        proofFile: form.get("proofFile")
      });
      onCreated(created.request, created.message);
      formElement.reset();
      setProofReady(false);
      setSent(true);
      setMessage("Equipo premium enviado. Fulbito lo activa cuando se valide el comprobante.");
    } catch (error) {
      submitLockedRef.current = false;
      setMessage(error instanceof Error ? error.message : "No se pudo crear el equipo Pro.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="creator-form" onSubmit={submit}>
      {data.teams.length ? (
        <div className="creator-toggle">
          <button className={mode === "existing" ? "is-active" : ""} onClick={() => setMode("existing")} type="button">Elegir equipo</button>
          <button className={mode === "new" ? "is-active" : ""} onClick={() => setMode("new")} type="button">Crear equipo</button>
        </div>
      ) : null}
      {mode === "existing" && data.teams.length ? (
        <select name="teamId" defaultValue={data.teams[0]?.id}>
          {data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
      ) : (
        <>
          <input name="teamName" placeholder="Nombre del equipo" />
          <input name="shortName" maxLength={4} placeholder="Sigla" />
          <input name="neighborhood" placeholder="Barrio" />
        </>
      )}
      <input name="payerNote" placeholder="Nota: alias desde donde pagaste" />
      <InlinePaymentAccount amount={plan.amount} />
      <ProofField disabled={pending || sent} onReady={setProofReady} ready={proofReady} sent={sent} />
      <SubmitButton disabled={!proofReady || sent} idle="Crear equipo" pending={pending} sent={sent} />
      {!proofReady && !sent ? <small>El boton se habilita cuando adjuntas el comprobante.</small> : null}
      {message ? <small>{message}</small> : null}
    </form>
  );
}

function TournamentProForm({
  plan,
  data,
  existingRequest,
  onCreated
}: {
  plan: PaymentPlan;
  data: ArenaData;
  existingRequest?: PaymentRequest;
  onCreated: (request: PaymentRequest, message?: PaymentMessage) => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(isRequestPending(existingRequest) ? "Ya enviaste un comprobante. Espera la revision del admin." : "");
  const [proofReady, setProofReady] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [sent, setSent] = useState(isRequestPending(existingRequest));
  const submitLockedRef = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setInviteUrl("");
    if (sent || submitLockedRef.current) return setMessage("Comprobante ya enviado. Espera la revision del admin.");
    if (!data.user) return setMessage("Entra con Google para continuar.");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("tournamentName") || "").trim();
    if (!name) return setMessage("El torneo necesita nombre.");
    submitLockedRef.current = true;
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const fieldMode = String(form.get("fieldMode") || "7v7") as FieldMode;
      const tournamentFormat = String(form.get("tournamentFormat") || "world_cup") as TournamentFormat;
      const maxTeams = Number(form.get("maxTeams") || 8);
      const { data: tournament, error } = await supabase
        .from("tournaments")
        .insert({
          organizer_id: data.user.id,
          name,
          slug: `${slugify(name)}-${Date.now().toString(36)}`,
          format: tournamentFormat,
          status: "registration",
          field_mode: fieldMode,
          max_teams: Number.isFinite(maxTeams) ? maxTeams : 8,
          registration_fee: 0,
          rules: `Copa creada en Fulbito Arena. Formato: ${tournamentFormatLabels[tournamentFormat]}. Los equipos pueden sumarse gratis o activar identidad premium.`
        })
        .select("id,name,slug")
        .single();
      if (error) throw error;

      const note = String(form.get("payerNote") || "").trim() || `Torneo: ${name}. Equipos: ${maxTeams}. Futbol: ${fieldMode}. Formato: ${tournamentFormatLabels[tournamentFormat]}.`;
      const created = await createPaymentRequest({
        userId: data.user.id,
        plan,
        targetType: "tournament",
        targetId: tournament.id,
        title: `Mundial barrial - ${tournament.name}`,
        note,
        proofFile: form.get("proofFile")
      });
      onCreated(created.request, created.message);

      const origin = window.location.origin;
      const invite = `Te invito a inscribir tu equipo en ${tournament.name} en Fulbito Arena. Entrá a ${origin} y cargá tu club, plantel y formación.`;
      const whatsappInvite = `Te invito a jugar ${tournament.name} en Fulbito Arena. Entra a ${origin}, crea o elegi tu equipo y carga el plantel para sumarte a la copa.`;
      setInviteUrl(`https://wa.me/?text=${encodeURIComponent(whatsappInvite)}`);
      formElement.reset();
      setProofReady(false);
      setSent(true);
      setMessage("Copa creada. Envia la invitacion a los equipos y espera la activacion premium.");
    } catch (error) {
      submitLockedRef.current = false;
      setMessage(error instanceof Error ? error.message : "No se pudo crear el torneo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="creator-form" onSubmit={submit}>
      <input name="tournamentName" placeholder="Nombre de la copa" />
      <select name="tournamentFormat" defaultValue="world_cup">
        {tournamentFormatOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <div className="creator-inline">
        <input name="maxTeams" inputMode="numeric" placeholder="Cantidad de equipos" />
        <select name="fieldMode" defaultValue="7v7">
          <option value="5v5">5v5</option>
          <option value="7v7">7v7</option>
          <option value="11v11">11v11</option>
        </select>
      </div>
      <input name="payerNote" placeholder="Alias o comentario de la transferencia" />
      <InlinePaymentAccount amount={plan.amount} />
      <ProofField disabled={pending || sent} onReady={setProofReady} ready={proofReady} sent={sent} />
      <SubmitButton disabled={!proofReady || sent} idle="Crear mundial" pending={pending} sent={sent} />
      {!proofReady && !sent ? <small>Adjunta el comprobante para crear la copa.</small> : null}
      {inviteUrl ? <a className="whatsapp-invite" href={inviteUrl} rel="noreferrer" target="_blank">Invitar equipos por WhatsApp</a> : null}
      {message ? <small>{message}</small> : null}
    </form>
  );
}

function SponsorForm({
  plan,
  data,
  existingRequest,
  onCreated
}: {
  plan: PaymentPlan;
  data: ArenaData;
  existingRequest?: PaymentRequest;
  onCreated: (request: PaymentRequest, message?: PaymentMessage) => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(isRequestPending(existingRequest) ? "Ya enviaste un comprobante. Espera la revision del admin." : "");
  const [proofReady, setProofReady] = useState(false);
  const [sent, setSent] = useState(isRequestPending(existingRequest));
  const submitLockedRef = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (sent || submitLockedRef.current) return setMessage("Comprobante ya enviado. Espera la revision del admin.");
    if (!data.user) return setMessage("Entra con Google para continuar.");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const sponsorName = String(form.get("sponsorName") || "").trim();
    if (!sponsorName) return setMessage("Carga el nombre del sponsor.");
    submitLockedRef.current = true;
    setPending(true);
    try {
      const note = String(form.get("payerNote") || "").trim() || `Sponsor: ${sponsorName}`;
      const created = await createPaymentRequest({
        userId: data.user.id,
        plan,
        targetType: "sponsor",
        targetId: null,
        title: `Sponsor local - ${sponsorName}`,
        note,
        proofFile: form.get("proofFile")
      });
      onCreated(created.request, created.message);
      formElement.reset();
      setProofReady(false);
      setSent(true);
      setMessage("Sponsor enviado para aprobacion.");
    } catch (error) {
      submitLockedRef.current = false;
      setMessage(error instanceof Error ? error.message : "No se pudo enviar el sponsor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="creator-form" onSubmit={submit}>
      <input name="sponsorName" placeholder="Nombre del sponsor" />
      <input name="payerNote" placeholder="Donde queres aparecer: fecha, final, MVP" />
      <InlinePaymentAccount amount={plan.amount} />
      <ProofField disabled={pending || sent} onReady={setProofReady} ready={proofReady} sent={sent} />
      <SubmitButton disabled={!proofReady || sent} idle="Crear sponsor" pending={pending} sent={sent} />
      {!proofReady && !sent ? <small>El boton se habilita cuando adjuntas el comprobante.</small> : null}
      {message ? <small>{message}</small> : null}
    </form>
  );
}

function FeaturedVenueForm({
  plan,
  data,
  existingRequest,
  onCreated
}: {
  plan: PaymentPlan;
  data: ArenaData;
  existingRequest?: PaymentRequest;
  onCreated: (request: PaymentRequest, message?: PaymentMessage) => void;
}) {
  const [mode, setMode] = useState(data.venues.length ? "existing" : "new");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(isRequestPending(existingRequest) ? "Ya enviaste un comprobante. Espera la revision del admin." : "");
  const [proofReady, setProofReady] = useState(false);
  const [sent, setSent] = useState(isRequestPending(existingRequest));
  const submitLockedRef = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (sent || submitLockedRef.current) return setMessage("Comprobante ya enviado. Espera la revision del admin.");
    if (!data.user) return setMessage("Entra con Google para continuar.");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    submitLockedRef.current = true;
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      let venueId = String(form.get("venueId") || "");
      let venueName = data.venues.find((venue) => venue.id === venueId)?.name ?? "";

      if (mode === "new" || !venueId) {
        venueName = String(form.get("venueName") || "").trim();
        if (!venueName) throw new Error("La cancha necesita nombre.");
        const { data: venue, error } = await supabase
          .from("venues")
          .insert({
            owner_id: data.user.id,
            name: venueName,
            slug: `${slugify(venueName)}-${Date.now().toString(36)}`,
            neighborhood: String(form.get("neighborhood") || "").trim() || "Barrio a confirmar",
            address: String(form.get("address") || "").trim() || null,
            phone: String(form.get("phone") || "").trim() || null,
            surface: String(form.get("surface") || "").trim() || "Sintetico",
            price_per_hour: Number(form.get("pricePerHour") || 0),
            status: "pending"
          })
          .select("id,name")
          .single();
        if (error) throw error;
        venueId = venue.id;
        venueName = venue.name;
      }

      const note = String(form.get("payerNote") || "").trim() || `Cancha: ${venueName}`;
      const created = await createPaymentRequest({
        userId: data.user.id,
        plan,
        targetType: "venue",
        targetId: venueId,
        title: `Cancha destacada - ${venueName}`,
        note,
        proofFile: form.get("proofFile")
      });
      onCreated(created.request, created.message);
      formElement.reset();
      setProofReady(false);
      setSent(true);
      setMessage("Cancha enviada para destacar. Fulbito valida el comprobante.");
    } catch (error) {
      submitLockedRef.current = false;
      setMessage(error instanceof Error ? error.message : "No se pudo enviar la cancha.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="creator-form" onSubmit={submit}>
      {data.venues.length ? (
        <div className="creator-toggle">
          <button className={mode === "existing" ? "is-active" : ""} onClick={() => setMode("existing")} type="button">Elegir cancha</button>
          <button className={mode === "new" ? "is-active" : ""} onClick={() => setMode("new")} type="button">Crear cancha</button>
        </div>
      ) : null}
      {mode === "existing" && data.venues.length ? (
        <select name="venueId" defaultValue={data.venues[0]?.id}>
          {data.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
        </select>
      ) : (
        <>
          <input name="venueName" placeholder="Nombre de la cancha" />
          <input name="neighborhood" placeholder="Barrio" />
          <input name="address" placeholder="Direccion" />
          <input name="phone" inputMode="tel" placeholder="WhatsApp o telefono" />
          <div className="creator-inline">
            <input name="surface" placeholder="Superficie" />
            <input name="pricePerHour" inputMode="numeric" placeholder="Precio hora" />
          </div>
        </>
      )}
      <input name="payerNote" placeholder="Nota: horarios, telefono o zona" />
      <InlinePaymentAccount amount={plan.amount} />
      <ProofField disabled={pending || sent} onReady={setProofReady} ready={proofReady} sent={sent} />
      <SubmitButton disabled={!proofReady || sent} idle="Crear cancha destacada" pending={pending} sent={sent} />
      {!proofReady && !sent ? <small>El boton se habilita cuando adjuntas el comprobante.</small> : null}
      {message ? <small>{message}</small> : null}
    </form>
  );
}

function CreatorPaymentCard({
  plan,
  data,
  existingRequest,
  onCreated
}: {
  plan: PaymentPlan;
  data: ArenaData;
  existingRequest?: PaymentRequest;
  onCreated: (request: PaymentRequest, message?: PaymentMessage) => void;
}) {
  return (
    <article className="payment-plan-card creator-card">
      <div>
        <Sparkles size={18} />
        <span>{plan.kicker}</span>
      </div>
      <h3>{plan.title}</h3>
      <strong>{formatPaymentMoney(plan.amount)}</strong>
      <p>{plan.description}</p>
      {plan.code === "team_pro" ? <TeamProForm data={data} existingRequest={existingRequest} onCreated={onCreated} plan={plan} /> : null}
      {plan.code === "tournament_pro" ? <TournamentProForm data={data} existingRequest={existingRequest} onCreated={onCreated} plan={plan} /> : null}
      {plan.code === "sponsor" ? <SponsorForm data={data} existingRequest={existingRequest} onCreated={onCreated} plan={plan} /> : null}
      {plan.code === "featured_venue" ? <FeaturedVenueForm data={data} existingRequest={existingRequest} onCreated={onCreated} plan={plan} /> : null}
    </article>
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
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
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
      formElement.reset();
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
  const plans = useMemo(() => mergePaymentPlans(data.billingPlans), [data.billingPlans]);
  const hasApprovedPro = data.entitlements.length > 0 || requests.some((request) => request.status === "approved");

  const messagesByRequest = useMemo(() => {
    return messages.reduce<Record<string, PaymentMessage[]>>((groups, item) => {
      groups[item.payment_request_id] = groups[item.payment_request_id] ?? [];
      groups[item.payment_request_id].push(item);
      return groups;
    }, {});
  }, [messages]);

  const pendingRequestByPlan = useMemo(() => {
    return requests.reduce<Partial<Record<PaymentPlan["code"], PaymentRequest>>>((groups, request) => {
      if (request.status !== "pending_review") return groups;
      groups[request.plan_code] = groups[request.plan_code] ?? request;
      return groups;
    }, {});
  }, [requests]);

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

  if (!data.user) return null;
  const user = data.user;

  return (
    <section className="console-panel payment-console" id="pro">
      <div className="payment-console__head">
        <span>Crear copa</span>
        <h2>Arma tu Mundial barrial</h2>
        <p>
          Crea la copa, elegi formato, invita equipos y deja que cada club cargue su plantel. El equipo basico es gratis; lo premium activa fotos, cartas y estadisticas.
        </p>
      </div>

      <div className="payment-account">
        <article>
          <Crown size={20} />
          <div>
            <strong>Transferencia Fulbito</strong>
            <span>Copia alias o CVU, paga y adjunta el comprobante.</span>
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
          <span>Tenes funciones premium activas en esta cuenta.</span>
        </div>
      ) : null}

      <div className="payment-plan-grid creator-grid">
        {plans.map((plan) => (
          <CreatorPaymentCard
            data={data}
            existingRequest={pendingRequestByPlan[plan.code]}
            key={plan.code}
            onCreated={onCreated}
            plan={plan}
          />
        ))}
      </div>

      <section className="payment-inbox">
        <header>
          <MessageCircle size={18} />
          <div>
            <strong>Mensajes de activacion</strong>
            <span>Seguimiento de comprobantes, copas, equipos y sponsors.</span>
          </div>
        </header>
        {requests.length ? requests.map((request) => (
          <PaymentThread
            key={request.id}
            messages={messagesByRequest[request.id] ?? []}
            onMessage={onMessage}
            request={request}
            userId={user.id}
          />
        )) : <p className="empty-payment-state">Todavia no enviaste comprobantes.</p>}
      </section>
    </section>
  );
}

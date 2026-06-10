"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { CalendarDays, CheckCircle2, ChevronDown, Clipboard, PlusCircle, Sparkles, Trophy, Upload, Users } from "lucide-react";
import { SlideSubmitButton } from "@/components/slide-submit-button";
import { formatPaymentMoney, mergePaymentPlans, paymentAccount } from "@/lib/payments";
import type { PaymentPlan, PaymentTargetType } from "@/lib/payments";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AccountEntitlement, ArenaData, ArenaTournament, FieldMode, PaymentMessage, PaymentRequest, TournamentFormat } from "@/lib/types";

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
  const { data: block, error: blockError } = await supabase
    .from("user_blocks")
    .select("reason")
    .eq("blocked_user_id", userId)
    .maybeSingle();
  if (blockError) throw blockError;
  if (block) throw new Error(block.reason || "Tu cuenta esta bloqueada para enviar nuevos comprobantes. Escribile al admin de Fulbito.");

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
      <span>Transferi {formatPaymentMoney(amount)} por mes y adjunta el comprobante</span>
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

function isEntitlementActive(entitlement: AccountEntitlement, now = Date.now()) {
  return !entitlement.expires_at || new Date(entitlement.expires_at).getTime() > now;
}

function daysLeft(value: string | null) {
  if (!value) return "Activo";
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) return "Vencido";
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  return `${days} dias`;
}

function formatBenefitDate(value: string | null) {
  if (!value) return "Sin vencimiento";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function TournamentInviteLink({ tournament }: { tournament: ArenaTournament }) {
  const [href, setHref] = useState("");

  useEffect(() => {
    const joinUrl = `${window.location.origin}/?join=${encodeURIComponent(tournament.slug)}`;
    const text = `Te invito a jugar ${tournament.name} en Fulbito Arena. Entra a ${joinUrl}, crea o elegi tu equipo y carga el plantel para sumarte a la copa.`;
    setHref(`https://wa.me/?text=${encodeURIComponent(text)}`);
  }, [tournament]);

  if (!href) return null;
  return <a className="whatsapp-invite" href={href} rel="noreferrer" target="_blank">Invitar equipos por WhatsApp</a>;
}

function entitlementTitle(entitlement: AccountEntitlement, data: ArenaData) {
  if (entitlement.plan_code === "tournament_pro") {
    const tournament = data.tournaments.find((item) => item.id === entitlement.target_id);
    return tournament ? `Torneo Pro - ${tournament.name}` : "Torneo Pro";
  }
  if (entitlement.plan_code === "team_pro") {
    const team = data.teams.find((item) => item.id === entitlement.target_id);
    return team ? `Equipo Pro - ${team.name}` : "Equipo Pro";
  }
  if (entitlement.plan_code === "featured_venue") {
    const venue = data.venues.find((item) => item.id === entitlement.target_id);
    return venue ? `Cancha destacada - ${venue.name}` : "Cancha destacada";
  }
  return "Sponsor local";
}

function ActiveBenefitCard({ entitlement, data }: { entitlement: AccountEntitlement; data: ArenaData }) {
  const [open, setOpen] = useState(false);
  const title = entitlementTitle(entitlement, data);

  return (
    <article className={`active-benefit-card ${open ? "is-open" : ""}`}>
      <button onClick={() => setOpen((current) => !current)} type="button">
        <CheckCircle2 size={17} />
        <span>
          <b>{title}</b>
          <small>{entitlement.expires_at ? `Quedan ${daysLeft(entitlement.expires_at)} / vence ${formatBenefitDate(entitlement.expires_at)}` : "Activo sin vencimiento"}</small>
        </span>
        <ChevronDown size={18} />
      </button>
      {open ? (
        <div>
          <p>Este beneficio ya esta comprado. No hace falta volver a pagarlo hasta que venza.</p>
          <small>Periodo mensual: 30 dias desde la aprobacion del comprobante.</small>
        </div>
      ) : null}
    </article>
  );
}

function ActiveBenefitsPanel({ entitlements, data }: { entitlements: AccountEntitlement[]; data: ArenaData }) {
  const [open, setOpen] = useState(false);
  if (!entitlements.length) return null;
  const shortestBenefit = entitlements
    .map((entitlement) => entitlement.expires_at)
    .filter(Boolean)
    .sort((a, b) => new Date(a as string).getTime() - new Date(b as string).getTime())[0] ?? null;

  return (
    <section className={`active-benefits-panel ${open ? "is-open" : ""}`}>
      <button className="active-benefits-panel__toggle" onClick={() => setOpen((current) => !current)} type="button">
        <CheckCircle2 size={18} />
        <div>
          <strong>Beneficios activos</strong>
          <span>{entitlements.length} activos{shortestBenefit ? ` / proximo vencimiento ${formatBenefitDate(shortestBenefit)}` : ""}</span>
        </div>
        <ChevronDown size={18} />
      </button>
      {open ? (
        <div>
          {entitlements.map((entitlement) => (
            <ActiveBenefitCard data={data} entitlement={entitlement} key={entitlement.id} />
          ))}
        </div>
      ) : null}
    </section>
  );
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
  const [sent, setSent] = useState(isRequestPending(existingRequest));
  const submitLockedRef = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
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
        title: `Torneo barrial - ${tournament.name}`,
        note,
        proofFile: form.get("proofFile")
      });
      onCreated(created.request, created.message);

      formElement.reset();
      setProofReady(false);
      setSent(true);
      setMessage("Copa creada. Fulbito revisa el comprobante. Cuando quede aprobada se habilita la invitacion por WhatsApp.");
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
      <SubmitButton disabled={!proofReady || sent} idle="Crear torneo" pending={pending} sent={sent} />
      {!proofReady && !sent ? <small>Adjunta el comprobante para crear la copa.</small> : null}
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
  const [open, setOpen] = useState(false);
  const pending = isRequestPending(existingRequest);
  const statusLabel = pending ? "En revision" : "Tocar para abrir";
  const statusTone = pending ? "is-pending" : "is-idle";

  return (
    <article className={`payment-plan-card creator-card ${open ? "is-open" : ""}`}>
      <button
        aria-expanded={open}
        className="payment-plan-card__summary"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="payment-plan-card__icon"><Sparkles size={18} /></span>
        <span className="payment-plan-card__copy">
          <small>{plan.kicker}</small>
          <b>{plan.title}</b>
          <em>{plan.description}</em>
        </span>
        <span className="payment-plan-card__price">{formatPaymentMoney(plan.amount)}<small>/ mes</small></span>
        <span className={`payment-plan-card__status ${statusTone}`}>{statusLabel}</span>
        <ChevronDown className="payment-plan-card__chevron" size={20} />
      </button>
      {open ? (
        <div className="payment-plan-card__body">
          {plan.code === "team_pro" ? <TeamProForm data={data} existingRequest={existingRequest} onCreated={onCreated} plan={plan} /> : null}
          {plan.code === "tournament_pro" ? <TournamentProForm data={data} existingRequest={existingRequest} onCreated={onCreated} plan={plan} /> : null}
          {plan.code === "sponsor" ? <SponsorForm data={data} existingRequest={existingRequest} onCreated={onCreated} plan={plan} /> : null}
          {plan.code === "featured_venue" ? <FeaturedVenueForm data={data} existingRequest={existingRequest} onCreated={onCreated} plan={plan} /> : null}
        </div>
      ) : null}
    </article>
  );
}

function MyTournamentsPanel({
  activeEntitlements,
  data,
  onCreateTournament
}: {
  activeEntitlements: AccountEntitlement[];
  data: ArenaData;
  onCreateTournament: () => void;
}) {
  const [open, setOpen] = useState(false);
  const tournamentEntitlements = activeEntitlements.filter((entitlement) => entitlement.plan_code === "tournament_pro" && entitlement.target_id);
  const tournamentRows = data.tournaments.map((tournament) => {
    const entitlement = tournamentEntitlements.find((item) => item.target_id === tournament.id);
    const pendingRequest = data.paymentRequests.find((request) =>
      request.target_type === "tournament" &&
      request.target_id === tournament.id &&
      request.status === "pending_review"
    );
    const teamCount = data.tournamentTeams.filter((row) => row.tournament_id === tournament.id).length;
    const playerCount = data.players.filter((player) => {
      return data.tournamentTeams.some((row) => row.tournament_id === tournament.id && row.team_id === player.team_id);
    }).length;
    return { tournament, entitlement, pendingRequest, teamCount, playerCount };
  });

  useEffect(() => {
    function openPanel() {
      setOpen(true);
    }

    window.addEventListener("fulbito:open-my-tournaments", openPanel);
    return () => window.removeEventListener("fulbito:open-my-tournaments", openPanel);
  }, []);

  if (!tournamentRows.length) return null;

  return (
    <section className={`my-tournaments-panel ${open ? "is-open" : ""}`} id="my-tournaments">
      <button className="my-tournaments-panel__toggle" onClick={() => setOpen((current) => !current)} type="button">
        <Trophy size={18} />
        <div>
          <strong>Mis torneos</strong>
          <span>Los equipos aparecen cuando se inscriben. El plantel puede completarse despues.</span>
        </div>
        <ChevronDown size={18} />
      </button>
      {open ? (
        <div className="my-tournaments-list">
          {tournamentRows.map(({ tournament, entitlement, pendingRequest, teamCount, playerCount }) => (
            <article key={tournament.id}>
              <div>
                <strong>{tournament.name}</strong>
                <span>{tournament.field_mode} / {tournament.status} / {tournament.max_teams ?? "sin limite"} equipos max.</span>
                <small>Equipos visibles al inscribirse. Jugadores visibles cuando cada club completa su plantel.</small>
              </div>
              <div className="my-tournament-stats">
                <small><Users size={14} />{teamCount} equipos</small>
                <small><CalendarDays size={14} />{playerCount} jugadores</small>
                <b className={entitlement ? "is-active" : pendingRequest ? "is-pending" : ""}>
                  {entitlement ? `Pro ${daysLeft(entitlement.expires_at)}` : pendingRequest ? "Pago en revision" : "Basico"}
                </b>
              </div>
              {entitlement ? <TournamentInviteLink tournament={tournament} /> : null}
            </article>
          ))}
          <button className="my-tournaments-new" onClick={onCreateTournament} type="button">
            <PlusCircle size={17} />
            Agregar nuevo torneo
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function PaymentConsole({ data, planCodes }: { data: ArenaData; planCodes?: PaymentPlan["code"][] }) {
  const [requests, setRequests] = useState(data.paymentRequests);
  const [showNewTournament, setShowNewTournament] = useState(false);
  const plans = useMemo(() => {
    const merged = mergePaymentPlans(data.billingPlans);
    return planCodes?.length ? merged.filter((plan) => planCodes.includes(plan.code)) : merged;
  }, [data.billingPlans, planCodes]);
  const teamOnly = planCodes?.length === 1 && planCodes[0] === "team_pro";
  const activeEntitlements = useMemo(() => data.entitlements.filter((entitlement) => isEntitlementActive(entitlement)), [data.entitlements]);
  const activePlanCodes = useMemo(() => new Set(activeEntitlements.map((entitlement) => entitlement.plan_code)), [activeEntitlements]);
  const hasActiveTournamentPro = activeEntitlements.some((entitlement) => entitlement.plan_code === "tournament_pro");

  const pendingRequestByPlan = useMemo(() => {
    return requests.reduce<Partial<Record<PaymentPlan["code"], PaymentRequest>>>((groups, request) => {
      if (request.status !== "pending_review") return groups;
      groups[request.plan_code] = groups[request.plan_code] ?? request;
      return groups;
    }, {});
  }, [requests]);
  const visiblePlans = useMemo(() => {
    return plans.filter((plan) => {
      if (pendingRequestByPlan[plan.code]) return true;
      if (plan.code === "tournament_pro") return !hasActiveTournamentPro || showNewTournament;
      return !activePlanCodes.has(plan.code);
    });
  }, [activePlanCodes, hasActiveTournamentPro, pendingRequestByPlan, plans, showNewTournament]);
  const tournamentPlan = plans.find((plan) => plan.code === "tournament_pro");

  function onCreated(request: PaymentRequest) {
    setRequests((current) => [request, ...current]);
    window.dispatchEvent(new CustomEvent<PaymentRequest>("fulbito:payment-request-created", { detail: request }));
    if (request.plan_code === "tournament_pro") setShowNewTournament(false);
  }

  if (!data.user) return null;

  return (
    <section className="console-panel payment-console" id="pro">
      <div className="payment-console__head">
        <span>{teamOnly ? "Equipo Pro" : "Crear torneo"}</span>
        <h2>{teamOnly ? "Activa identidad premium" : "Arma tu torneo barrial"}</h2>
        <p>
          {teamOnly
            ? "El equipo gratis puede inscribirse con escudo y plantel. Equipo Pro habilita fotos de jugadores, cartas estilo juego y estadisticas premium."
            : "Crea la copa, elegi formato, invita equipos y deja que cada club cargue su plantel. El equipo basico es gratis; lo premium activa fotos, cartas y estadisticas."}
        </p>
      </div>

      <ActiveBenefitsPanel data={data} entitlements={activeEntitlements} />

      {!teamOnly ? (
        <MyTournamentsPanel
          activeEntitlements={activeEntitlements}
          data={{ ...data, paymentRequests: requests }}
          onCreateTournament={() => {
            setShowNewTournament(true);
            window.setTimeout(() => {
              document.getElementById("pro")?.scrollIntoView({ block: "center", behavior: "smooth" });
            }, 40);
          }}
        />
      ) : null}

      {hasActiveTournamentPro && tournamentPlan && !teamOnly ? (
        <button className="create-another-tournament" onClick={() => setShowNewTournament((current) => !current)} type="button">
          <PlusCircle size={17} />
          {showNewTournament ? "Cerrar nueva copa" : "Crear otra copa"}
        </button>
      ) : null}

      {visiblePlans.length ? (
        <div className="payment-plan-grid creator-grid">
          {visiblePlans.map((plan) => (
            <CreatorPaymentCard
              data={data}
              existingRequest={pendingRequestByPlan[plan.code]}
              key={plan.code}
              onCreated={onCreated}
              plan={plan}
            />
          ))}
        </div>
      ) : (
        <div className="pro-active-banner pro-active-banner--quiet">
          <CheckCircle2 size={20} />
          <span>No hay pagos pendientes para esta pantalla. Tus beneficios activos quedan visibles arriba.</span>
        </div>
      )}
    </section>
  );
}

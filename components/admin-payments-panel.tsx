"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Ban, CheckCircle2, Clock3, ExternalLink, Flag, LoaderCircle, Megaphone, MessageCircle, RadioTower, ShieldCheck, Trophy, Users, Send, Upload, Video, XCircle } from "lucide-react";
import { formatPaymentMoney, mergePaymentPlans, paymentStatusMeta } from "@/lib/payments";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AccountEntitlement, AdCampaign, AdCampaignScope, AdCampaignStatus, AppRole, ArenaMatch, BillingPlanSetting, LiveStreamChannel, LiveStreamEvent, LiveStreamPermission, LiveStreamLifecycleStatus, MatchResultSubmission, PaymentMessage, PaymentRequest, PaymentRequestStatus, UserBlock } from "@/lib/types";

const statusIcons: Record<PaymentRequest["status"], typeof Clock3> = {
  pending_review: Clock3,
  approved: CheckCircle2,
  rejected: XCircle,
  cancelled: XCircle
};

type AdminRequestFilter = PaymentRequestStatus | "blocked" | "all";

type AdminProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

type AdminTeamAuditItem = {
  team: {
    id: string;
    owner_id: string | null;
    name: string;
    slug: string;
    short_name: string;
    badge_url: string | null;
    primary_color: string;
    neighborhood: string | null;
    created_at: string;
  };
  owner: AdminProfile | null;
  playerCount: number;
  tournaments: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    teamStatus: string;
    fieldMode: string;
  }>;
  entitlements: AccountEntitlement[];
};

type AdminLiveTournament = {
  id: string;
  organizer_id: string | null;
  name: string;
  slug: string;
  status: string;
  field_mode: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires"
  }).format(new Date(value));
}

function AdminTeamAudit({ teams }: { teams: AdminTeamAuditItem[] }) {
  const activeTeams = teams.filter((item) => item.tournaments.length > 0).length;
  const proTeams = teams.filter((item) =>
    item.entitlements.some((entitlement) => {
      if (entitlement.plan_code !== "team_pro") return false;
      if (entitlement.expires_at && new Date(entitlement.expires_at).getTime() < Date.now()) return false;
      return true;
    })
  ).length;

  return (
    <section className="admin-team-audit">
      <header>
        <span>Auditoria de clubes</span>
        <h2>Equipos, usuarios e inscripciones</h2>
        <p>Esta vista muestra si un usuario ya tiene club cargado, en que copa esta y si tiene Equipo Pro activo.</p>
      </header>

      <div className="admin-team-summary">
        <article>
          <Users size={18} />
          <strong>{teams.length}</strong>
          <span>Clubes cargados</span>
        </article>
        <article>
          <Trophy size={18} />
          <strong>{activeTeams}</strong>
          <span>Con copa asociada</span>
        </article>
        <article>
          <ShieldCheck size={18} />
          <strong>{proTeams}</strong>
          <span>Equipo Pro activo</span>
        </article>
      </div>

      <div className="admin-team-grid">
        {teams.length ? teams.map((item) => {
          const hasTeamPro = item.entitlements.some((entitlement) => {
            if (entitlement.plan_code !== "team_pro") return false;
            if (entitlement.expires_at && new Date(entitlement.expires_at).getTime() < Date.now()) return false;
            return true;
          });
          return (
            <article className="admin-team-card" key={item.team.id}>
              <header>
                <span className="admin-team-badge" style={{ "--team-color": item.team.primary_color } as CSSProperties}>
                  {item.team.badge_url ? <img alt="" src={item.team.badge_url} /> : item.team.short_name.slice(0, 3)}
                </span>
                <div>
                  <strong>{item.team.name}</strong>
                  <small>{item.team.short_name} / {item.team.neighborhood || "Barrio sin cargar"}</small>
                </div>
                <b className={hasTeamPro ? "is-pro" : ""}>{hasTeamPro ? "Pro" : "Free"}</b>
              </header>

              <div className="admin-team-meta">
                <span>Dueno: <strong>{item.owner?.display_name ?? "Sin perfil visible"}</strong></span>
                <span>Jugadores: <strong>{item.playerCount}</strong></span>
                <span>Creado: <strong>{formatDate(item.team.created_at)}</strong></span>
              </div>

              <div className="admin-team-pill-list">
                {item.tournaments.length ? item.tournaments.map((tournament) => (
                  <span key={tournament.id}>
                    {tournament.name} / {tournament.fieldMode} / {tournament.teamStatus}
                  </span>
                )) : <span>Sin copa asociada todavia</span>}
              </div>
            </article>
          );
        }) : (
          <article className="admin-empty">
            <Users size={24} />
            <strong>No hay equipos cargados.</strong>
            <span>Cuando un usuario cree o asocie un club, aparece en esta auditoria.</span>
          </article>
        )}
      </div>
    </section>
  );
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

function AdminResultsPanel({
  initialSubmissions,
  initialMatches,
  profiles,
  teams
}: {
  initialSubmissions: MatchResultSubmission[];
  initialMatches: ArenaMatch[];
  profiles: AdminProfile[];
  teams: AdminTeamAuditItem[];
}) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [matches, setMatches] = useState(initialMatches);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const matchMap = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches]);
  const teamNameMap = useMemo(() => new Map(teams.map((item) => [item.team.id, item.team.name])), [teams]);
  const pending = submissions.filter((submission) => submission.status === "pending");
  const visibleSubmissions = [...submissions].sort((left, right) => {
    if (left.status === "pending" && right.status !== "pending") return -1;
    if (left.status !== "pending" && right.status === "pending") return 1;
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  }).slice(0, 24);

  async function reviewSubmission(submission: MatchResultSubmission, status: "accepted" | "rejected") {
    setNotice("");
    setBusyId(submission.id);
    try {
      const response = await fetch("/api/admin/match-results/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ submissionId: submission.id, status })
      });
      const result = (await response.json()) as { submission?: MatchResultSubmission; match?: ArenaMatch; reason?: string; error?: string };
      if (!response.ok || !result.submission) throw new Error(result.error || "No se pudo revisar el resultado.");
      setSubmissions((current) => current.map((item) => item.id === result.submission?.id ? result.submission as MatchResultSubmission : item));
      if (result.match) {
        setMatches((current) => current.map((match) => match.id === result.match?.id ? result.match as ArenaMatch : match));
      }
      setNotice(result.reason ?? (status === "accepted" ? "Resultado aprobado." : "Resultado rechazado."));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo revisar el resultado.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="admin-team-audit admin-results-panel">
      <header>
        <span>Actas de partido</span>
        <h2>Resultados oficiales</h2>
        <p>Aproba el marcador para cerrar el partido, recalcular la tabla y avanzar la llave cuando corresponda.</p>
      </header>

      <div className="admin-team-summary">
        <article><Clock3 size={18} /><strong>{pending.length}</strong><span>Pendientes</span></article>
        <article><CheckCircle2 size={18} /><strong>{submissions.filter((item) => item.status === "accepted").length}</strong><span>Aprobados</span></article>
        <article><XCircle size={18} /><strong>{submissions.filter((item) => item.status === "rejected").length}</strong><span>Rechazados</span></article>
      </div>

      {notice ? <p className="admin-notice">{notice}</p> : null}

      <div className="admin-payment-list admin-results-list">
        {visibleSubmissions.length ? visibleSubmissions.map((submission) => {
          const match = matchMap.get(submission.match_id);
          const requester = submission.submitted_by ? profileMap.get(submission.submitted_by) : undefined;
          const busy = busyId === submission.id;
          const home = match?.home_team_id ? teamNameMap.get(match.home_team_id) ?? "Local" : "Local";
          const away = match?.away_team_id ? teamNameMap.get(match.away_team_id) ?? "Visitante" : "Visitante";
          return (
            <article className="admin-payment-card" key={submission.id}>
              <header>
                <Requester profile={requester} />
                <b className={`payment-status payment-status--${submission.status === "accepted" ? "approved" : submission.status === "rejected" ? "rejected" : "pending"}`}>
                  {submission.status === "pending" ? <Clock3 size={15} /> : submission.status === "accepted" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                  {submission.status === "pending" ? "Pendiente" : submission.status === "accepted" ? "Aprobado" : "Rechazado"}
                </b>
              </header>
              <div className="admin-payment-card__body">
                <div>
                  <span>{match?.round_name ?? "Partido"}</span>
                  <h2>{home} {submission.home_score} - {submission.away_score} {away}</h2>
                  <small>{formatDate(submission.created_at)} / {match?.group_code ? `Grupo ${match.group_code}` : match?.phase ?? "sin fase"}</small>
                  {submission.note ? <p>{submission.note}</p> : null}
                </div>
              </div>
              <div className="admin-review-actions">
                <button disabled={busy || submission.status === "accepted"} onClick={() => reviewSubmission(submission, "accepted")} type="button">
                  {busy ? <LoaderCircle className="button-spinner" size={17} /> : <CheckCircle2 size={17} />}
                  Aprobar resultado
                </button>
                <button disabled={busy || submission.status === "rejected"} onClick={() => reviewSubmission(submission, "rejected")} type="button">
                  <XCircle size={17} />
                  Rechazar
                </button>
              </div>
            </article>
          );
        }) : (
          <article className="admin-empty">
            <Flag size={24} />
            <strong>No hay resultados cargados.</strong>
            <span>Cuando un veedor, cancha o capitan envie marcador, aparece aca.</span>
          </article>
        )}
      </div>
    </section>
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
        <p>Estos importes se reflejan en la pantalla de creacion sin tocar codigo.</p>
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

async function optimizeAdLogo(file: File) {
  if (file.type === "image/svg+xml") return file;
  if (!file.type.startsWith("image/")) throw new Error("El logo debe ser PNG, JPG, WEBP o SVG.");
  const bitmap = await createImageBitmap(file);
  const maxSide = 360;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.78));
  if (!blob) return file;
  const filename = file.name.replace(/\.[^.]+$/, "") || "sponsor";
  return new File([blob], `${filename}.webp`, { type: "image/webp" });
}

function localDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function AdminAdCampaignPanel({
  adminId,
  initialCampaigns
}: {
  adminId: string;
  initialCampaigns: AdCampaign[];
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  async function uploadLogo(fileValue: FormDataEntryValue | null) {
    if (!(fileValue instanceof File) || fileValue.size === 0) return null;
    const supabase = createSupabaseBrowserClient();
    const optimized = await optimizeAdLogo(fileValue);
    const extension = optimized.type === "image/svg+xml" ? "svg" : optimized.type === "image/webp" ? "webp" : optimized.name.split(".").pop()?.toLowerCase() || "webp";
    const path = `${adminId}/${Date.now().toString(36)}-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("ad-assets").upload(path, optimized, {
      cacheControl: "604800",
      contentType: optimized.type || undefined,
      upsert: false
    });
    if (error) throw error;
    return supabase.storage.from("ad-assets").getPublicUrl(path).data.publicUrl;
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setBusyId("new-ad");
    const form = new FormData(event.currentTarget);
    const scope = String(form.get("scope") || "local") as AdCampaignScope;
    const latitude = Number(form.get("latitude") || "");
    const longitude = Number(form.get("longitude") || "");
    const radiusKm = Number(form.get("radiusKm") || 50);
    const advertiserName = String(form.get("advertiserName") || "").trim();
    const headline = String(form.get("headline") || "").trim();
    const startsAt = String(form.get("startsAt") || "");
    const endsAt = String(form.get("endsAt") || "");

    try {
      if (!advertiserName || !headline) throw new Error("Carga nombre del comercio y texto del LED.");
      if (scope === "local" && (!Number.isFinite(latitude) || !Number.isFinite(longitude))) {
        throw new Error("Para publicidad local carga latitud y longitud del comercio.");
      }
      const logoUrl = await uploadLogo(form.get("logoFile"));
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("ad_campaigns")
        .insert({
          created_by: adminId,
          approved_by: adminId,
          advertiser_name: advertiserName,
          headline,
          body: String(form.get("body") || "").trim() || null,
          logo_url: logoUrl,
          target_url: String(form.get("targetUrl") || "").trim() || null,
          placement: "arena_led",
          scope,
          latitude: scope === "local" ? latitude : null,
          longitude: scope === "local" ? longitude : null,
          radius_km: Number.isFinite(radiusKm) ? Math.max(1, Math.round(radiusKm)) : 50,
          status: String(form.get("status") || "active") as AdCampaignStatus,
          starts_at: startsAt ? new Date(startsAt).toISOString() : new Date().toISOString(),
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
          sort_order: Number(form.get("sortOrder") || 100)
        })
        .select()
        .single();
      if (error) throw error;
      setCampaigns((current) => [data as AdCampaign, ...current].sort((a, b) => a.sort_order - b.sort_order));
      event.currentTarget.reset();
      setNotice("Publicidad cargada. Si esta activa, ya puede aparecer en la tira LED.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo guardar la publicidad.");
    } finally {
      setBusyId("");
    }
  }

  async function updateCampaignStatus(campaign: AdCampaign, status: AdCampaignStatus) {
    setBusyId(campaign.id);
    setNotice("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("ad_campaigns")
        .update({ status, approved_by: adminId })
        .eq("id", campaign.id)
        .select()
        .single();
      if (error) throw error;
      setCampaigns((current) => current.map((item) => item.id === campaign.id ? data as AdCampaign : item));
      setNotice(status === "active" ? "Publicidad activada." : "Publicidad pausada.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo actualizar la publicidad.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="admin-ad-panel">
      <header>
        <span>Publicidad</span>
        <h2>Carteleria LED</h2>
        <p>Administra sponsors que aparecen en la tira inferior. Local se filtra por radio; nacional se ve en todo el pais.</p>
      </header>

      <form className="admin-ad-form" onSubmit={createCampaign}>
        <div className="admin-ad-form__grid">
          <input name="advertiserName" placeholder="Nombre del comercio" />
          <input name="headline" placeholder="Texto principal del LED" />
          <input name="body" placeholder="Subtexto corto: promo, barrio o rubro" />
          <input name="targetUrl" placeholder="Link web / Instagram / WhatsApp" />
          <select name="scope" defaultValue="local">
            <option value="local">Local 50 km</option>
            <option value="national">Nacional / tienda online</option>
          </select>
          <select name="status" defaultValue="active">
            <option value="active">Activa</option>
            <option value="pending">Pendiente</option>
            <option value="paused">Pausada</option>
          </select>
          <input name="latitude" placeholder="Latitud local" />
          <input name="longitude" placeholder="Longitud local" />
          <input defaultValue="50" inputMode="numeric" name="radiusKm" placeholder="Radio km" />
          <input defaultValue="100" inputMode="numeric" name="sortOrder" placeholder="Orden" />
          <label className="admin-ad-logo-field">
            <Upload size={16} />
            <span>Logo del sponsor</span>
            <input accept="image/png,image/jpeg,image/webp,image/svg+xml" name="logoFile" type="file" />
          </label>
          <input name="startsAt" type="datetime-local" />
          <input name="endsAt" type="datetime-local" />
        </div>
        <button disabled={busyId === "new-ad"} type="submit">
          {busyId === "new-ad" ? <LoaderCircle className="button-spinner" size={16} /> : <Megaphone size={16} />}
          Publicar en LED
        </button>
      </form>

      <div className="admin-ad-list">
        {campaigns.length ? campaigns.map((campaign) => (
          <article className={`admin-ad-card is-${campaign.status}`} key={campaign.id}>
            <header>
              <span>{campaign.logo_url ? <img alt="" src={campaign.logo_url} /> : <Megaphone size={18} />}</span>
              <div>
                <strong>{campaign.headline}</strong>
                <small>{campaign.advertiser_name} / {campaign.scope === "national" ? "Nacional" : `${campaign.radius_km} km`}</small>
              </div>
              <b>{campaign.status}</b>
            </header>
            {campaign.body ? <p>{campaign.body}</p> : null}
            <small>
              {localDateTime(campaign.starts_at) || "sin inicio"} / {localDateTime(campaign.ends_at) || "sin vencimiento"}
            </small>
            <div>
              <button disabled={busyId === campaign.id || campaign.status === "active"} onClick={() => updateCampaignStatus(campaign, "active")} type="button">Activar</button>
              <button disabled={busyId === campaign.id || campaign.status === "paused"} onClick={() => updateCampaignStatus(campaign, "paused")} type="button">Pausar</button>
            </div>
          </article>
        )) : (
          <article className="admin-empty">
            <Megaphone size={24} />
            <strong>No hay publicidades cargadas.</strong>
            <span>Cuando cargues una campaña activa, aparece en la tira LED de la app.</span>
          </article>
        )}
      </div>
      {notice ? <p className="admin-notice">{notice}</p> : null}
    </section>
  );
}

function liveStatusLabel(status: LiveStreamLifecycleStatus) {
  const labels: Record<LiveStreamLifecycleStatus, string> = {
    scheduled: "Programado",
    ready: "Listo",
    testing: "Prueba",
    live: "En vivo",
    complete: "Finalizado",
    cancelled: "Revocado",
    failed: "Fallido"
  };
  return labels[status];
}

function AdminLivePanel({
  adminId,
  channels: initialChannels,
  events: initialEvents,
  permissions: initialPermissions,
  profiles,
  tournaments
}: {
  adminId: string;
  channels: LiveStreamChannel[];
  events: LiveStreamEvent[];
  permissions: LiveStreamPermission[];
  profiles: AdminProfile[];
  tournaments: AdminLiveTournament[];
}) {
  const [events, setEvents] = useState(initialEvents);
  const [permissions, setPermissions] = useState(initialPermissions);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const permissionByTournament = useMemo(() => {
    return permissions.reduce<Record<string, LiveStreamPermission>>((groups, permission) => {
      if (permission.tournament_id) groups[permission.tournament_id] = permission;
      return groups;
    }, {});
  }, [permissions]);
  const visibleEvents = events.slice(0, 24);
  const activeEvents = events.filter((event) => ["ready", "testing", "live", "scheduled"].includes(event.lifecycle_status));
  const liveNow = events.filter((event) => event.lifecycle_status === "live" || event.lifecycle_status === "testing");

  async function setEventStatus(event: LiveStreamEvent, status: LiveStreamLifecycleStatus) {
    setNotice("");
    setBusyId(`${event.id}-${status}`);
    const patch: Partial<LiveStreamEvent> = { lifecycle_status: status };
    if (status === "live") patch.actual_started_at = new Date().toISOString();
    if (status === "complete") patch.actual_ended_at = new Date().toISOString();
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("live_stream_events")
        .update(patch)
        .eq("id", event.id)
        .select()
        .single();
      if (error) throw error;
      await supabase.from("live_stream_audit_logs").insert({
        actor_user_id: adminId,
        live_stream_event_id: event.id,
        action: `admin_set_${status}`,
        metadata: { previousStatus: event.lifecycle_status }
      });
      const next = data as LiveStreamEvent;
      setEvents((current) => current.map((item) => item.id === next.id ? next : item));
      setNotice(`Transmision marcada como ${liveStatusLabel(status)}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo actualizar el vivo.");
    } finally {
      setBusyId("");
    }
  }

  async function updateEventMetrics(event: FormEvent<HTMLFormElement>, liveEvent: LiveStreamEvent) {
    event.preventDefault();
    setNotice("");
    setBusyId(`metrics-${liveEvent.id}`);
    const form = new FormData(event.currentTarget);
    const manualViewCount = Math.max(0, Math.round(Number(form.get("manualViewCount") || 0)));
    const manualPeakViewers = Math.max(0, Math.round(Number(form.get("manualPeakViewers") || 0)));
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("live_stream_events")
        .update({
          sponsor_name: String(form.get("sponsorName") || "").trim() || null,
          sponsor_url: String(form.get("sponsorUrl") || "").trim() || null,
          manual_view_count: manualViewCount,
          manual_peak_viewers: manualPeakViewers,
          manual_notes: String(form.get("manualNotes") || "").trim() || null
        })
        .eq("id", liveEvent.id)
        .select()
        .single();
      if (error) throw error;
      await supabase.from("live_stream_audit_logs").insert({
        actor_user_id: adminId,
        live_stream_event_id: liveEvent.id,
        action: "admin_update_metrics",
        metadata: { manualViewCount, manualPeakViewers }
      });
      const next = data as LiveStreamEvent;
      setEvents((current) => current.map((item) => item.id === next.id ? next : item));
      setNotice("Sponsor y metricas guardados.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudieron guardar las metricas.");
    } finally {
      setBusyId("");
    }
  }

  async function enableTournamentLive(tournament: AdminLiveTournament) {
    setNotice("");
    if (!tournament.organizer_id) {
      setNotice("Este torneo no tiene organizador asignado.");
      return;
    }
    setBusyId(`enable-${tournament.id}`);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("live_stream_permissions")
        .upsert({
          user_id: tournament.organizer_id,
          tournament_id: tournament.id,
          can_use_external_link: true,
          can_use_official_auto: true,
          max_streams_per_day: 3,
          max_streams_per_week: 12,
          allowed_stream_types: ["match", "final", "draw"],
          status: "active",
          enabled_by_user_id: adminId
        }, { onConflict: "user_id,tournament_id" })
        .select()
        .single();
      if (error) throw error;
      const next = data as LiveStreamPermission;
      setPermissions((current) => {
        const exists = current.some((item) => item.id === next.id);
        return exists ? current.map((item) => item.id === next.id ? next : item) : [next, ...current];
      });
      setNotice("Fulbito Live habilitado para este torneo.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo habilitar Fulbito Live.");
    } finally {
      setBusyId("");
    }
  }

  async function updatePermission(event: FormEvent<HTMLFormElement>, permission: LiveStreamPermission) {
    event.preventDefault();
    setNotice("");
    setBusyId(`permission-${permission.id}`);
    const form = new FormData(event.currentTarget);
    const maxStreamsPerDay = Math.max(0, Math.round(Number(form.get("maxStreamsPerDay") || permission.max_streams_per_day)));
    const maxStreamsPerWeek = Math.max(0, Math.round(Number(form.get("maxStreamsPerWeek") || permission.max_streams_per_week)));
    const status = String(form.get("status") || permission.status);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("live_stream_permissions")
        .update({
          max_streams_per_day: maxStreamsPerDay,
          max_streams_per_week: maxStreamsPerWeek,
          status
        })
        .eq("id", permission.id)
        .select()
        .single();
      if (error) throw error;
      const next = data as LiveStreamPermission;
      setPermissions((current) => current.map((item) => item.id === next.id ? next : item));
      setNotice("Limites de Fulbito Live actualizados.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo guardar el permiso.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="admin-live-panel">
      <header>
        <span>Fulbito Live</span>
        <h2>Links, permisos y auditoria</h2>
        <p>Fulbito no aloja video: solo guarda metadatos, YouTube/external links, permisos, sponsor y estado.</p>
      </header>

      <div className="admin-live-summary">
        <article><RadioTower size={18} /><strong>{liveNow.length}</strong><span>En vivo/prueba</span></article>
        <article><Video size={18} /><strong>{activeEvents.length}</strong><span>Activos o programados</span></article>
        <article><ShieldCheck size={18} /><strong>{permissions.filter((item) => item.status === "active").length}</strong><span>Permisos activos</span></article>
      </div>

      <div className="admin-live-channels">
        {initialChannels.map((channel) => (
          <article key={channel.id}>
            <strong>{channel.name}</strong>
            <span>{channel.handle} / {channel.status}</span>
            {channel.channel_url ? <a href={channel.channel_url} rel="noreferrer" target="_blank">Abrir canal</a> : null}
          </article>
        ))}
      </div>

      <section className="admin-live-block">
        <h3>Habilitar torneos</h3>
        <div className="admin-live-tournament-list">
          {tournaments.slice(0, 18).map((tournament) => {
            const permission = permissionByTournament[tournament.id];
            const organizer = tournament.organizer_id ? profileMap.get(tournament.organizer_id) : null;
            return (
              <article key={tournament.id}>
                <div>
                  <strong>{tournament.name}</strong>
                  <span>{tournament.field_mode} / {tournament.status} / {organizer?.display_name ?? "Sin organizador visible"}</span>
                </div>
                <b className={permission?.status === "active" ? "is-active" : ""}>{permission?.status ?? "sin live"}</b>
                <button disabled={busyId === `enable-${tournament.id}`} onClick={() => enableTournamentLive(tournament)} type="button">
                  {busyId === `enable-${tournament.id}` ? <LoaderCircle className="button-spinner" size={15} /> : null}
                  {permission ? "Rehabilitar" : "Habilitar Live"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="admin-live-block">
        <h3>Vivos y links</h3>
        <div className="admin-live-event-list">
          {visibleEvents.length ? visibleEvents.map((event) => {
            const channel = initialChannels.find((item) => item.id === event.channel_id);
            return (
              <article key={event.id}>
                <div>
                  <span>{event.mode.replaceAll("_", " ").toUpperCase()}</span>
                  <strong>{event.title}</strong>
                  <small>{channel?.name ?? "Link externo"} / {liveStatusLabel(event.lifecycle_status)} / {formatDate(event.created_at)}</small>
                  {event.sponsor_name ? <small>Sponsor: {event.sponsor_name}</small> : null}
                </div>
                <div className="admin-live-event-actions">
                  {event.youtube_watch_url ? <a href={event.youtube_watch_url} rel="noreferrer" target="_blank"><ExternalLink size={15} />Ver link</a> : null}
                  <button disabled={Boolean(busyId)} onClick={() => setEventStatus(event, "live")} type="button">En vivo</button>
                  <button disabled={Boolean(busyId)} onClick={() => setEventStatus(event, "complete")} type="button">Completar</button>
                  <button disabled={Boolean(busyId)} onClick={() => setEventStatus(event, "cancelled")} type="button">Revocar</button>
                </div>
                <form className="admin-live-metrics-form" onSubmit={(formEvent) => updateEventMetrics(formEvent, event)}>
                  <input defaultValue={event.sponsor_name ?? ""} name="sponsorName" placeholder="Sponsor" />
                  <input defaultValue={event.sponsor_url ?? ""} name="sponsorUrl" placeholder="URL sponsor" />
                  <input defaultValue={event.manual_view_count} inputMode="numeric" name="manualViewCount" placeholder="Views" />
                  <input defaultValue={event.manual_peak_viewers} inputMode="numeric" name="manualPeakViewers" placeholder="Pico" />
                  <input defaultValue={event.manual_notes ?? ""} name="manualNotes" placeholder="Notas" />
                  <button disabled={busyId === `metrics-${event.id}`} type="submit">
                    {busyId === `metrics-${event.id}` ? <LoaderCircle className="button-spinner" size={15} /> : null}
                    Guardar metricas
                  </button>
                </form>
              </article>
            );
          }) : (
            <article className="admin-empty">
              <RadioTower size={24} />
              <strong>No hay transmisiones creadas.</strong>
              <span>Cuando un organizador habilitado cree un vivo, aparece aca.</span>
            </article>
          )}
        </div>
      </section>

      <section className="admin-live-block">
        <h3>Cupos y sanciones Live</h3>
        <div className="admin-live-permission-list">
          {permissions.slice(0, 18).map((permission) => {
            const tournament = tournaments.find((item) => item.id === permission.tournament_id);
            const owner = profileMap.get(permission.user_id);
            return (
              <form key={permission.id} onSubmit={(event) => updatePermission(event, permission)}>
                <div>
                  <strong>{tournament?.name ?? "Torneo"}</strong>
                  <span>{owner?.display_name ?? "Usuario"} / external {permission.can_use_external_link ? "si" : "no"} / oficial {permission.can_use_official_auto ? "si" : "no"}</span>
                </div>
                <input defaultValue={permission.max_streams_per_day} inputMode="numeric" name="maxStreamsPerDay" aria-label="Maximo por dia" />
                <input defaultValue={permission.max_streams_per_week} inputMode="numeric" name="maxStreamsPerWeek" aria-label="Maximo por semana" />
                <select defaultValue={permission.status} name="status">
                  <option value="active">Activo</option>
                  <option value="suspended">Suspendido</option>
                  <option value="expired">Vencido</option>
                </select>
                <button disabled={busyId === `permission-${permission.id}`} type="submit">
                  {busyId === `permission-${permission.id}` ? <LoaderCircle className="button-spinner" size={15} /> : null}
                  Guardar
                </button>
              </form>
            );
          })}
        </div>
      </section>

      {notice ? <p className="admin-notice">{notice}</p> : null}
    </section>
  );
}

export function AdminPaymentsPanel({
  adminId,
  adCampaigns,
  requests: initialRequests,
  messages: initialMessages,
  profiles,
  billingPlans,
  liveChannels,
  liveEvents,
  livePermissions,
  matchResults,
  matches,
  roles,
  teamAudit,
  tournaments,
  userBlocks
}: {
  adminId: string;
  adCampaigns: AdCampaign[];
  requests: PaymentRequest[];
  messages: PaymentMessage[];
  profiles: AdminProfile[];
  billingPlans: BillingPlanSetting[];
  liveChannels: LiveStreamChannel[];
  liveEvents: LiveStreamEvent[];
  livePermissions: LiveStreamPermission[];
  matchResults: MatchResultSubmission[];
  matches: ArenaMatch[];
  roles: AppRole[];
  teamAudit: AdminTeamAuditItem[];
  tournaments: AdminLiveTournament[];
  userBlocks: UserBlock[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [messages, setMessages] = useState(initialMessages);
  const [blocks, setBlocks] = useState(userBlocks);
  const [filter, setFilter] = useState<AdminRequestFilter>("pending_review");
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

  const blockedUserIds = useMemo(() => new Set(blocks.map((block) => block.blocked_user_id)), [blocks]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const blocked = blockedUserIds.has(request.requester_id);
      if (filter === "all") return true;
      if (filter === "blocked") return blocked;
      if (filter === "pending_review") return request.status === "pending_review" && !blocked;
      return request.status === filter;
    });
  }, [blockedUserIds, filter, requests]);

  const filterCounts = useMemo<Record<AdminRequestFilter, number>>(() => {
    return {
      pending_review: requests.filter((item) => item.status === "pending_review" && !blockedUserIds.has(item.requester_id)).length,
      approved: requests.filter((item) => item.status === "approved").length,
      rejected: requests.filter((item) => item.status === "rejected").length,
      cancelled: requests.filter((item) => item.status === "cancelled").length,
      blocked: requests.filter((item) => blockedUserIds.has(item.requester_id)).length,
      all: requests.length
    };
  }, [blockedUserIds, requests]);

  function replaceRequest(next: PaymentRequest) {
    setRequests((current) => current.map((item) => item.id === next.id ? next : item));
  }

  function replaceRequests(next: PaymentRequest[]) {
    if (!next.length) return;
    const byId = new Map(next.map((item) => [item.id, item]));
    setRequests((current) => current.map((item) => byId.get(item.id) ?? item));
  }

  function addMessage(message: PaymentMessage) {
    setMessages((current) => [...current, message]);
  }

  function addMessages(next: PaymentMessage[]) {
    if (!next.length) return;
    setMessages((current) => [...current, ...next]);
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
      const response = await fetch("/api/admin/payment-requests/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: request.id, status, note })
      });
      const result = (await response.json()) as { request?: PaymentRequest; message?: PaymentMessage; error?: string };
      if (!response.ok || !result.request) throw new Error(result.error || "No se pudo revisar la solicitud.");
      replaceRequest(result.request);
      if (result.message) addMessage(result.message);
      setNotice(status === "approved" ? "Comprobante aprobado y beneficio activado." : "Comprobante rechazado y usuario notificado.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo revisar la solicitud.");
    } finally {
      setBusyId("");
    }
  }

  async function toggleBlockUser(request: PaymentRequest) {
    const isBlocked = blockedUserIds.has(request.requester_id);
    setNotice("");
    setBusyId(`block-${request.requester_id}`);
    try {
      const response = await fetch("/api/admin/users/block", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: isBlocked ? "unblock" : "block",
          userId: request.requester_id,
          reason: "Bloqueado por comprobantes invalidos o repetidos."
        })
      });
      const result = (await response.json()) as { block?: UserBlock | null; requests?: PaymentRequest[]; messages?: PaymentMessage[]; error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo actualizar el bloqueo.");
      if (isBlocked) {
        setBlocks((current) => current.filter((block) => block.blocked_user_id !== request.requester_id));
        setNotice("Usuario desbloqueado para nuevos comprobantes.");
      } else if (result.block) {
        setBlocks((current) => {
          const exists = current.some((block) => block.blocked_user_id === result.block?.blocked_user_id);
          return exists ? current.map((block) => block.blocked_user_id === result.block?.blocked_user_id ? result.block as UserBlock : block) : [result.block as UserBlock, ...current];
        });
        replaceRequests(result.requests ?? []);
        addMessages(result.messages ?? []);
        setNotice("Usuario bloqueado. Sus pendientes quedaron cancelados.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo bloquear el usuario.");
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

      <AdminAdCampaignPanel adminId={adminId} initialCampaigns={adCampaigns} />

      <AdminLivePanel
        adminId={adminId}
        channels={liveChannels}
        events={liveEvents}
        permissions={livePermissions}
        profiles={profiles}
        tournaments={tournaments}
      />

      <AdminResultsPanel
        initialMatches={matches}
        initialSubmissions={matchResults}
        profiles={profiles}
        teams={teamAudit}
      />

      <AdminTeamAudit teams={teamAudit} />

      {notice ? <p className="admin-notice">{notice}</p> : null}

      <section className="admin-request-tabs" aria-label="Filtrar comprobantes">
        {[
          ["pending_review", "Pendientes"],
          ["approved", "Aprobados"],
          ["rejected", "Rechazados"],
          ["cancelled", "Cancelados"],
          ["blocked", "Bloqueados"],
          ["all", "Todos"]
        ].map(([value, label]) => (
          <button
            className={filter === value ? "is-active" : ""}
            key={value}
            onClick={() => setFilter(value as AdminRequestFilter)}
            type="button"
          >
            <span>{label}</span>
            <strong>{filterCounts[value as AdminRequestFilter]}</strong>
          </button>
        ))}
      </section>

      <section className="admin-payment-list">
        {filteredRequests.length ? filteredRequests.map((request) => {
          const meta = paymentStatusMeta[request.status];
          const StatusIcon = statusIcons[request.status];
          const requestMessages = messagesByRequest[request.id] ?? [];
          const requester = profileMap.get(request.requester_id);
          const busy = busyId === request.id;
          const blocked = blockedUserIds.has(request.requester_id);
          const blockBusy = busyId === `block-${request.requester_id}`;
          return (
            <article className={`admin-payment-card ${blocked ? "is-blocked" : ""}`} key={request.id}>
              <header>
                <Requester profile={requester} />
                <div className="admin-payment-badges">
                  {blocked ? <b className="payment-status payment-status--blocked"><Ban size={15} />Bloqueado</b> : null}
                  <b className={`payment-status payment-status--${meta.tone}`}>
                    <StatusIcon size={15} />
                    {meta.label}
                  </b>
                </div>
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
                <button className="admin-block-button" disabled={blockBusy} onClick={() => toggleBlockUser(request)} type="button">
                  {blockBusy ? <LoaderCircle className="button-spinner" size={17} /> : <Ban size={17} />}
                  {blocked ? "Desbloquear" : "Bloquear usuario"}
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
            <strong>No hay comprobantes en esta bandeja.</strong>
            <span>Cambia el filtro para revisar otro estado.</span>
          </article>
        )}
      </section>
    </main>
  );
}

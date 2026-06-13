"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, ExternalLink, LoaderCircle, MapPin, Megaphone, ShieldCheck, Trophy, XCircle } from "lucide-react";
import { AdminAdCampaignPanel } from "@/components/admin-payments-panel";
import { formatPaymentMoney, paymentStatusMeta } from "@/lib/payments";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AdCampaign, AdCampaignEvent, ArenaVenue, PaymentMessage, PaymentRequest, PaymentRequestStatus } from "@/lib/types";

type AdminProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

type AdvertisingVenue = Pick<ArenaVenue, "id" | "name" | "neighborhood" | "address" | "phone" | "cover_url" | "price_per_hour" | "status">;

type AdvertisingRequestFilter = PaymentRequestStatus | "all";

const statusIcons: Record<PaymentRequestStatus, typeof Clock3> = {
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
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires"
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

function noteChips(note?: string | null) {
  if (!note) return [];
  return note
    .split(" / ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export function AdminAdvertisingPanel({
  adminId,
  adCampaigns,
  adCampaignEvents,
  profiles,
  requests: initialRequests,
  venues
}: {
  adminId: string;
  adCampaigns: AdCampaign[];
  adCampaignEvents: AdCampaignEvent[];
  profiles: AdminProfile[];
  requests: PaymentRequest[];
  venues: AdvertisingVenue[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [filter, setFilter] = useState<AdvertisingRequestFilter>("pending_review");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const venueMap = useMemo(() => new Map(venues.map((venue) => [venue.id, venue])), [venues]);
  const activeCampaigns = adCampaigns.filter((campaign) => campaign.status === "active").length;
  const pendingRequests = requests.filter((request) => request.status === "pending_review").length;
  const approvedRequests = requests.filter((request) => request.status === "approved").length;
  const splashCampaigns = adCampaigns.filter((campaign) => campaign.splash_enabled || campaign.placement === "both" || campaign.placement === "sponsor_splash").length;

  const filterCounts = useMemo<Record<AdvertisingRequestFilter, number>>(() => ({
    pending_review: requests.filter((item) => item.status === "pending_review").length,
    approved: requests.filter((item) => item.status === "approved").length,
    rejected: requests.filter((item) => item.status === "rejected").length,
    cancelled: requests.filter((item) => item.status === "cancelled").length,
    all: requests.length
  }), [requests]);

  const filteredRequests = useMemo(() => {
    if (filter === "all") return requests;
    return requests.filter((request) => request.status === filter);
  }, [filter, requests]);

  function replaceRequest(next: PaymentRequest) {
    setRequests((current) => current.map((item) => item.id === next.id ? next : item));
  }

  async function openProof(request: PaymentRequest) {
    setNotice("");
    if (!request.proof_path) {
      setNotice("Esta solicitud no tiene comprobante adjunto.");
      return;
    }
    setBusyId(`proof-${request.id}`);
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

  async function reviewRequest(request: PaymentRequest, status: "approved" | "rejected") {
    setNotice("");
    setBusyId(`review-${request.id}`);
    const planName = request.plan_code === "featured_venue" ? "cancha destacada" : "sponsor local";
    try {
      const response = await fetch("/api/admin/payment-requests/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: request.id,
          status,
          note: status === "approved" ? `Solicitud de ${planName} aprobada.` : `Solicitud de ${planName} rechazada.`
        })
      });
      const result = (await response.json()) as { request?: PaymentRequest; message?: PaymentMessage; error?: string };
      if (!response.ok || !result.request) throw new Error(result.error || "No se pudo revisar la solicitud.");
      replaceRequest(result.request);
      setNotice(status === "approved"
        ? `Solicitud aprobada. ${request.plan_code === "sponsor" ? "Ahora podes publicar o editar la campana abajo." : "La cancha ya tiene visibilidad Pro por 30 dias."}`
        : "Solicitud rechazada y usuario notificado.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo revisar la solicitud.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="admin-shell admin-advertising-shell">
      <a className="admin-floating-app-link" href="/">Ver app</a>
      <header className="admin-topbar admin-topbar--ops">
        <a className="admin-brand-link" href="/admin">
          <span className="admin-brand-mark">FA</span>
          <span>
            Fulbito Arena
            <small>Publicidad</small>
          </span>
        </a>
        <div className="admin-topbar-actions">
          <span>Admin activo</span>
          <a href="/admin">Panel completo</a>
          <a href="/">Ver app</a>
        </div>
      </header>

      <section className="admin-hero admin-hero--ops admin-advertising-hero">
        <span>Workspace publicidad</span>
        <h1>Sponsors, LED y cancha destacada</h1>
        <p>Revisa pagos de publicidad, habilita beneficios y publica campanas visibles en la app sin mezclarlas con torneos, equipos o resultados.</p>
        <div className="admin-hero-actions">
          <a href="#solicitudes">Solicitudes</a>
          <a href="#publicidad">Publicar sponsor</a>
        </div>
      </section>

      <section className="admin-ops-dashboard admin-advertising-dashboard" aria-label="Resumen de publicidad">
        <article className={pendingRequests ? "is-hot" : ""}><Clock3 size={18} /><div><strong>{pendingRequests}</strong><span>Solicitudes pendientes</span></div></article>
        <article><CheckCircle2 size={18} /><div><strong>{approvedRequests}</strong><span>Pagos aprobados</span></div></article>
        <article className={activeCampaigns ? "is-live" : ""}><Megaphone size={18} /><div><strong>{activeCampaigns}</strong><span>Campanas activas</span></div></article>
        <article><Trophy size={18} /><div><strong>{splashCampaigns}</strong><span>Splash habilitados</span></div></article>
      </section>

      {notice ? <p className="admin-notice admin-advertising-notice" role="status">{notice}</p> : null}

      <section className="admin-review-panel admin-advertising-requests" id="solicitudes">
        <header className="admin-review-toolbar">
          <div>
            <span>Solicitudes de publicidad</span>
            <h2>Sponsor local y cancha destacada</h2>
            <p>Aca llegan los comprobantes de quienes quieren aparecer en Fulbito. Aprobar activa el beneficio mensual; publicar el arte se hace en la seccion de abajo.</p>
          </div>
        </header>

        <section className="admin-request-tabs admin-advertising-tabs" aria-label="Filtrar solicitudes de publicidad">
          {[
            ["pending_review", "Pendientes"],
            ["approved", "Aprobadas"],
            ["rejected", "Rechazadas"],
            ["cancelled", "Canceladas"],
            ["all", "Todas"]
          ].map(([value, label]) => (
            <button className={filter === value ? "is-active" : ""} key={value} onClick={() => setFilter(value as AdvertisingRequestFilter)} type="button">
              <span>{label}</span>
              <strong>{filterCounts[value as AdvertisingRequestFilter]}</strong>
            </button>
          ))}
        </section>

        <section className="admin-payment-list">
          {filteredRequests.length ? filteredRequests.map((request) => {
            const requester = profileMap.get(request.requester_id);
            const venue = request.target_id ? venueMap.get(request.target_id) : null;
            const meta = paymentStatusMeta[request.status];
            const StatusIcon = statusIcons[request.status];
            const proofBusy = busyId === `proof-${request.id}`;
            const reviewBusy = busyId === `review-${request.id}`;
            const planLabel = request.plan_code === "featured_venue" ? "Cancha destacada" : "Sponsor local";
            return (
              <article className="admin-payment-card admin-ad-request-card" key={request.id}>
                <header>
                  <Requester profile={requester} />
                  <b className={`payment-status payment-status--${meta.tone}`}>
                    <StatusIcon size={15} />
                    {meta.label}
                  </b>
                </header>
                <div className="admin-payment-card__body">
                  <div>
                    <span>{planLabel}</span>
                    <h2>{request.title}</h2>
                    <strong>{formatPaymentMoney(request.amount)} / mes</strong>
                    <small>{formatDate(request.created_at)} / {request.proof_filename ?? "sin archivo"}</small>
                    {venue ? (
                      <p><MapPin size={15} /> {venue.name} / {venue.neighborhood} / {venue.phone || "sin WhatsApp"}</p>
                    ) : null}
                    <div className="admin-ad-note-chip-list">
                      {noteChips(request.payer_note).map((chip) => <small key={chip}>{chip}</small>)}
                    </div>
                  </div>
                  <button disabled={proofBusy} onClick={() => openProof(request)} type="button">
                    {proofBusy ? <LoaderCircle className="button-spinner" size={17} /> : <ExternalLink size={17} />}
                    Ver comprobante
                  </button>
                </div>
                <div className="admin-review-actions">
                  <button disabled={reviewBusy || request.status === "approved"} onClick={() => reviewRequest(request, "approved")} type="button">
                    {reviewBusy ? <LoaderCircle className="button-spinner" size={17} /> : <ShieldCheck size={17} />}
                    Habilitar publicidad
                  </button>
                  <button disabled={reviewBusy || request.status === "rejected"} onClick={() => reviewRequest(request, "rejected")} type="button">
                    <XCircle size={17} />
                    Rechazar
                  </button>
                </div>
              </article>
            );
          }) : (
            <article className="admin-empty">
              <Megaphone size={24} />
              <strong>No hay solicitudes en esta bandeja.</strong>
              <span>Cuando alguien pague Sponsor Local o Cancha Destacada, aparece aca.</span>
            </article>
          )}
        </section>
      </section>

      <AdminAdCampaignPanel adminId={adminId} initialCampaigns={adCampaigns} initialEvents={adCampaignEvents} />
    </main>
  );
}

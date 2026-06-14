"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, Clock3, ExternalLink, ImagePlus, LoaderCircle, MapPin, ShieldCheck, Upload, XCircle } from "lucide-react";
import { formatPaymentMoney, paymentStatusMeta } from "@/lib/payments";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AccountEntitlement, ArenaVenue, PaymentMessage, PaymentRequest, PaymentRequestStatus } from "@/lib/types";
import { normalizeVenueSurface, venueSurfaceOptions } from "@/lib/venue-options";

type AdminProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

type AdminVenue = ArenaVenue & {
  created_at?: string;
  updated_at?: string;
};

type VenueFilter = "all" | "free" | "pro" | "pending";

const statusIcons: Record<PaymentRequestStatus, typeof Clock3> = {
  pending_review: Clock3,
  approved: CheckCircle2,
  rejected: XCircle,
  cancelled: XCircle
};

function isActiveEntitlement(entitlement: AccountEntitlement) {
  return !entitlement.expires_at || new Date(entitlement.expires_at).getTime() >= Date.now();
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires"
  }).format(new Date(value));
}

async function optimizeVenueCover(file: File) {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const targetRatio = 16 / 9;
  let sourceWidth = bitmap.width;
  let sourceHeight = bitmap.height;
  let sourceX = 0;
  let sourceY = 0;
  const currentRatio = bitmap.width / bitmap.height;

  if (currentRatio > targetRatio) {
    sourceWidth = Math.round(bitmap.height * targetRatio);
    sourceX = Math.round((bitmap.width - sourceWidth) / 2);
  } else if (currentRatio < targetRatio) {
    sourceHeight = Math.round(bitmap.width / targetRatio);
    sourceY = Math.round((bitmap.height - sourceHeight) / 2);
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    bitmap.close();
    return file;
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#071018";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let quality = 0.76;
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (blob && blob.size <= 430 * 1024) break;
    quality -= 0.08;
  }
  if (!blob) return file;
  const filename = file.name.replace(/\.[^.]+$/, "") || "cancha";
  return new File([blob], `${filename}.webp`, { type: "image/webp" });
}

function ownerLabel(profile?: AdminProfile | null) {
  return profile?.display_name || "Usuario Fulbito";
}

export function AdminVenuesPanel({
  adminId,
  entitlements,
  profiles,
  requests: initialRequests,
  venues: initialVenues
}: {
  adminId: string;
  entitlements: AccountEntitlement[];
  profiles: AdminProfile[];
  requests: PaymentRequest[];
  venues: AdminVenue[];
}) {
  const [venues, setVenues] = useState(initialVenues);
  const [requests, setRequests] = useState(initialRequests);
  const [filter, setFilter] = useState<VenueFilter>("all");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const proVenueIds = useMemo(() => new Set(entitlements
    .filter((entitlement) => entitlement.plan_code === "featured_venue" && entitlement.target_type === "venue" && entitlement.target_id && isActiveEntitlement(entitlement))
    .map((entitlement) => entitlement.target_id as string)), [entitlements]);
  const pendingRequests = requests.filter((request) => request.status === "pending_review");
  const freeVenues = venues.filter((venue) => !proVenueIds.has(venue.id));
  const proVenues = venues.filter((venue) => proVenueIds.has(venue.id));
  const pendingVenues = venues.filter((venue) => ["pending", "pending_pro"].includes(venue.status));
  const filteredVenues = venues.filter((venue) => {
    if (filter === "free") return !proVenueIds.has(venue.id);
    if (filter === "pro") return proVenueIds.has(venue.id);
    if (filter === "pending") return ["pending", "pending_pro"].includes(venue.status);
    return true;
  });

  function replaceVenue(next: AdminVenue) {
    setVenues((current) => current.map((venue) => venue.id === next.id ? next : venue));
  }

  function replaceRequest(next: PaymentRequest) {
    setRequests((current) => current.map((request) => request.id === next.id ? next : request));
  }

  async function uploadCover(venue: AdminVenue, fileValue: FormDataEntryValue | null) {
    if (!(fileValue instanceof File) || fileValue.size === 0) return venue.cover_url ?? null;
    const optimized = await optimizeVenueCover(fileValue);
    const supabase = createSupabaseBrowserClient();
    const path = `${adminId}/${venue.id}-${Date.now().toString(36)}.webp`;
    const { error } = await supabase.storage.from("venue-photos").upload(path, optimized, {
      cacheControl: "604800",
      contentType: "image/webp",
      upsert: false
    });
    if (error) throw error;
    return supabase.storage.from("venue-photos").getPublicUrl(path).data.publicUrl;
  }

  async function updateVenue(event: FormEvent<HTMLFormElement>, venue: AdminVenue) {
    event.preventDefault();
    setNotice("");
    setBusyId(`venue-${venue.id}`);
    const form = new FormData(event.currentTarget);
    try {
      const coverUrl = await uploadCover(venue, form.get("coverFile"));
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("venues")
        .update({
          name: String(form.get("name") || venue.name).trim(),
          neighborhood: String(form.get("neighborhood") || "").trim() || "Barrio sin cargar",
          address: String(form.get("address") || "").trim() || null,
          phone: String(form.get("phone") || "").trim() || null,
          surface: normalizeVenueSurface(String(form.get("surface") || "")),
          price_per_hour: Number(form.get("pricePerHour") || 0),
          inscription_fee: Number(form.get("inscriptionFee") || 0),
          open_hours: String(form.get("openHours") || "").trim() || null,
          status: String(form.get("status") || venue.status),
          cover_url: coverUrl
        })
        .eq("id", venue.id)
        .select()
        .single();
      if (error) throw error;
      replaceVenue(data as AdminVenue);
      setNotice("Cancha actualizada. Los cambios ya impactan en mapa, ficha y publicidad.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo actualizar la cancha.");
    } finally {
      setBusyId("");
    }
  }

  async function openProof(request: PaymentRequest) {
    setNotice("");
    if (!request.proof_path) return setNotice("Esta solicitud no tiene comprobante adjunto.");
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
    try {
      const response = await fetch("/api/admin/payment-requests/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: request.id,
          status,
          note: status === "approved" ? "Cancha Pro aprobada. Fulbito habilita visibilidad y gestion de foto." : "Cancha Pro rechazada."
        })
      });
      const result = (await response.json()) as { request?: PaymentRequest; message?: PaymentMessage; error?: string };
      if (!response.ok || !result.request) throw new Error(result.error || "No se pudo revisar la solicitud.");
      replaceRequest(result.request);
      if (status === "approved" && request.target_id) {
        const currentVenue = venues.find((venue) => venue.id === request.target_id);
        if (currentVenue) replaceVenue({ ...currentVenue, status: "verified" });
      }
      setNotice(status === "approved" ? "Cancha Pro aprobada. Ahora podes ajustar foto, precio y estado desde la ficha." : "Solicitud rechazada y usuario notificado.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo revisar la solicitud.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="admin-shell admin-venues-shell">
      <a className="admin-floating-app-link" href="/">Ver app</a>
      <header className="admin-topbar admin-topbar--ops">
        <a className="admin-brand-link" href="/admin">
          <span className="admin-brand-mark">FA</span>
          <span>
            Fulbito Arena
            <small>Canchas</small>
          </span>
        </a>
        <div className="admin-topbar-actions">
          <span>Admin activo</span>
          <a href="/admin/publicidad">Publicidad</a>
          <a href="/admin">Panel completo</a>
          <a href="/">Ver app</a>
        </div>
      </header>

      <section className="admin-hero admin-hero--ops">
        <span>Alta de sedes</span>
        <h1>Gestión de canchas</h1>
        <p>La cancha gratis queda visible automáticamente. Cancha Pro requiere comprobante aprobado y gestión de imagen para mapa, ficha y cartelería.</p>
        <div className="admin-hero-actions">
          <a href="#solicitudes-cancha">Solicitudes Pro</a>
          <a href="#listado-canchas">Editar canchas</a>
          <a href="/admin/publicidad">Cartelería LED</a>
        </div>
      </section>

      <section className="admin-ops-dashboard admin-venues-dashboard" aria-label="Resumen de canchas">
        <article><MapPin size={18} /><div><strong>{venues.length}</strong><span>Canchas cargadas</span></div></article>
        <article><ShieldCheck size={18} /><div><strong>{freeVenues.length}</strong><span>Gratis visibles</span></div></article>
        <article className={proVenues.length ? "is-live" : ""}><ImagePlus size={18} /><div><strong>{proVenues.length}</strong><span>Cancha Pro activa</span></div></article>
        <article className={pendingRequests.length ? "is-hot" : ""}><Clock3 size={18} /><div><strong>{pendingRequests.length}</strong><span>Pagos pendientes</span></div></article>
        <article><Upload size={18} /><div><strong>{venues.filter((venue) => venue.cover_url).length}</strong><span>Con foto</span></div></article>
        <article><XCircle size={18} /><div><strong>{pendingVenues.length}</strong><span>Requieren revisión</span></div></article>
      </section>

      {notice ? <p className="admin-notice admin-advertising-notice" role="status">{notice}</p> : null}

      <section className="admin-review-panel admin-venue-requests" id="solicitudes-cancha">
        <header className="admin-review-toolbar">
          <div>
            <span>Cancha Pro</span>
            <h2>Comprobantes para destacar sedes</h2>
            <p>Al aprobar, la sede pasa a verificada y el beneficio queda activo por 30 días. Luego podés ajustar la foto WebP y los datos comerciales.</p>
          </div>
        </header>
        <section className="admin-payment-list">
          {pendingRequests.length ? pendingRequests.map((request) => {
            const venue = request.target_id ? venues.find((item) => item.id === request.target_id) : null;
            const meta = paymentStatusMeta[request.status];
            const StatusIcon = statusIcons[request.status];
            const busy = busyId === `review-${request.id}`;
            return (
              <article className="admin-payment-card admin-ad-request-card" key={request.id}>
                <header>
                  <div className="admin-requester">
                    <span>{ownerLabel(profileMap.get(request.requester_id))[0] ?? "F"}</span>
                    <div>
                      <strong>{ownerLabel(profileMap.get(request.requester_id))}</strong>
                      <small>Solicitante</small>
                    </div>
                  </div>
                  <b className={`payment-status payment-status--${meta.tone}`}><StatusIcon size={15} />{meta.label}</b>
                </header>
                <div className="admin-payment-card__body">
                  <div>
                    <span>Cancha destacada</span>
                    <h2>{request.title}</h2>
                    <strong>{formatPaymentMoney(request.amount)} / mes</strong>
                    <small>{formatDate(request.created_at)} / vence a 30 días de aprobado</small>
                    {venue ? <p><MapPin size={15} /> {venue.name} / {venue.neighborhood} / {venue.phone || "sin WhatsApp"}</p> : null}
                  </div>
                  <button disabled={busyId === `proof-${request.id}`} onClick={() => openProof(request)} type="button">
                    {busyId === `proof-${request.id}` ? <LoaderCircle className="button-spinner" size={17} /> : <ExternalLink size={17} />}
                    Ver comprobante
                  </button>
                </div>
                <div className="admin-review-actions">
                  <button disabled={busy} onClick={() => reviewRequest(request, "approved")} type="button">
                    {busy ? <LoaderCircle className="button-spinner" size={17} /> : <ShieldCheck size={17} />}
                    Aprobar Cancha Pro
                  </button>
                  <button disabled={busy} onClick={() => reviewRequest(request, "rejected")} type="button"><XCircle size={17} />Rechazar</button>
                </div>
              </article>
            );
          }) : (
            <article className="admin-empty">
              <ShieldCheck size={24} />
              <strong>No hay pagos de Cancha Pro pendientes.</strong>
              <span>Las canchas gratis no pasan por aprobación; aparecen en el listado de abajo.</span>
            </article>
          )}
        </section>
      </section>

      <section className="admin-review-panel admin-venues-list-panel" id="listado-canchas">
        <header className="admin-review-toolbar">
          <div>
            <span>Mapa y ficha pública</span>
            <h2>Listado de canchas</h2>
            <p>Editar acá impacta en el mapa, ficha de sede, consulta por WhatsApp y material publicitario de Cancha Pro.</p>
          </div>
        </header>
        <section className="admin-request-tabs admin-advertising-tabs" aria-label="Filtrar canchas">
          {[
            ["all", "Todas", venues.length],
            ["free", "Gratis", freeVenues.length],
            ["pro", "Pro", proVenues.length],
            ["pending", "Pendientes", pendingVenues.length]
          ].map(([value, label, count]) => (
            <button className={filter === value ? "is-active" : ""} key={value} onClick={() => setFilter(value as VenueFilter)} type="button">
              <span>{label}</span>
              <strong>{count}</strong>
            </button>
          ))}
        </section>

        <section className="admin-venue-grid">
          {filteredVenues.map((venue) => {
            const isPro = proVenueIds.has(venue.id);
            const owner = venue.owner_id ? profileMap.get(venue.owner_id) : null;
            const busy = busyId === `venue-${venue.id}`;
            return (
              <article className={`admin-venue-card ${isPro ? "is-pro" : "is-free"}`} key={venue.id}>
                <div className="admin-venue-cover">
                  {venue.cover_url ? <img alt="" src={venue.cover_url} /> : <ImagePlus size={26} />}
                  <b>{isPro ? "Cancha Pro" : "Gratis"}</b>
                </div>
                <form onSubmit={(event) => updateVenue(event, venue)}>
                  <header>
                    <div>
                      <span>{venue.status}</span>
                      <h3>{venue.name}</h3>
                      <small>{ownerLabel(owner)} / creada {formatDate(venue.created_at)}</small>
                    </div>
                  </header>
                  <div className="admin-venue-fields">
                    <input defaultValue={venue.name} name="name" placeholder="Nombre" />
                    <input defaultValue={venue.neighborhood} name="neighborhood" placeholder="Barrio" />
                    <input defaultValue={venue.address ?? ""} name="address" placeholder="Dirección" />
                    <input defaultValue={venue.phone ?? ""} name="phone" placeholder="WhatsApp" />
                    <select defaultValue={normalizeVenueSurface(venue.surface)} name="surface">
                      {venueSurfaceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <input defaultValue={venue.price_per_hour || ""} inputMode="numeric" name="pricePerHour" placeholder="Precio por hora" />
                    <input defaultValue={venue.inscription_fee || ""} inputMode="numeric" name="inscriptionFee" placeholder="Inscripción sugerida" />
                    <input defaultValue={venue.open_hours ?? ""} name="openHours" placeholder="Horarios" />
                    <select defaultValue={venue.status} name="status">
                      <option value="listed">Gratis visible</option>
                      <option value="pending_pro">Pendiente Pro</option>
                      <option value="verified">Verificada / Pro</option>
                      <option value="paused">Pausada</option>
                      <option value="rejected">Rechazada</option>
                    </select>
                    <label className="admin-ad-logo-field admin-venue-photo-field">
                      <Upload size={16} />
                      <span>{venue.cover_url ? "Reemplazar foto WebP" : "Cargar foto Pro"}</span>
                      <input accept="image/png,image/jpeg,image/webp" name="coverFile" type="file" />
                    </label>
                  </div>
                  <button disabled={busy} type="submit">
                    {busy ? <LoaderCircle className="button-spinner" size={17} /> : <ShieldCheck size={17} />}
                    Guardar cancha
                  </button>
                </form>
              </article>
            );
          })}
        </section>
      </section>
    </main>
  );
}

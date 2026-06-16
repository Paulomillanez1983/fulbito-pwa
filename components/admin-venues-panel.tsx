"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { CheckCircle2, Clock3, ExternalLink, ImagePlus, LoaderCircle, MapPin, ShieldCheck, Upload, XCircle } from "lucide-react";
import { FrameHiddenInputs, ImageFrameTuner, defaultImageFrame, framePreviewStyle } from "@/components/image-frame-controls";
import type { ImageFrameDraft } from "@/components/image-frame-controls";
import { optimizeImageForUpload, readImageFrameOptions, type ImageFrameOptions } from "@/lib/image-optimizer";
import { formatPaymentMoney, paymentStatusMeta } from "@/lib/payments";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AccountEntitlement, ArenaVenue, PaymentMessage, PaymentRequest, PaymentRequestStatus } from "@/lib/types";
import {
  composeInternationalPhone,
  getPhoneCountry,
  normalizePhoneNational,
  normalizeVenuePhoneForCountry,
  normalizeVenueSurfaces,
  primaryVenuePrice,
  readVenueFormatPrices,
  southAmericanPhoneCountries,
  venueSurfaceLabel,
  venueSurfaceOptions,
  venueSurfacesFromStored
} from "@/lib/venue-options";

type AdminProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

type AdminVenue = ArenaVenue & {
  created_at?: string;
  updated_at?: string;
};

type AdminVenueMediaSet = {
  coverUrl: string | null;
  logoUrl: string | null;
  markerUrl: string | null;
  cardUrl: string | null;
  heroUrl: string | null;
  frame: ImageFrameOptions | null;
};

function frameForDerivative(frameOptions: ImageFrameOptions | null | undefined, shape: ImageFrameOptions["shape"] = "none") {
  return { ...(frameOptions ?? {}), shape };
}

function AdminVenuePhotoFrameField({ currentUrl }: { currentUrl?: string | null }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [frame, setFrame] = useState<ImageFrameDraft>(() => defaultImageFrame("venue"));

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFilename(file?.name ?? "");
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  return (
    <div className="admin-venue-frame-field">
      <label className="admin-ad-logo-field admin-venue-photo-field">
        <Upload size={16} />
        <span>{filename || (currentUrl ? "Reemplazar foto WebP" : "Cargar foto Pro")}</span>
        <input accept="image/png,image/jpeg,image/webp" name="coverFile" onChange={onFileChange} type="file" />
        <FrameHiddenInputs frame={frame} name="coverFile" />
      </label>
      {preview || currentUrl ? (
        <div className="admin-venue-frame-preview">
          <span data-frame-shape={frame.shape} style={framePreviewStyle(frame)}>
            <img alt="" src={preview || currentUrl || ""} />
          </span>
          <ImageFrameTuner allowNoShape frame={frame} label="Corregir encuadre" onFrameChange={setFrame} variant="venue" />
        </div>
      ) : null}
    </div>
  );
}

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

function FlagCountrySelect({ defaultValue, name }: { defaultValue: string; name: string }) {
  const selected = getPhoneCountry(defaultValue);
  return (
    <label className="flag-country-select" title={`${selected.name} ${selected.dialCode}`}>
      <span>{selected.flag}</span>
      <select aria-label={`Pais del WhatsApp: ${selected.name}`} defaultValue={selected.iso} name={name}>
        {southAmericanPhoneCountries.map((country) => <option key={country.iso} value={country.iso}>{country.flag}</option>)}
      </select>
    </label>
  );
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

  async function uploadVenueDerivative(
    venue: AdminVenue,
    fileValue: File,
    preset: "venue_logo" | "venue_marker" | "venue_card" | "venue_cover",
    frameOptions: ImageFrameOptions | null | undefined,
    suffix: string
  ) {
    const optimized = await optimizeImageForUpload(fileValue, preset, frameOptions);
    const supabase = createSupabaseBrowserClient();
    const path = `${adminId}/${venue.id}-${Date.now().toString(36)}-${suffix}.webp`;
    const { error } = await supabase.storage.from("venue-photos").upload(path, optimized, {
      cacheControl: "604800",
      contentType: "image/webp",
      upsert: false
    });
    if (error) throw error;
    return supabase.storage.from("venue-photos").getPublicUrl(path).data.publicUrl;
  }

  async function uploadCover(venue: AdminVenue, fileValue: FormDataEntryValue | null, frameOptions?: ImageFrameOptions | null): Promise<AdminVenueMediaSet> {
    if (!(fileValue instanceof File) || fileValue.size === 0) {
      return {
        coverUrl: venue.cover_url ?? null,
        logoUrl: venue.logo_url ?? null,
        markerUrl: venue.marker_url ?? null,
        cardUrl: venue.card_url ?? null,
        heroUrl: venue.hero_url ?? venue.cover_url ?? null,
        frame: venue.media_frame as ImageFrameOptions | null
      };
    }
    const logoUrl = await uploadVenueDerivative(venue, fileValue, "venue_logo", frameOptions, "logo");
    const markerUrl = await uploadVenueDerivative(venue, fileValue, "venue_marker", frameForDerivative(frameOptions, "none"), "pin");
    const cardUrl = await uploadVenueDerivative(venue, fileValue, "venue_card", frameForDerivative(frameOptions, "none"), "card");
    const heroUrl = await uploadVenueDerivative(venue, fileValue, "venue_cover", frameForDerivative(frameOptions, "none"), "hero");
    return {
      coverUrl: heroUrl,
      logoUrl,
      markerUrl,
      cardUrl,
      heroUrl,
      frame: frameOptions ?? null
    };
  }

  async function updateVenue(event: FormEvent<HTMLFormElement>, venue: AdminVenue) {
    event.preventDefault();
    setNotice("");
    setBusyId(`venue-${venue.id}`);
    const form = new FormData(event.currentTarget);
    try {
      const mediaSet = await uploadCover(venue, form.get("coverFile"), readImageFrameOptions(form, "coverFile", { shape: "rounded" }));
      const supabase = createSupabaseBrowserClient();
      const selectedModes = normalizeVenueSurfaces(form.getAll("surface"));
      const formatPrices = readVenueFormatPrices(form, selectedModes);
      const phoneCountry = getPhoneCountry(String(form.get("phoneCountryIso") || venue.phone_country_iso || "AR"));
      const phoneNational = normalizeVenuePhoneForCountry(phoneCountry.iso, String(form.get("phoneNational") || ""));
      const { data, error } = await supabase
        .from("venues")
        .update({
          name: String(form.get("name") || venue.name).trim(),
          neighborhood: String(form.get("neighborhood") || "").trim() || "Barrio sin cargar",
          address: String(form.get("address") || "").trim() || null,
          phone: composeInternationalPhone(phoneCountry.iso, phoneNational),
          phone_country_iso: phoneCountry.iso,
          phone_country_code: phoneCountry.dialCode,
          phone_national: phoneNational || null,
          surface: selectedModes.join(","),
          field_modes: selectedModes,
          format_prices: formatPrices,
          price_per_hour: primaryVenuePrice(formatPrices, selectedModes),
          inscription_fee: Number(form.get("reserveFee") || 0),
          open_hours: String(form.get("openHours") || "").trim() || null,
          status: String(form.get("status") || venue.status),
          cover_url: mediaSet.coverUrl,
          logo_url: mediaSet.logoUrl,
          marker_url: mediaSet.markerUrl,
          card_url: mediaSet.cardUrl,
          hero_url: mediaSet.heroUrl,
          media_frame: mediaSet.frame
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
          <a href="/admin/torneos">Torneos</a>
          <a href="/admin/precios">Precios</a>
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
          <a href="/admin/precios">Precios y promos</a>
          <a href="/admin/torneos">Panel torneos</a>
          <a href="/admin/publicidad">Cartelería LED</a>
        </div>
      </section>

      <section className="admin-ops-dashboard admin-venues-dashboard" aria-label="Resumen de canchas">
        <article><MapPin size={18} /><div><strong>{venues.length}</strong><span>Canchas cargadas</span></div></article>
        <article><ShieldCheck size={18} /><div><strong>{freeVenues.length}</strong><span>Gratis visibles</span></div></article>
        <article className={proVenues.length ? "is-live" : ""}><ImagePlus size={18} /><div><strong>{proVenues.length}</strong><span>Cancha Pro activa</span></div></article>
        <article className={pendingRequests.length ? "is-hot" : ""}><Clock3 size={18} /><div><strong>{pendingRequests.length}</strong><span>Pagos pendientes</span></div></article>
        <article><Upload size={18} /><div><strong>{venues.filter((venue) => venue.cover_url || venue.logo_url || venue.card_url || venue.hero_url).length}</strong><span>Con foto</span></div></article>
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
            const selectedModes = venueSurfacesFromStored(venue.field_modes, venue.surface);
            const formatPrices = venue.format_prices ?? {};
            const selectedPhoneCountry = getPhoneCountry(venue.phone_country_iso);
            const coverPreview = venue.hero_url || venue.card_url || venue.cover_url || venue.logo_url;
            return (
              <article className={`admin-venue-card ${isPro ? "is-pro" : "is-free"}`} key={venue.id}>
                <div className="admin-venue-cover">
                  {coverPreview ? <img alt="" src={coverPreview} /> : <ImagePlus size={26} />}
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
                    <div className="admin-venue-phone-row">
                      <FlagCountrySelect defaultValue={selectedPhoneCountry.iso} name="phoneCountryIso" />
                      <input defaultValue={venue.phone_national ?? normalizePhoneNational(venue.phone ?? "")} inputMode="tel" name="phoneNational" placeholder={selectedPhoneCountry.placeholder} />
                    </div>
                    <div className="admin-venue-mode-checks">
                      {venueSurfaceOptions.map((option) => (
                        <label key={option.value}>
                          <input defaultChecked={selectedModes.includes(option.value)} name="surface" type="checkbox" value={option.value} />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="admin-venue-price-grid">
                      {venueSurfaceOptions.map((option) => (
                        <label key={option.value}>
                          <span>{venueSurfaceLabel(option.value)}</span>
                          <input defaultValue={formatPrices[option.value] || (selectedModes.includes(option.value) ? venue.price_per_hour || "" : "")} inputMode="numeric" name={`price_${option.value}`} placeholder="Precio hora" />
                        </label>
                      ))}
                    </div>
                    <input defaultValue={venue.inscription_fee || ""} inputMode="numeric" name="reserveFee" placeholder="Seña de reserva opcional" />
                    <input defaultValue={venue.open_hours ?? ""} name="openHours" placeholder="Horarios" />
                    <select defaultValue={venue.status} name="status">
                      <option value="listed">Gratis visible</option>
                      <option value="pending_pro">Pendiente Pro</option>
                      <option value="verified">Verificada / Pro</option>
                      <option value="paused">Pausada</option>
                      <option value="rejected">Rechazada</option>
                    </select>
                    <AdminVenuePhotoFrameField currentUrl={venue.logo_url || venue.cover_url} />
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

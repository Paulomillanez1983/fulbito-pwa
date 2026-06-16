"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Camera, Clipboard, Flag, LoaderCircle, LocateFixed, MapPinned, ShieldPlus, Upload, UserPlus } from "lucide-react";
import { FrameHiddenInputs, ImageFrameTuner, defaultImageFrame, framePreviewStyle } from "@/components/image-frame-controls";
import type { ImageFrameDraft } from "@/components/image-frame-controls";
import { SlideSubmitButton } from "@/components/slide-submit-button";
import { storedImageFrameTransform } from "@/lib/image-frame";
import { optimizeImageForUpload, readImageFrameOptions, type ImageFrameOptions, type UploadImagePreset } from "@/lib/image-optimizer";
import { formatPaymentMoney, mergePaymentPlans, paymentAccount } from "@/lib/payments";
import { getRosterRule } from "@/lib/roster";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ArenaData } from "@/lib/types";
import {
  composeInternationalPhone,
  getPhoneCountry,
  normalizeVenuePhoneForCountry,
  normalizeVenueSurfaces,
  primaryVenuePrice,
  readVenueFormatPrices,
  southAmericanPhoneCountries,
  venueSurfaceOptions
} from "@/lib/venue-options";
import type { SouthAmericanPhoneCountryIso, VenueSurfaceValue } from "@/lib/venue-options";
import type { Map, Marker } from "maplibre-gl";

type ActionMode = "all" | "squad" | "venue" | "result" | "slot" | "self-player";
type MediaBucket = "team-badges" | "player-photos" | "venue-photos";

const mediaPresetByBucket: Record<MediaBucket, UploadImagePreset> = {
  "team-badges": "team_badge",
  "player-photos": "player_photo",
  "venue-photos": "venue_photo"
};

type VenueMediaUpload = {
  coverUrl: string | null;
  logoUrl: string | null;
  markerUrl: string | null;
  cardUrl: string | null;
  heroUrl: string | null;
  galleryUrls: string[];
  frame: ImageFrameOptions | null;
};

function frameForDerivative(frameOptions: ImageFrameOptions | null | undefined, shape: ImageFrameOptions["shape"] = "none") {
  return { ...(frameOptions ?? {}), shape };
}

type SlotDraft = {
  label: string;
  jersey: number;
  position: string;
};

function mediaInitialFrame(variant: "crest" | "avatar" | "wide" | "square", initialFrame?: unknown): ImageFrameDraft {
  const base = defaultImageFrame(variant);
  const stored = storedImageFrameTransform(initialFrame, base.shape);
  return {
    shape: stored.shape as ImageFrameDraft["shape"],
    zoom: stored.zoom,
    offsetX: stored.offsetX,
    offsetY: stored.offsetY
  };
}

const playerPositionGroups = [
  {
    label: "Base",
    options: ["Arquero", "Defensa", "Volante", "Delantero"]
  },
  {
    label: "Futbol 5",
    options: ["Cierre", "Ala derecha", "Ala izquierda", "Pivot"]
  },
  {
    label: "Futbol 7 / 11",
    options: [
      "Defensa central",
      "Lateral derecho",
      "Lateral izquierdo",
      "Carrilero",
      "Volante defensivo",
      "Volante mixto",
      "Mediocampista",
      "Enganche",
      "Extremo derecho",
      "Extremo izquierdo"
    ]
  }
];

const playerRoleOptions = [
  { value: "player", label: "Jugador", helper: "Ficha normal" },
  { value: "captain", label: "Capitan", helper: "Responsable" }
] as const;

type ReverseGeocodeResult = {
  neighborhood?: string;
  address?: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function SubmitButton({
  idle,
  pending,
  disabled = false,
  disabledLabel
}: {
  idle: string;
  pending: string;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  return <SlideSubmitButton disabled={disabled} disabledLabel={disabledLabel} idle={idle} pendingLabel={pending} />;
}

function FlagCountrySelect({
  name,
  value,
  onChange
}: {
  name: string;
  value: SouthAmericanPhoneCountryIso;
  onChange: (value: SouthAmericanPhoneCountryIso) => void;
}) {
  const selected = getPhoneCountry(value);
  return (
    <label className="flag-country-select" title={`${selected.name} ${selected.dialCode}`}>
      <span>{selected.flag}</span>
      <select aria-label={`Pais del WhatsApp: ${selected.name}`} name={name} value={selected.iso} onChange={(event) => onChange(event.target.value as SouthAmericanPhoneCountryIso)}>
        {southAmericanPhoneCountries.map((country) => <option key={country.iso} value={country.iso}>{country.flag}</option>)}
      </select>
    </label>
  );
}

function MediaField({
  name,
  accept,
  label,
  helper,
  variant = "square",
  currentSrc,
  initialFrame
}: {
  name: string;
  accept: string;
  label: string;
  helper: string;
  variant?: "crest" | "avatar" | "wide" | "square";
  currentSrc?: string | null;
  initialFrame?: unknown;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [frame, setFrame] = useState<ImageFrameDraft>(() => mediaInitialFrame(variant, initialFrame));
  const [status, setStatus] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const initialFrameKey = JSON.stringify(initialFrame ?? null);

  useEffect(() => {
    setFrame(mediaInitialFrame(variant, initialFrame));
  }, [initialFrameKey, variant]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function setPreviewFromFile(file?: File | null) {
    setFilename(file?.name ?? "");
    setStatus(file ? "Ajusta zoom y posicion antes de guardar. Fulbito lo sube en WebP liviano." : "");
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  function setInputFile(file: File) {
    if (!inputRef.current) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    inputRef.current.files = transfer.files;
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreviewFromFile(file);
  }

  async function editCurrentImage() {
    if (!currentSrc) return;
    setStatus("Preparando la foto actual...");
    try {
      const response = await fetch(currentSrc);
      if (!response.ok) throw new Error("No se pudo leer la imagen actual.");
      const blob = await response.blob();
      const extension = blob.type.includes("png")
        ? "png"
        : blob.type.includes("webp")
          ? "webp"
          : blob.type.includes("avif")
            ? "avif"
            : "jpg";
      const file = new File([blob], `${name}-actual.${extension}`, { type: blob.type || "image/jpeg" });
      setInputFile(file);
      setFrame(mediaInitialFrame(variant, initialFrame));
      setPreviewFromFile(file);
      setStatus("Foto actual lista para reencuadrar.");
    } catch {
      setStatus("No pude editar la foto actual. Subi una nueva imagen y Fulbito la optimiza.");
    }
  }

  function autoFrame() {
    setFrame((current) => ({ ...defaultImageFrame(variant), shape: current.shape }));
    setStatus("Autoencuadre aplicado. Podes ajustar fino si hace falta.");
  }

  return (
    <div className={`media-frame-field media-frame-field--${variant}`}>
      <label className={`media-field media-field--${variant}`}>
        <input accept={accept} name={name} onChange={onFileChange} ref={inputRef} type="file" />
        <FrameHiddenInputs frame={frame} name={name} />
        <span className="media-field__preview" data-frame-shape={frame.shape} style={framePreviewStyle(frame)}>
          {preview ? <img alt="" src={preview} /> : currentSrc ? <img alt="" src={currentSrc} /> : <Camera size={20} />}
        </span>
        <span className="media-field__copy">
          <strong>{label}</strong>
          <small>{filename || (currentSrc ? "Toca para elegir una nueva imagen. Fulbito la guarda en WebP." : helper)}</small>
        </span>
      </label>
      <div className="media-field-actions">
        {currentSrc ? (
          <button onClick={editCurrentImage} type="button">
            Editar foto actual
          </button>
        ) : null}
        <button onClick={autoFrame} type="button">
          Hacerlo automaticamente
        </button>
      </div>
      {preview ? (
        <ImageFrameTuner
          allowNoShape={variant === "wide" || variant === "square"}
          frame={frame}
          label={variant === "avatar" ? "Ajusta rostro" : variant === "crest" ? "Ajusta escudo" : "Ajusta imagen"}
          onFrameChange={setFrame}
          variant={variant}
        />
      ) : null}
      {status ? <p className="media-field-status">{status}</p> : null}
    </div>
  );
}

function PlayerPhotoGuide() {
  return (
    <aside className="player-photo-guide" aria-label="Guia para foto de jugador">
      <span><Camera size={18} /></span>
      <div>
        <strong>Foto ideal para tu carta</strong>
        <small>Usa buena luz, mira de frente o 3/4, cuerpo medio, celular vertical y deja aire arriba de la cabeza. Si el fondo es simple, la carta queda mucho mas limpia.</small>
      </div>
      <ul>
        <li>Evita fotos oscuras o muy lejanas.</li>
        <li>No tapes la cara con gorra, lentes o sombras.</li>
        <li>Ajusta zoom y posicion antes de guardar.</li>
      </ul>
    </aside>
  );
}

function PlayerPositionPicker({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="player-position-picker" aria-label="Seleccionar posicion">
      <input name="position" type="hidden" value={value} />
      {playerPositionGroups.map((group) => (
        <div className="player-position-picker__group" key={group.label}>
          <span>{group.label}</span>
          <div>
            {group.options.map((position) => (
              <button
                aria-pressed={value === position}
                className={value === position ? "is-active" : ""}
                key={position}
                onClick={() => onChange(position)}
                type="button"
              >
                {position}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function PlayerRolePicker({
  value,
  onChange
}: {
  value: "player" | "captain";
  onChange: (value: "player" | "captain") => void;
}) {
  return (
    <section className="player-role-picker" aria-label="Rol dentro del club">
      <input name="playerRole" type="hidden" value={value} />
      <span>Rol de tu ficha</span>
      <div>
        {playerRoleOptions.map((option) => (
          <button
            aria-pressed={value === option.value}
            className={value === option.value ? "is-active" : ""}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            <strong>{option.label}</strong>
            <small>{option.helper}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function VenueGalleryField({
  previews,
  onPreviewsChange
}: {
  previews: string[];
  onPreviewsChange: (previews: string[]) => void;
}) {
  const [filename, setFilename] = useState("");
  const [frame, setFrame] = useState<ImageFrameDraft>(() => defaultImageFrame("venue"));

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 3);
    setFilename(files.length ? `${files.length} imagen${files.length === 1 ? "" : "es"} seleccionada${files.length === 1 ? "" : "s"}` : "");
    onPreviewsChange(files.map((file) => URL.createObjectURL(file)));
  }

  return (
    <div className="venue-gallery-frame">
      <label className="venue-gallery-field">
        <input accept="image/png,image/jpeg,image/webp" multiple name="venueGalleryFiles" onChange={onFileChange} type="file" />
        <FrameHiddenInputs frame={frame} name="venueGalleryFiles" />
        <span className="venue-gallery-field__stack" data-frame-shape={frame.shape} style={framePreviewStyle(frame)}>
          {previews[0] ? <img alt="" src={previews[0]} /> : <Camera size={20} />}
          {previews.slice(1, 3).map((preview) => <img alt="" key={preview} src={preview} />)}
        </span>
        <span className="venue-gallery-field__copy">
          <strong>Logo o foto principal de la cancha</strong>
          <small>{filename || "Hasta 3 imagenes. La primera arma logo, pin y portada; Fulbito convierte todo a WebP liviano."}</small>
        </span>
      </label>
      {previews.length ? (
        <ImageFrameTuner
          allowNoShape
          frame={frame}
          label="Ajusta portada"
          onFrameChange={setFrame}
          variant="venue"
        />
      ) : null}
    </div>
  );
}

function ProofUploadField({
  ready,
  onReady
}: {
  ready: boolean;
  onReady: (ready: boolean) => void;
}) {
  return (
    <label className={`proof-upload proof-upload--venue ${ready ? "is-sent" : ""}`}>
      <Upload size={17} />
      <span>{ready ? "Comprobante adjunto" : "Adjuntar comprobante"}</span>
      <input
        accept="image/png,image/jpeg,image/webp,application/pdf"
        name="venueProofFile"
        onChange={(event) => onReady(Boolean(event.target.files?.[0]))}
        type="file"
      />
    </label>
  );
}

function InlineVenuePaymentAccount({ amount }: { amount: number }) {
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
    <div className="inline-payment-account venue-payment-account">
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

function VenueModePreview({
  mode,
  surfaces,
  amount,
  images = [],
  name,
  address,
  phone
}: {
  mode: "simple" | "pro";
  surfaces: VenueSurfaceValue[];
  amount?: number;
  images?: string[];
  name?: string;
  address?: string;
  phone?: string;
}) {
  const pro = mode === "pro";
  const displayName = name?.trim() || (pro ? "Arena Fulbito Norte" : "Cancha del barrio");
  const displayAddress = address?.trim() || "Direccion visible en el mapa";
  const displayPhone = phone?.trim() || "WhatsApp visible";
  const selectedLabels = surfaces
    .map((surface) => venueSurfaceOptions.find((option) => option.value === surface)?.label ?? surface)
    .join(" + ");

  return (
    <section className={`venue-mode-preview venue-mode-preview--${mode}`} aria-live="polite">
      <div className="venue-mode-preview__copy">
        <span>{pro ? "Vista Cancha PRO" : "Vista gratis"}</span>
        <strong>{pro ? "Asi queda publicada destacada" : "Asi queda publicada simple"}</strong>
        <p>
          {pro
            ? "Foto o logo, precios por formato, boton de WhatsApp, mapa destacado y aparicion en carteleria LED."
            : "Ubicacion real, nombre de la sede y WhatsApp. Sin foto ni publicidad para cuidar storage."}
        </p>
      </div>
      <div className="venue-preview-card" aria-hidden="true">
        <div className="venue-preview-card__media">
          <span>{pro ? "PRO" : "GRATIS"}</span>
          {pro && images[0] ? (
            <img alt="" src={images[0]} />
          ) : (
            <div className="venue-preview-field">
              <i />
              <b>{pro ? "FOTO / LOGO" : "PIN"}</b>
            </div>
          )}
        </div>
        <div className="venue-preview-card__info">
          <small>{pro ? "Cancha destacada" : "Registro basico"}</small>
          <strong>{displayName}</strong>
          <em>{displayAddress}</em>
          <span>{selectedLabels || "5 vs 5"}</span>
          <div>
            <b>{pro && amount ? `${formatPaymentMoney(amount)} / mes` : displayPhone}</b>
            <b>{pro ? "Precio por hora" : "Mapa 50 km"}</b>
          </div>
        </div>
      </div>
      {pro ? (
        <div className="venue-preview-gallery" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span key={index}>
              {images[index] ? <img alt="" src={images[index]} /> : <i>{index + 1}</i>}
            </span>
          ))}
        </div>
      ) : null}
      <div className="venue-preview-strip" aria-hidden="true">
        <span>{pro ? "LED SPONSOR" : "SIN LED"}</span>
        <strong>{pro ? "TU CANCHA EN FULBITO ARENA" : "UBICACION + CONTACTO"}</strong>
      </div>
    </section>
  );
}

async function optimizeProofFile(file: File) {
  if (file.type === "application/pdf" || !file.type.startsWith("image/")) return file;
  return optimizeImageForUpload(file, "payment_proof");
}

function VenueLocationPicker() {
  const [coordinates, setCoordinates] = useState({ latitude: -34.6037, longitude: -58.3816 });
  const [locationReady, setLocationReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [status, setStatus] = useState("Usa tu ubicacion actual, toca el mapa o arrastra el pin para confirmar la sede.");
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const geocodeRequestRef = useRef(0);

  function setMapPoint(next: { latitude: number; longitude: number }, ready = true) {
    setCoordinates(next);
    setLocationReady(ready);
    markerRef.current?.setLngLat([next.longitude, next.latitude]);
    mapRef.current?.flyTo({ center: [next.longitude, next.latitude], zoom: ready ? 15 : 12.4 });
    if (ready) {
      void reverseGeocode(next);
    }
  }

  function setInputValue(name: string, value: string) {
    if (!mapNode.current || !value) return;
    const form = mapNode.current.closest("form");
    const input = form?.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    if (!input || (input.type !== "hidden" && input.value)) return;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function reverseGeocode(point: { latitude: number; longitude: number }) {
    const requestId = geocodeRequestRef.current + 1;
    geocodeRequestRef.current = requestId;
    setGeocoding(true);
    try {
      const params = new URLSearchParams({
        lat: String(point.latitude),
        lon: String(point.longitude)
      });
      const response = await fetch(`/api/reverse-geocode?${params.toString()}`);
      if (!response.ok) throw new Error("No se pudo leer la direccion.");
      const result = (await response.json()) as ReverseGeocodeResult;
      if (geocodeRequestRef.current !== requestId) return;
      setInputValue("venueNeighborhood", result.neighborhood ?? "");
      setInputValue("venueAddress", result.address ?? "");
      setStatus(result.neighborhood || result.address ? "Ubicacion tomada y datos sugeridos. Si no es exacta, arrastra el pin." : "Ubicacion tomada. Completa barrio y direccion manualmente.");
    } catch {
      if (geocodeRequestRef.current === requestId) {
        setStatus("Ubicacion tomada. No se pudo sugerir direccion; completala manualmente.");
      }
    } finally {
      if (geocodeRequestRef.current === requestId) setGeocoding(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function mountMap() {
      if (!mapNode.current) return;
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !mapNode.current) return;

      const markerNode = document.createElement("span");
      markerNode.className = "venue-picker-marker";
      markerNode.innerHTML = "<i></i>";

      const map = new maplibregl.Map({
        container: mapNode.current,
        style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
        center: [coordinates.longitude, coordinates.latitude],
        zoom: 12.4,
        dragPan: false,
        dragRotate: false,
        scrollZoom: false,
        touchZoomRotate: false,
        doubleClickZoom: false,
        keyboard: false,
        attributionControl: false
      });

      const marker = new maplibregl.Marker({ element: markerNode, draggable: true })
        .setLngLat([coordinates.longitude, coordinates.latitude])
        .addTo(map);

      marker.on("dragend", () => {
        const point = marker.getLngLat();
        setMapPoint({ latitude: Number(point.lat.toFixed(6)), longitude: Number(point.lng.toFixed(6)) });
        setStatus("Ubicacion ajustada desde el puntero.");
      });

      map.on("click", (event) => {
        const next = { latitude: Number(event.lngLat.lat.toFixed(6)), longitude: Number(event.lngLat.lng.toFixed(6)) };
        setMapPoint(next);
        setStatus("Ubicacion confirmada desde el mapa.");
      });

      mapRef.current = map;
      markerRef.current = marker;
    }

    mountMap();
    return () => {
      cancelled = true;
      markerRef.current?.remove();
      mapRef.current?.remove();
    };
  }, []);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus("Tu navegador no permite tomar ubicacion actual. Toca el mapa para marcar la cancha.");
      return;
    }

    setLocating(true);
    setStatus("Buscando tu ubicacion actual...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6))
        };
        setMapPoint(next);
        setStatus("Ubicacion actual tomada. Si no es exacta, arrastra el pin hasta la entrada real.");
        setLocating(false);
      },
      () => {
        setStatus("No se pudo tomar tu ubicacion. Toca el mapa o mueve el puntero.");
        setLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 12000 }
    );
  }

  return (
    <div className="venue-picker">
      <input name="latitude" type="hidden" value={locationReady ? coordinates.latitude : ""} />
      <input name="longitude" type="hidden" value={locationReady ? coordinates.longitude : ""} />
      <div className="venue-location-tools">
        <button disabled={locating} onClick={useCurrentLocation} type="button">
          {locating ? <LoaderCircle className="button-spinner" size={16} /> : <LocateFixed size={16} />}
          {locating ? "Buscando ubicacion" : "Usar mi ubicacion actual"}
        </button>
        <span className={locationReady ? "is-ready" : ""}>{geocoding ? "Leyendo zona" : locationReady ? "Ubicacion lista" : "Pendiente"}</span>
      </div>
      <div className="venue-picker__map" ref={mapNode} />
      <p>{status}</p>
      <small>La ubicacion exacta se guarda por coordenadas. Podes mover el pin antes de registrar la cancha.</small>
    </div>
  );
}

export function ArenaActions({
  data,
  mode = "all",
  selectedTeamId,
  slotDraft,
  teamEditorOnly = false
}: {
  data: ArenaData;
  mode?: ActionMode;
  selectedTeamId?: string;
  slotDraft?: SlotDraft;
  teamEditorOnly?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState("");
  const [pendingEnrollId, setPendingEnrollId] = useState("");
  const showTeam = mode === "all" || mode === "squad";
  const resultMatches = data.matches.filter((match) => match.home_team_id && match.away_team_id && match.status !== "final");
  const hasMatches = resultMatches.length > 0;
  const showVenue = mode === "all" || mode === "venue";
  const showResult = hasMatches && (mode === "all" || mode === "result");
  const selfPlayerMode = mode === "self-player";
  const ownedTeams = data.user ? data.teams.filter((team) => team.owner_id === data.user?.id) : [];
  const ownedTeamIds = ownedTeams.map((team) => team.id).join("|");
  const defaultOwnedTeamId = selectedTeamId && ownedTeams.some((team) => team.id === selectedTeamId) ? selectedTeamId : ownedTeams[0]?.id ?? "";
  const [selectedOwnedTeamId, setSelectedOwnedTeamId] = useState(defaultOwnedTeamId);
  const selectedOwnedTeam = ownedTeams.find((team) => team.id === selectedOwnedTeamId) ?? ownedTeams[0] ?? null;
  const selectedOwnedTeamEnrolled = Boolean(
    selectedOwnedTeam &&
    data.activeTournament &&
    data.tournamentTeams.some((row) => row.tournament_id === data.activeTournament?.id && row.team_id === selectedOwnedTeam.id)
  );
  const selectedManagedTeam = selectedTeamId ? data.teams.find((team) => team.id === selectedTeamId) : null;
  const managedTeam = selfPlayerMode ? selectedManagedTeam ?? null : selectedManagedTeam ?? selectedOwnedTeam ?? null;
  const playerTeamId = managedTeam?.id ?? "";
  const rosterRule = getRosterRule(data.activeTournament?.field_mode);
  const managedTeamPlayers = data.players.filter((player) => player.team_id === playerTeamId);
  const ownManagedPlayer = data.user ? managedTeamPlayers.find((player) => player.profile_id === data.user?.id) : null;
  const defaultPlayerPosition = slotDraft?.position ?? ownManagedPlayer?.position ?? "";
  const defaultPlayerRole = ownManagedPlayer?.role === "captain" ? "captain" : "player";
  const rosterFull = Boolean(playerTeamId && managedTeamPlayers.length >= rosterRule.maxPlayers);
  const showPlayer = !teamEditorOnly && Boolean(managedTeam) && (mode === "all" || mode === "squad" || mode === "slot" || selfPlayerMode);
  const [playerDraft, setPlayerDraft] = useState({
    name: selfPlayerMode ? ownManagedPlayer?.display_name ?? "" : "",
    alias: selfPlayerMode ? ownManagedPlayer?.alias ?? "" : "",
    jersey: String(slotDraft?.jersey ?? ownManagedPlayer?.jersey_number ?? ""),
    position: defaultPlayerPosition,
    role: defaultPlayerRole as "player" | "captain"
  });
  const [venueMode, setVenueMode] = useState<"simple" | "pro">("simple");
  const [venueSurfaces, setVenueSurfaces] = useState<VenueSurfaceValue[]>([venueSurfaceOptions[0].value]);
  const [venuePhoneCountryIso, setVenuePhoneCountryIso] = useState<SouthAmericanPhoneCountryIso>(southAmericanPhoneCountries[0].iso);
  const [venueDraft, setVenueDraft] = useState({ name: "", address: "", phone: "" });
  const [venueProofReady, setVenueProofReady] = useState(false);
  const [venueImagePreviews, setVenueImagePreviews] = useState<string[]>([]);
  const selectedPhoneCountry = getPhoneCountry(venuePhoneCountryIso);
  const venuePreviewPhone = normalizeVenuePhoneForCountry(venuePhoneCountryIso, venueDraft.phone)
    ? composeInternationalPhone(venuePhoneCountryIso, normalizeVenuePhoneForCountry(venuePhoneCountryIso, venueDraft.phone))
    : "";
  const venueProPlan = mergePaymentPlans(data.billingPlans, data.billingPromotions).find((plan) => plan.code === "featured_venue");
  const venueCanSubmit = Boolean(
    venueDraft.name.trim() &&
    venueDraft.address.trim() &&
    normalizeVenuePhoneForCountry(venuePhoneCountryIso, venueDraft.phone) &&
    (venueMode === "simple" || venueProofReady)
  );
  const venueSubmitDisabledLabel = !venueDraft.name.trim() || !venueDraft.address.trim() || !normalizeVenuePhoneForCountry(venuePhoneCountryIso, venueDraft.phone)
    ? "Completa nombre, domicilio y WhatsApp"
    : venueMode === "pro" && !venueProofReady
      ? "Adjunta el comprobante para enviar Cancha Pro"
      : "Completa los datos";
  const jerseyNumberValue = Number(playerDraft.jersey);
  const playerCanSubmit = Boolean(
    playerTeamId &&
    playerDraft.name.trim() &&
    playerDraft.alias.trim() &&
    playerDraft.position.trim() &&
    /^\d{1,3}$/.test(playerDraft.jersey.trim()) &&
    jerseyNumberValue >= 1 &&
    jerseyNumberValue <= 99
  );
  const playerSubmitDisabledLabel = !playerDraft.name.trim()
    ? "Completa nombre"
    : !playerDraft.alias.trim()
      ? "Completa apodo"
      : !playerDraft.jersey.trim()
        ? "Completa dorsal"
        : !/^\d{1,3}$/.test(playerDraft.jersey.trim()) || jerseyNumberValue < 1 || jerseyNumberValue > 99
          ? "Dorsal entre 1 y 99"
          : !playerDraft.position.trim()
            ? "Elegi posicion"
            : "Completa la ficha";

  function toggleVenueSurface(value: VenueSurfaceValue) {
    setVenueSurfaces((current) => {
      if (current.includes(value)) return current.length === 1 ? current : current.filter((item) => item !== value);
      return [...current, value];
    });
  }

  function updateVenueDraft(field: keyof typeof venueDraft, value: string) {
    setVenueDraft((current) => ({ ...current, [field]: value }));
  }

  function updateVenueImagePreviews(nextPreviews: string[]) {
    setVenueImagePreviews((current) => {
      current.forEach((preview) => URL.revokeObjectURL(preview));
      return nextPreviews;
    });
  }

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    setPlayerDraft({
      name: selfPlayerMode ? ownManagedPlayer?.display_name ?? "" : "",
      alias: selfPlayerMode ? ownManagedPlayer?.alias ?? "" : "",
      jersey: String(slotDraft?.jersey ?? ownManagedPlayer?.jersey_number ?? ""),
      position: slotDraft?.position ?? ownManagedPlayer?.position ?? "",
      role: ownManagedPlayer?.role === "captain" ? "captain" : "player"
    });
  }, [
    selfPlayerMode,
    ownManagedPlayer?.id,
    ownManagedPlayer?.display_name,
    ownManagedPlayer?.alias,
    ownManagedPlayer?.jersey_number,
    ownManagedPlayer?.position,
    ownManagedPlayer?.role,
    slotDraft?.jersey,
    slotDraft?.position,
    playerTeamId
  ]);

  useEffect(() => () => {
    venueImagePreviews.forEach((preview) => URL.revokeObjectURL(preview));
  }, [venueImagePreviews]);

  useEffect(() => {
    if (!ownedTeams.length) {
      setSelectedOwnedTeamId("");
      return;
    }
    setSelectedOwnedTeamId((current) => {
      if (selectedTeamId && ownedTeams.some((team) => team.id === selectedTeamId)) return selectedTeamId;
      if (current && ownedTeams.some((team) => team.id === current)) return current;
      return ownedTeams[0].id;
    });
  }, [ownedTeamIds, selectedTeamId]);

  function hasTeamProAccess(teamId: string) {
    const now = Date.now();
    return data.entitlements.some((entitlement) => {
      if (entitlement.plan_code !== "team_pro") return false;
      if (entitlement.target_type !== "team") return false;
      if (entitlement.target_id && entitlement.target_id !== teamId) return false;
      if (entitlement.expires_at && new Date(entitlement.expires_at).getTime() < now) return false;
      return true;
    });
  }

  function teamInviteHref(team = selectedOwnedTeam) {
    if (!origin || !team || !data.activeTournament?.slug) return "";
    const joinUrl = `${origin}/?join=${encodeURIComponent(data.activeTournament.slug)}&team=${encodeURIComponent(team.slug)}`;
    const text = `Te invito a sumarte a ${team.name} en ${data.activeTournament.name}. Entra a ${joinUrl}, carga tu nombre, dorsal y apodo para quedar en el plantel.`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  async function getUserId() {
    const supabase = createSupabaseBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    return { supabase, userId: auth.user?.id };
  }

  async function uploadArenaMedia(
    supabase: ReturnType<typeof createSupabaseBrowserClient>,
    bucket: MediaBucket,
    userId: string,
    fileValue: FormDataEntryValue | null,
    frameOptions?: ImageFrameOptions | null,
    presetOverride?: UploadImagePreset,
    suffix = ""
  ) {
    if (!(fileValue instanceof File) || fileValue.size === 0) return null;
    const optimizedFile = await optimizeImageForUpload(fileValue, presetOverride ?? mediaPresetByBucket[bucket], frameOptions);
    const extension = optimizedFile.type === "image/webp" ? "webp" : optimizedFile.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${userId}/${Date.now().toString(36)}-${crypto.randomUUID()}${suffix ? `-${suffix}` : ""}.${extension}`;
    const { error } = await supabase.storage.from(bucket).upload(path, optimizedFile, {
      cacheControl: "31536000",
      contentType: optimizedFile.type || undefined,
      upsert: false
    });
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  async function uploadTeamBadgeSet(
    supabase: ReturnType<typeof createSupabaseBrowserClient>,
    userId: string,
    fileValue: FormDataEntryValue | null,
    frameOptions: ImageFrameOptions | null
  ) {
    if (!(fileValue instanceof File) || fileValue.size === 0) return null;
    const badgeUrl = await uploadArenaMedia(supabase, "team-badges", userId, fileValue, frameOptions, "team_badge", "badge");
    const iconUrl = await uploadArenaMedia(supabase, "team-badges", userId, fileValue, frameForDerivative(frameOptions, "none"), "team_badge", "icon");
    const cardUrl = await uploadArenaMedia(supabase, "team-badges", userId, fileValue, frameForDerivative(frameOptions, "none"), "team_badge_card", "card");
    return { badgeUrl, iconUrl, cardUrl, frame: frameOptions };
  }

  async function uploadPlayerPhotoSet(
    supabase: ReturnType<typeof createSupabaseBrowserClient>,
    userId: string,
    fileValue: FormDataEntryValue | null,
    frameOptions: ImageFrameOptions | null
  ) {
    if (!(fileValue instanceof File) || fileValue.size === 0) return null;
    const photoUrl = await uploadArenaMedia(supabase, "player-photos", userId, fileValue, frameOptions, "player_photo", "photo");
    const avatarUrl = await uploadArenaMedia(supabase, "player-photos", userId, fileValue, frameForDerivative(frameOptions, "none"), "player_avatar", "avatar");
    const cardPhotoUrl = await uploadArenaMedia(supabase, "player-photos", userId, fileValue, frameForDerivative(frameOptions, "none"), "player_card", "card");
    return { photoUrl, avatarUrl, cardPhotoUrl, frame: frameOptions };
  }

  async function uploadVenueGallery(
    supabase: ReturnType<typeof createSupabaseBrowserClient>,
    userId: string,
    fileValues: FormDataEntryValue[],
    frameOptions?: ImageFrameOptions | null
  ): Promise<VenueMediaUpload> {
    const files = fileValues
      .filter((fileValue): fileValue is File => fileValue instanceof File && fileValue.size > 0)
      .slice(0, 3);
    if (!files.length) {
      return { coverUrl: null, logoUrl: null, markerUrl: null, cardUrl: null, heroUrl: null, galleryUrls: [], frame: frameOptions ?? null };
    }
    const urls: string[] = [];
    for (const file of files) {
      const url = await uploadArenaMedia(supabase, "venue-photos", userId, file, frameForDerivative(frameOptions, "none"), "venue_photo", "gallery");
      if (url) urls.push(url);
    }
    const primary = files[0];
    const logoUrl = await uploadArenaMedia(supabase, "venue-photos", userId, primary, frameOptions, "venue_logo", "logo");
    const markerUrl = await uploadArenaMedia(supabase, "venue-photos", userId, primary, frameForDerivative(frameOptions, "none"), "venue_marker", "pin");
    const cardUrl = await uploadArenaMedia(supabase, "venue-photos", userId, primary, frameForDerivative(frameOptions, "none"), "venue_card", "card");
    const heroUrl = await uploadArenaMedia(supabase, "venue-photos", userId, primary, frameForDerivative(frameOptions, "none"), "venue_cover", "hero");
    return {
      coverUrl: heroUrl ?? urls[0] ?? null,
      logoUrl,
      markerUrl,
      cardUrl,
      heroUrl,
      galleryUrls: urls,
      frame: frameOptions ?? null
    };
  }

  async function uploadPaymentProof(
    supabase: ReturnType<typeof createSupabaseBrowserClient>,
    userId: string,
    fileValue: FormDataEntryValue | null
  ) {
    if (!(fileValue instanceof File) || fileValue.size === 0) throw new Error("Adjunta el comprobante de transferencia.");
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

  async function createVenueProPaymentRequest({
    supabase,
    userId,
    venueId,
    venueName,
    proofFile,
    amount,
    note
  }: {
    supabase: ReturnType<typeof createSupabaseBrowserClient>;
    userId: string;
    venueId: string;
    venueName: string;
    proofFile: FormDataEntryValue | null;
    amount: number;
    note: string;
  }) {
    const { data: block, error: blockError } = await supabase
      .from("user_blocks")
      .select("reason")
      .eq("blocked_user_id", userId)
      .maybeSingle();
    if (blockError) throw blockError;
    if (block) throw new Error(block.reason || "Tu cuenta esta bloqueada para enviar nuevos comprobantes.");

    const { data: existingRequest, error: existingError } = await supabase
      .from("payment_requests")
      .select("id")
      .eq("requester_id", userId)
      .eq("plan_code", "featured_venue")
      .eq("status", "pending_review")
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existingRequest) throw new Error("Ya tenes una solicitud de Cancha Pro pendiente. Espera la revision del admin.");

    const proof = await uploadPaymentProof(supabase, userId, proofFile);
    const { data: request, error: requestError } = await supabase
      .from("payment_requests")
      .insert({
        requester_id: userId,
        plan_code: "featured_venue",
        target_type: "venue",
        target_id: venueId,
        title: `Cancha destacada - ${venueName}`,
        amount,
        proof_path: proof.proofPath,
        proof_filename: proof.proofFilename,
        payer_note: note || `Cancha: ${venueName}`
      })
      .select()
      .single();
    if (requestError) {
      await supabase.storage.from("payment-proofs").remove([proof.proofPath]);
      throw requestError;
    }

    const { error: messageError } = await supabase
      .from("payment_messages")
      .insert({
        payment_request_id: request.id,
        sender_id: userId,
        body: note || `Comprobante enviado para Cancha Pro - ${venueName}.`
      });
    if (messageError) throw messageError;
    window.dispatchEvent(new CustomEvent("fulbito:payment-request-created", { detail: request }));
  }

  async function createTeam(formData: FormData) {
    setMessage("");
    const name = String(formData.get("teamName") || "").trim();
    if (!name) return setMessage("El equipo necesita nombre.");
    formData.delete("badgeFile");
    if (data.activeTournament?.id) formData.set("tournamentId", data.activeTournament.id);
    const response = await fetch("/api/teams", { method: "POST", body: formData });
    const result = (await response.json()) as { team?: { id: string; name: string }; error?: string; warning?: string };
    if (!response.ok || !result.team) return setMessage(result.error || "No se pudo crear el equipo.");
    const team = result.team;
    if (data.activeTournament?.id) {
      window.setTimeout(() => window.location.reload(), 1000);
      return setMessage(result.warning || `${team.name} quedo inscripto en ${data.activeTournament.name}. Actualiza la pantalla para verlo.`);
    }
    window.setTimeout(() => window.location.reload(), 1000);
    setMessage("Equipo creado. Actualiza la pantalla para verlo en la arena.");
  }

  async function updateTeamBadge(formData: FormData) {
    setMessage("");
    const teamId = String(formData.get("teamId") || "");
    const team = ownedTeams.find((item) => item.id === teamId);
    if (!team) return setMessage("Solo podes editar un equipo propio.");
    if (!hasTeamProAccess(team.id)) return setMessage("Activa Equipo Pro para subir escudo premium.");
    const { supabase, userId } = await getUserId();
    if (!userId) return setMessage("Entra con Google para continuar.");
    const badgeFile = formData.get("badgeFile");
    if (!(badgeFile instanceof File) || badgeFile.size === 0) return setMessage("Selecciona una imagen para el escudo.");
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const { count, error: limitError } = await supabase
      .from("profile_media_updates")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("target_type", "team_badge")
      .eq("target_id", team.id)
      .gte("created_at", monthStart.toISOString());
    if (limitError) return setMessage(limitError.message);
    if ((count ?? 0) >= 3) return setMessage("Este club ya cambio el escudo 3 veces este mes. Podes volver a cambiarlo el mes que viene.");
    let badgeSet: Awaited<ReturnType<typeof uploadTeamBadgeSet>> = null;
    try {
      badgeSet = await uploadTeamBadgeSet(supabase, userId, badgeFile, readImageFrameOptions(formData, "badgeFile", { shape: "shield" }));
    } catch (error) {
      return setMessage(error instanceof Error ? error.message : "No se pudo subir el escudo.");
    }
    if (!badgeSet?.badgeUrl) return setMessage("Selecciona una imagen para el escudo.");
    const primaryColor = String(formData.get("primaryColor") || team.primary_color || "#eec15c").trim();
    const { error } = await supabase
      .from("teams")
      .update({
        badge_url: badgeSet.badgeUrl,
        badge_icon_url: badgeSet.iconUrl,
        badge_card_url: badgeSet.cardUrl,
        badge_frame: badgeSet.frame,
        primary_color: primaryColor
      })
      .eq("id", team.id);
    if (!error) {
      await supabase.from("profile_media_updates").insert({
        user_id: userId,
        target_type: "team_badge",
        target_id: team.id
      });
    }
    if (!error) window.setTimeout(() => window.location.reload(), 800);
    setMessage(error ? error.message : "Escudo premium actualizado.");
  }

  async function enrollOwnedTeam() {
    setMessage("");
    const team = selectedOwnedTeam;
    if (!team) return setMessage("Primero crea o elegi un equipo.");
    if (!data.activeTournament?.id) return setMessage("No hay copa activa para inscribir el equipo.");
    setPendingEnrollId(team.id);
    try {
      const response = await fetch("/api/tournament-teams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tournamentId: data.activeTournament.id, teamId: team.id })
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) return setMessage(result.error || "No se pudo inscribir el equipo.");
      window.setTimeout(() => window.location.reload(), 900);
      setMessage(`${team.name} quedo inscripto en ${data.activeTournament.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo inscribir el equipo.");
    } finally {
      setPendingEnrollId("");
    }
  }

  async function createVenue(formData: FormData) {
    setMessage("");
    const name = String(formData.get("venueName") || "").trim();
    if (!name) return setMessage("La cancha necesita nombre.");
    const selectedVenueMode = String(formData.get("venueMode") || "simple") === "pro" ? "pro" : "simple";
    const latitudeValue = String(formData.get("latitude") || "");
    const longitudeValue = String(formData.get("longitude") || "");
    const latitude = Number(latitudeValue);
    const longitude = Number(longitudeValue);
    if (!latitudeValue || !longitudeValue || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return setMessage("Selecciona la ubicacion de la cancha con el boton o el mapa.");
    }
    const { supabase, userId } = await getUserId();
    if (!userId) return setMessage("Entra con Google para continuar.");
    const selectedModes = normalizeVenueSurfaces(formData.getAll("venueSurface"));
    const phoneCountryIso = String(formData.get("phoneCountryIso") || "AR");
    const phoneCountry = getPhoneCountry(phoneCountryIso);
    const phoneNational = normalizeVenuePhoneForCountry(phoneCountry.iso, String(formData.get("venuePhoneNational") || ""));
    if (!phoneNational) return setMessage("Carga un WhatsApp de contacto para recibir consultas de reserva.");
    const address = String(formData.get("venueAddress") || "").trim();
    if (!address) return setMessage("Carga el domicilio para ubicar bien la cancha en el mapa.");
    const formatPrices = selectedVenueMode === "pro" ? readVenueFormatPrices(formData, selectedModes) : {};
    let venueMedia: VenueMediaUpload = {
      coverUrl: null,
      logoUrl: null,
      markerUrl: null,
      cardUrl: null,
      heroUrl: null,
      galleryUrls: [],
      frame: null
    };
    if (selectedVenueMode === "pro") {
      if (!venueProPlan) return setMessage("Cancha Pro no esta disponible en este momento.");
      const proofFile = formData.get("venueProofFile");
      if (!(proofFile instanceof File) || proofFile.size === 0) return setMessage("Adjunta el comprobante para enviar la solicitud Pro.");
      const { data: block, error: blockError } = await supabase
        .from("user_blocks")
        .select("reason")
        .eq("blocked_user_id", userId)
        .maybeSingle();
      if (blockError) return setMessage(blockError.message);
      if (block) return setMessage(block.reason || "Tu cuenta esta bloqueada para enviar nuevos comprobantes.");
      const { data: existingRequest, error: existingError } = await supabase
        .from("payment_requests")
        .select("id")
        .eq("requester_id", userId)
        .eq("plan_code", "featured_venue")
        .eq("status", "pending_review")
        .limit(1)
        .maybeSingle();
      if (existingError) return setMessage(existingError.message);
      if (existingRequest) return setMessage("Ya tenes una solicitud de Cancha Pro pendiente. Espera la revision del admin.");
      try {
        venueMedia = await uploadVenueGallery(supabase, userId, formData.getAll("venueGalleryFiles"), readImageFrameOptions(formData, "venueGalleryFiles", { shape: "rounded" }));
      } catch (error) {
        return setMessage(error instanceof Error ? error.message : "No se pudieron subir las fotos de la cancha.");
      }
    }
    const payload = {
      owner_id: userId,
      name,
      slug: `${slugify(name)}-${Date.now().toString(36)}`,
      neighborhood: String(formData.get("venueNeighborhood") || "").trim() || "Barrio sin cargar",
      address,
      surface: selectedModes.join(","),
      field_modes: selectedModes,
      format_prices: formatPrices,
      phone: composeInternationalPhone(phoneCountry.iso, phoneNational),
      phone_country_iso: phoneCountry.iso,
      phone_country_code: phoneCountry.dialCode,
      phone_national: phoneNational || null,
      latitude,
      longitude,
      price_per_hour: selectedVenueMode === "pro" ? primaryVenuePrice(formatPrices, selectedModes) : 0,
      inscription_fee: selectedVenueMode === "pro" ? Number(formData.get("reserveFee") || 0) : 0,
      cover_url: venueMedia.coverUrl,
      logo_url: venueMedia.logoUrl,
      marker_url: venueMedia.markerUrl,
      card_url: venueMedia.cardUrl,
      hero_url: venueMedia.heroUrl,
      gallery_urls: venueMedia.galleryUrls,
      media_frame: venueMedia.frame,
      open_hours: selectedVenueMode === "pro" ? String(formData.get("openHours") || "").trim() || null : null,
      status: selectedVenueMode === "pro" ? "pending_pro" : "listed"
    };
    const { data: venue, error } = await supabase.from("venues").insert(payload).select().single();
    if (error || !venue) return setMessage(error?.message || "No se pudo registrar la cancha.");
    window.dispatchEvent(new CustomEvent("fulbito:venue-created", { detail: venue }));
    if (selectedVenueMode === "pro") {
      try {
        await createVenueProPaymentRequest({
          supabase,
          userId,
          venueId: venue.id,
          venueName: venue.name,
          proofFile: formData.get("venueProofFile"),
          amount: venueProPlan?.amount ?? 0,
          note: String(formData.get("payerNote") || "").trim() || `Cancha: ${venue.name}`
        });
      } catch (paymentError) {
        return setMessage(paymentError instanceof Error ? paymentError.message : "La cancha se guardo, pero no se pudo enviar el comprobante.");
      }
      setVenueProofReady(false);
      setMessage("Cancha Pro enviada. Fulbito revisa el comprobante y habilita foto, precios y publicidad.");
      return;
    }
    setMessage("Cancha registrada gratis. Ya queda visible con ubicacion, domicilio y WhatsApp.");
  }

  async function submitResult(formData: FormData) {
    setMessage("");
    const matchId = String(formData.get("matchId") || "");
    if (!matchId) return setMessage("No hay un partido real para cargar resultado.");
    const { supabase, userId } = await getUserId();
    if (!userId) return setMessage("Entra con Google para continuar.");
    const role = data.user?.roles[0] ?? "captain";
    const { error } = await supabase.from("match_result_submissions").insert({
      match_id: matchId,
      submitted_by: userId,
      source_role: role,
      home_score: Number(formData.get("homeScore") || 0),
      away_score: Number(formData.get("awayScore") || 0),
      note: String(formData.get("note") || "").trim()
    });
    setMessage(error ? error.message : "Resultado enviado para validacion.");
  }

  async function createPlayer(formData: FormData) {
    setMessage("");
    const displayName = String(formData.get("playerName") || "").trim();
    const alias = String(formData.get("alias") || "").trim();
    const jerseyRaw = String(formData.get("jerseyNumber") || "").trim();
    const jerseyNumber = Number(jerseyRaw);
    const position = String(formData.get("position") || "").trim();
    const teamId = String(formData.get("playerTeamId") || "");
    const selfRegister = String(formData.get("selfRegister") || "") === "1";
    if (!displayName || !teamId || !alias || !jerseyRaw || !position) {
      return setMessage("Completa nombre, apodo, dorsal y posicion para guardar la ficha.");
    }
    if (!Number.isInteger(jerseyNumber) || jerseyNumber < 1 || jerseyNumber > 99) {
      return setMessage("El dorsal tiene que ser un numero entre 1 y 99.");
    }
    const { supabase, userId } = await getUserId();
    if (!userId) return setMessage("Entra con Google para continuar.");
    const currentTeam = data.teams.find((team) => team.id === teamId);
    const requestedRole = String(formData.get("playerRole") || "player") === "captain" ? "captain" : "player";
    const memberRole = requestedRole === "captain" && selfRegister && currentTeam?.owner_id === userId ? "captain" : "player";
    const existingSelfPlayer = selfRegister ? data.players.find((player) => player.team_id === teamId && player.profile_id === userId) : null;
    const currentCount = data.players.filter((player) => player.team_id === teamId).length;
    if (!existingSelfPlayer && currentCount >= rosterRule.maxPlayers) {
      return setMessage(`Plantel completo para ${rosterRule.label}: ${rosterRule.starters} titulares + ${rosterRule.substitutes} suplentes.`);
    }
    const photoFile = formData.get("playerPhoto");
    const wantsPhotoUpload = photoFile instanceof File && photoFile.size > 0;
    if (selfRegister && wantsPhotoUpload) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { count, error: limitError } = await supabase
        .from("profile_media_updates")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("target_type", "player_photo")
        .gte("created_at", monthStart.toISOString());
      if (limitError) return setMessage(limitError.message);
      if ((count ?? 0) >= 3) {
        return setMessage("Ya cambiaste tu foto 3 veces este mes. Podes volver a cambiarla el mes que viene.");
      }
    }
    let photoSet: Awaited<ReturnType<typeof uploadPlayerPhotoSet>> = null;
    if (hasTeamProAccess(teamId)) {
      try {
        photoSet = await uploadPlayerPhotoSet(supabase, userId, photoFile, readImageFrameOptions(formData, "playerPhoto", { shape: "circle", zoom: 1.08 }));
      } catch (error) {
        return setMessage(error instanceof Error ? error.message : "No se pudo subir la foto del jugador.");
      }
    }
    const resolvedPhotoUrl = photoSet?.photoUrl ?? (selfRegister ? existingSelfPlayer?.photo_url ?? null : null);
    const payload = {
      team_id: teamId,
      profile_id: selfRegister ? userId : null,
      role: memberRole,
      display_name: displayName,
      alias,
      jersey_number: jerseyNumber,
      position,
      photo_url: resolvedPhotoUrl,
      avatar_url: photoSet?.avatarUrl ?? (selfRegister ? existingSelfPlayer?.avatar_url ?? existingSelfPlayer?.photo_url ?? null : null),
      card_photo_url: photoSet?.cardPhotoUrl ?? (selfRegister ? existingSelfPlayer?.card_photo_url ?? existingSelfPlayer?.photo_url ?? null : null),
      photo_frame: photoSet?.frame ?? (selfRegister ? existingSelfPlayer?.photo_frame ?? null : null)
    };
    const { data: savedPlayer, error } = selfRegister
      ? await supabase.from("team_members").upsert(payload, { onConflict: "team_id,profile_id" })
        .select("id")
        .single()
      : await supabase.from("team_members").insert(payload);
    const savedPlayerId = savedPlayer?.id ?? existingSelfPlayer?.id ?? null;
    if (!error && memberRole === "captain" && savedPlayerId) {
      await supabase
        .from("team_members")
        .update({ role: "player" })
        .eq("team_id", teamId)
        .eq("role", "captain")
        .neq("id", savedPlayerId);
    }
    if (!error && selfRegister && photoSet?.photoUrl) {
      await supabase.from("profile_media_updates").insert({
        user_id: userId,
        target_type: "player_photo",
        target_id: savedPlayerId
      });
    }
    if (!error) window.setTimeout(() => window.location.reload(), 800);
    setMessage(error ? error.message : selfRegister ? "Tu ficha quedo guardada en el plantel." : "Jugador agregado al plantel.");
  }

  const nextMatch = resultMatches[0];
  const selectedBadgeUrl = selectedOwnedTeam?.badge_card_url || selectedOwnedTeam?.badge_icon_url || selectedOwnedTeam?.badge_url || null;

  const actionContent = (
    <>
      <div className="action-grid">
        {showTeam && selectedOwnedTeam ? (
          <article className={`action-card action-card--locked ${teamEditorOnly ? "action-card--team-editor-intro" : ""}`}>
            <ShieldPlus />
            <h3>{teamEditorOnly ? "Editar identidad del club" : "Elegir equipo propio"}</h3>
            <p>
              {teamEditorOnly
                ? `Actualiza el escudo de ${selectedOwnedTeam.name}. Fulbito genera version principal, icono y card en WebP para que se vea bien en mapa, liga, equipo y cartas.`
                : `${selectedOwnedTeam.name} esta asociado a tu cuenta. ${data.activeTournament ? `Lo podes inscribir en ${data.activeTournament.name}.` : "Elegilo para gestionar plantel."} Esta copa permite ${rosterRule.starters} titulares + ${rosterRule.substitutes} suplentes.`}
            </p>
            {ownedTeams.length > 1 && !teamEditorOnly ? (
              <select value={selectedOwnedTeam.id} onChange={(event) => setSelectedOwnedTeamId(event.target.value)}>
                {ownedTeams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name} / {team.short_name}</option>
                ))}
              </select>
            ) : null}
            {!teamEditorOnly ? <div className="team-invite-actions">
              {data.activeTournament ? (
                <button className="inline-enroll-button" disabled={selectedOwnedTeamEnrolled || pendingEnrollId === selectedOwnedTeam.id} onClick={enrollOwnedTeam} type="button">
                  {pendingEnrollId === selectedOwnedTeam.id ? <LoaderCircle className="button-spinner" size={16} /> : null}
                  {selectedOwnedTeamEnrolled ? "Equipo inscripto" : pendingEnrollId === selectedOwnedTeam.id ? "Inscribiendo" : data.activeTournament ? `Inscribir en ${data.activeTournament.name}` : "Inscribir en esta copa"}
                </button>
              ) : null}
              {teamInviteHref(selectedOwnedTeam) ? (
                <a className="inline-whatsapp-button" href={teamInviteHref(selectedOwnedTeam)} rel="noreferrer" target="_blank">
                  Invitar jugadores por WhatsApp
                </a>
              ) : null}
            </div> : null}
          </article>
        ) : null}

        {showTeam && !teamEditorOnly ? <form action={createTeam} className={selectedOwnedTeam ? "action-card action-card--secondary" : "action-card"}>
          <ShieldPlus />
          <h3>{selectedOwnedTeam ? "Crear otro equipo gratis" : "Crear equipo gratis"}</h3>
          <p>{data.activeTournament ? `Este equipo queda inscripto en ${data.activeTournament.name}. ` : ""}El alta gratis usa nombre, sigla y barrio. Escudo, fotos y cartas se activan con Equipo Pro.</p>
          <input name="teamName" placeholder="Nombre del club" required />
          <input name="shortName" maxLength={4} placeholder="Sigla" />
          <input name="neighborhood" placeholder="Barrio" />
          <input name="primaryColor" type="color" defaultValue="#eec15c" />
          <div className="pro-lock-note">
            <strong>Sin escudo en modo gratis</strong>
            <span>Para cuidar Supabase, las imagenes del club quedan dentro de Equipo Pro.</span>
          </div>
          <SubmitButton idle="Guardar equipo" pending="Creando equipo" />
        </form> : null}

        {showTeam && selectedOwnedTeam && hasTeamProAccess(selectedOwnedTeam.id) ? (
          <form action={updateTeamBadge} className="action-card action-card--premium" id="team-badge-editor">
            <ShieldPlus />
            <h3>{teamEditorOnly ? "Subir nuevo escudo" : "Escudo premium"}</h3>
            <p>{selectedOwnedTeam.name} tiene Equipo Pro activo. Elegi la imagen, ajusta forma, zoom y posicion. Limite: 3 cambios por mes.</p>
            <input name="teamId" type="hidden" value={selectedOwnedTeam.id} />
            <MediaField accept="image/png,image/jpeg,image/webp,image/avif" currentSrc={selectedBadgeUrl} helper="PNG, JPG, AVIF o WebP. Fulbito lo convierte a WebP liviano antes de subir." initialFrame={selectedOwnedTeam.badge_frame} label="Escudo del equipo" name="badgeFile" variant="crest" />
            <input name="primaryColor" type="color" defaultValue={selectedOwnedTeam.primary_color || "#eec15c"} />
            <SubmitButton idle="Actualizar escudo" pending="Guardando escudo" />
          </form>
        ) : null}

        {showTeam && teamEditorOnly && selectedOwnedTeam && !hasTeamProAccess(selectedOwnedTeam.id) ? (
          <article className="action-card action-card--locked">
            <ShieldPlus />
            <h3>Escudo bloqueado</h3>
            <p>La carga de escudo, icono y carta del club usa storage de Supabase. Se habilita con Equipo Pro y queda protegida por el limite de 3 cambios por mes.</p>
          </article>
        ) : null}

        {showVenue ? <form action={createVenue} className="action-card action-card--venue">
          <MapPinned />
          <h3>Selecciona la ubicacion</h3>
          <p>Primero marca el punto real de la cancha. El registro gratis muestra nombre y WhatsApp; Pro agrega foto, precio y visibilidad.</p>
          <input name="venueMode" type="hidden" value={venueMode} />
          <div className="creator-toggle venue-mode-toggle" aria-label="Tipo de registro de cancha">
            <button className={venueMode === "simple" ? "is-active venue-mode-free" : "venue-mode-free"} onClick={() => setVenueMode("simple")} type="button">
              <strong>Gratis</strong>
              <small>Ubicacion + WhatsApp</small>
            </button>
            <button className={venueMode === "pro" ? "is-active venue-mode-pro" : "venue-mode-pro"} onClick={() => setVenueMode("pro")} type="button">
              <strong>Cancha PRO</strong>
              <small>Foto, precios y publicidad</small>
            </button>
          </div>
          <VenueModePreview
            address={venueDraft.address}
            amount={venueProPlan?.amount}
            images={venueImagePreviews}
            mode={venueMode}
            name={venueDraft.name}
            phone={venuePreviewPhone ?? ""}
            surfaces={venueSurfaces}
          />
          <VenueLocationPicker />
          <section className="venue-surface-panel" aria-label="Formato de cancha">
            {venueSurfaces.map((surface) => <input key={surface} name="venueSurface" type="hidden" value={surface} />)}
            <span>Formato de cancha</span>
            <div className="venue-surface-options">
              {venueSurfaceOptions.map((option) => (
                <button
                  aria-pressed={venueSurfaces.includes(option.value)}
                  className={venueSurfaces.includes(option.value) ? "is-active" : ""}
                  key={option.value}
                  onClick={() => toggleVenueSurface(option.value)}
                  type="button"
                >
                  <strong>{option.label}</strong>
                  <small>{option.detail}</small>
                </button>
              ))}
            </div>
          </section>
          <div className="venue-form-grid">
            <input name="venueName" onChange={(event) => updateVenueDraft("name", event.target.value)} placeholder="Nombre de la cancha" required value={venueDraft.name} />
            <input name="venueAddress" onChange={(event) => updateVenueDraft("address", event.target.value)} placeholder="Domicilio de la cancha" required value={venueDraft.address} />
            <input name="venueNeighborhood" placeholder="Barrio o zona (opcional)" />
            <div className="venue-phone-input">
              <FlagCountrySelect name="phoneCountryIso" value={venuePhoneCountryIso} onChange={setVenuePhoneCountryIso} />
              <input name="venuePhoneNational" inputMode="tel" onChange={(event) => updateVenueDraft("phone", event.target.value)} placeholder={`WhatsApp ${selectedPhoneCountry.placeholder}`} required value={venueDraft.phone} />
              <small>Fulbito arma el prefijo {selectedPhoneCountry.dialCode}. En Argentina podes escribirlo con o sin 9.</small>
            </div>
          </div>
          {venueMode === "pro" && venueProPlan ? (
            <section className="venue-pro-inline">
              <div className="venue-pro-inline__headline">
                <div>
                  <strong>Cancha PRO</strong>
                  <span>Foto, precios visibles, mapa destacado y carteleria LED.</span>
                </div>
                <b>{formatPaymentMoney(venueProPlan.amount)} / mes</b>
              </div>
              <VenueGalleryField previews={venueImagePreviews} onPreviewsChange={updateVenueImagePreviews} />
              <section className="venue-format-price-list">
                <span>Precio por formato seleccionado</span>
                {venueSurfaces.map((surface) => {
                  const option = venueSurfaceOptions.find((item) => item.value === surface);
                  return (
                    <label key={surface}>
                      <small>{option?.label ?? surface}</small>
                      <input inputMode="numeric" name={`price_${surface}`} placeholder={`Precio ${option?.label ?? surface}`} />
                    </label>
                  );
                })}
              </section>
              <div className="creator-inline venue-pro-extra-fields">
                <input name="openHours" placeholder="Horarios visibles, ej. Lun a Dom 17 a 01" />
                <input inputMode="numeric" name="reserveFee" placeholder="Seña o reserva sugerida (opcional)" />
              </div>
              <input name="payerNote" placeholder="Nota para Fulbito o alias desde donde pagaste" />
              <InlineVenuePaymentAccount amount={venueProPlan.amount} />
              <ProofUploadField ready={venueProofReady} onReady={setVenueProofReady} />
              <small>{venueProofReady ? "Listo. Al deslizar se envia la sede y el comprobante al admin." : "El envio Pro se habilita cuando adjuntas el comprobante."}</small>
            </section>
          ) : venueMode === "pro" ? (
            <div className="pro-lock-note">
              <strong>Cancha Pro no disponible</strong>
              <span>No encontramos el plan activo. Revisalo desde el panel administrador.</span>
            </div>
          ) : (
            <div className="pro-lock-note">
              <strong>Sin fotos en registro gratis</strong>
              <span>Para ahorrar storage, las fotos de sede y publicidad se habilitan con Cancha Pro.</span>
            </div>
          )}
          <SubmitButton
            disabled={!venueCanSubmit}
            disabledLabel={venueSubmitDisabledLabel}
            idle={venueMode === "pro" ? "Enviar cancha Pro" : "Guardar cancha gratis"}
            pending={venueMode === "pro" ? "Enviando Cancha Pro" : "Registrando cancha"}
          />
        </form> : null}

        {showPlayer && rosterFull && !selfPlayerMode ? (
          <article className="action-card action-card--locked">
            <UserPlus />
            <h3>Plantel completo</h3>
            <p>{managedTeam?.name} ya tiene {managedTeamPlayers.length}/{rosterRule.maxPlayers} jugadores para {rosterRule.label}: {rosterRule.starters} titulares + {rosterRule.substitutes} suplentes.</p>
            {teamInviteHref() ? <a className="inline-whatsapp-button" href={teamInviteHref()} rel="noreferrer" target="_blank">Compartir equipo</a> : null}
          </article>
        ) : null}

        {showPlayer && (!rosterFull || selfPlayerMode) ? <form action={createPlayer} className={mode === "slot" ? "action-card action-card--slot" : selfPlayerMode ? "action-card action-card--self-player" : "action-card"}>
          <UserPlus />
          <h3>{selfPlayerMode ? "Completar mi ficha" : mode === "slot" ? `Cargar ${slotDraft?.label ?? "posicion"}` : "Agregar jugador"}</h3>
          <p>
            {selfPlayerMode
              ? hasTeamProAccess(playerTeamId)
                ? "Carga tu nombre, apodo, dorsal, posicion y foto para quedar en el plantel."
                : "Carga tu nombre, apodo, dorsal y posicion. La foto se habilita si el club activa Equipo Pro."
              : mode === "slot"
              ? `Completa el puesto desde el mapa. Plantel: ${managedTeamPlayers.length}/${rosterRule.maxPlayers}.`
              : hasTeamProAccess(playerTeamId)
                ? `Nombre, apodo, dorsal, posicion y foto. Plantel: ${managedTeamPlayers.length}/${rosterRule.maxPlayers}.`
                : `Carga el plantel gratis con nombre, apodo, dorsal y posicion. Plantel: ${managedTeamPlayers.length}/${rosterRule.maxPlayers}.`}
          </p>
          {selfPlayerMode ? <input name="selfRegister" type="hidden" value="1" /> : null}
          <select name="playerTeamId" defaultValue={playerTeamId}>
            {managedTeam ? <option value={managedTeam.id}>{managedTeam.name}</option> : null}
          </select>
          <input name="playerName" onChange={(event) => setPlayerDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Nombre y apellido" value={playerDraft.name} />
          <input name="alias" onChange={(event) => setPlayerDraft((current) => ({ ...current, alias: event.target.value }))} placeholder="Apodo" value={playerDraft.alias} />
          <input name="jerseyNumber" inputMode="numeric" onChange={(event) => setPlayerDraft((current) => ({ ...current, jersey: event.target.value.replace(/\D/g, "").slice(0, 2) }))} placeholder="Dorsal" value={playerDraft.jersey} />
          <PlayerPositionPicker value={playerDraft.position} onChange={(position) => setPlayerDraft((current) => ({ ...current, position }))} />
          {selfPlayerMode && managedTeam?.owner_id === data.user?.id ? (
            <PlayerRolePicker value={playerDraft.role} onChange={(role) => setPlayerDraft((current) => ({ ...current, role }))} />
          ) : (
            <input name="playerRole" type="hidden" value={ownManagedPlayer?.role ?? "player"} />
          )}
          {selfPlayerMode ? (
            <div className="player-form-rules">
              Tu cuenta puede tener una sola ficha en este club. Si ya existe, Fulbito actualiza esa misma ficha.
            </div>
          ) : null}
          {hasTeamProAccess(playerTeamId) ? (
            <>
              <PlayerPhotoGuide />
              <MediaField accept="image/png,image/jpeg,image/webp" helper="Foto vertical o medio cuerpo. Fulbito la recorta, optimiza y guarda en WebP." label="Foto para carta premium" name="playerPhoto" variant="avatar" />
            </>
          ) : (
            <div className="pro-lock-note">
              <strong>Fotos bloqueadas en modo gratis</strong>
              <span>Activa Equipo Pro para subir rostros, generar cartas y compartir fichas premium.</span>
            </div>
          )}
          <SubmitButton
            disabled={!playerCanSubmit}
            disabledLabel={playerSubmitDisabledLabel}
            idle={selfPlayerMode ? "Guardar mi ficha" : mode === "slot" ? "Guardar en posicion" : "Guardar jugador"}
            pending="Guardando jugador"
          />
        </form> : null}

        {showResult ? <form action={submitResult} className="action-card">
          <Flag />
          <h3>Enviar resultado</h3>
          <p>El marcador queda pendiente hasta validacion de cancha, veedor u organizador.</p>
          <select name="matchId" defaultValue={nextMatch?.id}>
            {resultMatches.map((match) => (
              <option key={match.id} value={match.id}>
                {match.homeTeam?.short_name ?? "LOC"} vs {match.awayTeam?.short_name ?? "VIS"} - {match.round_name}
              </option>
            ))}
          </select>
          <div className="score-fields">
            <input name="homeScore" inputMode="numeric" placeholder="Local" />
            <input name="awayScore" inputMode="numeric" placeholder="Visitante" />
          </div>
          <input name="note" placeholder="Nota del veedor" />
          <SubmitButton idle="Enviar a validacion" pending="Enviando resultado" />
        </form> : null}

        {(mode === "result" && !hasMatches) ? (
          <article className="action-card action-card--locked">
            <Flag />
            <h3>Sin partidos para cargar</h3>
            <p>Cuando crees o te sumes a un torneo, aca aparece el acta para enviar resultados.</p>
          </article>
        ) : null}
      </div>
      {message ? <p className="console-message">{message}</p> : null}
    </>
  );

  return (
    <section className={`action-console action-console--${mode}${teamEditorOnly ? " action-console--team-editor" : ""}`} id="acciones">
      {mode === "all" ? (
        <>
          <div className="section-heading">
            <p className="eyebrow">Acciones reales</p>
            <h2>Consola segun rol</h2>
            <p>Estas acciones ya escriben contra Supabase cuando hay sesion activa y permisos RLS.</p>
          </div>
          {actionContent}
        </>
      ) : mode === "slot" || mode === "venue" || mode === "self-player" || teamEditorOnly ? (
        actionContent
      ) : (
        <details className="action-drawer">
          <summary>Acciones de esta pantalla</summary>
          {actionContent}
        </details>
      )}
    </section>
  );
}

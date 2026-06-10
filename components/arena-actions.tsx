"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Camera, Flag, LoaderCircle, LocateFixed, MapPinned, ShieldPlus, UserPlus } from "lucide-react";
import { SlideSubmitButton } from "@/components/slide-submit-button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ArenaData } from "@/lib/types";
import type { Map, Marker } from "maplibre-gl";

type ActionMode = "all" | "squad" | "venue" | "result" | "slot";
type MediaBucket = "team-badges" | "player-photos" | "venue-photos";

type SlotDraft = {
  label: string;
  jersey: number;
  position: string;
};

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

function SubmitButton({ idle, pending }: { idle: string; pending: string }) {
  return <SlideSubmitButton idle={idle} pendingLabel={pending} />;
}

function MediaField({
  name,
  accept,
  label,
  helper,
  variant = "square"
}: {
  name: string;
  accept: string;
  label: string;
  helper: string;
  variant?: "crest" | "avatar" | "wide" | "square";
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [filename, setFilename] = useState("");

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
    <label className={`media-field media-field--${variant}`}>
      <input accept={accept} name={name} onChange={onFileChange} type="file" />
      <span className="media-field__preview">
        {preview ? <img alt="" src={preview} /> : <Camera size={20} />}
      </span>
      <span className="media-field__copy">
        <strong>{label}</strong>
        <small>{filename || helper}</small>
      </span>
    </label>
  );
}

const imageTargets: Record<MediaBucket, { width: number; height: number; quality: number; fit: "cover" | "contain" }> = {
  "team-badges": { width: 512, height: 512, quality: 0.84, fit: "contain" },
  "player-photos": { width: 512, height: 512, quality: 0.82, fit: "cover" },
  "venue-photos": { width: 1280, height: 720, quality: 0.78, fit: "cover" }
};

async function optimizeImageFile(file: File, bucket: MediaBucket) {
  if (file.type === "image/svg+xml") return file;
  if (!file.type.startsWith("image/")) return file;

  const target = imageTargets[bucket];
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext("2d", { alpha: target.fit === "contain" });
  if (!context) return file;

  if (target.fit === "contain") {
    const scale = Math.min(target.width / bitmap.width, target.height / bitmap.height) * 0.94;
    const dw = bitmap.width * scale;
    const dh = bitmap.height * scale;
    context.clearRect(0, 0, target.width, target.height);
    context.drawImage(bitmap, (target.width - dw) / 2, (target.height - dh) / 2, dw, dh);
  } else {
    const sourceRatio = bitmap.width / bitmap.height;
    const targetRatio = target.width / target.height;
    let sx = 0;
    let sy = 0;
    let sw = bitmap.width;
    let sh = bitmap.height;

    if (sourceRatio > targetRatio) {
      sw = bitmap.height * targetRatio;
      sx = (bitmap.width - sw) / 2;
    } else {
      sh = bitmap.width / targetRatio;
      sy = (bitmap.height - sh) / 2;
    }
    context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, target.width, target.height);
  }
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", target.quality));
  if (!blob) return file;
  const filename = file.name.replace(/\.[^.]+$/, "") || "arena-media";
  return new File([blob], `${filename}.webp`, { type: "image/webp" });
}

function VenueLocationPicker() {
  const [coordinates, setCoordinates] = useState({ latitude: -34.6037, longitude: -58.3816 });
  const [locationReady, setLocationReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [status, setStatus] = useState("Usa tu ubicacion actual o toca el mapa para confirmar la sede.");
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
    if (!input || input.value) return;
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
      setStatus(result.neighborhood || result.address ? "Ubicacion tomada y datos sugeridos. Ajustalos si hace falta." : "Ubicacion tomada. Completa barrio y direccion manualmente.");
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
        style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
        center: [coordinates.longitude, coordinates.latitude],
        zoom: 12.4,
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
        setStatus("Ubicacion actual tomada. Si no es exacta, mueve el puntero.");
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
      <small>Direccion sugerida con OpenStreetMap/Nominatim. Verifica antes de guardar.</small>
    </div>
  );
}

export function ArenaActions({
  data,
  mode = "all",
  selectedTeamId,
  slotDraft
}: {
  data: ArenaData;
  mode?: ActionMode;
  selectedTeamId?: string;
  slotDraft?: SlotDraft;
}) {
  const [message, setMessage] = useState("");
  const showTeam = mode === "all" || mode === "squad";
  const hasTeams = data.teams.length > 0;
  const hasMatches = data.matches.length > 0;
  const showPlayer = hasTeams && (mode === "all" || mode === "squad" || mode === "slot");
  const showVenue = mode === "all" || mode === "venue";
  const showResult = hasMatches && (mode === "all" || mode === "result");
  const playerTeamId = selectedTeamId ?? data.teams[0]?.id;
  const ownedTeam = data.user ? data.teams.find((team) => team.owner_id === data.user?.id) : null;

  async function getUserId() {
    const supabase = createSupabaseBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    return { supabase, userId: auth.user?.id };
  }

  async function uploadArenaMedia(
    supabase: ReturnType<typeof createSupabaseBrowserClient>,
    bucket: MediaBucket,
    userId: string,
    fileValue: FormDataEntryValue | null
  ) {
    if (!(fileValue instanceof File) || fileValue.size === 0) return null;
    const optimizedFile = await optimizeImageFile(fileValue, bucket);
    const extension = optimizedFile.type === "image/webp" ? "webp" : optimizedFile.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${userId}/${Date.now().toString(36)}-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(bucket).upload(path, optimizedFile, {
      cacheControl: "31536000",
      contentType: optimizedFile.type || undefined,
      upsert: false
    });
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  async function createTeam(formData: FormData) {
    setMessage("");
    const name = String(formData.get("teamName") || "").trim();
    if (!name) return setMessage("El equipo necesita nombre.");
    const { supabase, userId } = await getUserId();
    if (!userId) return setMessage("Entra con Google para continuar.");
    const { data: existingTeam, error: existingTeamError } = await supabase
      .from("teams")
      .select("id,name")
      .eq("owner_id", userId)
      .limit(1)
      .maybeSingle();
    if (existingTeamError) return setMessage(existingTeamError.message);
    if (existingTeam) return setMessage(`Ya tenes un equipo creado: ${existingTeam.name}.`);
    let badgeUrl: string | null = null;
    try {
      badgeUrl = await uploadArenaMedia(supabase, "team-badges", userId, formData.get("badgeFile"));
    } catch (error) {
      return setMessage(error instanceof Error ? error.message : "No se pudo subir el escudo.");
    }
    const payload = {
      owner_id: userId,
      name,
      slug: `${slugify(name)}-${Date.now().toString(36)}`,
      short_name: String(formData.get("shortName") || name.slice(0, 3)).trim().slice(0, 4).toUpperCase(),
      neighborhood: String(formData.get("neighborhood") || "").trim(),
      primary_color: String(formData.get("primaryColor") || "#eec15c"),
      badge_url: badgeUrl
    };
    const { data: team, error } = await supabase.from("teams").insert(payload).select("id,name").single();
    if (error) return setMessage(error.message);
    if (data.activeTournament?.id) {
      const { error: enrollError } = await supabase
        .from("tournament_teams")
        .upsert(
          { tournament_id: data.activeTournament.id, team_id: team.id, status: "approved" },
          { onConflict: "tournament_id,team_id" }
        );
      if (enrollError) return setMessage(`Equipo creado, pero no se pudo sumar a la copa: ${enrollError.message}`);
      return setMessage(`${team.name} quedo inscripto en ${data.activeTournament.name}. Actualiza la pantalla para verlo.`);
    }
    setMessage("Equipo creado. Actualiza la pantalla para verlo en la arena.");
  }

  async function enrollOwnedTeam() {
    setMessage("");
    if (!ownedTeam) return setMessage("Primero crea o elegi un equipo.");
    if (!data.activeTournament?.id) return setMessage("No hay copa activa para inscribir el equipo.");
    const { supabase, userId } = await getUserId();
    if (!userId) return setMessage("Entra con Google para continuar.");
    const { error } = await supabase
      .from("tournament_teams")
      .upsert(
        { tournament_id: data.activeTournament.id, team_id: ownedTeam.id, status: "approved" },
        { onConflict: "tournament_id,team_id" }
      );
    setMessage(error ? error.message : `${ownedTeam.name} quedo inscripto en ${data.activeTournament.name}.`);
  }

  async function createVenue(formData: FormData) {
    setMessage("");
    const name = String(formData.get("venueName") || "").trim();
    if (!name) return setMessage("La cancha necesita nombre.");
    const latitudeValue = String(formData.get("latitude") || "");
    const longitudeValue = String(formData.get("longitude") || "");
    const latitude = Number(latitudeValue);
    const longitude = Number(longitudeValue);
    if (!latitudeValue || !longitudeValue || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return setMessage("Selecciona la ubicacion de la cancha con el boton o el mapa.");
    }
    const { supabase, userId } = await getUserId();
    if (!userId) return setMessage("Entra con Google para continuar.");
    let coverUrl: string | null = null;
    try {
      coverUrl = await uploadArenaMedia(supabase, "venue-photos", userId, formData.get("venuePhoto"));
    } catch (error) {
      return setMessage(error instanceof Error ? error.message : "No se pudo subir la foto de cancha.");
    }
    const payload = {
      owner_id: userId,
      name,
      slug: `${slugify(name)}-${Date.now().toString(36)}`,
      neighborhood: String(formData.get("venueNeighborhood") || "").trim() || "Barrio sin cargar",
      address: String(formData.get("venueAddress") || "").trim() || null,
      surface: String(formData.get("venueSurface") || "").trim() || "Sintetico",
      phone: String(formData.get("venuePhone") || "").trim() || null,
      latitude,
      longitude,
      price_per_hour: Number(formData.get("pricePerHour") || 0),
      inscription_fee: Number(formData.get("inscriptionFee") || 0),
      cover_url: coverUrl,
      status: "pending"
    };
    const { error } = await supabase.from("venues").insert(payload);
    setMessage(error ? error.message : "Cancha registrada. Queda pendiente de verificacion.");
  }

  async function submitResult(formData: FormData) {
    setMessage("");
    const matchId = String(formData.get("matchId") || "");
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
    const teamId = String(formData.get("playerTeamId") || "");
    if (!displayName || !teamId) return setMessage("El jugador necesita nombre y equipo.");
    const { supabase, userId } = await getUserId();
    if (!userId) return setMessage("Entra con Google para continuar.");
    let photoUrl: string | null = null;
    try {
      photoUrl = await uploadArenaMedia(supabase, "player-photos", userId, formData.get("playerPhoto"));
    } catch (error) {
      return setMessage(error instanceof Error ? error.message : "No se pudo subir la foto del jugador.");
    }
    const { error } = await supabase.from("team_members").insert({
      team_id: teamId,
      role: "player",
      display_name: displayName,
      alias: String(formData.get("alias") || "").trim() || null,
      jersey_number: Number(formData.get("jerseyNumber") || 0) || null,
      position: String(formData.get("position") || "").trim() || null,
      photo_url: photoUrl
    });
    setMessage(error ? error.message : "Jugador agregado al plantel.");
  }

  const nextMatch = data.matches.find((match) => match.status !== "final") ?? data.matches[0];

  const actionContent = (
    <>
      <div className="action-grid">
        {showTeam && ownedTeam ? (
          <article className="action-card action-card--locked">
            <ShieldPlus />
            <h3>Equipo ya creado</h3>
            <p>{ownedTeam.name} ya esta asociado a tu cuenta. Desde esta pantalla podes cargar jugadores y completar la formacion.</p>
            {data.activeTournament ? (
              <button className="inline-enroll-button" onClick={enrollOwnedTeam} type="button">
                Inscribir en esta copa
              </button>
            ) : null}
          </article>
        ) : null}

        {showTeam && !ownedTeam ? <form action={createTeam} className="action-card">
          <ShieldPlus />
          <h3>Crear equipo</h3>
          <p>Subi escudo, sigla y color base. La imagen se adapta al marco del club.</p>
          <input name="teamName" placeholder="Nombre del club" />
          <input name="shortName" maxLength={4} placeholder="Sigla" />
          <input name="neighborhood" placeholder="Barrio" />
          <MediaField accept="image/png,image/jpeg,image/webp,image/svg+xml" helper="PNG, JPG, WebP o SVG. Se ajusta al escudo." label="Escudo del equipo" name="badgeFile" variant="crest" />
          <input name="primaryColor" type="color" defaultValue="#eec15c" />
          <SubmitButton idle="Guardar equipo" pending="Creando equipo" />
        </form> : null}

        {showVenue ? <form action={createVenue} className="action-card action-card--venue">
          <MapPinned />
          <h3>Selecciona la ubicacion</h3>
          <p>Primero marca el punto real de la cancha. Despues completa precio, superficie y foto para publicarla.</p>
          <VenueLocationPicker />
          <div className="venue-form-grid">
          <input name="venueName" placeholder="Nombre de la cancha" />
          <input name="venueNeighborhood" placeholder="Barrio" />
          <input name="venueAddress" placeholder="Direccion" />
          <input name="venuePhone" inputMode="tel" placeholder="WhatsApp o telefono" />
          <input name="venueSurface" placeholder="Superficie" />
          <input name="pricePerHour" inputMode="numeric" placeholder="Precio por hora" />
          <input name="inscriptionFee" inputMode="numeric" placeholder="Inscripcion sugerida" />
          </div>
          <MediaField accept="image/png,image/jpeg,image/webp" helper="Foto horizontal optimizada para portada." label="Foto de la cancha" name="venuePhoto" variant="wide" />
          <SubmitButton idle="Guardar cancha" pending="Registrando cancha" />
        </form> : null}

        {showPlayer ? <form action={createPlayer} className={mode === "slot" ? "action-card action-card--slot" : "action-card"}>
          <UserPlus />
          <h3>{mode === "slot" ? `Cargar ${slotDraft?.label ?? "posicion"}` : "Agregar jugador"}</h3>
          <p>{mode === "slot" ? "Completa el puesto desde el mapa de formacion." : "Nombre, apodo, dorsal, posicion y foto para el plantel."}</p>
          <select name="playerTeamId" defaultValue={playerTeamId}>
            {data.teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
          <input name="playerName" placeholder="Nombre y apellido" />
          <input name="alias" placeholder="Apodo" />
          <input name="jerseyNumber" inputMode="numeric" placeholder="Dorsal" defaultValue={slotDraft?.jersey} />
          <input name="position" placeholder="Posicion" defaultValue={slotDraft?.position} />
          <MediaField accept="image/png,image/jpeg,image/webp" helper="Foto cuadrada. Se recorta al rostro." label="Foto del jugador" name="playerPhoto" variant="avatar" />
          <SubmitButton idle={mode === "slot" ? "Guardar en posicion" : "Guardar jugador"} pending="Guardando jugador" />
        </form> : null}

        {showResult ? <form action={submitResult} className="action-card">
          <Flag />
          <h3>Enviar resultado</h3>
          <p>El marcador queda pendiente hasta validacion de cancha, veedor u organizador.</p>
          <select name="matchId" defaultValue={nextMatch?.id}>
            {data.matches.map((match) => (
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
    <section className={`action-console action-console--${mode}`} id="acciones">
      {mode === "all" ? (
        <>
          <div className="section-heading">
            <p className="eyebrow">Acciones reales</p>
            <h2>Consola segun rol</h2>
            <p>Estas acciones ya escriben contra Supabase cuando hay sesion activa y permisos RLS.</p>
          </div>
          {actionContent}
        </>
      ) : mode === "slot" || mode === "venue" ? (
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

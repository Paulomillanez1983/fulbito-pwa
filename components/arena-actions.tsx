"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Camera, Flag, LoaderCircle, LocateFixed, MapPinned, ShieldPlus, UserPlus } from "lucide-react";
import { SlideSubmitButton } from "@/components/slide-submit-button";
import { getRosterRule } from "@/lib/roster";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ArenaData } from "@/lib/types";
import type { Map, Marker } from "maplibre-gl";

type ActionMode = "all" | "squad" | "venue" | "result" | "slot" | "self-player";
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
  "team-badges": { width: 512, height: 512, quality: 0.82, fit: "contain" },
  "player-photos": { width: 640, height: 640, quality: 0.8, fit: "cover" },
  "venue-photos": { width: 1280, height: 720, quality: 0.76, fit: "cover" }
};

const imageBudgets: Record<MediaBucket, { maxBytes: number; minQuality: number; minScale: number }> = {
  "team-badges": { maxBytes: 120 * 1024, minQuality: 0.58, minScale: 0.74 },
  "player-photos": { maxBytes: 170 * 1024, minQuality: 0.58, minScale: 0.68 },
  "venue-photos": { maxBytes: 430 * 1024, minQuality: 0.55, minScale: 0.72 }
};

async function optimizeImageFile(file: File, bucket: MediaBucket) {
  if (file.type === "image/svg+xml") {
    if (file.size > 180 * 1024) throw new Error("El SVG es demasiado pesado. Subi PNG, JPG o WebP para optimizarlo.");
    return file;
  }
  if (!file.type.startsWith("image/")) return file;

  const target = imageTargets[bucket];
  const budget = imageBudgets[bucket];
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image", resizeQuality: "high" });
  let bestBlob: Blob | null = null;
  let scale = 1;

  while (scale >= budget.minScale) {
    const width = Math.max(320, Math.round(target.width * scale));
    const height = Math.max(320, Math.round(target.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: target.fit === "contain" });
    if (!context) break;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    if (target.fit === "contain") {
      const drawScale = Math.min(width / bitmap.width, height / bitmap.height) * 0.94;
      const dw = bitmap.width * drawScale;
      const dh = bitmap.height * drawScale;
      context.clearRect(0, 0, width, height);
      context.drawImage(bitmap, (width - dw) / 2, (height - dh) / 2, dw, dh);
    } else {
      const sourceRatio = bitmap.width / bitmap.height;
      const targetRatio = width / height;
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
      context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
    }

    for (let quality = target.quality; quality >= budget.minQuality; quality -= 0.07) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", Number(quality.toFixed(2))));
      if (!blob) continue;
      if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
      if (blob.size <= budget.maxBytes) {
        bitmap.close();
        const filename = file.name.replace(/\.[^.]+$/, "") || "arena-media";
        return new File([blob], `${filename}.webp`, { type: "image/webp" });
      }
    }

    scale *= 0.86;
  }

  bitmap.close();
  const blob = bestBlob;
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
  const [origin, setOrigin] = useState("");
  const [pendingEnrollId, setPendingEnrollId] = useState("");
  const showTeam = mode === "all" || mode === "squad";
  const hasMatches = data.matches.length > 0;
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
  const rosterFull = Boolean(playerTeamId && managedTeamPlayers.length >= rosterRule.maxPlayers);
  const showPlayer = Boolean(managedTeam) && (mode === "all" || mode === "squad" || mode === "slot" || selfPlayerMode);
  const [venueMode, setVenueMode] = useState<"simple" | "pro">("simple");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

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
    let badgeUrl: string | null = null;
    try {
      badgeUrl = await uploadArenaMedia(supabase, "team-badges", userId, formData.get("badgeFile"));
    } catch (error) {
      return setMessage(error instanceof Error ? error.message : "No se pudo subir el escudo.");
    }
    if (!badgeUrl) return setMessage("Selecciona una imagen para el escudo.");
    const primaryColor = String(formData.get("primaryColor") || team.primary_color || "#eec15c").trim();
    const { error } = await supabase
      .from("teams")
      .update({ badge_url: badgeUrl, primary_color: primaryColor })
      .eq("id", team.id);
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
    let coverUrl: string | null = null;
    if (selectedVenueMode === "pro") {
      try {
        coverUrl = await uploadArenaMedia(supabase, "venue-photos", userId, formData.get("venuePhoto"));
      } catch (error) {
        return setMessage(error instanceof Error ? error.message : "No se pudo subir la foto de cancha.");
      }
    }
    const payload = {
      owner_id: userId,
      name,
      slug: `${slugify(name)}-${Date.now().toString(36)}`,
      neighborhood: String(formData.get("venueNeighborhood") || "").trim() || "Barrio sin cargar",
      address: String(formData.get("venueAddress") || "").trim() || null,
      surface: selectedVenueMode === "pro" ? String(formData.get("venueSurface") || "").trim() || "Sintetico" : null,
      phone: String(formData.get("venuePhone") || "").trim() || null,
      latitude,
      longitude,
      price_per_hour: selectedVenueMode === "pro" ? Number(formData.get("pricePerHour") || 0) : 0,
      inscription_fee: selectedVenueMode === "pro" ? Number(formData.get("inscriptionFee") || 0) : 0,
      cover_url: coverUrl,
      status: "pending"
    };
    const { error } = await supabase.from("venues").insert(payload);
    setMessage(error ? error.message : selectedVenueMode === "pro" ? "Cancha Pro registrada. Queda pendiente de verificacion." : "Cancha registrada gratis. Queda pendiente de verificacion.");
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
    const selfRegister = String(formData.get("selfRegister") || "") === "1";
    if (!displayName || !teamId) return setMessage("El jugador necesita nombre y equipo.");
    const { supabase, userId } = await getUserId();
    if (!userId) return setMessage("Entra con Google para continuar.");
    const existingSelfPlayer = selfRegister ? data.players.find((player) => player.team_id === teamId && player.profile_id === userId) : null;
    const currentCount = data.players.filter((player) => player.team_id === teamId).length;
    if (!existingSelfPlayer && currentCount >= rosterRule.maxPlayers) {
      return setMessage(`Plantel completo para ${rosterRule.label}: ${rosterRule.starters} titulares + ${rosterRule.substitutes} suplentes.`);
    }
    let photoUrl: string | null = null;
    if (hasTeamProAccess(teamId)) {
      try {
        photoUrl = await uploadArenaMedia(supabase, "player-photos", userId, formData.get("playerPhoto"));
      } catch (error) {
        return setMessage(error instanceof Error ? error.message : "No se pudo subir la foto del jugador.");
      }
    }
    const resolvedPhotoUrl = photoUrl ?? (selfRegister ? existingSelfPlayer?.photo_url ?? null : null);
    const payload = {
      team_id: teamId,
      profile_id: selfRegister ? userId : null,
      role: "player",
      display_name: displayName,
      alias: String(formData.get("alias") || "").trim() || null,
      jersey_number: Number(formData.get("jerseyNumber") || 0) || null,
      position: String(formData.get("position") || "").trim() || null,
      photo_url: resolvedPhotoUrl
    };
    const { error } = selfRegister
      ? await supabase.from("team_members").upsert(payload, { onConflict: "team_id,profile_id" })
      : await supabase.from("team_members").insert(payload);
    if (!error) window.setTimeout(() => window.location.reload(), 800);
    setMessage(error ? error.message : selfRegister ? "Tu ficha quedo guardada en el plantel." : "Jugador agregado al plantel.");
  }

  const nextMatch = data.matches.find((match) => match.status !== "final") ?? data.matches[0];

  const actionContent = (
    <>
      <div className="action-grid">
        {showTeam && selectedOwnedTeam ? (
          <article className="action-card action-card--locked">
            <ShieldPlus />
            <h3>Elegir equipo propio</h3>
            <p>{selectedOwnedTeam.name} esta asociado a tu cuenta. {data.activeTournament ? `Lo podes inscribir en ${data.activeTournament.name}.` : "Elegilo para gestionar plantel."} Esta copa permite {rosterRule.starters} titulares + {rosterRule.substitutes} suplentes.</p>
            {ownedTeams.length > 1 ? (
              <select value={selectedOwnedTeam.id} onChange={(event) => setSelectedOwnedTeamId(event.target.value)}>
                {ownedTeams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name} / {team.short_name}</option>
                ))}
              </select>
            ) : null}
            <div className="team-invite-actions">
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
            </div>
          </article>
        ) : null}

        {showTeam ? <form action={createTeam} className={selectedOwnedTeam ? "action-card action-card--secondary" : "action-card"}>
          <ShieldPlus />
          <h3>{selectedOwnedTeam ? "Crear otro equipo gratis" : "Crear equipo gratis"}</h3>
          <p>{data.activeTournament ? `Este equipo queda inscripto en ${data.activeTournament.name}. ` : ""}El alta gratis usa nombre, sigla y barrio. Escudo, fotos y cartas se activan con Equipo Pro.</p>
          <input name="teamName" placeholder="Nombre del club" />
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
          <form action={updateTeamBadge} className="action-card action-card--premium">
            <ShieldPlus />
            <h3>Escudo premium</h3>
            <p>{selectedOwnedTeam.name} tiene Equipo Pro activo. Subi un escudo optimizado para la app, links y cartas.</p>
            <input name="teamId" type="hidden" value={selectedOwnedTeam.id} />
            <MediaField accept="image/png,image/jpeg,image/webp,image/svg+xml" helper="PNG, JPG, WebP o SVG. Fulbito lo optimiza antes de subir." label="Escudo del equipo" name="badgeFile" variant="crest" />
            <input name="primaryColor" type="color" defaultValue={selectedOwnedTeam.primary_color || "#eec15c"} />
            <SubmitButton idle="Actualizar escudo" pending="Guardando escudo" />
          </form>
        ) : null}

        {showVenue ? <form action={createVenue} className="action-card action-card--venue">
          <MapPinned />
          <h3>Selecciona la ubicacion</h3>
          <p>Primero marca el punto real de la cancha. El registro gratis muestra nombre y WhatsApp; Pro agrega foto, precio y visibilidad.</p>
          <input name="venueMode" type="hidden" value={venueMode} />
          <div className="creator-toggle venue-mode-toggle" aria-label="Tipo de registro de cancha">
            <button className={venueMode === "simple" ? "is-active" : ""} onClick={() => setVenueMode("simple")} type="button">Simple gratis</button>
            <button className={venueMode === "pro" ? "is-active" : ""} onClick={() => setVenueMode("pro")} type="button">Cancha Pro</button>
          </div>
          <VenueLocationPicker />
          <div className="venue-form-grid">
            <input name="venueName" placeholder="Nombre de la cancha" />
            <input name="venuePhone" inputMode="tel" placeholder="WhatsApp o telefono" />
            {venueMode === "pro" ? (
              <>
                <input name="venueNeighborhood" placeholder="Barrio" />
                <input name="venueAddress" placeholder="Direccion" />
                <input name="venueSurface" placeholder="Superficie" />
                <input name="pricePerHour" inputMode="numeric" placeholder="Precio por hora" />
                <input name="inscriptionFee" inputMode="numeric" placeholder="Inscripcion sugerida" />
              </>
            ) : (
              <>
                <input name="venueNeighborhood" type="hidden" />
                <input name="venueAddress" type="hidden" />
              </>
            )}
          </div>
          {venueMode === "pro" ? (
            <MediaField accept="image/png,image/jpeg,image/webp" helper="Foto horizontal optimizada para portada y LED." label="Foto de la cancha" name="venuePhoto" variant="wide" />
          ) : (
            <div className="pro-lock-note">
              <strong>Sin fotos en registro gratis</strong>
              <span>Para ahorrar storage, las fotos de sede y publicidad se habilitan con Cancha Pro.</span>
            </div>
          )}
          <SubmitButton idle={venueMode === "pro" ? "Guardar cancha Pro" : "Guardar cancha gratis"} pending="Registrando cancha" />
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
          <input name="playerName" placeholder="Nombre y apellido" />
          <input name="alias" placeholder="Apodo" />
          <input name="jerseyNumber" inputMode="numeric" placeholder="Dorsal" defaultValue={slotDraft?.jersey} />
          <input name="position" placeholder="Posicion" defaultValue={slotDraft?.position} />
          {hasTeamProAccess(playerTeamId) ? (
            <MediaField accept="image/png,image/jpeg,image/webp" helper="Foto cuadrada. Se recorta al rostro." label="Foto del jugador" name="playerPhoto" variant="avatar" />
          ) : (
            <div className="pro-lock-note">
              <strong>Fotos bloqueadas en modo gratis</strong>
              <span>Activa Equipo Pro para subir rostros, generar cartas y compartir fichas premium.</span>
            </div>
          )}
          <SubmitButton idle={selfPlayerMode ? "Guardar mi ficha" : mode === "slot" ? "Guardar en posicion" : "Guardar jugador"} pending="Guardando jugador" />
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
      ) : mode === "slot" || mode === "venue" || mode === "self-player" ? (
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

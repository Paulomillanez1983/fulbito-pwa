"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Flag, LoaderCircle, MapPinned, ShieldPlus, UserPlus } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ArenaData } from "@/lib/types";

type ActionMode = "all" | "squad" | "venue" | "result" | "slot";

type SlotDraft = {
  label: string;
  jersey: number;
  position: string;
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
  const form = useFormStatus();
  return (
    <button disabled={form.pending} type="submit">
      {form.pending ? <LoaderCircle className="button-spinner" size={17} /> : null}
      {form.pending ? pending : idle}
    </button>
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
  const showPlayer = mode === "all" || mode === "squad" || mode === "slot";
  const showVenue = mode === "all" || mode === "venue";
  const showResult = mode === "all" || mode === "result";
  const playerTeamId = selectedTeamId ?? data.teams[0]?.id;

  async function getUserId() {
    const supabase = createSupabaseBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    return { supabase, userId: auth.user?.id };
  }

  async function uploadArenaMedia(
    supabase: ReturnType<typeof createSupabaseBrowserClient>,
    bucket: "team-badges" | "player-photos" | "venue-photos",
    userId: string,
    fileValue: FormDataEntryValue | null
  ) {
    if (!(fileValue instanceof File) || fileValue.size === 0) return null;
    const extension = fileValue.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${userId}/${Date.now().toString(36)}-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(bucket).upload(path, fileValue, {
      cacheControl: "31536000",
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
    if (!userId) return setMessage("Primero entra con Google.");
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
    const { error } = await supabase.from("teams").insert(payload);
    setMessage(error ? error.message : "Equipo creado. Actualiza la pantalla para verlo en la arena.");
  }

  async function createVenue(formData: FormData) {
    setMessage("");
    const name = String(formData.get("venueName") || "").trim();
    if (!name) return setMessage("La cancha necesita nombre.");
    const { supabase, userId } = await getUserId();
    if (!userId) return setMessage("Primero entra con Google.");
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
    if (!userId) return setMessage("Primero entra con Google.");
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
    if (!userId) return setMessage("Primero entra con Google.");
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
        {showTeam ? <form action={createTeam} className="action-card">
          <ShieldPlus />
          <h3>Crear equipo</h3>
          <p>Subi escudo, sigla y color base. La imagen se adapta al marco del club.</p>
          <input name="teamName" placeholder="Nombre del club" />
          <input name="shortName" maxLength={4} placeholder="Sigla" />
          <input name="neighborhood" placeholder="Barrio" />
          <input name="badgeFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
          <input name="primaryColor" type="color" defaultValue="#eec15c" />
          <SubmitButton idle="Guardar equipo" pending="Creando equipo" />
        </form> : null}

        {showVenue ? <form action={createVenue} className="action-card">
          <MapPinned />
          <h3>Registrar cancha</h3>
          <p>Direccion, precio, superficie y foto para mostrarla en el mapa de sedes.</p>
          <input name="venueName" placeholder="Nombre de la cancha" />
          <input name="venueNeighborhood" placeholder="Barrio" />
          <input name="venueAddress" placeholder="Direccion" />
          <input name="venueSurface" placeholder="Superficie" />
          <input name="pricePerHour" inputMode="numeric" placeholder="Precio por hora" />
          <input name="inscriptionFee" inputMode="numeric" placeholder="Inscripcion sugerida" />
          <input name="venuePhoto" type="file" accept="image/png,image/jpeg,image/webp" />
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
          <input name="playerPhoto" type="file" accept="image/png,image/jpeg,image/webp" />
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
      ) : mode === "slot" ? (
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

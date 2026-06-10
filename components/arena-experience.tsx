"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BellRing,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Crown,
  ExternalLink,
  Flag,
  Gamepad2,
  LoaderCircle,
  LogIn,
  LogOut,
  LocateFixed,
  MapPinned,
  Plus,
  RadioTower,
  Route,
  Shield,
  ShieldCheck,
  Star,
  Trophy,
  UserCheck,
  Users,
  X
} from "lucide-react";
import { ArenaActions } from "@/components/arena-actions";
import { InstallAppButton } from "@/components/install-app-button";
import { LoginPanel } from "@/components/login-panel";
import { PaymentConsole } from "@/components/payment-console";
import { VenueMap } from "@/components/venue-map";
import { buildTournamentDraw, type DrawResult } from "@/lib/draw";
import { roleCatalog } from "@/lib/demo";
import { getRosterRule } from "@/lib/roster";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AppRole, ArenaData, ArenaMatch, ArenaPlayer, ArenaTeam, ArenaTournament, ArenaTournamentDraw, ArenaVenue, FieldMode, LiveStreamEvent, LiveStreamMode, PaymentRequest } from "@/lib/types";

type TabId = "home" | "matches" | "league" | "squad" | "venues";

const tabs: Array<{ id: TabId; label: string; icon: typeof Gamepad2 }> = [
  { id: "home", label: "Inicio", icon: Gamepad2 },
  { id: "matches", label: "Partidos", icon: CalendarDays },
  { id: "league", label: "Liga", icon: Trophy },
  { id: "squad", label: "Equipo", icon: Shield },
  { id: "venues", label: "Canchas", icon: MapPinned }
];

const playableRoles: AppRole[] = ["player", "captain", "venue_owner", "organizer", "referee"];

const formatLabels = {
  league: "Liga todos contra todos",
  world_cup: "Mundial barrial",
  knockout: "Copa eliminatoria"
};

const fulbitoLiveChannelUrl = "https://www.youtube.com/@FulbitoLIVE?sub_confirmation=1";

const positionLabels: Record<string, string> = {
  ARQ: "Arquero",
  DEF: "Defensa",
  VOL: "Volante",
  DEL: "Delantero"
};

type FormationSlot = { x: number; y: number; label: string };
type FormationPreset = { id: string; name: string; shape: string; slots: FormationSlot[] };
type GeoPoint = { latitude: number; longitude: number };

const formationPresets: Record<FieldMode, FormationPreset[]> = {
  "5v5": [
    {
      id: "5-2-1-1",
      name: "Compacta",
      shape: "2-1-1",
      slots: [
        { x: 50, y: 86, label: "ARQ" },
        { x: 30, y: 62, label: "DEF" },
        { x: 70, y: 62, label: "DEF" },
        { x: 50, y: 41, label: "VOL" },
        { x: 50, y: 20, label: "DEL" }
      ]
    },
    {
      id: "5-1-2-1",
      name: "Control",
      shape: "1-2-1",
      slots: [
        { x: 50, y: 86, label: "ARQ" },
        { x: 50, y: 63, label: "DEF" },
        { x: 34, y: 42, label: "VOL" },
        { x: 66, y: 42, label: "VOL" },
        { x: 50, y: 20, label: "DEL" }
      ]
    },
    {
      id: "5-1-1-2",
      name: "Presion",
      shape: "1-1-2",
      slots: [
        { x: 50, y: 86, label: "ARQ" },
        { x: 50, y: 64, label: "DEF" },
        { x: 50, y: 44, label: "VOL" },
        { x: 35, y: 20, label: "DEL" },
        { x: 65, y: 20, label: "DEL" }
      ]
    }
  ],
  "7v7": [
    {
      id: "7-3-2-1",
      name: "Equilibrada",
      shape: "3-2-1",
      slots: [
        { x: 50, y: 87, label: "ARQ" },
        { x: 23, y: 68, label: "DEF" },
        { x: 50, y: 64, label: "DEF" },
        { x: 77, y: 68, label: "DEF" },
        { x: 34, y: 43, label: "VOL" },
        { x: 66, y: 43, label: "VOL" },
        { x: 50, y: 20, label: "DEL" }
      ]
    },
    {
      id: "7-2-3-1",
      name: "Posesion",
      shape: "2-3-1",
      slots: [
        { x: 50, y: 87, label: "ARQ" },
        { x: 35, y: 66, label: "DEF" },
        { x: 65, y: 66, label: "DEF" },
        { x: 24, y: 43, label: "VOL" },
        { x: 50, y: 39, label: "VOL" },
        { x: 76, y: 43, label: "VOL" },
        { x: 50, y: 18, label: "DEL" }
      ]
    },
    {
      id: "7-2-2-2",
      name: "Ataque",
      shape: "2-2-2",
      slots: [
        { x: 50, y: 87, label: "ARQ" },
        { x: 35, y: 66, label: "DEF" },
        { x: 65, y: 66, label: "DEF" },
        { x: 34, y: 43, label: "VOL" },
        { x: 66, y: 43, label: "VOL" },
        { x: 35, y: 20, label: "DEL" },
        { x: 65, y: 20, label: "DEL" }
      ]
    }
  ],
  "11v11": [
    {
      id: "11-4-3-3",
      name: "4-3-3",
      shape: "4-3-3",
      slots: [
        { x: 50, y: 88, label: "ARQ" },
        { x: 18, y: 70, label: "DEF" },
        { x: 38, y: 72, label: "DEF" },
        { x: 62, y: 72, label: "DEF" },
        { x: 82, y: 70, label: "DEF" },
        { x: 28, y: 50, label: "VOL" },
        { x: 50, y: 48, label: "VOL" },
        { x: 72, y: 50, label: "VOL" },
        { x: 24, y: 25, label: "DEL" },
        { x: 50, y: 18, label: "DEL" },
        { x: 76, y: 25, label: "DEL" }
      ]
    },
    {
      id: "11-4-4-2",
      name: "4-4-2",
      shape: "4-4-2",
      slots: [
        { x: 50, y: 88, label: "ARQ" },
        { x: 18, y: 70, label: "DEF" },
        { x: 38, y: 72, label: "DEF" },
        { x: 62, y: 72, label: "DEF" },
        { x: 82, y: 70, label: "DEF" },
        { x: 20, y: 47, label: "VOL" },
        { x: 40, y: 49, label: "VOL" },
        { x: 60, y: 49, label: "VOL" },
        { x: 80, y: 47, label: "VOL" },
        { x: 38, y: 20, label: "DEL" },
        { x: 62, y: 20, label: "DEL" }
      ]
    },
    {
      id: "11-3-5-2",
      name: "3-5-2",
      shape: "3-5-2",
      slots: [
        { x: 50, y: 88, label: "ARQ" },
        { x: 28, y: 70, label: "DEF" },
        { x: 50, y: 72, label: "DEF" },
        { x: 72, y: 70, label: "DEF" },
        { x: 15, y: 48, label: "VOL" },
        { x: 34, y: 48, label: "VOL" },
        { x: 50, y: 43, label: "VOL" },
        { x: 66, y: 48, label: "VOL" },
        { x: 85, y: 48, label: "VOL" },
        { x: 38, y: 20, label: "DEL" },
        { x: 62, y: 20, label: "DEL" }
      ]
    }
  ]
};

function getFormationPreset(mode: FieldMode, presetId: string) {
  return formationPresets[mode].find((preset) => preset.id === presetId) ?? formationPresets[mode][0];
}

function money(value: number) {
  return `$ ${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function hasCoordinates(venue: ArenaVenue) {
  return typeof venue.latitude === "number" && typeof venue.longitude === "number";
}

function distanceKm(from: GeoPoint, venue: ArenaVenue) {
  if (!hasCoordinates(venue)) return Number.POSITIVE_INFINITY;
  const earthRadius = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad((venue.latitude ?? 0) - from.latitude);
  const dLon = toRad((venue.longitude ?? 0) - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(venue.latitude ?? 0)) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function venueWhatsappUrl(phone?: string | null) {
  const digits = phone?.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

function formatDate(value: string | null) {
  if (!value) return "A confirmar";
  const source = new Date(value);
  const argentinaTime = new Date(source.getTime() - 3 * 60 * 60 * 1000);
  const days = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const day = days[argentinaTime.getUTCDay()];
  const date = String(argentinaTime.getUTCDate()).padStart(2, "0");
  const month = months[argentinaTime.getUTCMonth()];
  const hour = String(argentinaTime.getUTCHours()).padStart(2, "0");
  const minute = String(argentinaTime.getUTCMinutes()).padStart(2, "0");
  return `${day}, ${date} ${month}, ${hour}:${minute}`;
}

function groupTeams(teams: ArenaTeam[], size = 4) {
  return teams.reduce<ArenaTeam[][]>((groups, team, index) => {
    const groupIndex = Math.floor(index / size);
    groups[groupIndex] = groups[groupIndex] ?? [];
    groups[groupIndex].push(team);
    return groups;
  }, []);
}

function buildKnockoutRounds(teams: ArenaTeam[]) {
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(2, teams.length))));
  const labels: Record<number, string> = {
    32: "16avos",
    16: "Octavos",
    8: "Cuartos",
    4: "Semis",
    2: "Final"
  };
  const rounds: Array<{ label: string; slots: number }> = [];
  for (let size = bracketSize; size >= 2; size = size / 2) {
    rounds.push({ label: labels[size] ?? `${size} equipos`, slots: size });
  }
  return rounds;
}

function TeamCrest({ team, size = "normal" }: { team?: ArenaTeam | null; size?: "normal" | "large" }) {
  return (
    <span className={`team-crest ${size === "large" ? "team-crest--large" : ""}`} style={{ "--crest": team?.primary_color ?? "#eec15c" } as CSSProperties}>
      {team?.badge_url ? <img alt="" src={team.badge_url} /> : <b>{team?.short_name ?? "FC"}</b>}
    </span>
  );
}

function getPlayerInitials(player?: ArenaPlayer | null) {
  return player?.display_name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "FA";
}

function getPlayerRating(player: ArenaPlayer, team?: ArenaTeam) {
  const position = (player.position ?? "").toLowerCase();
  const positionBoost = position.includes("arquero") ? 5 : position.includes("delantero") ? 4 : position.includes("volante") ? 3 : 2;
  const cardPenalty = (player.yellow_cards ?? 0) + (player.red_cards ?? 0) * 4;
  const base = 67 + positionBoost + Math.min(player.goals * 4, 20) + Math.min(team?.played ?? 0, 10) - cardPenalty;
  return Math.max(48, Math.min(99, base));
}

function getPlayerStars(rating: number) {
  if (rating >= 90) return 5;
  if (rating >= 82) return 4;
  if (rating >= 74) return 3;
  return 2;
}

function getPlayerStatus(player: ArenaPlayer) {
  if ((player.red_cards ?? 0) > 0) return "Suspendido";
  return "Disponible";
}

function PlayerAvatar({ player }: { player?: ArenaPlayer | null }) {
  const initials = getPlayerInitials(player);

  return (
    <span className="player-disc">
      {player?.photo_url ? <img alt="" src={player.photo_url} /> : initials}
    </span>
  );
}

function PlayerCardModal({ player, team, onClose }: { player: ArenaPlayer; team?: ArenaTeam; onClose: () => void }) {
  const rating = getPlayerRating(player, team);
  const stars = getPlayerStars(rating);
  const status = getPlayerStatus(player);
  const played = team?.played ?? 0;
  const initials = getPlayerInitials(player);

  useEffect(() => {
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [onClose]);

  return (
    <div
      aria-labelledby="player-card-title"
      aria-modal="true"
      className="player-card-backdrop"
      onClick={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="dialog"
    >
      <article className="player-ultimate-card">
        <button aria-label="Cerrar ficha del jugador" className="player-card-close" onClick={onClose} type="button">
          <X size={18} />
        </button>
        <header>
          <div>
            <strong>{rating}</strong>
            <span>CAL</span>
          </div>
          <TeamCrest team={team} />
        </header>
        <div className="player-card-portrait">
          {player.photo_url ? <img alt="" src={player.photo_url} /> : <span>{initials}</span>}
        </div>
        <section className="player-card-name">
          <h2 id="player-card-title">{player.alias || player.display_name}</h2>
          <span>#{player.jersey_number ?? "-"} / {player.position ?? "Posicion"}</span>
        </section>
        <div className="player-card-stars" aria-label={`${stars} estrellas`}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Star className={index < stars ? "is-active" : ""} fill="currentColor" key={index} size={17} />
          ))}
        </div>
        <dl className="player-card-metrics">
          <div><dt>Goles</dt><dd>{player.goals}</dd></div>
          <div><dt>PJ</dt><dd>{played}</dd></div>
          <div><dt>Estado</dt><dd>{status}</dd></div>
          <div><dt>Amarillas</dt><dd>{player.yellow_cards ?? 0}</dd></div>
        </dl>
        <footer>
          <BadgeCheck size={17} />
          <span>DT o veedor actualiza goles, tarjetas y estado desde el acta.</span>
        </footer>
      </article>
    </div>
  );
}

function ScreenHeader({ eyebrow, title, children, compact = false }: { eyebrow: string; title: string; children?: ReactNode; compact?: boolean }) {
  return (
    <div className={`screen-header ${compact ? "screen-header--compact" : ""}`}>
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  onClick
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  onClick: () => void;
}) {
  return (
    <button className="mini-stat mini-stat--button" onClick={onClick} type="button">
      {icon}
      <strong>{value}</strong>
      <span>{label}</span>
      <ArrowRight size={16} />
    </button>
  );
}

function DrawLiveTeaser({
  data,
  tournament,
  onOpenTournaments,
  onOpenMatches
}: {
  data: ArenaData;
  tournament: ArenaTournament | null;
  onOpenTournaments: () => void;
  onOpenMatches: () => void;
}) {
  const [demoDraw, setDemoDraw] = useState<DrawResult | null>(null);
  const [officialDraw, setOfficialDraw] = useState<ArenaTournamentDraw | null>(null);
  const [stage, setStage] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [youtubeWatchUrl, setYoutubeWatchUrl] = useState("");
  if (!tournament) return null;
  const activeDrawTournament = tournament;
  const tournamentTeamIds = new Set(
    data.tournamentTeams
      .filter((row) => row.tournament_id === activeDrawTournament.id && row.status !== "rejected")
      .map((row) => row.team_id)
  );
  const enrolledTeams = data.teams.filter((team) => tournamentTeamIds.has(team.id));
  const teamCount = enrolledTeams.length;
  const maxTeams = activeDrawTournament.max_teams ?? Math.max(8, teamCount);
  const isReady = teamCount >= maxTeams;
  const groupLabels = ["A", "B", "C", "D"].slice(0, Math.max(2, Math.min(4, Math.ceil(maxTeams / 4))));
  const savedDraw = officialDraw ?? data.tournamentDraws.find((draw) => draw.tournament_id === activeDrawTournament.id && draw.mode === "official") ?? null;
  const canManage = Boolean(data.user && data.user.id === activeDrawTournament.organizer_id);
  const visibleGroups = savedDraw?.groups ?? demoDraw?.groups ?? [];
  const visibleBracket = savedDraw?.bracket ?? demoDraw?.bracket ?? [];

  function runDemoDraw() {
    if (enrolledTeams.length < 2) {
      setMessage("El demo necesita al menos 2 equipos inscriptos.");
      return;
    }
    const seed = `demo-${activeDrawTournament.id}-${Date.now()}`;
    const result = buildTournamentDraw({
      teams: enrolledTeams,
      format: activeDrawTournament.format,
      maxTeams,
      seed
    });
    setDemoDraw(result);
    setStage("Bolillero en marcha");
    setMessage("Demo rapido: no guarda resultado y se puede repetir para revisar la experiencia visual.");
    window.setTimeout(() => setStage("Saliendo bolillas"), 1600);
    window.setTimeout(() => setStage(activeDrawTournament.format === "knockout" ? "Llave generada" : "Grupos generados"), 3400);
  }

  async function createOfficialDraw() {
    if (!canManage || savedDraw) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/tournaments/${activeDrawTournament.id}/draw`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ youtubeWatchUrl })
      });
      const result = await response.json() as { draw?: ArenaTournamentDraw; reason?: string; error?: string };
      if (!response.ok || !result.draw) throw new Error(result.error || "No se pudo guardar el sorteo oficial.");
      setOfficialDraw(result.draw);
      setDemoDraw(null);
      setStage("Sorteo oficial guardado");
      setMessage(result.reason || "Sorteo oficial guardado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo iniciar el sorteo oficial.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="draw-live-teaser">
      <div className="draw-live-teaser__pot" aria-hidden="true">
        {groupLabels.map((group, index) => (
          <span key={group} style={{ "--angle": `${index * 88}deg`, "--delay": `${index * 120}ms` } as CSSProperties}>{group}</span>
        ))}
      </div>
      <div>
        <span>Sorteo Fulbito Live</span>
        <strong>{savedDraw ? "Sorteo oficial auditado" : isReady ? "Bolillero listo para fixture" : `${teamCount}/${maxTeams} equipos en el bolillero`}</strong>
        <p>
          Demo libre para probar. Oficial: una sola ejecucion, 2 a 3 minutos de show visual,
          grupos o llave segun formato y resultado guardado para compartir por YouTube.
        </p>
        {stage ? <small className="draw-live-teaser__stage">{stage}</small> : null}
      </div>
      <div className="draw-live-teaser__actions">
        <button onClick={onOpenTournaments} type="button">Ver equipos</button>
        <button onClick={runDemoDraw} type="button">Demo sorteo</button>
        <a href={fulbitoLiveChannelUrl} rel="noreferrer" target="_blank">Seguir Fulbito TV</a>
        <button onClick={onOpenMatches} type="button">Ver Fulbito Live</button>
      </div>
      {canManage && !savedDraw ? (
        <div className="draw-official-console">
          <input
            onChange={(event) => setYoutubeWatchUrl(event.target.value)}
            placeholder="Link YouTube del sorteo, opcional"
            value={youtubeWatchUrl}
          />
          <button disabled={!isReady || busy} onClick={createOfficialDraw} type="button">
            {busy ? "Guardando" : isReady ? "Iniciar sorteo oficial" : "Oficial al completar cupo"}
          </button>
        </div>
      ) : null}
      {savedDraw?.youtube_watch_url ? (
        <a className="draw-youtube-link" href={savedDraw.youtube_watch_url} rel="noreferrer" target="_blank">Ver sorteo en YouTube</a>
      ) : null}
      {visibleGroups.length || visibleBracket.length ? (
        <div className="draw-result-preview">
          {visibleGroups.map((group) => (
            <article key={group.code}>
              <strong>Grupo {group.code}</strong>
              <span>{group.teams.map((team) => team.shortName).join(" / ") || "Pendiente"}</span>
            </article>
          ))}
          {visibleBracket.slice(0, 4).map((slot) => (
            <article key={`${slot.round}-${slot.label}`}>
              <strong>{slot.round}</strong>
              <span>{slot.home} vs {slot.away}</span>
            </article>
          ))}
        </div>
      ) : null}
      {message ? <p className="draw-live-teaser__message">{message}</p> : null}
    </section>
  );
}

function YouTubeFollowStrip() {
  return (
    <section className="youtube-follow-strip">
      <RadioTower size={18} />
      <div>
        <strong>Fulbito TV en YouTube</strong>
        <span>Sorteos, vivos, finales y repeticiones quedan en el canal oficial.</span>
      </div>
      <a href={fulbitoLiveChannelUrl} rel="noreferrer" target="_blank">
        Seguir
        <ExternalLink size={15} />
      </a>
    </section>
  );
}

function playApprovalWhistle() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audio = new AudioContextClass();
    const now = audio.currentTime;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
    gain.connect(audio.destination);

    const whistle = audio.createOscillator();
    whistle.type = "sine";
    whistle.frequency.setValueAtTime(1240, now);
    whistle.frequency.linearRampToValueAtTime(1640, now + 0.18);
    whistle.frequency.linearRampToValueAtTime(1360, now + 0.42);
    whistle.connect(gain);
    whistle.start(now);
    whistle.stop(now + 0.62);
    window.setTimeout(() => void audio.close(), 900);
  } catch {
    // Browser audio permissions may block automatic notification sound.
  }
}

function statusLabel(status: PaymentRequest["status"]) {
  if (status === "approved") return "Aprobado";
  if (status === "rejected") return "Revisar";
  if (status === "cancelled") return "Cancelado";
  return "Pendiente";
}

function tournamentInviteCode(activeTournament: ArenaTournament | null, request: PaymentRequest) {
  if (request.target_type !== "tournament") return "";
  if (activeTournament?.id === request.target_id) return activeTournament.slug;
  return request.target_id ?? "";
}

function UserMenu({
  user,
  configured,
  team,
  activeTournament,
  paymentRequests,
  onLogin
}: {
  user: ArenaData["user"];
  configured: boolean;
  team?: ArenaTeam | null;
  activeTournament: ArenaTournament | null;
  paymentRequests: PaymentRequest[];
  onLogin: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const [menuRequests, setMenuRequests] = useState(paymentRequests);
  const approvedCount = menuRequests.filter((request) => request.status === "approved").length;
  const pendingCount = menuRequests.filter((request) => request.status === "pending_review").length;
  const latestRequests = menuRequests.slice(0, 6);
  const approvedTournamentRequests = menuRequests.filter((request) => request.status === "approved" && request.target_type === "tournament");

  useEffect(() => {
    if (!user) return;
    setOrigin(window.location.origin);
    const storageKey = `fulbito-approved-count-${user.id}`;
    const previous = Number(window.localStorage.getItem(storageKey) || approvedCount);
    if (approvedCount > previous) playApprovalWhistle();
    window.localStorage.setItem(storageKey, String(approvedCount));
  }, [approvedCount, user]);

  useEffect(() => {
    setMenuRequests(paymentRequests);
  }, [paymentRequests]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    function handleCreated(event: Event) {
      const request = (event as CustomEvent<PaymentRequest>).detail;
      if (!request) return;
      setMenuRequests((current) => [request, ...current.filter((item) => item.id !== request.id)]);
      setNotificationsOpen(true);
      setOpen(false);
    }

    async function refreshRequests() {
      const supabase = createSupabaseBrowserClient();
      const { data: nextRequests } = await supabase
        .from("payment_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(12);
      if (mounted && nextRequests) setMenuRequests(nextRequests as PaymentRequest[]);
    }

    window.addEventListener("fulbito:payment-request-created", handleCreated);
    const interval = window.setInterval(refreshRequests, 30000);
    return () => {
      mounted = false;
      window.removeEventListener("fulbito:payment-request-created", handleCreated);
      window.clearInterval(interval);
    };
  }, [user]);

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut({ scope: "local" });
    window.location.href = "/";
  }

  if (!user) {
    return (
      <button aria-label="Entrar con Google" className="top-auth top-auth--login" disabled={!configured} onClick={onLogin} type="button">
        <LogIn size={16} />
        <span>Entrar</span>
      </button>
    );
  }

  function inviteHref(request: PaymentRequest) {
    const code = tournamentInviteCode(activeTournament, request);
    if (!code || !origin) return "";
    const joinUrl = `${origin}/?join=${encodeURIComponent(code)}`;
    const text = `Te invito a jugar ${request.title.replace(/^(Mundial|Torneo) barrial - /, "")} en Fulbito Arena. Entra a ${joinUrl}, crea o elegi tu equipo y carga el plantel para sumarte a la copa.`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  return (
    <div className="top-user-menu top-user-menu--with-notifications">
      <button
        aria-expanded={notificationsOpen}
        aria-label="Abrir notificaciones"
        className={`top-notification-button ${approvedCount ? "is-approved" : pendingCount ? "is-pending" : ""}`}
        onClick={() => {
          setNotificationsOpen((current) => !current);
          setOpen(false);
        }}
        type="button"
      >
        <BellRing size={17} />
        {approvedCount + pendingCount > 0 ? <span>{approvedCount + pendingCount}</span> : null}
      </button>
      <button
        aria-expanded={open}
        aria-label="Abrir menu de cuenta"
        className="top-user-avatar"
        onClick={() => {
          setOpen((current) => !current);
          setNotificationsOpen(false);
        }}
        type="button"
      >
        {user.avatarUrl ? <img alt={`Cuenta de ${user.name ?? "Google"}`} src={user.avatarUrl} /> : <span>{user.name?.[0] ?? "F"}</span>}
      </button>
      {notificationsOpen ? (
        <div className="top-notification-popover">
          <header>
            <strong>Notificaciones</strong>
            <small>{approvedCount ? "Hay beneficios aprobados." : pendingCount ? "Tenes comprobantes en revision." : "Sin novedades."}</small>
          </header>
          {latestRequests.length ? (
            <div className="notification-list">
              {latestRequests.map((request) => {
                const invite = request.status === "approved" ? inviteHref(request) : "";
                return (
                  <article className={`notification-item notification-item--${request.status}`} key={request.id}>
                    <span>{statusLabel(request.status)}</span>
                    <strong>{request.title}</strong>
                    <small>{request.status === "approved" ? "Listo para usar." : request.status === "pending_review" ? "Fulbito revisa el comprobante." : "Requiere revision."}</small>
                    {invite ? <a href={invite} rel="noreferrer" target="_blank">Invitar equipos</a> : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p>Todavia no hay comprobantes ni activaciones.</p>
          )}
          {approvedTournamentRequests.length ? <small className="notification-hint">Cada invitacion lleva a los equipos a esta misma copa.</small> : null}
        </div>
      ) : null}
      {open ? (
        <div className="top-user-popover">
          <div>
            {user.avatarUrl ? <img alt="" src={user.avatarUrl} /> : <span>{user.name?.[0] ?? "F"}</span>}
            <div>
              <strong>{user.name ?? "Usuario"}</strong>
              <small>{team ? `Mi equipo: ${team.name}` : user.email ?? "Google conectado"}</small>
            </div>
          </div>
          <button onClick={logout} type="button">
            <LogOut size={16} />
            Salir
          </button>
          {user.roles.includes("admin") ? (
            <button onClick={() => { window.location.href = "/admin"; }} type="button">
              <ShieldCheck size={16} />
              Panel admin
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MatchTile({
  match,
  liveEvent,
  featured = false,
  onOpen
}: {
  match: ArenaMatch;
  liveEvent?: LiveStreamEvent | null;
  featured?: boolean;
  onOpen: () => void;
}) {
  const isFinal = match.status === "final";
  const isLive = liveEvent?.lifecycle_status === "live" || liveEvent?.lifecycle_status === "testing";
  return (
    <button className={featured ? "match-tile match-tile--featured match-tile--button" : "match-tile match-tile--button"} onClick={onOpen} type="button">
      <div className="match-tile__meta">
        <span>{match.round_name}</span>
        <b className={isLive ? "is-live" : ""}>{isLive ? "En vivo" : isFinal ? "Final" : "Por jugar"}</b>
      </div>
      <div className="match-tile__teams">
        <div><TeamCrest team={match.homeTeam} /><strong>{match.homeTeam?.short_name ?? "LOC"}</strong></div>
        <em>{isFinal ? `${match.home_score} - ${match.away_score}` : "VS"}</em>
        <div><TeamCrest team={match.awayTeam} /><strong>{match.awayTeam?.short_name ?? "VIS"}</strong></div>
      </div>
      <footer>
        <span>{match.venue?.name ?? "Cancha a confirmar"}</span>
        <span>{formatDate(match.scheduled_at)}</span>
      </footer>
    </button>
  );
}

function getLiveEventForMatch(events: LiveStreamEvent[], matchId?: string | null) {
  if (!matchId) return null;
  const rank: Record<LiveStreamEvent["lifecycle_status"], number> = {
    live: 0,
    testing: 1,
    ready: 2,
    scheduled: 3,
    complete: 4,
    cancelled: 8,
    failed: 9
  };
  return events
    .filter((event) => event.match_id === matchId)
    .sort((a, b) => (rank[a.lifecycle_status] ?? 9) - (rank[b.lifecycle_status] ?? 9) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;
}

function liveEventStatusLabel(event?: LiveStreamEvent | null) {
  if (!event) return "Sin transmision";
  if (event.lifecycle_status === "live" || event.lifecycle_status === "testing") return "En vivo";
  if (event.lifecycle_status === "ready") return "Listo";
  if (event.lifecycle_status === "scheduled") return "Programado";
  if (event.lifecycle_status === "complete") return "Repeticion";
  if (event.lifecycle_status === "cancelled") return "Revocado";
  return "No disponible";
}

function TeamRow({ team, onOpen }: { team: ArenaTeam; onOpen: () => void }) {
  return (
    <button className="team-row team-row--button" onClick={onOpen} type="button">
      <TeamCrest team={team} />
      <div>
        <strong>{team.name}</strong>
        <span>{team.neighborhood ?? "Barrio"} / {team.points ?? 0} pts / DG {team.goalDiff ?? 0}</span>
      </div>
      <ChevronRight size={18} />
    </button>
  );
}

function VenueRow({ venue, onOpen }: { venue: ArenaVenue; onOpen: () => void }) {
  return (
    <button className="venue-row venue-row--button" onClick={onOpen} type="button">
      <div>
        <strong>{venue.name}</strong>
        <span>{venue.neighborhood} / {venue.surface ?? "Sintetico"} / {venue.phone ? `Contacto ${venue.phone}` : venue.address ?? "Direccion pendiente"}</span>
      </div>
      <b>{money(venue.price_per_hour)}</b>
    </button>
  );
}

function StandingCompact({ teams, onTeamOpen }: { teams: ArenaTeam[]; onTeamOpen: (teamId: string) => void }) {
  return (
    <div className="standings-compact">
      {teams.map((team, index) => (
        <button className="standings-row" key={team.id} onClick={() => onTeamOpen(team.id)} type="button">
          <span>{index + 1}</span>
          <TeamCrest team={team} />
          <strong>{team.short_name}</strong>
          <b>{team.points ?? 0}</b>
          <small>{team.played ?? 0} PJ / GF {team.goalsFor ?? 0} / GC {team.goalsAgainst ?? 0} / DG {team.goalDiff ?? 0}</small>
        </button>
      ))}
    </div>
  );
}

function RoleConsole({
  user,
  roles,
  activeRole,
  message,
  team,
  onChangeRole,
  onAddRole
}: {
  user: ArenaData["user"];
  roles: AppRole[];
  activeRole: AppRole;
  message: string;
  team?: ArenaTeam | null;
  onChangeRole: (role: AppRole) => void;
  onAddRole: (role: AppRole) => void;
}) {
  const info = roleCatalog[activeRole];
  const [open, setOpen] = useState(false);
  return (
    <section className={`role-console ${open ? "is-open" : ""}`}>
      <button className="role-console__toggle" onClick={() => setOpen((current) => !current)} type="button">
        <ShieldCheck size={20} />
        <div>
          <span>Tu arena</span>
          <strong>{info.label}</strong>
          <small>{team ? `Equipo rapido: ${team.name}` : "Elegir participante"}</small>
        </div>
        <ChevronDown size={18} />
      </button>
      {open ? (
        <>
          <div className="role-guide">
            <article>
              <span>1</span>
              <strong>Tu cuenta</strong>
              <small>{user?.name ?? "Google"} activa roles sin crear otra cuenta.</small>
            </article>
            <article>
              <span>2</span>
              <strong>Tu equipo</strong>
              <small>{team ? `${team.name} queda como acceso rapido.` : "Crea o elige un equipo como preferido."}</small>
            </article>
            <article>
              <span>3</span>
              <strong>Tu panel</strong>
              <small>Cada rol muestra acciones distintas.</small>
            </article>
          </div>
          <div className="role-console__roles" aria-label="Roles activos">
            {playableRoles.map((role) => {
              const owned = roles.includes(role);
              return (
                <button
                  className={activeRole === role ? "is-active" : owned ? "is-owned" : ""}
                  key={role}
                  onClick={() => (owned ? onChangeRole(role) : onAddRole(role))}
                  type="button"
                >
                  {owned ? <ShieldCheck size={15} /> : <Plus size={15} />}
                  <span>{roleCatalog[role].label}</span>
                </button>
              );
            })}
          </div>
          <article className="selected-role-card selected-role-card--game">
            <ShieldCheck size={20} />
            <div>
              <strong>{info.label}: {info.headline}</strong>
              <span>{info.actions.slice(0, 3).join(" / ")}</span>
            </div>
          </article>
        </>
      ) : null}
      {message ? <p className="console-message">{message}</p> : null}
    </section>
  );
}

function TeamProfile({ team, players, isManager }: { team?: ArenaTeam; players: ArenaPlayer[]; isManager: boolean }) {
  if (!team) return null;
  const goals = players.reduce((total, player) => total + player.goals, 0);
  return (
    <section className="team-profile-console">
      <div className="team-profile-console__identity">
        <TeamCrest team={team} size="large" />
        <div>
          <span>{isManager ? "Panel del club" : "Vista publica"}</span>
          <h2>{team.name}</h2>
          <p>{team.neighborhood ?? "Barrio"} / {players.length} jugadores / {goals} goles</p>
        </div>
      </div>
      <div className="team-profile-console__stats">
        <strong>{team.points ?? 0}<span>PTS</span></strong>
        <strong>{team.played ?? 0}<span>PJ</span></strong>
        <strong>{team.goalDiff ?? 0}<span>DG</span></strong>
      </div>
    </section>
  );
}

function FormationPanel({
  team,
  players,
  mode,
  preset,
  presetId,
  selectedSlotIndex,
  isManager,
  onModeChange,
  onPresetChange,
  onOpenPlayer,
  onSelectSlot,
  lockedMode = false
}: {
  team?: ArenaTeam;
  players: ArenaPlayer[];
  mode: FieldMode;
  preset: FormationPreset;
  presetId: string;
  selectedSlotIndex: number;
  isManager: boolean;
  onModeChange: (mode: FieldMode) => void;
  onPresetChange: (presetId: string) => void;
  onOpenPlayer: (playerId: string) => void;
  onSelectSlot: (index: number) => void;
  lockedMode?: boolean;
}) {
  const fieldModes = lockedMode ? [mode] : (["5v5", "7v7", "11v11"] as FieldMode[]);

  return (
    <article className="console-panel formation-console">
      <div className="formation-console__head">
        <div>
          <TeamCrest team={team} size="large" />
          <strong>{team?.name ?? "Equipo"}</strong>
          <span>{isManager ? "Toca un puesto y carga jugador" : "Plantel y formacion publica"}</span>
        </div>
        <div className="formation-controls" aria-label="Modo de cancha">
          {fieldModes.map((item) => (
            <button className={mode === item ? "is-active" : ""} key={item} onClick={() => onModeChange(item)} type="button">
              {item}
            </button>
          ))}
        </div>
      </div>
      {lockedMode ? <p className="formation-locked-note">Formato fijado por esta copa: {mode}.</p> : null}
      <div className="formation-presets" aria-label="Esquema tactico">
        {formationPresets[mode].map((item) => (
          <button className={item.id === presetId ? "is-active" : ""} key={item.id} onClick={() => onPresetChange(item.id)} type="button">
            <strong>{item.shape}</strong>
            <span>{item.name}</span>
          </button>
        ))}
      </div>
      <div className="formation-pitch formation-pitch--console">
        <span className="pitch-goal pitch-goal--top" />
        <span className="pitch-goal pitch-goal--bottom" />
        <span className="pitch-box pitch-box--top" />
        <span className="pitch-box pitch-box--bottom" />
        <span className="pitch-circle" />
        {preset.slots.map((slot, index) => {
          const player = players[index] ?? null;
          const selected = selectedSlotIndex === index;
          return (
            <button
              className={`formation-slot formation-slot--button ${selected ? "is-selected" : ""} ${player ? "is-filled" : "is-empty"}`}
              aria-label={player ? `Abrir ficha de ${player.display_name}` : `Cargar ${slot.label} ${index + 1}`}
              key={`${mode}-${slot.label}-${index}`}
              onClick={() => {
                onSelectSlot(index);
                if (player) onOpenPlayer(player.id);
              }}
              style={{ "--x": `${slot.x}%`, "--y": `${slot.y}%` } as CSSProperties}
              type="button"
            >
              <PlayerAvatar player={player} />
              <strong>{player?.jersey_number ?? index + 1}</strong>
              <span>{player?.alias || player?.display_name || slot.label}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function GroupTables({ groups }: { groups: ArenaTeam[][] }) {
  return (
    <section className="groups-console">
      {groups.map((group, groupIndex) => (
        <article key={`group-${groupIndex}`}>
          <header>
            <strong>Grupo {String.fromCharCode(65 + groupIndex)}</strong>
            <span>{group.length}/4 equipos</span>
          </header>
          {group.map((team, index) => (
            <div key={team.id}>
              <span>{index + 1}</span>
              <TeamCrest team={team} />
              <b>{team.short_name}</b>
              <small>{team.points ?? 0} pts</small>
            </div>
          ))}
        </article>
      ))}
    </section>
  );
}

function KnockoutPath({ rounds, teams }: { rounds: Array<{ label: string; slots: number }>; teams: ArenaTeam[] }) {
  return (
    <section className="console-panel bracket-console bracket-console--path">
      {rounds.map((round, index) => (
        <article key={round.label}>
          <span>0{index + 1}</span>
          <strong>{round.label}</strong>
          <small>{round.slots} clasificados</small>
          <div>
            {Array.from({ length: Math.min(4, Math.max(1, round.slots / 2)) }).map((_, slot) => {
              const team = teams[(index + slot) % Math.max(teams.length, 1)];
              return <i key={`${round.label}-${slot}`}>{team?.short_name ?? "TBD"}</i>;
            })}
          </div>
        </article>
      ))}
    </section>
  );
}

function VenueSpotlight({ venue }: { venue?: ArenaVenue }) {
  if (!venue) return null;
  const whatsappUrl = venueWhatsappUrl(venue.phone);
  return (
    <section className="venue-spotlight">
      <div>
        <span>{venue.status === "verified" ? "Cancha verificada" : "Cancha partner"}</span>
        <h2>{venue.name}</h2>
        <p>{venue.address ?? venue.neighborhood} / {venue.open_hours ?? "Horario a cargar"}</p>
        {venue.phone ? <small>Contacto: {venue.phone}</small> : null}
      </div>
      <div>
        <strong>{money(venue.price_per_hour)}<small>por hora</small></strong>
        {whatsappUrl ? <a className="venue-contact-link" href={whatsappUrl} rel="noreferrer" target="_blank">Consultar turno</a> : null}
      </div>
    </section>
  );
}

function EmptyState({
  icon,
  title,
  children
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="empty-arena-state">
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </section>
  );
}

function SplashScreen() {
  return (
    <div className="arena-splash" aria-label="Cargando Fulbito Arena">
      <div className="arena-splash__ball" aria-hidden="true">
        <span className="arena-splash__texture" />
        <span className="arena-splash__patch arena-splash__patch--center" />
        <span className="arena-splash__patch arena-splash__patch--top" />
        <span className="arena-splash__patch arena-splash__patch--left" />
        <span className="arena-splash__patch arena-splash__patch--right" />
        <span className="arena-splash__patch arena-splash__patch--bottom" />
        <span className="arena-splash__shine" />
      </div>
      <strong>Fulbito Arena</strong>
      <small>Modo torneo</small>
    </div>
  );
}

function TeamPlayerInvitePanel({
  players,
  rosterRule,
  team,
  tournament
}: {
  players: ArenaPlayer[];
  rosterRule: ReturnType<typeof getRosterRule>;
  team: ArenaTeam;
  tournament: ArenaTournament | null;
}) {
  const [href, setHref] = useState("");
  const rosterFull = players.length >= rosterRule.maxPlayers;

  useEffect(() => {
    if (!tournament?.slug || !team.slug) return;
    const joinUrl = `${window.location.origin}/?join=${encodeURIComponent(tournament.slug)}&team=${encodeURIComponent(team.slug)}`;
    const text = `Te invito a sumarte a ${team.name} en ${tournament.name}. Entra a ${joinUrl}, carga tu nombre, dorsal, apodo y foto para quedar en el plantel.`;
    setHref(`https://wa.me/?text=${encodeURIComponent(text)}`);
  }, [team.name, team.slug, tournament?.name, tournament?.slug]);

  return (
    <section className="player-invite-panel">
      <div>
        <span>Invitar plantel</span>
        <strong>{players.length}/{rosterRule.maxPlayers} jugadores</strong>
        <p>Compartile este link a los jugadores. Cada uno entra con Google y completa su propia ficha dentro de {team.name}.</p>
      </div>
      {href && !rosterFull ? (
        <a href={href} rel="noreferrer" target="_blank">Invitar jugadores por WhatsApp</a>
      ) : (
        <button disabled type="button">{rosterFull ? "Plantel completo" : "Preparando link"}</button>
      )}
    </section>
  );
}

function PlayerSelfJoinPanel({
  data,
  players,
  rosterRule,
  team
}: {
  data: ArenaData;
  players: ArenaPlayer[];
  rosterRule: ReturnType<typeof getRosterRule>;
  team: ArenaTeam;
}) {
  const ownPlayer = data.user ? players.find((player) => player.profile_id === data.user?.id) : null;
  const rosterFull = players.length >= rosterRule.maxPlayers && !ownPlayer;

  return (
    <section className="player-self-panel">
      <header>
        <UserCheck size={18} />
        <div>
          <span>Entrada de jugador</span>
          <strong>{ownPlayer ? "Tu ficha ya esta en el plantel" : `Completa tu ficha en ${team.name}`}</strong>
          <small>{rosterRule.label}: {rosterRule.starters} titulares + {rosterRule.substitutes} suplentes.</small>
        </div>
      </header>
      {ownPlayer ? (
        <div className="player-self-panel__ready">
          <PlayerAvatar player={ownPlayer} />
          <div>
            <strong>{ownPlayer.display_name}</strong>
            <span>#{ownPlayer.jersey_number ?? "-"} / {ownPlayer.alias ?? "Sin apodo"} / {ownPlayer.position ?? "Posicion"}</span>
          </div>
        </div>
      ) : rosterFull ? (
        <p>El plantel esta completo. Pedile al capitan que libere un lugar o cambie la convocatoria.</p>
      ) : (
        <ArenaActions data={data} mode="self-player" selectedTeamId={team.id} />
      )}
    </section>
  );
}

function LiveMatchPanel({
  canManageLive,
  data,
  initialEvent,
  match
}: {
  canManageLive: boolean;
  data: ArenaData;
  initialEvent?: LiveStreamEvent | null;
  match: ArenaMatch;
}) {
  const [liveEvent, setLiveEvent] = useState<LiveStreamEvent | null>(initialEvent ?? null);
  const [mode, setMode] = useState<Extract<LiveStreamMode, "external_link" | "official_auto">>("external_link");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const status = liveEventStatusLabel(liveEvent);
  const isLive = liveEvent?.lifecycle_status === "live" || liveEvent?.lifecycle_status === "testing";
  const canCreate = canManageLive && !liveEvent;
  const defaultTitle = `${match.homeTeam?.short_name ?? "Local"} vs ${match.awayTeam?.short_name ?? "Visitante"} - Fulbito Live`;

  useEffect(() => {
    setLiveEvent(initialEvent ?? null);
    setMessage("");
  }, [initialEvent?.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.user) {
      setMessage("Entra con Google para crear una transmision.");
      return;
    }
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/live/events/auto-create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tournamentId: match.tournament_id,
          matchId: match.id,
          mode,
          streamType: match.round_name.toLowerCase().includes("final") ? "final" : "match",
          title: String(form.get("title") || defaultTitle),
          description: String(form.get("description") || ""),
          youtubeWatchUrl: String(form.get("youtubeWatchUrl") || ""),
          visibility: String(form.get("visibility") || "public"),
          scheduledStartAt: match.scheduled_at,
          sponsorName: String(form.get("sponsorName") || ""),
          sponsorUrl: String(form.get("sponsorUrl") || "")
        })
      });
      const result = await response.json() as { event?: LiveStreamEvent; reason?: string; error?: string };
      if (!response.ok || !result.event) throw new Error(result.reason || result.error || "No se pudo crear Fulbito Live.");
      setLiveEvent(result.event);
      setMessage(result.reason || "Transmision guardada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear Fulbito Live.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`live-match-panel ${isLive ? "is-live" : ""}`}>
      <header>
        <RadioTower size={18} />
        <div>
          <span>Fulbito Live</span>
          <strong>{status}</strong>
          <small>YouTube o red externa procesa el video. Fulbito solo guarda link, estado y sponsor.</small>
        </div>
      </header>

      {liveEvent ? (
        <article className="live-match-card">
          <div>
            <span>{liveEvent.mode === "official_auto" ? "Canal oficial mock" : "Link externo"}</span>
            <strong>{liveEvent.title}</strong>
            <small>{liveEvent.sponsor_name ? `Sponsor: ${liveEvent.sponsor_name}` : "Sin sponsor cargado"}</small>
          </div>
          {liveEvent.youtube_watch_url ? (
            <a href={liveEvent.youtube_watch_url} rel="noreferrer" target="_blank">
              <ExternalLink size={16} />
              {liveEvent.lifecycle_status === "complete" ? "Ver repeticion" : "Ver en YouTube"}
            </a>
          ) : null}
        </article>
      ) : null}

      {canCreate ? (
        <form className="live-create-form" onSubmit={submit}>
          <div className="live-mode-switch">
            <button className={mode === "external_link" ? "is-active" : ""} onClick={() => setMode("external_link")} type="button">Link externo</button>
            <button className={mode === "official_auto" ? "is-active" : ""} onClick={() => setMode("official_auto")} type="button">Oficial mock</button>
          </div>
          <input name="title" placeholder="Titulo del vivo" defaultValue={defaultTitle} />
          {mode === "external_link" ? <input name="youtubeWatchUrl" placeholder="Link YouTube, TikTok, Facebook o Instagram" /> : null}
          <div className="live-create-form__grid">
            <input name="sponsorName" placeholder="Sponsor opcional" />
            <select name="visibility" defaultValue="public">
              <option value="public">Publico</option>
              <option value="unlisted">No listado</option>
              <option value="private">Privado</option>
            </select>
          </div>
          <textarea name="description" placeholder="Notas internas o descripcion corta" rows={2} />
          <button disabled={busy} type="submit">
            {busy ? <LoaderCircle className="button-spinner" size={16} /> : <RadioTower size={16} />}
            {mode === "official_auto" ? "Crear Live oficial mock" : "Guardar link en vivo"}
          </button>
        </form>
      ) : !liveEvent ? (
        <p className="live-match-note">El creador del torneo habilitado puede activar Fulbito Live para este partido.</p>
      ) : null}

      {message ? <p className="live-match-message">{message}</p> : null}
    </section>
  );
}

export function ArenaExperience({ data, joinCode, inviteTeamCode }: { data: ArenaData; joinCode?: string; inviteTeamCode?: string }) {
  const inviteMode = Boolean(joinCode && data.activeTournament);
  const ownedTeam = data.user ? data.teams.find((team) => team.owner_id === data.user?.id) : null;
  const memberTeamId = data.user ? data.players.find((player) => player.profile_id === data.user?.id)?.team_id : null;
  const memberTeam = memberTeamId ? data.teams.find((team) => team.id === memberTeamId) : null;
  const invitedTeam = inviteTeamCode
    ? data.teams.find((team) => team.slug === inviteTeamCode || team.id === inviteTeamCode || team.short_name.toLowerCase() === inviteTeamCode.toLowerCase())
    : null;
  const playerInviteMode = Boolean(inviteMode && inviteTeamCode && invitedTeam);
  const inferredTeam = invitedTeam ?? ownedTeam ?? memberTeam ?? (inviteMode ? null : data.teams[0] ?? null);

  const [showSplash, setShowSplash] = useState(true);
  const [active, setActive] = useState<TabId>(() => inviteMode && data.user ? "squad" : "home");
  const [formationMode, setFormationMode] = useState<FieldMode>(data.activeTournament?.field_mode ?? "7v7");
  const [formationPresetId, setFormationPresetId] = useState(formationPresets[data.activeTournament?.field_mode ?? "7v7"][0].id);
  const [selectedTeamId, setSelectedTeamId] = useState(inferredTeam?.id ?? "");
  const [selectedVenueId, setSelectedVenueId] = useState(data.venues[0]?.id ?? "");
  const [selectedMatchId, setSelectedMatchId] = useState(data.matches.find((match) => match.status !== "final")?.id ?? data.matches[0]?.id ?? "");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(formationPresets[data.activeTournament?.field_mode ?? "7v7"][0].slots.length - 1);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<AppRole[]>(() => data.user?.roles.length ? data.user.roles : ["player"]);
  const [activeRole, setActiveRole] = useState<AppRole>(() => data.user?.roles[0] ?? "player");
  const [roleMessage, setRoleMessage] = useState("");
  const [venueLocation, setVenueLocation] = useState<GeoPoint | null>(null);
  const [venueLocationAsked, setVenueLocationAsked] = useState(false);
  const [venueLocationStatus, setVenueLocationStatus] = useState("Mostrando canchas registradas.");

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  const nextMatch = useMemo(() => data.matches.find((match) => match.status !== "final") ?? data.matches[0], [data.matches]);
  const selectedMatch = data.matches.find((match) => match.id === selectedMatchId) ?? nextMatch;
  const liveEventByMatch = useMemo(() => {
    return data.liveEvents.reduce<Map<string, LiveStreamEvent>>((map, event) => {
      if (!event.match_id) return map;
      const current = map.get(event.match_id);
      if (!current) {
        map.set(event.match_id, event);
        return map;
      }
      map.set(event.match_id, getLiveEventForMatch([current, event], event.match_id) ?? current);
      return map;
    }, new Map());
  }, [data.liveEvents]);
  const selectedMatchLiveEvent = selectedMatch ? liveEventByMatch.get(selectedMatch.id) ?? null : null;
  const selectedTeam = data.teams.find((team) => team.id === selectedTeamId) ?? (inviteMode && !inferredTeam ? undefined : data.teams[0]);
  const nearbyVenues = useMemo(() => {
    if (!venueLocation) return data.venues;
    return data.venues
      .map((venue) => ({ venue, distance: distanceKm(venueLocation, venue) }))
      .filter((item) => item.distance <= 50 || item.venue.owner_id === data.user?.id)
      .sort((a, b) => a.distance - b.distance)
      .map((item) => item.venue);
  }, [data.user?.id, data.venues, venueLocation]);
  const selectedVenue = nearbyVenues.find((venue) => venue.id === selectedVenueId) ?? nearbyVenues[0];
  const selectedPlayers = data.players.filter((player) => player.team_id === selectedTeam?.id);
  const selectedPlayer = selectedPlayers.find((player) => player.id === selectedPlayerId) ?? null;
  const groups = useMemo(() => groupTeams(data.standings.length ? data.standings : data.teams), [data.standings, data.teams]);
  const knockoutRounds = useMemo(() => buildKnockoutRounds(data.teams), [data.teams]);
  const currentFormation = getFormationPreset(formationMode, formationPresetId);
  const selectedSlot = currentFormation.slots[selectedSlotIndex] ?? currentFormation.slots[0];
  const rosterRule = getRosterRule(data.activeTournament?.field_mode);
  const isTeamManager = Boolean(
    data.user &&
    (selectedTeam?.owner_id === data.user.id || userRoles.includes("organizer") || userRoles.includes("admin"))
  );
  const myTeam = ownedTeam ?? memberTeam ?? selectedTeam;
  const hasCreatedTournament = Boolean(data.user && data.tournaments.some((tournament) => tournament.organizer_id === data.user?.id));
  const canManageSelectedMatchLive = Boolean(
    data.user &&
    selectedMatch &&
    data.activeTournament &&
    selectedMatch.tournament_id === data.activeTournament.id &&
    (data.activeTournament.organizer_id === data.user.id || userRoles.includes("admin") || userRoles.includes("venue_owner"))
  );

  useEffect(() => {
    if (!data.user || !inferredTeam?.id) return;
    setSelectedTeamId((current) => current || inferredTeam.id);
  }, [data.user, inferredTeam?.id]);

  useEffect(() => {
    if (selectedVenue?.id) setSelectedVenueId((current) => current || selectedVenue.id);
  }, [selectedVenue?.id]);

  const requestVenueLocation = useCallback(() => {
    setVenueLocationAsked(true);
    if (!navigator.geolocation) {
      setVenueLocationStatus("Tu navegador no permite ubicacion. Mostramos todas las canchas registradas.");
      return;
    }
    setVenueLocationStatus("Buscando canchas a 50 km de tu ubicacion...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6))
        };
        setVenueLocation(point);
        setVenueLocationStatus("Mostrando canchas registradas hasta 50 km de tu ubicacion.");
      },
      () => {
        setVenueLocationStatus("No se pudo tomar tu ubicacion. Mostramos todas las canchas registradas.");
      },
      { enableHighAccuracy: true, maximumAge: 120000, timeout: 12000 }
    );
  }, []);

  useEffect(() => {
    if (active !== "venues" || !data.user || venueLocationAsked) return;
    requestVenueLocation();
  }, [active, data.user, requestVenueLocation, venueLocationAsked]);

  function openLoginPanel() {
    setActive("home");
    window.setTimeout(() => {
      document.getElementById("login")?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 60);
  }

  function openTournamentStarter() {
    setActive("home");
    window.setTimeout(() => {
      document.getElementById(data.user ? "pro" : "login")?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 60);
  }

  function openMyTournaments() {
    if (!data.user) {
      openLoginPanel();
      return;
    }
    setActive("home");
    window.setTimeout(() => {
      window.dispatchEvent(new Event("fulbito:open-my-tournaments"));
      document.getElementById("my-tournaments")?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
  }

  const openTeam = useCallback((teamId: string) => {
    setSelectedTeamId(teamId);
    setActive("squad");
  }, []);

  const openVenue = useCallback((venueId: string) => {
    setSelectedVenueId(venueId);
    setActive("venues");
  }, []);

  const openMatch = useCallback((match: ArenaMatch) => {
    setSelectedMatchId(match.id);
    setActive("matches");
  }, []);

  async function addRole(role: AppRole) {
    if (!data.user) return;
    setRoleMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("user_roles").upsert({ user_id: data.user.id, role }, { onConflict: "user_id,role" });
      if (error) throw error;
      setUserRoles((current) => current.includes(role) ? current : [...current, role]);
      setActiveRole(role);
      setRoleMessage(`Rol activado: ${roleCatalog[role].label}.`);
    } catch (error) {
      setRoleMessage(error instanceof Error ? error.message : "No se pudo activar el rol.");
    }
  }

  function renderHome() {
    return (
      <>
        {inviteMode ? (
          <section className="join-tournament-banner join-tournament-banner--priority">
            <Trophy size={20} />
            <div>
              <span>{playerInviteMode ? "Invitacion al plantel" : "Invitacion recibida"}</span>
              <strong>{playerInviteMode ? invitedTeam?.name : data.activeTournament?.name}</strong>
              <small>{playerInviteMode ? `Este link te suma al equipo en ${data.activeTournament?.name}.` : "Este link te lleva a la misma copa que creo el organizador."}</small>
            </div>
            <button onClick={() => (data.user ? setActive("squad") : openLoginPanel())} type="button">{playerInviteMode ? "Cargar ficha" : "Cargar equipo"}</button>
          </section>
        ) : null}

        {!inviteMode && !hasCreatedTournament ? (
          <section className="console-hero-panel console-hero-panel--2026">
            <img alt="" className="hero-mark" src="/assets/icon.svg" />
            <span>Fulbito Arena 2026</span>
            <h1>Tu liga entra en modo juego.</h1>
            <p>Fixture, tabla, plantel y canchas con una experiencia de torneo para futbol amateur.</p>
            <div className="hero-actions">
              <InstallAppButton variant="hero" />
              <button onClick={openTournamentStarter} type="button">Crear torneo</button>
              <button onClick={() => setActive("matches")} type="button">Ver fecha</button>
            </div>
          </section>
        ) : null}

        {!inviteMode && nextMatch ? (
          <MatchTile liveEvent={liveEventByMatch.get(nextMatch.id)} match={nextMatch} featured onOpen={() => openMatch(nextMatch)} />
        ) : !inviteMode && data.user ? (
          <EmptyState icon={<CalendarDays />} title="Tu calendario empieza vacio">
            Crea un torneo, carga tu equipo o espera una invitacion. Cuando haya fixtures reales, aparecen aca.
          </EmptyState>
        ) : null}

        {(!inviteMode || data.user) ? (
          <section className="mini-grid">
            <MiniStat icon={<Trophy />} label={data.activeTournament ? formatLabels[data.activeTournament.format] : "Formato"} onClick={() => setActive("league")} value={data.activeTournament?.name ?? "Torneo"} />
            <MiniStat icon={<Users />} label="Equipos" onClick={() => setActive("squad")} value={data.teams.length} />
            <MiniStat icon={<CalendarDays />} label="Partidos" onClick={() => setActive("matches")} value={data.matches.length} />
            <MiniStat icon={<Trophy />} label="Mis torneos" onClick={openMyTournaments} value={data.tournaments.length} />
          </section>
        ) : null}

        {!inviteMode ? <YouTubeFollowStrip /> : null}

        {!inviteMode && data.user ? (
          <DrawLiveTeaser
            data={data}
            onOpenMatches={() => setActive("matches")}
            onOpenTournaments={openMyTournaments}
            tournament={data.activeTournament}
          />
        ) : null}

        <section className="console-panel">
          {!data.user || inviteMode ? (
            <ScreenHeader
              eyebrow={inviteMode ? playerInviteMode ? "Entrada de jugador" : "Entrada de equipo" : "Crear torneo"}
              title={inviteMode ? data.user ? playerInviteMode ? "Completa tu ficha" : "Carga tu club invitado" : "Entra para sumarte" : "Crea tu torneo barrial"}
            >
              {inviteMode
                ? data.user
                  ? playerInviteMode
                    ? "Carga tus datos como jugador para que el capitan te vea en el plantel."
                    : "Completa o inscribi tu equipo en esta copa. Despues podes volver al inicio para crear otra arena."
                  : playerInviteMode
                    ? "Primero entra con Google. Al volver, Fulbito te lleva directo a completar tu ficha."
                    : "Primero entra con Google. Al volver, Fulbito te lleva directo a cargar el equipo para esta copa."
                : "Entra con Google para armar una copa, elegir formato, invitar equipos y seguir el torneo desde el celular."}
            </ScreenHeader>
          ) : null}
          {inviteMode && data.user ? (
            <div className="join-focus-actions">
              <button className="join-focus-button" onClick={() => setActive("squad")} type="button">
                {playerInviteMode ? `Completar ficha en ${invitedTeam?.name}` : `Cargar equipo en ${data.activeTournament?.name}`}
                <ChevronRight size={18} />
              </button>
              <button className="join-secondary-button" onClick={() => { window.location.href = "/"; }} type="button">
                Crear nueva copa
              </button>
            </div>
          ) : data.user ? (
            <RoleConsole
              activeRole={activeRole}
              message={roleMessage}
              team={myTeam}
              onAddRole={addRole}
              onChangeRole={setActiveRole}
              roles={userRoles}
              user={data.user}
            />
          ) : (
            <LoginPanel configured={data.configured} joinCode={joinCode} teamCode={inviteTeamCode} tournamentName={data.activeTournament?.name} />
          )}
        </section>
        {!inviteMode ? <PaymentConsole data={data} /> : null}
      </>
    );
  }

  function renderMatches() {
    return (
      <>
        <ScreenHeader eyebrow="Calendario" title="Partidos">
          Cada card abre el partido, la sede y los dos clubes. El resultado queda validado por cancha, veedor u organizador.
        </ScreenHeader>
        {selectedMatch ? (
          <>
            <section className="match-detail-console">
              <div className="match-detail-console__stage">
                <button onClick={() => selectedMatch.homeTeam && openTeam(selectedMatch.homeTeam.id)} type="button">
                  <TeamCrest team={selectedMatch.homeTeam} size="large" />
                  <strong>{selectedMatch.homeTeam?.name ?? "Local"}</strong>
                </button>
                <em>{selectedMatch.status === "final" ? `${selectedMatch.home_score} - ${selectedMatch.away_score}` : "VS"}</em>
                <button onClick={() => selectedMatch.awayTeam && openTeam(selectedMatch.awayTeam.id)} type="button">
                  <TeamCrest team={selectedMatch.awayTeam} size="large" />
                  <strong>{selectedMatch.awayTeam?.name ?? "Visitante"}</strong>
                </button>
              </div>
              <footer>
                <button onClick={() => selectedMatch.venue && openVenue(selectedMatch.venue.id)} type="button">
                  <MapPinned size={16} />
                  {selectedMatch.venue?.name ?? "Cancha a confirmar"}
                </button>
                <span>{formatDate(selectedMatch.scheduled_at)}</span>
              </footer>
            </section>
            <LiveMatchPanel canManageLive={canManageSelectedMatchLive} data={data} initialEvent={selectedMatchLiveEvent} match={selectedMatch} />
          </>
        ) : null}
        {data.matches.length ? (
          <div className="match-stack">{data.matches.map((match) => <MatchTile key={match.id} liveEvent={liveEventByMatch.get(match.id)} match={match} onOpen={() => openMatch(match)} />)}</div>
        ) : (
          <EmptyState icon={<CalendarDays />} title="Todavia no hay partidos">
            Cuando crees un torneo o tu equipo quede inscripto, Fulbito arma el calendario aca.
          </EmptyState>
        )}
        <section className="console-panel flow-compact">
          <article><Flag /><strong>Veedor</strong><span>Carga marcador</span></article>
          <article><MapPinned /><strong>Cancha</strong><span>Valida acta</span></article>
          <article><Trophy /><strong>Tabla</strong><span>Se recalcula</span></article>
        </section>
        <ArenaActions data={data} mode="result" />
      </>
    );
  }

  function renderLeague() {
    return (
      <>
        <ScreenHeader eyebrow="Camino a la copa" title="Liga">
          Grupos de cuatro, tabla automatica y llave eliminatoria generada segun cantidad de equipos.
        </ScreenHeader>
        {data.teams.length ? (
          <>
            <StandingCompact onTeamOpen={openTeam} teams={data.standings} />
            <GroupTables groups={groups} />
            <KnockoutPath rounds={knockoutRounds} teams={data.standings.length ? data.standings : data.teams} />
          </>
        ) : (
          <EmptyState icon={<Trophy />} title="Sin tabla todavia">
            La clasificacion aparece cuando haya equipos reales en tu torneo.
          </EmptyState>
        )}
      </>
    );
  }

  function renderSquad() {
    const slotDraft = {
      label: `${selectedSlot.label} ${selectedSlotIndex + 1}`,
      jersey: selectedSlotIndex + 1,
      position: positionLabels[selectedSlot.label] ?? selectedSlot.label
    };

    if (!selectedTeam) {
      return (
        <>
          <ScreenHeader compact eyebrow="Tu club" title="Crea tu equipo">
            {inviteMode
              ? `${data.activeTournament?.name} es ${rosterRule.label}: ${rosterRule.starters} titulares + ${rosterRule.substitutes} suplentes.`
              : "Todavia no tenes un equipo asociado a tu cuenta. Cargalo para activar plantel, escudo y formacion."}
          </ScreenHeader>
          <EmptyState icon={<Shield />} title="No hay equipo propio">
            Empeza por crear tu club. Despues vas a poder cargar jugadores desde la canchita.
          </EmptyState>
          <ArenaActions data={data} mode="squad" />
          {inviteMode ? <PaymentConsole data={data} planCodes={["team_pro"]} /> : null}
        </>
      );
    }

    return (
      <>
        <ScreenHeader compact eyebrow={isTeamManager ? "Panel del club" : "Club"} title={selectedTeam?.name ?? "Equipo"}>
          {inviteMode
            ? `${rosterRule.label}: hasta ${rosterRule.maxPlayers} jugadores (${rosterRule.starters} titulares + ${rosterRule.substitutes} suplentes).`
            : "Toca una posicion del campo para cargar jugador. Cambia de equipo desde el selector."}
        </ScreenHeader>
        {isTeamManager && data.activeTournament ? (
          <TeamPlayerInvitePanel players={selectedPlayers} rosterRule={rosterRule} team={selectedTeam} tournament={data.activeTournament} />
        ) : null}
        {data.user && (playerInviteMode || (selectedTeam.owner_id === data.user.id && !selectedPlayers.some((player) => player.profile_id === data.user?.id))) ? (
          <PlayerSelfJoinPanel data={data} players={selectedPlayers} rosterRule={rosterRule} team={selectedTeam} />
        ) : null}
        <FormationPanel
          isManager={isTeamManager}
          mode={formationMode}
          onModeChange={(mode) => {
            setFormationMode(mode);
            const nextPreset = formationPresets[mode][0];
            setFormationPresetId(nextPreset.id);
            setSelectedSlotIndex(Math.min(selectedSlotIndex, nextPreset.slots.length - 1));
          }}
          onPresetChange={(presetId) => {
            const nextPreset = getFormationPreset(formationMode, presetId);
            setFormationPresetId(presetId);
            setSelectedSlotIndex(Math.min(selectedSlotIndex, nextPreset.slots.length - 1));
          }}
          onOpenPlayer={setSelectedPlayerId}
          onSelectSlot={setSelectedSlotIndex}
          players={selectedPlayers}
          preset={currentFormation}
          presetId={formationPresetId}
          selectedSlotIndex={selectedSlotIndex}
          team={selectedTeam}
          lockedMode={inviteMode}
        />
        <section className={`slot-editor-console ${isTeamManager ? "" : "slot-editor-console--public"}`}>
          <div>
            <UserCheck size={18} />
            <strong>{slotDraft.label}</strong>
            <span>{isTeamManager ? "Alta rapida desde formacion" : "Ficha publica del puesto"}</span>
          </div>
          {isTeamManager ? (
            <ArenaActions data={data} mode="slot" selectedTeamId={selectedTeam?.id} slotDraft={slotDraft} />
          ) : (
            <p>Toca un jugador cargado para ver su card. Solo el dueno del club u organizador puede modificar el plantel.</p>
          )}
        </section>
        <section className="team-stack team-stack--selector" aria-label="Selector de equipos">
          {data.teams.map((team) => <TeamRow key={team.id} onOpen={() => setSelectedTeamId(team.id)} team={team} />)}
        </section>
        <TeamProfile isManager={isTeamManager} players={selectedPlayers} team={selectedTeam} />
        <section className="player-strip">
          {selectedPlayers.map((player) => (
            <button key={player.id} onClick={() => setSelectedPlayerId(player.id)} type="button">
              <PlayerAvatar player={player} />
              <div>
                <strong>{player.display_name}</strong>
                <span>#{player.jersey_number ?? "-"} / {player.position ?? "Posicion"} / {player.goals} goles</span>
              </div>
              <Activity size={16} />
            </button>
          ))}
        </section>
        {isTeamManager ? <ArenaActions data={data} mode="squad" selectedTeamId={selectedTeam?.id} /> : null}
        {inviteMode && isTeamManager ? <PaymentConsole data={data} planCodes={["team_pro"]} /> : null}
        {selectedPlayer ? <PlayerCardModal onClose={() => setSelectedPlayerId(null)} player={selectedPlayer} team={selectedTeam} /> : null}
      </>
    );
  }

  function renderVenues() {
    return (
      <>
        <ScreenHeader eyebrow="Alta de sede" title="Canchas">
          Marca tu ubicacion para ver canchas registradas en un radio de 50 km, o registra una sede con precio, contacto y foto.
        </ScreenHeader>
        <section className="venue-nearby-toolbar">
          <button onClick={requestVenueLocation} type="button">
            <LocateFixed size={16} />
            Usar mi ubicacion
          </button>
          <span>{venueLocationStatus}</span>
        </section>
        <ArenaActions data={data} mode="venue" />
        <section className="venues-marketplace">
          <header>
            <span>Sedes activas</span>
            <strong>{venueLocation ? "Radio 50 km" : "Mapa y precios cargados"}</strong>
          </header>
          <VenueMap onSelectVenue={openVenue} selectedVenueId={selectedVenue?.id} userLocation={venueLocation} venues={nearbyVenues} />
          {nearbyVenues.length ? (
            <>
              <VenueSpotlight venue={selectedVenue} />
              <section className="venue-stack">{nearbyVenues.map((venue) => <VenueRow key={venue.id} onOpen={() => setSelectedVenueId(venue.id)} venue={venue} />)}</section>
            </>
          ) : (
            <EmptyState icon={<MapPinned />} title="No hay canchas registradas cerca">
              Se muestran solo sedes reales cargadas por usuarios. Registra la tuya para que aparezca en el mapa.
            </EmptyState>
          )}
        </section>
        <section className="console-panel money-console">
          <MiniStat icon={<CircleDollarSign />} label="Ticket promedio" onClick={() => setActive("venues")} value={money(selectedVenue?.price_per_hour ?? 0)} />
          <MiniStat icon={<Crown />} label="Visibilidad Pro" onClick={() => setActive("league")} value="Sin comision" />
          <MiniStat icon={<Route />} label="Sedes cercanas" onClick={() => setActive("matches")} value={nearbyVenues.length} />
        </section>
      </>
    );
  }

  const screens: Record<TabId, () => ReactNode> = {
    home: renderHome,
    matches: renderMatches,
    league: renderLeague,
    squad: renderSquad,
    venues: renderVenues
  };

  return (
    <div className="game-app-shell">
      {showSplash ? <SplashScreen /> : null}
      <header className="game-topbar">
        <button className="game-brand" onClick={() => setActive("home")} type="button">
          <img alt="" src="/assets/icon.svg" />
          <span>
            <strong>Fulbito Arena</strong>
            <small>{data.source === "supabase" ? "Online" : "Demo"}</small>
          </span>
        </button>
        {data.user && myTeam ? (
          <button className="top-team-pill" onClick={() => openTeam(myTeam.id)} type="button">
            <TeamCrest team={myTeam} />
            <span>
              <small>Mi equipo</small>
              <strong>{myTeam.short_name}</strong>
            </span>
          </button>
        ) : null}
        <UserMenu
          activeTournament={data.activeTournament}
          configured={data.configured}
          onLogin={openLoginPanel}
          paymentRequests={data.paymentRequests}
          team={myTeam}
          user={data.user}
        />
      </header>

      <main className="game-screen" key={active}>
        {screens[active]()}
      </main>

      <nav className="game-tabbar" aria-label="Navegacion principal">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button className={active === item.id ? "is-active" : ""} key={item.id} onClick={() => setActive(item.id)} type="button">
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

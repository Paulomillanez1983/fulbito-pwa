"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BellRing,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Crown,
  ExternalLink,
  Flag,
  Gamepad2,
  Globe2,
  LoaderCircle,
  LogIn,
  LogOut,
  LocateFixed,
  MapPinned,
  Megaphone,
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
import { getKnockoutBracketSize } from "@/lib/tournament-structure";
import type { AdCampaign, AppRole, ArenaData, ArenaMatch, ArenaPlayer, ArenaTeam, ArenaTournament, ArenaTournamentDraw, ArenaTournamentTeam, ArenaVenue, FieldMode, FriendlyMatch, LiveStreamEvent, LiveStreamMode, PaymentRequest } from "@/lib/types";

type TabId = "home" | "matches" | "league" | "squad" | "venues";
type LeagueView = "classification" | "bracket";
type CupTier = "local" | "regional" | "provincial" | "world";
type StartJourneyId = "organizer" | "captain" | "player" | "venue";
type DrawReveal = {
  team: DrawResult["teams"][number];
  destination: string;
  index: number;
  total: number;
} | null;

const tabs: Array<{ id: TabId; label: string; icon: typeof Gamepad2 }> = [
  { id: "home", label: "Inicio", icon: Gamepad2 },
  { id: "matches", label: "Partidos", icon: CalendarDays },
  { id: "league", label: "Liga", icon: Trophy },
  { id: "squad", label: "Equipo", icon: Shield },
  { id: "venues", label: "Canchas", icon: MapPinned }
];

function isTabId(value: unknown): value is TabId {
  return typeof value === "string" && tabs.some((tab) => tab.id === value);
}

const playableRoles: AppRole[] = ["player", "captain", "venue_owner", "organizer", "referee"];

function uniqueRoles(roles: AppRole[]) {
  return Array.from(new Set(roles));
}

function sameRoles(left: AppRole[], right: AppRole[]) {
  if (left.length !== right.length) return false;
  return left.every((role, index) => role === right[index]);
}

const startJourneyCatalog: Array<{
  id: StartJourneyId;
  label: string;
  eyebrow: string;
  title: string;
  icon: typeof Trophy;
}> = [
  {
    id: "organizer",
    label: "Torneo",
    eyebrow: "Organizador",
    title: "Crear torneo e invitar equipos",
    icon: Trophy
  },
  {
    id: "captain",
    label: "Club",
    eyebrow: "Capitan / DT",
    title: "Crear o asociar tu equipo",
    icon: Shield
  },
  {
    id: "player",
    label: "Jugador",
    eyebrow: "Jugador",
    title: "Ver tu equipo y completar ficha",
    icon: UserCheck
  },
  {
    id: "venue",
    label: "Cancha",
    eyebrow: "Cancha",
    title: "Registra sede y contacto",
    icon: MapPinned
  }
];

const formatLabels = {
  league: "Liga todos contra todos",
  world_cup: "Mundial barrial",
  knockout: "Copa eliminatoria"
};

const cupTierCatalog: Array<{
  id: CupTier;
  label: string;
  eyebrow: string;
  trophyLabel: string;
  title: string;
  description: string;
}> = [
  {
    id: "local",
    label: "Copa del Hincha",
    eyebrow: "Cancha",
    trophyLabel: "Copa del Hincha",
    title: "Campeon de cancha",
    description: "El campeon local queda listo para recibir invitacion regional si acepta seguir compitiendo."
  },
  {
    id: "regional",
    label: "Regional 50 km",
    eyebrow: "Workgroup",
    trophyLabel: "Regional",
    title: "Campeones cercanos",
    description: "Reune campeones de canchas dentro de 50 km, con ida y vuelta para mover ambas sedes."
  },
  {
    id: "provincial",
    label: "Provincial",
    eyebrow: "Ascenso",
    trophyLabel: "Provincial",
    title: "Campeones regionales",
    description: "Los ganadores regionales pueden entrar a una copa provincial con historial permanente."
  },
  {
    id: "world",
    label: "Fulbito Cup",
    eyebrow: "Maximo logro",
    trophyLabel: "Fulbito Cup",
    title: "Copa Fulbito nacional",
    description: "La competencia mayor: campeones provinciales compiten por el titulo anual de Fulbito."
  }
];

const fulbitoLiveChannelUrl = "https://www.youtube.com/@FulbitoLIVE?sub_confirmation=1";
const youtubeFollowStorageKey = "fulbito-youtube-followed";

function useYouTubeFollowState() {
  const [followed, setFollowed] = useState(false);

  useEffect(() => {
    setFollowed(window.localStorage.getItem(youtubeFollowStorageKey) === "1");

    function syncFollowState() {
      setFollowed(window.localStorage.getItem(youtubeFollowStorageKey) === "1");
    }

    window.addEventListener("fulbito:youtube-followed", syncFollowState);
    return () => window.removeEventListener("fulbito:youtube-followed", syncFollowState);
  }, []);

  function markFollowed() {
    window.localStorage.setItem(youtubeFollowStorageKey, "1");
    setFollowed(true);
    window.dispatchEvent(new Event("fulbito:youtube-followed"));
  }

  return { followed, markFollowed };
}

function YouTubeLogo({ size = 22 }: { size?: number }) {
  return (
    <svg aria-hidden="true" className="youtube-logo" height={size} viewBox="0 0 28 20" width={Math.round(size * 1.4)}>
      <path d="M27.4 3.1A3.5 3.5 0 0 0 25 .6C22.8 0 14 0 14 0S5.2 0 3 .6A3.5 3.5 0 0 0 .6 3.1 36.5 36.5 0 0 0 0 10a36.5 36.5 0 0 0 .6 6.9A3.5 3.5 0 0 0 3 19.4c2.2.6 11 .6 11 .6s8.8 0 11-.6a3.5 3.5 0 0 0 2.4-2.5A36.5 36.5 0 0 0 28 10a36.5 36.5 0 0 0-.6-6.9Z" fill="#ff0033" />
      <path d="M11.2 14.3V5.7L18.5 10l-7.3 4.3Z" fill="#fff" />
    </svg>
  );
}

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function friendlyInviteCode(team: ArenaTeam) {
  return `${slugify(team.short_name || team.name)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function friendlyInviteHref(match: FriendlyMatch) {
  if (typeof window === "undefined") return "";
  const url = `${window.location.origin}/?friendly=${encodeURIComponent(match.invite_code)}`;
  const text = `Te invito a jugar un amistoso en Fulbito Arena. Entra a ${url}, elegi tu equipo y acepta el desafio.`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
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

function venueReservationWhatsappUrl(venue?: ArenaVenue | null) {
  const baseUrl = venueWhatsappUrl(venue?.phone);
  if (!baseUrl || !venue) return "";
  const text = `Hola, vi ${venue.name} en Fulbito Arena. Queria consultar disponibilidad, precio y horarios para jugar un amistoso.`;
  return `${baseUrl}?text=${encodeURIComponent(text)}`;
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

function combineDateTime(date: FormDataEntryValue | null, time: FormDataEntryValue | null) {
  const day = String(date || "");
  if (!day) return null;
  const clock = String(time || "20:00") || "20:00";
  return new Date(`${day}T${clock}:00`).toISOString();
}

function computeTeamRating(team: ArenaTeam, matches: ArenaMatch[], friendlies: FriendlyMatch[]) {
  let played = 0;
  let wins = 0;
  let draws = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  function addResult(homeId: string | null, awayId: string | null, homeScore: number | null, awayScore: number | null, weight: number) {
    if (homeScore === null || awayScore === null) return;
    const isHome = homeId === team.id;
    const isAway = awayId === team.id;
    if (!isHome && !isAway) return;
    played += weight;
    const own = isHome ? homeScore : awayScore;
    const rival = isHome ? awayScore : homeScore;
    goalsFor += own * weight;
    goalsAgainst += rival * weight;
    if (own > rival) wins += weight;
    if (own === rival) draws += weight;
  }

  matches.forEach((match) => {
    if (match.status !== "final") return;
    addResult(match.home_team_id, match.away_team_id, match.home_score, match.away_score, 1);
  });
  friendlies.forEach((match) => {
    if (match.status !== "final") return;
    addResult(match.home_team_id, match.away_team_id, match.home_score, match.away_score, 0.65);
  });

  const points = wins * 3 + draws;
  const form = played ? points / (played * 3) : 0;
  const goalBoost = Math.max(-10, Math.min(16, (goalsFor - goalsAgainst) * 1.5));
  const rating = Math.max(42, Math.min(94, Math.round(48 + form * 34 + Math.min(played, 10) * 1.4 + goalBoost)));
  const stars = Math.max(1, Math.min(5, Math.round(rating / 20)));
  const tier = rating >= 82 ? "oro" : rating >= 68 ? "plata" : "bronce";
  return { rating, stars, tier, played: Math.round(played), wins: Math.round(wins), goalsFor: Math.round(goalsFor), goalsAgainst: Math.round(goalsAgainst) };
}

function playerLevel(player: ArenaPlayer) {
  const rating = Math.max(42, Math.min(91, 48 + player.goals * 4 - (player.red_cards ?? 0) * 6 - (player.yellow_cards ?? 0)));
  const tier = rating >= 82 ? "oro" : rating >= 68 ? "plata" : "bronce";
  return { rating, tier };
}

function groupTeams(teams: ArenaTeam[], size = 4) {
  return teams.reduce<ArenaTeam[][]>((groups, team, index) => {
    const groupIndex = Math.floor(index / size);
    groups[groupIndex] = groups[groupIndex] ?? [];
    groups[groupIndex].push(team);
    return groups;
  }, []);
}

function buildClassificationGroups({
  tournament,
  tournamentTeams,
  standings,
  teams
}: {
  tournament: ArenaTournament | null;
  tournamentTeams: ArenaTournamentTeam[];
  standings: ArenaTeam[];
  teams: ArenaTeam[];
}) {
  const rankedTeams = standings.length ? standings : teams;
  if (!tournament) return groupTeams(rankedTeams);
  const rows = tournamentTeams.filter((row) => row.tournament_id === tournament.id);
  if (tournament.format === "league") return [rankedTeams];

  const groupCodes = Array.from(new Set(rows.map((row) => row.group_code).filter(Boolean) as string[])).sort();
  if (!groupCodes.length) return groupTeams(rankedTeams);

  const rankedById = new Map(rankedTeams.map((team) => [team.id, team]));
  const fallbackById = new Map(teams.map((team) => [team.id, team]));
  return groupCodes.map((code) => {
    const groupRows = rows
      .filter((row) => row.group_code === code)
      .sort((left, right) => (left.seed ?? 999) - (right.seed ?? 999));
    return groupRows
      .map((row) => rankedById.get(row.team_id) ?? fallbackById.get(row.team_id))
      .filter((team): team is ArenaTeam => Boolean(team))
      .sort((left, right) =>
        (right.points ?? 0) - (left.points ?? 0) ||
        (right.goalDiff ?? 0) - (left.goalDiff ?? 0) ||
        (right.goalsFor ?? 0) - (left.goalsFor ?? 0) ||
        left.name.localeCompare(right.name)
      );
  });
}

function buildKnockoutRounds(teams: ArenaTeam[]) {
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(2, teams.length))));
  return buildKnockoutRoundsBySize(bracketSize);
}

function buildKnockoutRoundsBySize(size: number) {
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(2, size))));
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

function normalizeKnockoutRound(value: string) {
  const text = value.toLowerCase();
  if (text.includes("16") || text.includes("dieciseis")) return "16avos";
  if (text.includes("octav")) return "Octavos";
  if (text.includes("cuart")) return "Cuartos";
  if (text.includes("semi")) return "Semis";
  if (text.includes("final")) return "Final";
  return "";
}

function matchKnockoutRound(match: ArenaMatch) {
  if (match.phase === "groups" || match.group_code) return "";
  return normalizeKnockoutRound(`${match.phase} ${match.round_name}`);
}

function getMatchWinnerId(match: ArenaMatch) {
  if (match.status !== "final" || match.home_score === null || match.away_score === null) return null;
  if (match.home_score === match.away_score) return null;
  return match.home_score > match.away_score ? match.home_team_id : match.away_team_id;
}

function getRoundParticipants(roundLabel: string, matches: ArenaMatch[], teamsById: Map<string, ArenaTeam>) {
  const roundMatches = matches.filter((match) => matchKnockoutRound(match) === roundLabel);
  if (roundMatches.length) {
    return roundMatches.flatMap((match) => [match.home_team_id, match.away_team_id])
      .filter((teamId): teamId is string => Boolean(teamId))
      .map((teamId) => teamsById.get(teamId))
      .filter((team): team is ArenaTeam => Boolean(team));
  }

  const previousRoundByRound: Record<string, string> = {
    Final: "Semis",
    Semis: "Cuartos",
    Cuartos: "Octavos",
    Octavos: "16avos"
  };
  const previousRound = previousRoundByRound[roundLabel];
  if (!previousRound) return [];
  const previousMatches = matches.filter((match) => matchKnockoutRound(match) === previousRound);
  if (!previousMatches.length) return [];
  const winners = previousMatches.map(getMatchWinnerId);
  if (winners.some((teamId) => !teamId)) return [];
  return winners
    .filter((teamId): teamId is string => Boolean(teamId))
    .map((teamId) => teamsById.get(teamId))
    .filter((team): team is ArenaTeam => Boolean(team));
}

function getTournamentChampion(matches: ArenaMatch[], teamsById: Map<string, ArenaTeam>) {
  const finalMatch = matches.find((match) => matchKnockoutRound(match) === "Final" && getMatchWinnerId(match));
  const winnerId = finalMatch ? getMatchWinnerId(finalMatch) : null;
  return winnerId ? teamsById.get(winnerId) ?? null : null;
}

function buildSimulatedDrawTeams(teams: ArenaTeam[], maxTeams: number) {
  const plannedCount = Math.max(4, maxTeams, teams.length);
  const nextTeams = [...teams];
  for (let index = nextTeams.length; index < plannedCount; index += 1) {
    const teamNumber = index + 1;
    nextTeams.push({
      id: `demo-team-${teamNumber}`,
      name: `Equipo demo ${String(teamNumber).padStart(2, "0")}`,
      slug: `equipo-demo-${teamNumber}`,
      short_name: `D${String(teamNumber).padStart(2, "0")}`,
      badge_url: null,
      primary_color: index % 2 === 0 ? "#34c9ff" : "#f1c75b",
      neighborhood: "Demo",
      home_venue_id: null,
      points: 0,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0
    });
  }
  return nextTeams;
}

function findDrawDestination(draw: DrawResult, team: DrawResult["teams"][number]) {
  const group = draw.groups.find((item) => item.teams.some((groupTeam) => groupTeam.id === team.id));
  if (group) return `Grupo ${group.code}`;
  const seedIndex = draw.teams.findIndex((drawTeam) => drawTeam.id === team.id);
  return seedIndex >= 0 ? `Llave ${seedIndex + 1}` : "Bombo principal";
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
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoProgress, setDemoProgress] = useState(0);
  const [currentBall, setCurrentBall] = useState("");
  const [currentReveal, setCurrentReveal] = useState<DrawReveal>(null);
  const [drawEvents, setDrawEvents] = useState<string[]>([]);
  const [revealedTeamIds, setRevealedTeamIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [youtubeWatchUrl, setYoutubeWatchUrl] = useState("");
  const demoTimersRef = useRef<number[]>([]);
  const { followed: youtubeFollowed, markFollowed: markYouTubeFollowed } = useYouTubeFollowState();

  function clearDemoTimers() {
    demoTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    demoTimersRef.current = [];
  }

  useEffect(() => {
    return () => clearDemoTimers();
  }, []);

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
  const groupLabels = Array.from({ length: Math.min(26, Math.max(1, Math.ceil(maxTeams / 4))) }, (_, index) => String.fromCharCode(65 + index));
  const drawDestinationLabel = activeDrawTournament.format === "knockout" ? "posicion de llave" : "grupo";
  const drawStageLabel = activeDrawTournament.format === "knockout" ? "llave" : "grupos";
  const drawBoardPlaceholders = activeDrawTournament.format === "knockout"
    ? Array.from({ length: Math.min(8, Math.max(2, maxTeams / 2)) }, (_, index) => `Llave ${index + 1}`)
    : groupLabels.map((group) => `Grupo ${group}`);
  const savedDraw = officialDraw ?? data.tournamentDraws.find((draw) => draw.tournament_id === activeDrawTournament.id && draw.mode === "official") ?? null;
  const canManage = Boolean(data.user && data.user.id === activeDrawTournament.organizer_id);
  const revealedTeamSet = new Set(revealedTeamIds);
  const boardGroups = savedDraw?.groups ?? (demoDraw ? demoDraw.groups.map((group) => ({
    ...group,
    teams: demoRunning ? group.teams.filter((team) => revealedTeamSet.has(team.id)) : group.teams
  })) : []);
  const demoSecondsLeft = Math.max(0, 120 - Math.round(demoProgress * 120 / 100));
  const broadcastBalls = (demoDraw?.teams.length ? demoDraw.teams : enrolledTeams.map((team) => ({
    id: team.id,
    name: team.name,
    shortName: team.short_name,
    badgeUrl: team.badge_url
  }))).slice(0, 10);

  function runDemoDraw() {
    clearDemoTimers();
    const seed = `demo-${activeDrawTournament.id}-${Date.now()}`;
    const simulatedTeams = buildSimulatedDrawTeams(enrolledTeams, maxTeams);
    const result = buildTournamentDraw({
      teams: simulatedTeams,
      format: activeDrawTournament.format,
      maxTeams,
      seed,
      scope: "groups"
    });
    setDemoDraw(result);
    setDemoRunning(true);
    setDemoProgress(0);
    setCurrentBall("");
    setCurrentReveal(null);
    setDrawEvents([]);
    setRevealedTeamIds([]);
    setStage(`Camara uno / ${drawStageLabel} preparado`);
    setMessage(`Show demo de 2 minutos: completa cupos con equipos demo, simula el sorteo de ${drawStageLabel} y no guarda resultado.`);

    const durationMs = 120000;
    const progressInterval = window.setInterval(() => {
      setDemoProgress((current) => {
        const next = Math.min(100, current + 100 / 120);
        if (next >= 100) window.clearInterval(progressInterval);
        return next;
      });
    }, 1000);
    demoTimersRef.current.push(progressInterval);

    result.teams.forEach((team, index) => {
      const delay = Math.round(((index + 1) / (result.teams.length + 1)) * durationMs);
      const timer = window.setTimeout(() => {
        const destination = findDrawDestination(result, team);
        setCurrentBall(team.shortName);
        setCurrentReveal({ team, destination, index: index + 1, total: result.teams.length });
        setRevealedTeamIds((current) => current.includes(team.id) ? current : [...current, team.id]);
        setDrawEvents((current) => [`${team.shortName} -> ${destination}`, ...current].slice(0, 6));
        setStage(index === result.teams.length - 1 ? `Ultima extraccion / ${drawStageLabel} completo` : `Extraccion ${index + 1} de ${result.teams.length}`);
      }, delay);
      demoTimersRef.current.push(timer);
    });

    const finishTimer = window.setTimeout(() => {
      setDemoProgress(100);
      setDemoRunning(false);
      setCurrentBall("");
      setCurrentReveal(null);
      setRevealedTeamIds(result.teams.map((team) => team.id));
      setStage(`${drawStageLabel[0].toUpperCase()}${drawStageLabel.slice(1)} demo generado`);
    }, durationMs);
    demoTimersRef.current.push(finishTimer);
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
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo iniciar el sorteo oficial.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`draw-live-teaser ${demoRunning ? "is-running" : ""}`}>
      <div className="draw-broadcast">
        <div className="draw-broadcast__mast">
          <span>Fulbito Live Draw</span>
          <strong>{activeDrawTournament.name}</strong>
          <small>{savedDraw ? "Sorteo oficial auditado" : demoRunning ? "En vivo simulado" : isReady ? "Cupo completo para sorteo oficial" : "Oficial al completar cupo"}</small>
        </div>
        <div className="draw-broadcast__stage">
          <span className="draw-broadcast__beam draw-broadcast__beam--left" />
          <span className="draw-broadcast__beam draw-broadcast__beam--right" />
          <div className="draw-live-teaser__pot" aria-hidden="true">
            <span className="draw-live-teaser__gate" />
            <span className="draw-live-teaser__glass" />
            {(broadcastBalls.length ? broadcastBalls : groupLabels.map((group) => ({ id: group, name: `Grupo ${group}`, shortName: group, badgeUrl: null }))).map((ball, index) => (
              <span className="draw-live-teaser__ball" key={`${ball.id}-${index}`} style={{ "--angle": `${index * 47}deg`, "--delay": `${index * 90}ms`, "--depth": `${(index % 4) * 5}px` } as CSSProperties}>{ball.shortName.slice(0, 3)}</span>
            ))}
            {currentBall ? <span className="draw-live-teaser__exit-ball">{currentBall}</span> : null}
          </div>
          <div className="draw-reveal-card">
            <span>{currentReveal ? `Extraccion ${currentReveal.index}/${currentReveal.total}` : "Proxima bolilla"}</span>
            <div className="draw-reveal-card__crest">
              {currentReveal?.team.badgeUrl ? <img alt="" src={currentReveal.team.badgeUrl} /> : <b>{currentReveal?.team.shortName ?? "FA"}</b>}
            </div>
            <strong>{currentReveal?.team.name ?? "Equipo por revelar"}</strong>
            <p>{currentReveal ? `Destino: ${currentReveal.destination}` : `Cuando empiece el show, cada bolilla revela la ${drawDestinationLabel} del equipo.`}</p>
          </div>
          <div className="draw-broadcast__lower-third">
            <span>{stage || "Escenario listo"}</span>
            <b>{demoRunning ? `Tiempo restante ${String(Math.floor(demoSecondsLeft / 60)).padStart(2, "0")}:${String(demoSecondsLeft % 60).padStart(2, "0")}` : `${teamCount}/${maxTeams} equipos reales`}</b>
          </div>
        </div>
      </div>
      <div className="draw-show">
        <div className="draw-show__progress">
          <span style={{ width: `${demoProgress}%` }} />
        </div>
        <div className="draw-show__meta">
          <b>{demoRunning ? `Demo en curso ${String(Math.floor(demoSecondsLeft / 60)).padStart(2, "0")}:${String(demoSecondsLeft % 60).padStart(2, "0")}` : savedDraw ? "Resultado oficial guardado" : "Listo para probar el show"}</b>
          <small>{currentBall ? `Sale bolilla ${currentBall}` : `Las bolillas van cayendo en ${drawStageLabel}.`}</small>
        </div>
        <div className="draw-show__events">
          {drawEvents.length ? drawEvents.map((event) => <span key={event}>{event}</span>) : <span>Esperando primera extraccion</span>}
        </div>
      </div>
      <div className="draw-live-board">
        {boardGroups.length ? boardGroups.slice(0, 8).map((group) => (
          <article key={group.code}>
            <strong>Grupo {group.code}</strong>
            <span>{group.teams.map((team) => team.shortName).join(" / ") || "Pendiente"}</span>
          </article>
        )) : (
          drawBoardPlaceholders.map((label) => (
            <article key={label}>
              <strong>{label}</strong>
              <span>Esperando sorteo</span>
            </article>
          ))
        )}
      </div>
      <div className="draw-live-teaser__actions">
        <button onClick={onOpenTournaments} type="button">Ver equipos</button>
        <button disabled={demoRunning} onClick={runDemoDraw} type="button">{demoRunning ? "Demo corriendo" : "Demo 2 minutos"}</button>
        {!youtubeFollowed ? (
          <a href={fulbitoLiveChannelUrl} onClick={markYouTubeFollowed} rel="noreferrer" target="_blank">
            <YouTubeLogo size={18} />
            Seguir Fulbito TV
          </a>
        ) : null}
        <button onClick={onOpenMatches} type="button">
          <YouTubeLogo size={18} />
          Ver Fulbito Live
        </button>
      </div>
      {canManage && !savedDraw ? (
        <div className="draw-official-console">
          <input
            onChange={(event) => setYoutubeWatchUrl(event.target.value)}
            placeholder="Pega el vivo de YouTube del sorteo oficial si ya lo creaste"
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
      {message ? <p className="draw-live-teaser__message">{message}</p> : null}
    </section>
  );
}

function YouTubeFollowStrip() {
  const { followed, markFollowed } = useYouTubeFollowState();
  return (
    <a className="youtube-follow-strip" href={fulbitoLiveChannelUrl} onClick={markFollowed} rel="noreferrer" target="_blank">
      <span className="youtube-follow-strip__icon" aria-hidden="true">
        <YouTubeLogo size={26} />
      </span>
      <div className="youtube-follow-strip__copy">
        <strong>Fulbito TV en YouTube</strong>
        <span>Sorteos, vivos, finales y repeticiones quedan en el canal oficial.</span>
      </div>
      <span className="youtube-follow-strip__cta">
        <YouTubeLogo size={16} />
        {followed ? "Canal abierto" : "Abrir YouTube"}
        <ExternalLink size={15} />
      </span>
    </a>
  );
}

function AdBoardItem({ campaign }: { campaign: AdCampaign }) {
  const isYouTube = /youtube|youtu\.be/i.test(`${campaign.target_url ?? ""} ${campaign.advertiser_name} ${campaign.headline}`);
  const targetKind = sponsorTargetKind(campaign.target_url);
  const targetLabel = sponsorTargetLabel(targetKind);
  const ledText = `${campaign.headline} ${campaign.body ?? ""}`.trim();
  const shouldScroll = ledText.length > 24;
  const renderMessage = (suffix: string) => (
    <span className="arena-ad-board__message" key={`${campaign.id}-${suffix}`}>
      <b>{campaign.headline}</b>
      {campaign.body ? <small>{campaign.body}</small> : null}
    </span>
  );
  return (
    <span className={`arena-ad-board arena-ad-board--${targetKind} ${shouldScroll ? "is-marquee" : ""}`}>
      <span className="arena-ad-board__edge" />
      <span className="arena-ad-board__signal" />
      {campaign.logo_url || isYouTube ? (
        <span className="arena-ad-board__icon">
          {campaign.logo_url ? <img alt="" src={campaign.logo_url} /> : <YouTubeLogo size={15} />}
        </span>
      ) : null}
      <span className="arena-ad-board__tag">{targetLabel}</span>
      <span className="arena-ad-board__viewport">
        <span className="arena-ad-board__track">
          {renderMessage("primary")}
          {shouldScroll ? (
            <>
              <i aria-hidden="true">/</i>
              {renderMessage("loop")}
            </>
          ) : null}
        </span>
      </span>
    </span>
  );
}

function ArenaAdBoards({ campaigns }: { campaigns: AdCampaign[] }) {
  const fallbackCampaigns = useMemo<AdCampaign[]>(() => [
    {
      id: "fallback-fulbito-tv",
      created_by: null,
      approved_by: null,
      advertiser_name: "Fulbito TV",
      headline: "Segui Fulbito TV",
      body: "Sorteos en vivo",
      logo_url: null,
      target_url: fulbitoLiveChannelUrl,
      placement: "arena_led",
      scope: "national",
      latitude: null,
      longitude: null,
      radius_km: 50,
      status: "active",
      starts_at: new Date().toISOString(),
      ends_at: null,
      sort_order: 1,
      splash_enabled: true,
      splash_cta_label: "Abrir canal",
      splash_close_after_seconds: 5,
      splash_frequency_hours: 12,
      splash_creative_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: "fallback-fulbito-live",
      created_by: null,
      approved_by: null,
      advertiser_name: "Fulbito Live",
      headline: "Fulbito Live",
      body: "Vivos y finales",
      logo_url: null,
      target_url: fulbitoLiveChannelUrl,
      placement: "arena_led",
      scope: "national",
      latitude: null,
      longitude: null,
      radius_km: 50,
      status: "active",
      starts_at: new Date().toISOString(),
      ends_at: null,
      sort_order: 2,
      splash_enabled: false,
      splash_cta_label: "Ver sponsor",
      splash_close_after_seconds: 5,
      splash_frequency_hours: 12,
      splash_creative_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ], []);
  const ledCampaigns = useMemo(() => campaigns.filter((campaign) => campaign.placement !== "sponsor_splash"), [campaigns]);
  const visibleCampaigns = useMemo(() => ledCampaigns.length ? ledCampaigns : fallbackCampaigns, [fallbackCampaigns, ledCampaigns]);
  const repeatedCampaigns = useMemo(() => [...visibleCampaigns, ...visibleCampaigns, ...visibleCampaigns, ...visibleCampaigns], [visibleCampaigns]);
  const impressionKey = useMemo(() => visibleCampaigns
    .filter((campaign) => !campaign.id.startsWith("fallback-"))
    .map((campaign) => campaign.id)
    .sort()
    .join("|"), [visibleCampaigns]);

  useEffect(() => {
    const campaignsToLog = visibleCampaigns.filter((campaign) => !campaign.id.startsWith("fallback-"));
    if (!campaignsToLog.length) return;
    const sessionKey = "fulbito:arena-led-impressions";
    const loggedIds = new Set((window.sessionStorage.getItem(sessionKey) ?? "").split("|").filter(Boolean));
    const pending = campaignsToLog.filter((campaign) => !loggedIds.has(campaign.id));
    if (!pending.length) return;

    const anonId = getSponsorDeviceId();
    const supabase = createSupabaseBrowserClient();
    const rows = pending.map((campaign) => ({
      campaign_id: campaign.id,
      anon_id: anonId,
      event_type: "impression",
      placement: "arena_led",
      source_path: `${window.location.pathname}${window.location.search}`,
      metadata: {
        advertiserName: campaign.advertiser_name,
        headline: campaign.headline,
        board: "stadium_led"
      }
    }));
    pending.forEach((campaign) => loggedIds.add(campaign.id));
    window.sessionStorage.setItem(sessionKey, Array.from(loggedIds).join("|"));
    void (async () => {
      try {
        await supabase.from("ad_campaign_events").insert(rows);
      } catch {
        // LED metrics must never block navigation or rendering.
      }
    })();
  }, [impressionKey, visibleCampaigns]);

  return (
    <div aria-hidden="true" className="arena-ad-boards">
      <div className="arena-ad-boards__truss" />
      <div className="arena-ad-boards__rail" />
      <div className="arena-ad-boards__glow" />
      <div className="arena-ad-boards__lane arena-ad-boards__lane--front">
        {repeatedCampaigns.map((campaign, index) => <AdBoardItem campaign={campaign} key={`${campaign.id}-${index}`} />)}
      </div>
      <div className="arena-ad-boards__glass" />
      <div className="arena-ad-boards__reflection" />
    </div>
  );
}

function getSponsorDeviceId() {
  const key = "fulbito:sponsor-device-id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = `device-${crypto.randomUUID()}`;
  window.localStorage.setItem(key, next);
  return next;
}

function canShowSponsorSplash(campaign: AdCampaign, userKey: string) {
  const frequencyHours = campaign.splash_frequency_hours ?? 12;
  if (frequencyHours <= 0) return true;
  const raw = window.localStorage.getItem(`fulbito:sponsor-splash:${userKey}:${campaign.id}`);
  if (!raw) return true;
  const lastShownAt = Number(raw);
  if (!Number.isFinite(lastShownAt)) return true;
  return Date.now() - lastShownAt >= frequencyHours * 60 * 60 * 1000;
}

function markSponsorSplashShown(campaign: AdCampaign, userKey: string) {
  window.localStorage.setItem(`fulbito:sponsor-splash:${userKey}:${campaign.id}`, String(Date.now()));
}

function shuffleSponsorIds(ids: string[], avoidFirstId?: string | null) {
  const queue = [...ids];
  for (let index = queue.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [queue[index], queue[randomIndex]] = [queue[randomIndex], queue[index]];
  }
  if (queue.length > 1 && avoidFirstId && queue[0] === avoidFirstId) {
    const swapIndex = queue.findIndex((id) => id !== avoidFirstId);
    if (swapIndex > 0) [queue[0], queue[swapIndex]] = [queue[swapIndex], queue[0]];
  }
  return queue;
}

function pickSponsorSplashCampaign(campaigns: AdCampaign[], userKey: string) {
  if (!campaigns.length) return null;
  const eligible = campaigns.filter((item) => canShowSponsorSplash(item, userKey));
  const candidates = eligible.length ? eligible : campaigns;
  const ids = candidates.map((item) => item.id).sort();
  const poolKey = ids.join("|");
  const storageKey = `fulbito:sponsor-splash-rotation:${userKey}`;
  const lastPickedKey = `fulbito:sponsor-splash-last-picked:${userKey}`;
  const lastPickedId = window.sessionStorage.getItem(lastPickedKey);
  let queue: string[] = [];

  try {
    const raw = window.sessionStorage.getItem(storageKey);
    const stored = raw ? JSON.parse(raw) as { poolKey?: string; queue?: string[] } : null;
    if (stored?.poolKey === poolKey && Array.isArray(stored.queue)) {
      const validIds = new Set(ids);
      queue = stored.queue.filter((id) => validIds.has(id));
    }
  } catch {
    queue = [];
  }

  if (!queue.length) queue = shuffleSponsorIds(ids, lastPickedId);
  const pickedId = queue.shift() ?? ids[0];
  const picked = candidates.find((item) => item.id === pickedId) ?? candidates[0] ?? null;
  if (picked) {
    window.sessionStorage.setItem(lastPickedKey, picked.id);
    window.sessionStorage.setItem(storageKey, JSON.stringify({ poolKey, queue }));
  }
  return picked;
}

function sponsorTargetKind(url?: string | null) {
  const value = (url ?? "").toLowerCase();
  if (value.includes("youtube.com") || value.includes("youtu.be")) return "youtube";
  if (value.includes("instagram.com") || value.includes("instagr.am")) return "instagram";
  if (value.includes("facebook.com") || value.includes("fb.com")) return "facebook";
  if (value.includes("tiktok.com")) return "tiktok";
  return "web";
}

function sponsorTargetLabel(kind: ReturnType<typeof sponsorTargetKind>) {
  if (kind === "youtube") return "YouTube";
  if (kind === "instagram") return "Instagram";
  if (kind === "facebook") return "Facebook";
  if (kind === "tiktok") return "TikTok";
  return "Sponsor";
}

function sponsorDefaultCta(url?: string | null) {
  const kind = sponsorTargetKind(url);
  if (kind === "youtube") return "Abrir canal";
  if (kind === "instagram") return "Ver Instagram";
  if (kind === "facebook") return "Ver Facebook";
  if (kind === "tiktok") return "Ver TikTok";
  return "Abrir web";
}

function SponsorTargetIcon({ url }: { url?: string | null }) {
  const kind = sponsorTargetKind(url);
  if (kind === "youtube") return <YouTubeLogo size={18} />;
  if (kind === "instagram") return <span aria-hidden="true" className="sponsor-social-icon sponsor-social-icon--instagram" />;
  if (kind === "facebook") return <span aria-hidden="true" className="sponsor-social-icon sponsor-social-icon--facebook">f</span>;
  if (kind === "tiktok") return <span aria-hidden="true" className="sponsor-social-icon sponsor-social-icon--tiktok">T</span>;
  return <Globe2 aria-hidden="true" size={18} />;
}

function playSponsorWhistle() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audio = new AudioContextClass();
    const now = audio.currentTime;
    const master = audio.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.09, now + 0.03);
    master.gain.exponentialRampToValueAtTime(0.001, now + 0.78);
    master.connect(audio.destination);

    const main = audio.createOscillator();
    main.type = "sine";
    main.frequency.setValueAtTime(1920, now);
    main.frequency.linearRampToValueAtTime(2380, now + 0.16);
    main.frequency.linearRampToValueAtTime(2100, now + 0.38);
    main.frequency.linearRampToValueAtTime(2520, now + 0.56);
    main.connect(master);
    main.start(now);
    main.stop(now + 0.78);

    const overtone = audio.createOscillator();
    overtone.type = "triangle";
    overtone.frequency.setValueAtTime(2820, now + 0.02);
    overtone.frequency.linearRampToValueAtTime(3180, now + 0.18);
    overtone.frequency.linearRampToValueAtTime(2740, now + 0.52);
    overtone.connect(master);
    overtone.start(now + 0.02);
    overtone.stop(now + 0.64);

    window.setTimeout(() => void audio.close(), 1100);
  } catch {
    // Browser audio permissions may block automatic sponsor sounds before user interaction.
  }
}

function SponsorSplashOverlay({
  campaigns,
  enabled,
  triggerKey,
  userId
}: {
  campaigns: AdCampaign[];
  enabled: boolean;
  triggerKey: number;
  userId?: string | null;
}) {
  const [campaign, setCampaign] = useState<AdCampaign | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const loggedImpressionRef = useRef("");
  const shownTriggerRef = useRef<number | null>(null);

  const logEvent = useCallback(async (activeCampaign: AdCampaign, eventType: "impression" | "click" | "dismiss") => {
    try {
      const anonId = getSponsorDeviceId();
      const supabase = createSupabaseBrowserClient();
      await supabase.from("ad_campaign_events").insert({
        campaign_id: activeCampaign.id,
        anon_id: anonId,
        event_type: eventType,
        placement: "sponsor_splash",
        source_path: `${window.location.pathname}${window.location.search}`,
        metadata: {
          advertiserName: activeCampaign.advertiser_name,
          userLoggedIn: Boolean(userId)
        }
      });
    } catch {
      // Ad metrics must never block the product flow.
    }
  }, [userId]);

  useEffect(() => {
    if (!enabled || campaign) return;
    if (shownTriggerRef.current === triggerKey) return;
    const splashCampaigns = campaigns.filter((item) => item.splash_enabled || ["sponsor_splash", "arena_led", "both"].includes(item.placement));
    if (!splashCampaigns.length) return;
    const deviceId = getSponsorDeviceId();
    const userKey = userId ?? deviceId;
    const eligible = pickSponsorSplashCampaign(splashCampaigns, userKey);
    if (!eligible) return;
    shownTriggerRef.current = triggerKey;
    markSponsorSplashShown(eligible, userKey);
    setCampaign(eligible);
    setSecondsLeft(Math.max(0, eligible.splash_close_after_seconds ?? 5));
    window.setTimeout(playSponsorWhistle, 120);
  }, [campaign, campaigns, enabled, triggerKey, userId]);

  useEffect(() => {
    if (!campaign || loggedImpressionRef.current === campaign.id) return;
    loggedImpressionRef.current = campaign.id;
    void logEvent(campaign, "impression");
  }, [campaign, logEvent]);

  useEffect(() => {
    if (!campaign || secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [campaign, secondsLeft]);

  if (!campaign) return null;

  const logoUrl = campaign.splash_creative_url || campaign.logo_url;
  const closeAllowed = secondsLeft <= 0;

  function visitSponsor() {
    if (!campaign) return;
    void logEvent(campaign, "click");
    if (campaign.target_url) window.open(campaign.target_url, "_blank", "noopener,noreferrer");
  }

  function closeSponsor() {
    if (!campaign || !closeAllowed) return;
    void logEvent(campaign, "dismiss");
    setCampaign(null);
  }

  return (
    <section className="sponsor-splash" aria-label={`Auspicia Fulbito Arena: ${campaign.advertiser_name}`} aria-modal="true" role="dialog">
      <button className="sponsor-splash__hitbox" onClick={visitSponsor} type="button" aria-label={`Abrir sponsor ${campaign.advertiser_name}`} />
      <span className="sponsor-splash__beam sponsor-splash__beam--left" aria-hidden="true" />
      <span className="sponsor-splash__beam sponsor-splash__beam--right" aria-hidden="true" />
      <article className="sponsor-splash__card">
        <div className="sponsor-splash__match-ribbon">
          <span className="sponsor-splash__eyebrow">Auspicia Fulbito Arena</span>
          <span>Publicidad oficial</span>
        </div>
        <div className="sponsor-splash__stage" aria-hidden="true">
          <img alt="" className="sponsor-splash__photo" src="/assets/sponsor-yellow-card-hand.webp" />
          <span className="sponsor-splash__card-aura" />
          <div className="sponsor-splash__brand">
            <span className="sponsor-splash__card-label">Sponsor</span>
            {logoUrl ? <img alt="" src={logoUrl} /> : <Megaphone size={46} />}
            <span className="sponsor-splash__card-footer">Fulbito Arena</span>
          </div>
        </div>
        <div className="sponsor-splash__copy">
          <span className="sponsor-splash__presented">Presenta esta jugada</span>
          <strong>{campaign.advertiser_name}</strong>
          <h2>{campaign.headline}</h2>
          {campaign.body ? <p>{campaign.body}</p> : null}
        </div>
        <button className="sponsor-splash__cta" onClick={visitSponsor} type="button">
          <SponsorTargetIcon url={campaign.target_url} />
          <span>{campaign.splash_cta_label || sponsorDefaultCta(campaign.target_url)}</span>
          <ExternalLink size={17} />
        </button>
        <small>{closeAllowed ? "Ya podes cerrar este sponsor." : `Podes cerrarlo en ${secondsLeft}s`}</small>
      </article>
      <button className="sponsor-splash__close" disabled={!closeAllowed} onClick={closeSponsor} type="button" aria-label="Cerrar publicidad">
        {closeAllowed ? <X size={22} /> : secondsLeft}
      </button>
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

function isFreshNotification(request: PaymentRequest, maxDays = 30) {
  const createdAt = new Date(request.created_at).getTime();
  if (!Number.isFinite(createdAt)) return true;
  return Date.now() - createdAt <= maxDays * 24 * 60 * 60 * 1000;
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
  const freshRequests = useMemo(() => menuRequests.filter((request) => isFreshNotification(request)), [menuRequests]);
  const approvedCount = freshRequests.filter((request) => request.status === "approved").length;
  const pendingCount = freshRequests.filter((request) => request.status === "pending_review").length;
  const latestRequests = freshRequests;
  const approvedTournamentRequests = freshRequests.filter((request) => request.status === "approved" && request.target_type === "tournament");

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
        .limit(40);
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

function TeamCarousel({
  teams,
  selectedTeamId,
  onSelect
}: {
  teams: ArenaTeam[];
  selectedTeamId?: string;
  onSelect: (teamId: string) => void;
}) {
  if (!teams.length) return null;
  return (
    <section className="team-carousel" aria-label="Selector de equipos">
      <header>
        <span>Equipos</span>
        <strong>{teams.length} clubes</strong>
      </header>
      <div className="team-carousel__track">
        {teams.map((team) => {
          const selected = team.id === selectedTeamId;
          return (
            <button
              aria-pressed={selected}
              className={`team-switch-card ${selected ? "is-active" : ""}`}
              key={team.id}
              onClick={() => onSelect(team.id)}
              type="button"
            >
              <TeamCrest team={team} size="large" />
              <span>{selected ? "Seleccionado" : "Ver club"}</span>
              <strong>{team.name}</strong>
              <small>{team.neighborhood ?? "Barrio"} / {team.played ?? 0} PJ</small>
              <b>{team.points ?? 0} pts</b>
            </button>
          );
        })}
      </div>
    </section>
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
    <div className="standings-compact league-podium">
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

function CompetitionTabs({
  active,
  onChange
}: {
  active: LeagueView;
  onChange: (view: LeagueView) => void;
}) {
  return (
    <section className="competition-tabs" aria-label="Vista de competicion">
      <button className={active === "classification" ? "is-active" : ""} onClick={() => onChange("classification")} type="button">Clasificacion</button>
      <button className={active === "bracket" ? "is-active" : ""} onClick={() => onChange("bracket")} type="button">Eliminatorias</button>
    </section>
  );
}

function ClassificationTables({
  groups,
  tournamentName,
  onTeamOpen
}: {
  groups: ArenaTeam[][];
  tournamentName: string;
  onTeamOpen: (teamId: string) => void;
}) {
  return (
    <section className="classification-console">
      <header>
        <span>Clasificacion</span>
        <strong>{tournamentName}</strong>
      </header>
      {groups.map((group, groupIndex) => (
        <article className="classification-group" key={`classification-${groupIndex}`}>
          <header>
            <strong>Grupo {String.fromCharCode(65 + groupIndex)}</strong>
            <div>
              <span>PJ</span>
              <span>G</span>
              <span>E</span>
              <span>P</span>
              <span>DG</span>
              <span>Pts</span>
            </div>
          </header>
          {group.map((team, index) => (
            <button className="classification-row" key={team.id} onClick={() => onTeamOpen(team.id)} type="button">
              <span>{index + 1}</span>
              <TeamCrest team={team} />
              <strong>{team.short_name}</strong>
              <div>
                <span>{team.played ?? 0}</span>
                <span>{team.won ?? 0}</span>
                <span>{team.drawn ?? 0}</span>
                <span>{team.lost ?? 0}</span>
                <span>{team.goalDiff ?? 0}</span>
                <b>{team.points ?? 0}</b>
              </div>
            </button>
          ))}
          {Array.from({ length: Math.max(0, 4 - group.length) }).map((_, index) => (
            <div className="classification-row classification-row--empty" key={`empty-${groupIndex}-${index}`}>
              <span>{group.length + index + 1}</span>
              <i />
              <strong>Por definir</strong>
              <div>
                <span>0</span><span>0</span><span>0</span><span>0</span><span>0</span><b>0</b>
              </div>
            </div>
          ))}
        </article>
      ))}
    </section>
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
          <span>Rol activo</span>
          <strong>{info.label}</strong>
          <small>{team ? `Equipo rapido: ${team.name}` : "Una cuenta puede tener varios roles"}</small>
        </div>
        <ChevronDown size={18} />
      </button>
      {open ? (
        <>
          <div className="role-guide">
            <article>
              <span>1</span>
              <strong>Cuenta unica</strong>
              <small>{user?.name ?? "Google"} puede organizar, jugar y gestionar club sin otro login.</small>
            </article>
            <article>
              <span>2</span>
              <strong>Club y jugador</strong>
              <small>{team ? `${team.name} queda como acceso rapido.` : "Desde Equipo podes crear club y despues cargar tu ficha."}</small>
            </article>
            <article>
              <span>3</span>
              <strong>Acciones</strong>
              <small>El rol activo solo ordena botones; no limita lo que puede hacer tu cuenta.</small>
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

function StartGuidePanel({
  data,
  ownedTeam,
  memberTeam,
  myTeam,
  hasCreatedTournament,
  onCreateTournament,
  onLogin,
  onOpenTeam,
  onOpenSquad,
  onOpenVenues
}: {
  data: ArenaData;
  ownedTeam?: ArenaTeam | null;
  memberTeam?: ArenaTeam | null;
  myTeam?: ArenaTeam | null;
  hasCreatedTournament: boolean;
  onCreateTournament: () => void;
  onLogin: (nextTarget?: string) => void;
  onOpenTeam: (teamId: string) => void;
  onOpenSquad: () => void;
  onOpenVenues: () => void;
}) {
  const suggestedJourney: StartJourneyId = data.user
    ? hasCreatedTournament
      ? "organizer"
      : myTeam
        ? "player"
        : data.venues.some((venue) => venue.owner_id === data.user?.id)
          ? "venue"
          : "organizer"
    : "organizer";
  const [selectedJourney, setSelectedJourney] = useState<StartJourneyId>(suggestedJourney);
  const signedIn = Boolean(data.user);
  const playerProfile = data.user ? data.players.find((player) => player.profile_id === data.user?.id) : null;
  const ownedVenue = data.user ? data.venues.find((venue) => venue.owner_id === data.user?.id) : null;
  const ownedTournaments = signedIn ? data.tournaments.filter((tournament) => tournament.organizer_id === data.user?.id) : [];
  const ownedTournamentIds = new Set(ownedTournaments.map((tournament) => tournament.id));
  const ownedTournamentTeamCount = data.tournamentTeams.filter((row) => ownedTournamentIds.has(row.tournament_id)).length;
  const userTeam = memberTeam ?? ownedTeam ?? null;
  const userTeamMatchCount = userTeam
    ? data.matches.filter((match) => match.home_team_id === userTeam.id || match.away_team_id === userTeam.id).length
    : 0;
  const tournamentProActive = data.entitlements.some((entitlement) => {
    if (entitlement.plan_code !== "tournament_pro") return false;
    return !entitlement.expires_at || new Date(entitlement.expires_at).getTime() > Date.now();
  });
  const venueProActive = data.entitlements.some((entitlement) => {
    if (entitlement.plan_code !== "featured_venue") return false;
    return !entitlement.expires_at || new Date(entitlement.expires_at).getTime() > Date.now();
  });
  const ownedTeamEnrolled = Boolean(
    ownedTeam &&
    data.activeTournament &&
    data.tournamentTeams.some((row) => row.tournament_id === data.activeTournament?.id && row.team_id === ownedTeam.id)
  );
  const ownedTeamPlayers = ownedTeam ? data.players.filter((player) => player.team_id === ownedTeam.id) : [];
  const selectedConfig = startJourneyCatalog.find((item) => item.id === selectedJourney) ?? startJourneyCatalog[0];
  const SelectedIcon = selectedConfig.icon;
  const accountStepLabel = signedIn ? "Cuenta activa" : "Entrar con Google";

  const stepsByJourney: Record<StartJourneyId, Array<{ label: string; done: boolean }>> = {
    organizer: [
      { label: accountStepLabel, done: signedIn },
      { label: "Crear torneo", done: signedIn && hasCreatedTournament },
      { label: "Aprobar Pro", done: signedIn && tournamentProActive },
      { label: "Invitar equipos", done: signedIn && ownedTournamentTeamCount > 0 }
    ],
    captain: [
      { label: accountStepLabel, done: signedIn },
      { label: "Crear o elegir club", done: signedIn && Boolean(ownedTeam) },
      { label: "Inscribir en copa", done: signedIn && ownedTeamEnrolled },
      { label: "Invitar jugadores", done: signedIn && ownedTeamPlayers.length > 0 }
    ],
    player: [
      { label: accountStepLabel, done: signedIn },
      { label: "Equipo asignado", done: signedIn && Boolean(userTeam) },
      { label: "Ficha cargada", done: signedIn && Boolean(playerProfile) },
      { label: "Ver partidos", done: signedIn && userTeamMatchCount > 0 }
    ],
    venue: [
      { label: accountStepLabel, done: signedIn },
      { label: "Marcar ubicacion", done: signedIn && Boolean(ownedVenue?.latitude && ownedVenue?.longitude) },
      { label: "WhatsApp visible", done: signedIn && Boolean(ownedVenue?.phone) },
      { label: "Destacar Pro", done: signedIn && venueProActive }
    ]
  };
  const steps = stepsByJourney[selectedJourney];
  const currentIndex = steps.findIndex((step) => !step.done);

  function runPrimaryAction() {
    if (selectedJourney === "organizer") {
      onCreateTournament();
      return;
    }
    if (selectedJourney === "captain") {
      if (!signedIn) return onLogin("/?start=squad");
      if (ownedTeam) return onOpenTeam(ownedTeam.id);
      onOpenSquad();
      return;
    }
    if (selectedJourney === "player") {
      if (!signedIn) return onLogin("/?start=squad");
      if (myTeam?.id) return onOpenTeam(myTeam.id);
      onOpenSquad();
      return;
    }
    if (!signedIn) return onLogin("/?start=venues");
    onOpenVenues();
  }

  function primaryLabel() {
    if (!signedIn && selectedJourney !== "organizer") return "Entrar con Google";
    if (selectedJourney === "organizer") return hasCreatedTournament ? "Ver mis torneos" : "Crear torneo";
    if (selectedJourney === "captain") return ownedTeam ? "Gestionar club" : "Crear club";
    if (selectedJourney === "player") return myTeam ? "Ver mi equipo" : "Buscar equipo";
    return ownedVenue ? "Ver mis canchas" : "Registrar cancha";
  }

  return (
    <section className="start-guide-panel" aria-labelledby="start-guide-title">
      <header>
        <span>Plan de juego</span>
        <div>
          <h2 id="start-guide-title">Que queres hacer hoy?</h2>
          <p>{signedIn ? "Te mostramos el siguiente paso segun tu cuenta." : "Elegi una opcion y entra con Google una sola vez."}</p>
        </div>
      </header>
      <div className="start-guide-tabs" aria-label="Elegir camino inicial">
        {startJourneyCatalog.map((item) => {
          const Icon = item.icon;
          return (
            <button className={selectedJourney === item.id ? "is-active" : ""} key={item.id} onClick={() => setSelectedJourney(item.id)} type="button">
              <Icon size={17} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      <article className="start-guide-card">
        <div className="start-guide-card__head">
          <SelectedIcon size={22} />
          <div>
            <span>{selectedConfig.eyebrow}</span>
            <strong>{selectedConfig.title}</strong>
          </div>
        </div>
        <ol className="start-guide-steps">
          {steps.map((step, index) => (
            <li className={step.done ? "is-done" : index === currentIndex ? "is-current" : ""} key={step.label}>
              <span>{step.done ? <BadgeCheck size={14} /> : index + 1}</span>
              <b>{step.label}</b>
            </li>
          ))}
        </ol>
        <button className="start-guide-primary" onClick={runPrimaryAction} type="button">
          {primaryLabel()}
          <ArrowRight size={17} />
        </button>
      </article>
    </section>
  );
}

function FriendlyPanel({
  data,
  ownedTeam,
  focusCode,
  focusMode = false,
  nearbyVenues = data.venues,
  venueLocation = null,
  venueLocationStatus = "Mostrando canchas registradas.",
  onCreateTeam,
  onOpenTeamPro,
  onCloseFocus,
  onRequestVenueLocation
}: {
  data: ArenaData;
  ownedTeam?: ArenaTeam | null;
  focusCode?: string;
  focusMode?: boolean;
  nearbyVenues?: ArenaVenue[];
  venueLocation?: GeoPoint | null;
  venueLocationStatus?: string;
  onCreateTeam: () => void;
  onOpenTeamPro?: () => void;
  onCloseFocus?: () => void;
  onRequestVenueLocation?: () => void;
}) {
  const ownedTeams = data.user ? data.teams.filter((team) => team.owner_id === data.user?.id) : [];
  const focusedFriendly = focusCode ? data.friendlyMatches.find((match) => match.invite_code === focusCode) : null;
  const [open, setOpen] = useState(Boolean(focusedFriendly));
  const [selectedTeamId, setSelectedTeamId] = useState(ownedTeam?.id ?? ownedTeams[0]?.id ?? "");
  const [fieldMode, setFieldMode] = useState<FieldMode>(focusedFriendly?.field_mode ?? "5v5");
  const [selectedFriendlyVenueId, setSelectedFriendlyVenueId] = useState(focusedFriendly?.venue_id ?? "");
  const [message, setMessage] = useState("");
  const [inviteHref, setInviteHref] = useState("");
  const [pending, setPending] = useState(false);
  const [teamPending, setTeamPending] = useState(false);
  const ownedTeamIds = new Set(ownedTeams.map((team) => team.id));
  const selectedTeam = ownedTeams.find((team) => team.id === selectedTeamId) ?? ownedTeams[0] ?? null;
  const focusedHomeIsMine = focusedFriendly ? ownedTeamIds.has(focusedFriendly.home_team_id) : false;
  const panelOpen = focusMode || open || Boolean(focusedFriendly);
  const stageHomeTeam = focusedFriendly?.homeTeam ?? selectedTeam;
  const stageAwayTeam = focusedFriendly ? focusedFriendly.awayTeam ?? (focusedFriendly.home_team_id !== selectedTeam?.id ? selectedTeam : null) : null;
  const emptyAwayLabel = focusedFriendly && !focusedHomeIsMine ? "Tu equipo" : "Rival pendiente";
  const friendlyVenueOptions = nearbyVenues.length ? nearbyVenues : data.venues;
  const selectedFriendlyVenue = friendlyVenueOptions.find((venue) => venue.id === selectedFriendlyVenueId) ?? null;
  const selectedVenueWhatsapp = venueReservationWhatsappUrl(selectedFriendlyVenue);
  const friendlyFeed = data.friendlyMatches
    .filter((match) => {
      if (focusedFriendly?.id === match.id) return true;
      if (match.status === "open") return true;
      return ownedTeamIds.has(match.home_team_id) || (match.away_team_id ? ownedTeamIds.has(match.away_team_id) : false);
    })
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  const latestOwnOpenFriendly = friendlyFeed.find((match) => match.status === "open" && ownedTeamIds.has(match.home_team_id));
  const shareableFriendlyId = !inviteHref
    ? focusedFriendly && focusedHomeIsMine
      ? focusedFriendly.id
      : latestOwnOpenFriendly?.id
    : null;
  const visibleFriendlies = inviteHref
    ? []
    : focusedFriendly
      ? [focusedFriendly]
      : focusMode
        ? latestOwnOpenFriendly ? [latestOwnOpenFriendly] : []
        : friendlyFeed.slice(0, 6);

  useEffect(() => {
    if (focusMode || focusedFriendly) setOpen(true);
  }, [focusMode, focusedFriendly?.id]);

  useEffect(() => {
    function openRequested() {
      setOpen(true);
      window.setTimeout(() => {
        document.getElementById("friendly")?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 40);
    }

    window.addEventListener("fulbito:open-friendly", openRequested);
    return () => window.removeEventListener("fulbito:open-friendly", openRequested);
  }, []);

  async function createInlineTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!data.user) return setMessage("Entra con Google para crear tu equipo.");
    const form = new FormData(event.currentTarget);
    const teamName = String(form.get("teamName") || "").trim();
    if (!teamName) return setMessage("El equipo necesita nombre.");
    setTeamPending(true);
    try {
      const response = await fetch("/api/teams", { method: "POST", body: form });
      const result = (await response.json()) as { team?: { id: string; name: string }; error?: string; warning?: string };
      if (!response.ok || !result.team) throw new Error(result.error || "No se pudo crear el equipo.");
      setMessage(result.warning || `${result.team.name} quedo creado. Volvemos al amistoso para usarlo.`);
      window.setTimeout(() => {
        window.location.href = focusedFriendly?.invite_code
          ? `/?friendly=${encodeURIComponent(focusedFriendly.invite_code)}#friendly`
          : "/?start=friendly#friendly";
      }, 850);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el equipo.");
    } finally {
      setTeamPending(false);
    }
  }

  async function createFriendly(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setInviteHref("");
    if (!data.user) return setMessage("Entra con Google para crear un amistoso.");
    if (!selectedTeam) {
      setMessage("Primero crea un equipo propio.");
      onCreateTeam();
      return;
    }
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: created, error } = await supabase
        .from("friendly_matches")
        .insert({
          created_by: data.user.id,
          home_team_id: selectedTeam.id,
          venue_id: selectedFriendlyVenueId || null,
          field_mode: fieldMode,
          invite_code: friendlyInviteCode(selectedTeam),
          title: "Amistoso",
          note: String(form.get("note") || "").trim() || null,
          scheduled_at: combineDateTime(form.get("friendlyDate"), form.get("friendlyTime")),
          status: "open"
        })
        .select("*")
        .single();
      if (error) throw error;
      const related = { ...(created as FriendlyMatch), homeTeam: selectedTeam, awayTeam: null, venue: data.venues.find((venue) => venue.id === created.venue_id) ?? null };
      setInviteHref(friendlyInviteHref(related));
      setMessage("Amistoso creado. Compartilo por WhatsApp para que otro equipo lo acepte.");
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el amistoso.");
    } finally {
      setPending(false);
    }
  }

  async function acceptFriendly(match: FriendlyMatch) {
    setMessage("");
    if (!data.user) return setMessage("Entra con Google para aceptar el amistoso.");
    if (!selectedTeam) return setMessage("Primero crea o elegi un equipo propio.");
    if (selectedTeam.id === match.home_team_id) return setMessage("Ese amistoso ya pertenece a tu equipo. Compartilo con otro club.");
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("friendly_matches")
        .update({
          away_team_id: selectedTeam.id,
          accepted_by: data.user.id,
          accepted_at: new Date().toISOString(),
          status: "accepted"
        })
        .eq("invite_code", match.invite_code);
      if (error) throw error;
      setMessage(`Listo: ${selectedTeam.name} acepto el amistoso contra ${match.homeTeam?.name ?? "el rival"}.`);
      window.setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo aceptar el amistoso.");
    } finally {
      setPending(false);
    }
  }

  async function saveFriendlyResult(event: FormEvent<HTMLFormElement>, match: FriendlyMatch) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setMessage("");
    try {
      const homeScore = Number(form.get("homeScore"));
      const awayScore = Number(form.get("awayScore"));
      if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) throw new Error("Cargá un marcador valido.");
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("friendly_matches")
        .update({
          home_score: homeScore,
          away_score: awayScore,
          status: "final",
          result_locked_at: new Date().toISOString()
        })
        .eq("id", match.id);
      if (error) throw error;
      setMessage("Resultado guardado. El rating del equipo se recalcula con este amistoso.");
      window.setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el resultado.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={`friendly-panel ${panelOpen ? "is-open" : ""} ${focusMode ? "friendly-panel--focus" : ""}`} id="friendly">
      {focusMode ? (
        <header className="friendly-mode-header">
          <div>
            <span>Modo amistoso</span>
            <h2>Amistoso</h2>
            <p>Elegis tu equipo, dia, hora y cancha. Despues mandas la invitacion por WhatsApp para que el rival confirme el partido.</p>
          </div>
          {onCloseFocus ? <button onClick={onCloseFocus} type="button">Inicio</button> : null}
        </header>
      ) : null}
      <button className="friendly-panel__toggle" onClick={() => setOpen((current) => !current)} type="button">
        <Flag size={18} />
        <div>
          <span>Amistosos</span>
          <strong>Buscar rival para entrenar</strong>
          <small>Creá un desafío, compartilo por WhatsApp y sumá puntos de forma.</small>
        </div>
        <ChevronDown className={panelOpen ? "is-open" : ""} size={18} />
      </button>
      {panelOpen ? (
        <div className="friendly-panel__body">
          <article className="friendly-versus-stage">
            <div className="friendly-versus-team">
              <TeamCrest team={stageHomeTeam} size="large" />
              <span>{focusedFriendly ? "Local" : "Tu equipo"}</span>
              <strong>{stageHomeTeam?.name ?? "Crea tu club"}</strong>
              <small>{stageHomeTeam?.neighborhood ?? "Equipo propio"}</small>
            </div>
            <div className="friendly-versus-center">
              <b>VS</b>
              <span>{focusedFriendly?.field_mode ?? fieldMode}</span>
            </div>
            <div className={`friendly-versus-team ${stageAwayTeam ? "" : "friendly-versus-team--empty"}`}>
              {stageAwayTeam ? <TeamCrest team={stageAwayTeam} size="large" /> : <span className="friendly-rival-placeholder">?</span>}
              <span>{focusedFriendly?.awayTeam ? "Visitante" : emptyAwayLabel}</span>
              <strong>{stageAwayTeam?.name ?? "A confirmar"}</strong>
              <small>{stageAwayTeam ? stageAwayTeam.neighborhood ?? "Club confirmado" : "Se completa al aceptar el link"}</small>
            </div>
          </article>
          {focusMode && !ownedTeams.length ? (
            <form className="friendly-team-form" onSubmit={createInlineTeam}>
              <header>
                <span>Alta rapida</span>
                <strong>Crear equipo gratis</strong>
                <p>Nombre, sigla y barrio. El escudo, fotos y cartas quedan para Equipo Pro.</p>
              </header>
              <input name="teamName" placeholder="Nombre del club" />
              <div className="creator-inline">
                <input maxLength={4} name="shortName" placeholder="Sigla" />
                <input name="neighborhood" placeholder="Barrio" />
              </div>
              <button disabled={teamPending} type="submit">{teamPending ? "Guardando equipo" : "Crear equipo gratis"}</button>
              <button className="friendly-team-form__pro" onClick={onOpenTeamPro ?? onCreateTeam} type="button">Quiero Equipo Pro</button>
            </form>
          ) : null}
          {!ownedTeams.length ? (
            <article className="friendly-empty">
              <Shield size={18} />
              <div>
                <strong>Primero necesitás un equipo</strong>
                <span>El amistoso se crea desde un club propio. Después podés invitar rivales.</span>
              </div>
              <button onClick={onCreateTeam} type="button">Crear equipo</button>
            </article>
          ) : (
            <form className="friendly-form" onSubmit={createFriendly}>
              <header className="friendly-form__head">
                <span>{focusedFriendly ? "Aceptar desafio" : "Nuevo desafio"}</span>
                <strong>{focusedFriendly ? "Elige tu club para confirmar" : "Tu equipo vs rival pendiente"}</strong>
              </header>
              <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)}>
                {ownedTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
              <div className="field-mode-card-grid" aria-label="Modalidad del amistoso">
                {(["5v5", "7v7", "11v11"] as FieldMode[]).map((mode) => (
                  <button className={fieldMode === mode ? "is-active" : ""} key={mode} onClick={() => setFieldMode(mode)} type="button">
                    <b>{mode.replace("v", " vs ")}</b>
                    <small>{getRosterRule(mode).starters} titulares</small>
                  </button>
                ))}
              </div>
              <div className="creator-inline">
                <input name="friendlyDate" type="date" />
                <input defaultValue="20:00" name="friendlyTime" type="time" />
              </div>
              <section className="friendly-venue-picker">
                <header>
                  <div>
                    <span>Cancha</span>
                    <strong>{venueLocation ? "Sedes a 50 km" : "Busca sedes cercanas"}</strong>
                    <small>{venueLocationStatus}</small>
                  </div>
                  {onRequestVenueLocation ? (
                    <button onClick={onRequestVenueLocation} type="button">
                      <LocateFixed size={15} />
                      {venueLocation ? "Actualizar" : "Usar ubicacion"}
                    </button>
                  ) : null}
                </header>
                <select name="venueId" value={selectedFriendlyVenueId} onChange={(event) => setSelectedFriendlyVenueId(event.target.value)}>
                  <option value="">Cancha a confirmar</option>
                  {friendlyVenueOptions.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name}{venue.neighborhood ? ` / ${venue.neighborhood}` : ""}{venue.price_per_hour ? ` / ${money(venue.price_per_hour)}` : ""}
                    </option>
                  ))}
                </select>
                {selectedFriendlyVenue ? (
                  <div className="friendly-venue-summary">
                    <div>
                      <strong>{selectedFriendlyVenue.name}</strong>
                      <span>{selectedFriendlyVenue.address ?? selectedFriendlyVenue.neighborhood}{selectedFriendlyVenue.price_per_hour ? ` / ${money(selectedFriendlyVenue.price_per_hour)} por hora` : ""}</span>
                    </div>
                    {selectedVenueWhatsapp ? (
                      <a href={selectedVenueWhatsapp} rel="noreferrer" target="_blank">Consultar reserva</a>
                    ) : (
                      <small>Sin WhatsApp cargado</small>
                    )}
                  </div>
                ) : (
                  <p className="friendly-venue-hint">Podes dejarla a confirmar o elegir una sede para consultar disponibilidad por WhatsApp.</p>
                )}
              </section>
              <input name="note" placeholder="Nota: buscamos rival nivel medio, traer pelota..." />
              {!focusedFriendly ? <button disabled={pending} type="submit">{pending ? "Creando invitacion" : "Crear invitacion de amistoso"}</button> : null}
              {inviteHref ? <a className="inline-whatsapp-button" href={inviteHref} rel="noreferrer" target="_blank">Invitar rival por WhatsApp</a> : null}
            </form>
          )}

          {visibleFriendlies.length ? (
            <div className="friendly-list">
              {visibleFriendlies.map((match) => {
                const canAccept = data.user && selectedTeam && match.status === "open" && match.home_team_id !== selectedTeam.id;
                const canResult = data.user && match.away_team_id && (ownedTeamIds.has(match.home_team_id) || ownedTeamIds.has(match.away_team_id)) && match.status !== "final";
                const canShare = match.status === "open" && match.id === shareableFriendlyId;
                return (
                  <article className={focusedFriendly?.id === match.id ? "is-focused" : ""} key={match.id}>
                    <header>
                      <span>{match.field_mode} / {match.status === "open" ? "busca rival" : match.status}</span>
                      <strong>{match.homeTeam?.short_name ?? "LOC"} vs {match.awayTeam?.short_name ?? "Rival"}</strong>
                      <small>{formatDate(match.scheduled_at)}{match.venue ? ` / ${match.venue.name}` : ""}</small>
                    </header>
                    {match.note ? <p>{match.note}</p> : null}
                    <div className="friendly-actions">
                      {canShare ? <a className="inline-whatsapp-button" href={friendlyInviteHref(match)} rel="noreferrer" target="_blank">Invitar por WhatsApp</a> : null}
                      {canAccept ? <button disabled={pending} onClick={() => acceptFriendly(match)} type="button">Aceptar con mi equipo</button> : null}
                    </div>
                    {match.status === "final" ? (
                      <b className="friendly-score">{match.home_score} - {match.away_score}</b>
                    ) : canResult ? (
                      <form className="friendly-result-form" onSubmit={(event) => saveFriendlyResult(event, match)}>
                        <input name="homeScore" inputMode="numeric" placeholder={match.homeTeam?.short_name ?? "LOC"} />
                        <input name="awayScore" inputMode="numeric" placeholder={match.awayTeam?.short_name ?? "VIS"} />
                        <button disabled={pending} type="submit">Guardar resultado</button>
                      </form>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : null}
          {message ? <p className="console-message">{message}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function TeamProfile({
  team,
  players,
  isManager,
  rating
}: {
  team?: ArenaTeam;
  players: ArenaPlayer[];
  isManager: boolean;
  rating?: ReturnType<typeof computeTeamRating>;
}) {
  if (!team) return null;
  const goals = players.reduce((total, player) => total + player.goals, 0);
  const teamRating = rating ?? { rating: 50, stars: 3, tier: "bronce", played: 0, wins: 0, goalsFor: goals, goalsAgainst: 0 };
  return (
    <section className="team-profile-console">
      <div className="team-profile-console__identity">
        <TeamCrest team={team} size="large" />
        <div>
          <span>{isManager ? "Panel del club" : "Vista publica"}</span>
          <h2>{team.name}</h2>
          <p>{team.neighborhood ?? "Barrio"} / {players.length} jugadores / {goals} goles</p>
          <small className={`team-rating-badge team-rating-badge--${teamRating.tier}`}>
            {teamRating.rating} OVR / {"★".repeat(teamRating.stars)}{"☆".repeat(5 - teamRating.stars)} / {teamRating.tier.toUpperCase()}
          </small>
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

function getCupRoundLabel(label: string) {
  const labels: Record<string, string> = {
    Final: "Finalistas",
    Semis: "Semis",
    Cuartos: "Cuartos",
    Octavos: "Octavos",
    "16avos": "16avos"
  };
  return labels[label] ?? label;
}

function FulbitoFanCup({ tier }: { tier: CupTier }) {
  return (
    <svg className={`fulbito-fan-cup fulbito-fan-cup--${tier}`} viewBox="0 0 220 300" role="img" aria-label="Copa Fulbito">
      <defs>
        <linearGradient id="cup-silver" x1="35" x2="184" y1="15" y2="214" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".22" stopColor="#d8e5ee" />
          <stop offset=".48" stopColor="#8799a8" />
          <stop offset=".72" stopColor="#f8fbff" />
          <stop offset="1" stopColor="#667481" />
        </linearGradient>
        <linearGradient id="cup-gold-edge" x1="48" x2="177" y1="34" y2="247" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff3a5" />
          <stop offset=".46" stopColor="#d39c2b" />
          <stop offset="1" stopColor="#7c4c0f" />
        </linearGradient>
        <linearGradient id="cup-shadow" x1="30" x2="184" y1="12" y2="268" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#102233" stopOpacity=".08" />
          <stop offset=".72" stopColor="#06101b" stopOpacity=".42" />
          <stop offset="1" stopColor="#02050a" stopOpacity=".72" />
        </linearGradient>
        <radialGradient id="cup-glow" cx="44%" cy="20%" r="68%">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".88" />
          <stop offset=".24" stopColor="#ffffff" stopOpacity=".22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id="cup-depth" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="18" stdDeviation="14" floodColor="#000000" floodOpacity=".46" />
          <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="#f1c75b" floodOpacity=".28" />
        </filter>
      </defs>
      <g filter="url(#cup-depth)">
        <ellipse cx="110" cy="270" rx="64" ry="14" fill="#02060c" opacity=".42" />
        <path d="M64 246h92l12 22H52l12-22Z" fill="url(#cup-gold-edge)" />
        <path d="M73 219h74l9 30H64l9-30Z" fill="url(#cup-silver)" />
        <path d="M91 174h38l9 50H82l9-50Z" fill="url(#cup-gold-edge)" />
        <path d="M45 40h130c-2 58-14 105-37 134-17 21-40 21-57 0C58 145 47 98 45 40Z" fill="url(#cup-silver)" />
        <path d="M45 40h130c-4 22-31 35-65 35S49 62 45 40Z" fill="#f5fbff" opacity=".7" />
        <path d="M52 50c8 66 26 119 58 139 32-20 50-73 58-139" fill="none" stroke="url(#cup-shadow)" strokeWidth="13" opacity=".58" />
        <path d="M52 39c-33 10-44 47-32 76 8 19 24 31 48 39l7-22c-18-5-29-13-34-26-7-18 0-36 18-44l-7-23Z" fill="url(#cup-silver)" />
        <path d="M168 39c33 10 44 47 32 76-8 19-24 31-48 39l-7-22c18-5 29-13 34-26 7-18 0-36-18-44l7-23Z" fill="url(#cup-silver)" />
        <path d="M34 59c-14 13-16 34-8 50 6 12 17 19 33 25" fill="none" stroke="#fff" strokeOpacity=".42" strokeWidth="4" />
        <path d="M186 59c14 13 16 34 8 50-6 12-17 19-33 25" fill="none" stroke="#fff" strokeOpacity=".42" strokeWidth="4" />
        <path d="M74 50c7 52 22 94 43 127" fill="none" stroke="#ffffff" strokeOpacity=".42" strokeWidth="5" strokeLinecap="round" />
        <path d="M137 50c-3 43-12 80-28 111" fill="none" stroke="#ffffff" strokeOpacity=".14" strokeWidth="18" strokeLinecap="round" />
        <ellipse cx="92" cy="58" rx="45" ry="78" fill="url(#cup-glow)" opacity=".7" />
        <circle cx="110" cy="118" r="31" fill="#07101a" opacity=".86" />
        <path d="M94 122h32M110 101v42M98 107l24 24M122 107l-24 24" stroke="#f1c75b" strokeWidth="5" strokeLinecap="round" />
        <path d="M74 220h72" stroke="#ffffff" strokeOpacity=".45" strokeWidth="3" />
        <path d="M58 248h104" stroke="#ffffff" strokeOpacity=".34" strokeWidth="3" />
      </g>
    </svg>
  );
}

function CupTierSelector({
  active,
  hasLocalChampion,
  onChange
}: {
  active: CupTier;
  hasLocalChampion: boolean;
  onChange: (tier: CupTier) => void;
}) {
  return (
    <section className="cup-tier-selector" aria-label="Camino competitivo Fulbito">
      {cupTierCatalog.map((tier) => (
        <button
          className={`${active === tier.id ? "is-active" : ""} ${tier.id !== "local" && !hasLocalChampion ? "is-locked" : ""}`}
          disabled={tier.id !== "local" && !hasLocalChampion}
          key={tier.id}
          onClick={() => onChange(tier.id)}
          type="button"
        >
          <span>{tier.eyebrow}</span>
          <strong>{tier.label}</strong>
          {tier.id !== "local" && !hasLocalChampion ? <small>Bloqueado</small> : null}
        </button>
      ))}
    </section>
  );
}

function CupBracketSide({
  side,
  rounds,
  matches,
  teamsById,
  onTeamOpen
}: {
  side: "left" | "right";
  rounds: Array<{ label: string; slots: number }>;
  matches: ArenaMatch[];
  teamsById: Map<string, ArenaTeam>;
  onTeamOpen: (teamId: string) => void;
}) {
  const centerOutRounds = [...rounds].reverse();
  return (
    <div className={`cup-bracket-side cup-bracket-side--${side}`}>
      {centerOutRounds.map((round) => {
        const sideSlots = round.label === "Final" ? 1 : Math.max(1, Math.ceil(round.slots / 2));
        const visibleSlots = Math.min(sideSlots, 8);
        const participants = getRoundParticipants(round.label, matches, teamsById);
        const sideOffset = side === "left" ? 0 : sideSlots;
        return (
          <article className="cup-stage" key={`${side}-${round.label}`}>
            <header>
              <strong>{getCupRoundLabel(round.label)}</strong>
              <span>{sideSlots} cupos</span>
            </header>
            <div>
              {Array.from({ length: visibleSlots }).map((_, slotIndex) => {
                const team = participants[sideOffset + slotIndex] ?? null;
                return (
                  <button className="cup-slot" disabled={!team} key={`${side}-${round.label}-${slotIndex}`} onClick={() => team && onTeamOpen(team.id)} type="button">
                    {team ? <TeamCrest team={team} /> : <i />}
                    <span>{team?.short_name ?? "Pendiente"}</span>
                  </button>
                );
              })}
              {sideSlots > visibleSlots ? <small>+{sideSlots - visibleSlots} cruces</small> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ChampionCard({
  champion,
  competitionName,
  players,
  isChampion,
  tier,
  onTeamOpen
}: {
  champion?: ArenaTeam | null;
  competitionName: string;
  players: ArenaPlayer[];
  isChampion: boolean;
  tier: (typeof cupTierCatalog)[number];
  onTeamOpen: (teamId: string) => void;
}) {
  const championPlayers = champion ? players.filter((player) => player.team_id === champion.id) : [];
  const title = tier.id === "local" ? `Campeon de ${competitionName}` : tier.title;
  return (
    <button className="champion-card" disabled={!champion} onClick={() => champion && onTeamOpen(champion.id)} type="button">
      {champion ? <TeamCrest team={champion} size="large" /> : <span className="champion-card__empty-crest"><Trophy /></span>}
      <div>
        <span>{isChampion ? title : `${title} por definir`}</span>
        <strong>{champion?.name ?? "Campeon por definir"}</strong>
        <p>{champion ? `${champion.neighborhood ?? "Barrio"} / ${championPlayers.length} jugadores cargados` : "Cuando se juegue y cierre la final, el equipo campeon queda registrado aca."}</p>
        <div className="champion-card__roster">
          {championPlayers.slice(0, 7).map((player) => (
            <span key={player.id} title={player.display_name}>
              <PlayerAvatar player={player} />
            </span>
          ))}
          {!championPlayers.length ? <small>Plantel pendiente</small> : null}
        </div>
      </div>
      <ChevronRight />
    </button>
  );
}

function CompetitionBracket({
  matches,
  rounds,
  teams,
  players,
  tournament,
  onTeamOpen
}: {
  matches: ArenaMatch[];
  rounds: Array<{ label: string; slots: number }>;
  teams: ArenaTeam[];
  players: ArenaPlayer[];
  tournament?: ArenaTournament | null;
  onTeamOpen: (teamId: string) => void;
}) {
  const [cupTier, setCupTier] = useState<CupTier>("local");
  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const champion = getTournamentChampion(matches, teamsById);
  const hasLocalChampion = Boolean(champion);
  const isChampion = Boolean(champion);
  const activeTier = cupTierCatalog.find((tier) => tier.id === cupTier) ?? cupTierCatalog[0];
  const competitionName = tournament?.name ?? "Copa del Hincha";
  const trophyLabel = cupTier === "local" ? competitionName : activeTier.trophyLabel;
  const summaryTitle = cupTier === "local" ? competitionName : activeTier.title;
  const summaryDescription = cupTier === "local"
    ? "Esta es la copa que creo el organizador. Los clasificados aparecen en eliminatorias solo cuando el torneo los genere o cuando los cruces tengan resultados."
    : activeTier.description;
  return (
    <section className="competition-bracket">
      <header>
        <span>Eliminatorias</span>
        <strong>Camino a la final</strong>
      </header>
      <CupTierSelector active={cupTier} hasLocalChampion={hasLocalChampion} onChange={setCupTier} />
      <article className="cup-tier-summary">
        <span>{activeTier.eyebrow}</span>
        <strong>{summaryTitle}</strong>
        <p>{summaryDescription}</p>
      </article>
      <div className="competition-cup-bracket">
        <div className="competition-cup-bracket__field">
          <CupBracketSide matches={matches} onTeamOpen={onTeamOpen} rounds={rounds} side="left" teamsById={teamsById} />
          <div className="cup-trophy" aria-label="Copa Fulbito">
            <div className="cup-trophy__halo" />
            <div className="cup-trophy__model">
              <FulbitoFanCup tier={cupTier} />
            </div>
            <span>{trophyLabel}</span>
          </div>
          <CupBracketSide matches={matches} onTeamOpen={onTeamOpen} rounds={rounds} side="right" teamsById={teamsById} />
        </div>
        <ChampionCard champion={champion} competitionName={competitionName} isChampion={isChampion} onTeamOpen={onTeamOpen} players={players} tier={activeTier} />
      </div>
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
  teamProActive,
  tournament
}: {
  players: ArenaPlayer[];
  rosterRule: ReturnType<typeof getRosterRule>;
  team: ArenaTeam;
  teamProActive: boolean;
  tournament: ArenaTournament | null;
}) {
  const [href, setHref] = useState("");
  const rosterFull = players.length >= rosterRule.maxPlayers;

  useEffect(() => {
    if (!tournament?.slug || !team.slug) return;
    const joinUrl = `${window.location.origin}/?join=${encodeURIComponent(tournament.slug)}&team=${encodeURIComponent(team.slug)}`;
    const premiumCopy = teamProActive ? " Tambien podes subir foto para tu carta Fulbito." : " En modo gratis cargas nombre, dorsal y apodo; la foto se habilita si el club activa Equipo Pro.";
    const text = `Te invito a sumarte a ${team.name} en ${tournament.name}. Entra a ${joinUrl}, carga tu ficha y queda en el plantel.${premiumCopy}`;
    setHref(`https://wa.me/?text=${encodeURIComponent(text)}`);
  }, [team.name, team.slug, teamProActive, tournament?.name, tournament?.slug]);

  return (
    <section className="player-invite-panel">
      <div>
        <span>Invitar plantel</span>
        <strong>{players.length}/{rosterRule.maxPlayers} jugadores</strong>
        <p>
          Compartile este link a los jugadores. Cada uno entra con Google y completa su ficha dentro de {team.name}.
          {teamProActive ? " Equipo Pro activo: fotos y cartas disponibles." : " Equipo gratis: sin fotos para cuidar storage."}
        </p>
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

export function ArenaExperience({ data, joinCode, inviteTeamCode, friendlyCode }: { data: ArenaData; joinCode?: string; inviteTeamCode?: string; friendlyCode?: string }) {
  const inviteMode = Boolean(joinCode && data.activeTournament);
  const ownedTeam = data.user ? data.teams.find((team) => team.owner_id === data.user?.id) : null;
  const memberTeamId = data.user ? data.players.find((player) => player.profile_id === data.user?.id)?.team_id : null;
  const memberTeam = memberTeamId ? data.teams.find((team) => team.id === memberTeamId) : null;
  const invitedTeam = inviteTeamCode
    ? data.teams.find((team) => team.slug === inviteTeamCode || team.id === inviteTeamCode || team.short_name.toLowerCase() === inviteTeamCode.toLowerCase())
    : null;
  const playerInviteMode = Boolean(inviteMode && inviteTeamCode && invitedTeam);
  const friendlyInvite = friendlyCode ? data.friendlyMatches.find((match) => match.invite_code === friendlyCode) : null;
  const inferredTeam = playerInviteMode
    ? invitedTeam
    : inviteMode
      ? ownedTeam ?? null
      : ownedTeam ?? memberTeam ?? data.teams[0] ?? null;
  const inferredAccountRoles = useMemo<AppRole[]>(() => {
    const roles: AppRole[] = data.user?.roles.length ? [...data.user.roles] : ["player"];
    if (!data.user) return uniqueRoles(roles);
    if (data.tournaments.some((tournament) => tournament.organizer_id === data.user?.id)) roles.push("organizer");
    if (ownedTeam) roles.push("captain");
    if (memberTeam) roles.push("player");
    if (data.venues.some((venue) => venue.owner_id === data.user?.id)) roles.push("venue_owner");
    if (inviteMode && !playerInviteMode) roles.push("captain");
    if (playerInviteMode) roles.push("player");
    return uniqueRoles(roles);
  }, [data.tournaments, data.user, data.venues, inviteMode, memberTeam, ownedTeam, playerInviteMode]);
  const preferredInitialRole = useMemo<AppRole>(() => {
    if (!data.user) return "player";
    if (inviteMode) return playerInviteMode ? "player" : "captain";
    if (data.tournaments.some((tournament) => tournament.organizer_id === data.user?.id)) return "organizer";
    if (ownedTeam) return "captain";
    if (memberTeam) return "player";
    if (data.venues.some((venue) => venue.owner_id === data.user?.id)) return "venue_owner";
    return inferredAccountRoles[0] ?? "player";
  }, [data.tournaments, data.user, data.venues, inferredAccountRoles, inviteMode, memberTeam, ownedTeam, playerInviteMode]);

  const [showSplash, setShowSplash] = useState(true);
  const [active, setActive] = useState<TabId>(() => inviteMode && data.user ? "squad" : "home");
  const [leagueView, setLeagueView] = useState<LeagueView>("classification");
  const [formationMode, setFormationMode] = useState<FieldMode>(data.activeTournament?.field_mode ?? "7v7");
  const [formationPresetId, setFormationPresetId] = useState(formationPresets[data.activeTournament?.field_mode ?? "7v7"][0].id);
  const [selectedTeamId, setSelectedTeamId] = useState(inferredTeam?.id ?? "");
  const [selectedVenueId, setSelectedVenueId] = useState(data.venues[0]?.id ?? "");
  const [selectedMatchId, setSelectedMatchId] = useState(data.matches.find((match) => match.status !== "final")?.id ?? data.matches[0]?.id ?? "");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(formationPresets[data.activeTournament?.field_mode ?? "7v7"][0].slots.length - 1);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<AppRole[]>(() => inferredAccountRoles);
  const [activeRole, setActiveRole] = useState<AppRole>(() => preferredInitialRole);
  const inferredRoleKey = inferredAccountRoles.join("|");
  const effectiveUserRoles = useMemo(() => uniqueRoles([...userRoles, ...inferredAccountRoles]), [inferredAccountRoles, userRoles]);
  const [roleMessage, setRoleMessage] = useState("");
  const [venueLocation, setVenueLocation] = useState<GeoPoint | null>(null);
  const [venueLocationAsked, setVenueLocationAsked] = useState(false);
  const [venueLocationStatus, setVenueLocationStatus] = useState("Mostrando canchas registradas.");
  const [showVenueForm, setShowVenueForm] = useState(false);
  const [friendlyFocus, setFriendlyFocus] = useState(Boolean(friendlyCode));
  const [tournamentFocus, setTournamentFocus] = useState(false);
  const [loginNextTarget, setLoginNextTarget] = useState("/");
  const [sponsorTriggerKey, setSponsorTriggerKey] = useState(0);
  const activeRef = useRef<TabId>(active);
  const historyReadyRef = useRef(false);
  const sponsorTabSwitchCountRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!data.user) return;
    const nextRoles = uniqueRoles([...userRoles, ...inferredAccountRoles]);
    setUserRoles((current) => sameRoles(current, nextRoles) ? current : nextRoles);
    setActiveRole((current) => {
      if (current !== "player" && nextRoles.includes(current)) return current;
      return preferredInitialRole;
    });
  }, [data.user, inferredAccountRoles, inferredRoleKey, preferredInitialRole, userRoles]);

  const setActiveTab = useCallback((next: TabId) => {
    if (activeRef.current === next) return;
    if (typeof window !== "undefined") {
      window.history.pushState({ ...(window.history.state ?? {}), fulbitoTab: next }, "", window.location.href);
    }
    activeRef.current = next;
    setActive(next);
    sponsorTabSwitchCountRef.current += 1;
    if (sponsorTabSwitchCountRef.current >= 3) {
      sponsorTabSwitchCountRef.current = 0;
      setSponsorTriggerKey((current) => current + 1);
    }
  }, []);

  useEffect(() => {
    if (historyReadyRef.current) return;
    historyReadyRef.current = true;
    window.history.replaceState({ ...(window.history.state ?? {}), fulbitoTab: activeRef.current }, "", window.location.href);

    function handlePopState(event: PopStateEvent) {
      const nextTab = event.state?.fulbitoTab;
      if (isTabId(nextTab)) {
        activeRef.current = nextTab;
        setActive(nextTab);
        return;
      }
      if (activeRef.current !== "home") {
        window.history.pushState({ ...(window.history.state ?? {}), fulbitoTab: "home" }, "", window.location.href);
        activeRef.current = "home";
        setActive("home");
      }
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
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
  const selectedTeam = selectedTeamId === "__new__"
    ? undefined
    : data.teams.find((team) => team.id === selectedTeamId) ?? (inviteMode && !inferredTeam ? undefined : data.teams[0]);
  const nearbyVenues = useMemo(() => {
    if (!venueLocation) return data.venues;
    return data.venues
      .map((venue) => ({ venue, distance: distanceKm(venueLocation, venue) }))
      .filter((item) => item.distance <= 50 || item.venue.owner_id === data.user?.id)
      .sort((a, b) => a.distance - b.distance)
      .map((item) => item.venue);
  }, [data.user?.id, data.venues, venueLocation]);
  const visibleAdCampaigns = useMemo(() => {
    const now = Date.now();
    return data.adCampaigns.filter((campaign) => {
      if (campaign.status !== "active") return false;
      if (new Date(campaign.starts_at).getTime() > now) return false;
      if (campaign.ends_at && new Date(campaign.ends_at).getTime() < now) return false;
      if (campaign.scope === "national") return true;
      if (!venueLocation) return true;
      if (typeof campaign.latitude !== "number" || typeof campaign.longitude !== "number") return false;
      return distanceKm(venueLocation, {
        id: campaign.id,
        owner_id: null,
        name: campaign.advertiser_name,
        slug: campaign.id,
        neighborhood: "",
        address: null,
        latitude: campaign.latitude,
        longitude: campaign.longitude,
        price_per_hour: 0,
        inscription_fee: 0,
        commission_rate: 0,
        status: "active",
        surface: null,
        open_hours: null
      }) <= campaign.radius_km;
    });
  }, [data.adCampaigns, venueLocation]);
  const sponsorSplashCampaigns = useMemo(() => {
    return visibleAdCampaigns.filter((campaign) => campaign.splash_enabled || ["sponsor_splash", "arena_led", "both"].includes(campaign.placement));
  }, [visibleAdCampaigns]);
  const selectedVenue = nearbyVenues.find((venue) => venue.id === selectedVenueId) ?? nearbyVenues[0];
  const selectedPlayers = data.players.filter((player) => player.team_id === selectedTeam?.id);
  const selectedPlayer = selectedPlayers.find((player) => player.id === selectedPlayerId) ?? null;
  const selectedTeamEnrolledInActiveTournament = Boolean(
    selectedTeam &&
    data.activeTournament &&
    data.tournamentTeams.some((row) => row.tournament_id === data.activeTournament?.id && row.team_id === selectedTeam.id)
  );
  const selectedTeamProActive = Boolean(
    selectedTeam &&
    data.entitlements.some((entitlement) => {
      if (entitlement.plan_code !== "team_pro" || entitlement.target_type !== "team") return false;
      if (entitlement.target_id !== selectedTeam.id) return false;
      return !entitlement.expires_at || new Date(entitlement.expires_at).getTime() > Date.now();
    })
  );
  const groups = useMemo(() => buildClassificationGroups({
    tournament: data.activeTournament,
    tournamentTeams: data.tournamentTeams,
    standings: data.standings,
    teams: data.teams
  }), [data.activeTournament, data.standings, data.teams, data.tournamentTeams]);
  const tournamentMatches = useMemo(() => data.activeTournament ? data.matches.filter((match) => match.tournament_id === data.activeTournament?.id) : data.matches, [data.activeTournament, data.matches]);
  const knockoutRounds = useMemo(() => {
    const bracketSize = getKnockoutBracketSize(data.activeTournament, data.teams.length);
    return bracketSize ? buildKnockoutRoundsBySize(bracketSize) : [];
  }, [data.activeTournament, data.teams.length]);
  const currentFormation = getFormationPreset(formationMode, formationPresetId);
  const selectedSlot = currentFormation.slots[selectedSlotIndex] ?? currentFormation.slots[0];
  const rosterRule = getRosterRule(data.activeTournament?.field_mode);
  const isTeamManager = Boolean(
    data.user &&
    (selectedTeam?.owner_id === data.user.id || effectiveUserRoles.includes("organizer") || effectiveUserRoles.includes("admin"))
  );
  const myTeam = ownedTeam ?? memberTeam ?? selectedTeam;
  const hasCreatedTournament = Boolean(data.user && data.tournaments.some((tournament) => tournament.organizer_id === data.user?.id));
  const canManageSelectedMatchLive = Boolean(
    data.user &&
    selectedMatch &&
    data.activeTournament &&
    selectedMatch.tournament_id === data.activeTournament.id &&
    (data.activeTournament.organizer_id === data.user.id || effectiveUserRoles.includes("admin") || effectiveUserRoles.includes("venue_owner"))
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

  useEffect(() => {
    if (!data.user || inviteMode) return;
    const params = new URLSearchParams(window.location.search);
    const startTarget = params.get("start");
    if (startTarget === "tournament" || window.location.hash === "#pro") {
      activeRef.current = "home";
      setActive("home");
      setFriendlyFocus(false);
      setTournamentFocus(true);
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("fulbito:open-payment-plan", { detail: "tournament_pro" }));
        document.getElementById("pro")?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 140);
    } else if (startTarget === "friendly" || window.location.hash === "#friendly") {
      activeRef.current = "home";
      setActive("home");
      setFriendlyFocus(true);
      setTournamentFocus(false);
      window.setTimeout(() => {
        window.dispatchEvent(new Event("fulbito:open-friendly"));
        document.getElementById("friendly")?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 140);
    } else if (startTarget === "squad") {
      activeRef.current = "squad";
      if (!ownedTeam && !memberTeam) setSelectedTeamId("__new__");
      setActive("squad");
    } else if (startTarget === "venues") {
      activeRef.current = "venues";
      setActive("venues");
      setShowVenueForm(true);
    } else {
      return;
    }
    window.history.replaceState({ ...(window.history.state ?? {}), fulbitoTab: activeRef.current }, "", "/");
  }, [data.user, inviteMode]);

  function openLoginPanel(nextTarget = "/") {
    setLoginNextTarget(nextTarget);
    setActiveTab("home");
    window.setTimeout(() => {
      document.getElementById("login")?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 60);
  }

  function openTournamentStarter() {
    setLoginNextTarget("/?start=tournament#pro");
    setActiveTab("home");
    if (data.user) {
      setFriendlyFocus(false);
      setTournamentFocus(true);
    }
    window.setTimeout(() => {
      const target = data.user ? "pro" : "login";
      if (data.user) window.dispatchEvent(new CustomEvent("fulbito:open-payment-plan", { detail: "tournament_pro" }));
      document.getElementById(target)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 60);
  }

  function openFriendlyStarter() {
    if (!data.user) {
      openLoginPanel("/?start=friendly#friendly");
      return;
    }
    setActiveTab("home");
    setFriendlyFocus(true);
    setTournamentFocus(false);
    window.setTimeout(() => {
      window.dispatchEvent(new Event("fulbito:open-friendly"));
      document.getElementById("friendly")?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
  }

  function openMyTournaments() {
    if (!data.user) {
      openLoginPanel();
      return;
    }
    setActiveTab("home");
    window.setTimeout(() => {
      window.dispatchEvent(new Event("fulbito:open-my-tournaments"));
      document.getElementById("my-tournaments")?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
  }

  const openTeam = useCallback((teamId: string) => {
    setSelectedTeamId(teamId);
    setActiveTab("squad");
  }, [setActiveTab]);

  const openVenue = useCallback((venueId: string) => {
    setSelectedVenueId(venueId);
    setActiveTab("venues");
  }, [setActiveTab]);

  const openMatch = useCallback((match: ArenaMatch) => {
    setSelectedMatchId(match.id);
    setActiveTab("matches");
  }, [setActiveTab]);

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
    const showFriendlyFocus = !inviteMode && Boolean(data.user) && friendlyFocus;
    const showTournamentFocus = !inviteMode && Boolean(data.user) && tournamentFocus && !showFriendlyFocus;
    const showModeFocus = showFriendlyFocus || showTournamentFocus;
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
            <button onClick={() => (data.user ? setActiveTab("squad") : openLoginPanel())} type="button">{playerInviteMode ? "Cargar ficha" : "Cargar equipo"}</button>
          </section>
        ) : null}

        {!inviteMode && friendlyInvite ? (
          <section className="join-tournament-banner join-tournament-banner--friendly">
            <Flag size={20} />
            <div>
              <span>Desafio amistoso</span>
              <strong>{friendlyInvite.homeTeam?.name ?? "Equipo rival"} busca rival</strong>
              <small>{friendlyInvite.field_mode} / {formatDate(friendlyInvite.scheduled_at)}. Entra con tu equipo para aceptar.</small>
            </div>
            <button
              onClick={() => {
                if (!data.user) {
                  openLoginPanel(`/?friendly=${encodeURIComponent(friendlyInvite.invite_code)}#friendly`);
                  return;
                }
                setFriendlyFocus(true);
                window.dispatchEvent(new Event("fulbito:open-friendly"));
              }}
              type="button"
            >
              {data.user ? "Ver desafio" : "Entrar"}
            </button>
          </section>
        ) : null}

        {!inviteMode && data.user && !showModeFocus ? (
          <StartGuidePanel
            data={data}
            hasCreatedTournament={hasCreatedTournament}
            memberTeam={memberTeam}
            myTeam={myTeam}
            onCreateTournament={hasCreatedTournament ? openMyTournaments : openTournamentStarter}
            onLogin={openLoginPanel}
            onOpenSquad={() => {
              if (!ownedTeam && !memberTeam) setSelectedTeamId("__new__");
              setActiveTab("squad");
            }}
            onOpenTeam={openTeam}
            onOpenVenues={() => {
              setActiveTab("venues");
              setShowVenueForm(true);
            }}
            ownedTeam={ownedTeam}
          />
        ) : null}

        {!inviteMode && !data.user && !hasCreatedTournament ? (
          <section className="console-hero-panel console-hero-panel--2026">
            <img alt="" className="hero-mark" src="/assets/icon.svg" />
            <span>Fulbito Arena 2026</span>
            <h1>Tu liga entra en modo juego.</h1>
            <p>Fixture, tabla, plantel y canchas con una experiencia de torneo para futbol amateur.</p>
            <div className="hero-actions">
              <InstallAppButton variant="hero" />
              <button onClick={openTournamentStarter} type="button">Crear torneo</button>
              <button onClick={openFriendlyStarter} type="button">Crear amistoso</button>
              <button onClick={() => setActiveTab("matches")} type="button">Ver fecha</button>
            </div>
          </section>
        ) : null}

        {showTournamentFocus ? (
          <section className="mode-focus-panel mode-focus-panel--tournament">
            <div>
              <span>Modo torneo</span>
              <h2>Crear torneo</h2>
              <p>Configura copa, formato, cantidad de equipos, fechas y comprobante. Cuando Fulbito aprueba el pago, se habilita la invitacion por WhatsApp.</p>
            </div>
            <button onClick={() => setTournamentFocus(false)} type="button">Inicio</button>
          </section>
        ) : null}

        {!inviteMode && !showModeFocus && nextMatch ? (
          <MatchTile liveEvent={liveEventByMatch.get(nextMatch.id)} match={nextMatch} featured onOpen={() => openMatch(nextMatch)} />
        ) : !inviteMode && data.user && !showModeFocus ? (
          <EmptyState icon={<CalendarDays />} title="Tu calendario empieza vacio">
            Crea un torneo, carga tu equipo o espera una invitacion. Cuando haya fixtures reales, aparecen aca.
          </EmptyState>
        ) : null}

        {(!inviteMode || data.user) && !showModeFocus ? (
          <section className="mini-grid">
            <MiniStat icon={<Trophy />} label={data.activeTournament ? formatLabels[data.activeTournament.format] : "Formato"} onClick={() => setActiveTab("league")} value={data.activeTournament?.name ?? "Torneo"} />
            <MiniStat icon={<Users />} label="Equipos" onClick={() => setActiveTab("squad")} value={data.teams.length} />
            <MiniStat icon={<CalendarDays />} label="Partidos" onClick={() => setActiveTab("matches")} value={data.matches.length} />
            <MiniStat icon={<Trophy />} label="Mis torneos" onClick={openMyTournaments} value={data.tournaments.length} />
          </section>
        ) : null}

        {!inviteMode && data.user && !showTournamentFocus ? (
          <FriendlyPanel
            data={data}
            focusMode={showFriendlyFocus}
            focusCode={friendlyCode}
            nearbyVenues={nearbyVenues}
            onCloseFocus={() => setFriendlyFocus(false)}
            onCreateTeam={() => {
              if (!ownedTeam && !memberTeam) setSelectedTeamId("__new__");
              setActiveTab("squad");
            }}
            onOpenTeamPro={() => {
              window.dispatchEvent(new CustomEvent("fulbito:open-payment-plan", { detail: "team_pro" }));
              window.setTimeout(() => document.getElementById("pro")?.scrollIntoView({ block: "center", behavior: "smooth" }), 80);
            }}
            onRequestVenueLocation={requestVenueLocation}
            ownedTeam={ownedTeam}
            venueLocation={venueLocation}
            venueLocationStatus={venueLocationStatus}
          />
        ) : null}

        {!inviteMode && !showModeFocus ? <YouTubeFollowStrip /> : null}

        {!inviteMode && data.user && !showModeFocus ? (
          <DrawLiveTeaser
            data={data}
            onOpenMatches={() => setActiveTab("matches")}
            onOpenTournaments={openMyTournaments}
            tournament={data.activeTournament}
          />
        ) : null}

        {!showModeFocus ? <section className="console-panel">
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
              <button className="join-focus-button" onClick={() => setActiveTab("squad")} type="button">
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
              roles={effectiveUserRoles}
              user={data.user}
            />
          ) : (
            <LoginPanel configured={data.configured} joinCode={joinCode} nextTarget={loginNextTarget} teamCode={inviteTeamCode} tournamentName={data.activeTournament?.name} />
          )}
        </section> : null}
        {!inviteMode ? <PaymentConsole data={data} planCodes={showFriendlyFocus ? ["team_pro", "tournament_pro", "featured_venue"] : showTournamentFocus ? ["tournament_pro"] : undefined} /> : null}
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
    const rankingTeams = data.standings.length ? data.standings : data.teams;
    const tournamentName = data.activeTournament?.name ?? "Liga";
    return (
      <>
        <ScreenHeader eyebrow="Camino a la copa" title={tournamentName}>
          Clasificacion por grupos, tabla automatica y eliminatorias con camino visual hacia la final.
        </ScreenHeader>
        <CompetitionTabs active={leagueView} onChange={setLeagueView} />
        {data.teams.length ? (
          <>
            {leagueView === "classification" ? (
              <>
                <StandingCompact onTeamOpen={openTeam} teams={rankingTeams} />
                <ClassificationTables groups={groups} onTeamOpen={openTeam} tournamentName={tournamentName} />
              </>
            ) : (
              <CompetitionBracket matches={tournamentMatches} onTeamOpen={openTeam} players={data.players} rounds={knockoutRounds} teams={rankingTeams} tournament={data.activeTournament} />
            )}
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
          {data.user ? <PaymentConsole data={data} planCodes={["team_pro"]} /> : null}
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
        {isTeamManager && data.activeTournament && selectedTeamEnrolledInActiveTournament ? (
          <TeamPlayerInvitePanel players={selectedPlayers} rosterRule={rosterRule} team={selectedTeam} teamProActive={selectedTeamProActive} tournament={data.activeTournament} />
        ) : isTeamManager && data.activeTournament ? (
          <section className="player-invite-panel player-invite-panel--locked">
            <div>
              <span>Invitacion bloqueada</span>
              <strong>Primero inscribi {selectedTeam.name}</strong>
              <p>El link de jugadores se habilita cuando este club queda asociado a {data.activeTournament.name}. Asi cada ficha cae en la copa correcta.</p>
            </div>
            <button disabled type="button">Inscribir equipo abajo</button>
          </section>
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
        <TeamCarousel onSelect={setSelectedTeamId} selectedTeamId={selectedTeam.id} teams={data.teams} />
        <TeamProfile
          isManager={isTeamManager}
          players={selectedPlayers}
          rating={selectedTeam ? computeTeamRating(selectedTeam, data.matches, data.friendlyMatches) : undefined}
          team={selectedTeam}
        />
        <section className="player-strip">
          {selectedPlayers.map((player) => {
            const level = playerLevel(player);
            return (
              <button key={player.id} onClick={() => setSelectedPlayerId(player.id)} type="button">
                <PlayerAvatar player={player} />
                <div>
                  <strong>{player.display_name}</strong>
                  <span>#{player.jersey_number ?? "-"} / {player.position ?? "Posicion"} / {player.goals} goles / {level.rating} {level.tier}</span>
                </div>
                <Activity size={16} />
              </button>
            );
          })}
        </section>
        {isTeamManager ? <ArenaActions data={data} mode="squad" selectedTeamId={selectedTeam?.id} /> : null}
        {data.user && isTeamManager ? <PaymentConsole data={data} planCodes={["team_pro"]} /> : null}
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
            {venueLocation ? "Actualizar ubicacion" : "Usar mi ubicacion"}
          </button>
          <span>{venueLocationStatus}</span>
        </section>
        <section className="venues-marketplace">
          <header>
            <span>Sedes activas</span>
            <strong>{venueLocation ? `${nearbyVenues.length} a 50 km` : "Primero ubicate"}</strong>
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
        <section className="venue-register-panel">
          <button aria-expanded={showVenueForm} onClick={() => setShowVenueForm((current) => !current)} type="button">
            <span>
              <MapPinned size={18} />
              Registrar una cancha
            </span>
            <ChevronDown className={showVenueForm ? "is-open" : ""} size={18} />
          </button>
          {showVenueForm ? <ArenaActions data={data} mode="venue" /> : (
            <p>Cuando quieras sumar una sede, abri este panel. Vas a marcar el punto en el mapa, completar precio, contacto y foto.</p>
          )}
        </section>
        <section className="console-panel money-console">
          <MiniStat icon={<Route />} label="Sedes cercanas" onClick={() => setActiveTab("venues")} value={nearbyVenues.length} />
          <MiniStat icon={<MapPinned />} label="Registro simple" onClick={() => setShowVenueForm(true)} value="Gratis" />
          <MiniStat icon={<Crown />} label="Cancha Pro" onClick={() => {
            setShowVenueForm(true);
            window.setTimeout(() => window.dispatchEvent(new CustomEvent("fulbito:open-payment-plan", { detail: "featured_venue" })), 80);
          }} value="Destacar" />
        </section>
        {data.user ? <PaymentConsole data={data} planCodes={["featured_venue"]} /> : null}
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
      <SponsorSplashOverlay campaigns={sponsorSplashCampaigns} enabled={!showSplash} triggerKey={sponsorTriggerKey} userId={data.user?.id} />
      <ArenaAdBoards campaigns={visibleAdCampaigns} />
      <header className="game-topbar">
        <button className="game-brand" onClick={() => setActiveTab("home")} type="button">
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
            <button className={active === item.id ? "is-active" : ""} key={item.id} onClick={() => setActiveTab(item.id)} type="button">
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

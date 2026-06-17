"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
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
  Repeat2,
  Save,
  Shield,
  ShieldCheck,
  Share2,
  Star,
  Trophy,
  UserCheck,
  UserMinus,
  Users,
  X
} from "lucide-react";
import { ArenaActions } from "@/components/arena-actions";
import { InstallAppButton } from "@/components/install-app-button";
import { LoginPanel } from "@/components/login-panel";
import { PaymentConsole } from "@/components/payment-console";
import { VenueMap } from "@/components/venue-map";
import { isSponsorSoundVariant } from "@/lib/ad-sounds";
import { buildTournamentDraw, type DrawResult } from "@/lib/draw";
import { storedImageFrameCssVars, storedImageFrameShape, storedImageFrameTransform, type StoredImageFrameShape } from "@/lib/image-frame";
import { roleCatalog } from "@/lib/demo";
import { getRosterRule } from "@/lib/roster";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getKnockoutBracketSize } from "@/lib/tournament-structure";
import type { AccountEntitlement, AdCampaign, AppRole, ArenaData, ArenaMatch, ArenaPlayer, ArenaTeam, ArenaTournament, ArenaTournamentDraw, ArenaTournamentTeam, ArenaVenue, FieldMode, FriendlyMatch, LiveStreamEvent, LiveStreamMode, PaymentRequest, UserNotification } from "@/lib/types";
import { primaryVenuePrice, venueSurfaceSummary, venueSurfacesFromStored } from "@/lib/venue-options";

type TabId = "home" | "matches" | "league" | "squad" | "venues";
type LeagueView = "classification" | "bracket";
type CupTier = "local" | "regional" | "provincial" | "world";
type StartJourneyId = "organizer" | "captain" | "player" | "venue";
type SquadPanel = "field" | "formation" | "bench" | "invite" | "edit";
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

function venuePriceSummary(venue: ArenaVenue) {
  const modes = venueSurfacesFromStored(venue.field_modes, venue.surface);
  const prices = venue.format_prices ?? {};
  const pricedModes = modes
    .map((mode) => {
      const value = Number(prices[mode] || 0);
      return value > 0 ? `${mode.replace("v", " vs ")} ${money(value)}` : null;
    })
    .filter(Boolean);
  if (pricedModes.length) return pricedModes.join(" / ");
  const fallbackPrice = primaryVenuePrice(prices, modes) || venue.price_per_hour || 0;
  return fallbackPrice > 0 ? money(fallbackPrice) : "Consultar";
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

function venueMapsUrl(venue?: ArenaVenue | null) {
  if (!venue) return "";
  if (typeof venue.latitude === "number" && typeof venue.longitude === "number") {
    return `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`;
  }
  const query = [venue.name, venue.address, venue.neighborhood].filter(Boolean).join(", ");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
}

function venueGallery(venue: ArenaVenue) {
  const gallery = venue.gallery_urls?.filter(Boolean) ?? [];
  if (gallery.length) return gallery.slice(0, 5);
  const fallback = venueHeroImage(venue);
  return fallback ? [fallback] : [];
}

function venueHeroImage(venue: ArenaVenue) {
  return venue.hero_url || venue.cover_url || venue.gallery_urls?.[0] || venue.card_url || venue.logo_url || "";
}

function venueCardImage(venue: ArenaVenue) {
  return venue.card_url || venue.logo_url || venue.cover_url || venue.gallery_urls?.[0] || "";
}

function venueLogoImage(venue: ArenaVenue) {
  return venue.logo_url || venue.marker_url || venue.card_url || venue.cover_url || venue.gallery_urls?.[0] || "";
}

function teamBadgeImage(team?: ArenaTeam | null) {
  return team?.badge_icon_url || team?.badge_url || team?.badge_card_url || "";
}

function teamBadgeCardImage(team?: ArenaTeam | null) {
  return team?.badge_card_url || team?.badge_icon_url || team?.badge_url || "";
}

function playerAvatarImage(player?: ArenaPlayer | null) {
  return player?.avatar_url || player?.photo_url || player?.card_photo_url || "";
}

function playerCardImage(player?: ArenaPlayer | null) {
  return player?.card_photo_url || player?.photo_url || player?.avatar_url || "";
}

function venueIsPro(venue: ArenaVenue) {
  return Boolean(venueGallery(venue).length || venue.price_per_hour > 0 || ["verified", "pending_pro"].includes(venue.status));
}

function venueAddressLine(venue: ArenaVenue) {
  return [venue.address, venue.neighborhood].filter(Boolean).join(" / ") || "Domicilio pendiente";
}

function venuePhoneLabel(venue: ArenaVenue) {
  return venue.phone?.replace(/\s+/g, " ").trim() || "WhatsApp a cargar";
}

function venueModePriceItems(venue: ArenaVenue) {
  const modes = venueSurfacesFromStored(venue.field_modes, venue.surface);
  const prices = venue.format_prices ?? {};
  return modes.map((mode) => {
    const value = Number(prices[mode] || 0);
    return {
      mode,
      label: mode.replace("v", " vs "),
      price: value > 0 ? money(value) : venue.price_per_hour > 0 ? money(venue.price_per_hour) : "Consultar"
    };
  });
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
  const nextTeams = teams.map((team) => ({ ...team, badge_url: teamBadgeCardImage(team) || team.badge_url }));
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
  const badgeUrl = teamBadgeImage(team);
  return (
    <span
      className={`team-crest ${size === "large" ? "team-crest--large" : ""}`}
      data-frame-shape={storedImageFrameShape(team?.badge_frame, "shield")}
      style={{ "--crest": team?.primary_color ?? "#eec15c", ...storedImageFrameCssVars(team?.badge_frame, "shield") } as CSSProperties}
    >
      {badgeUrl ? <img alt="" src={badgeUrl} /> : <b>{team?.short_name ?? "FC"}</b>}
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

function playerPositionCode(player: ArenaPlayer) {
  const position = (player.position ?? "").toLowerCase();
  if (position.includes("arquero") || position.includes("arq")) return "ARQ";
  if (position.includes("def")) return "DEF";
  if (position.includes("vol") || position.includes("med")) return "MED";
  if (position.includes("del") || position.includes("ata")) return "DEL";
  return "JUG";
}

function playerGameStats(player: ArenaPlayer, team?: ArenaTeam) {
  const rating = getPlayerRating(player, team);
  const played = team?.played ?? 0;
  const goals = player.goals ?? 0;
  const cards = (player.yellow_cards ?? 0) + (player.red_cards ?? 0) * 2;
  const position = playerPositionCode(player);
  return [
    { label: "VEL", value: Math.max(42, Math.min(99, rating - 4 + Math.min(played, 8))) },
    { label: "GOL", value: Math.max(38, Math.min(99, 58 + Math.min(goals * 7, 35))) },
    { label: "PAS", value: Math.max(44, Math.min(96, rating - 2 + (position === "MED" ? 6 : 0))) },
    { label: "REG", value: Math.max(45, Math.min(97, rating + (position === "DEL" ? 3 : 0))) },
    { label: "DEF", value: Math.max(35, Math.min(96, rating - 14 + (position === "DEF" || position === "ARQ" ? 14 : 0))) },
    { label: "FIS", value: Math.max(45, Math.min(97, rating - cards * 3 + Math.min(played, 6))) }
  ];
}

function shareFileName(value: string) {
  const slug = slugify(value || "jugador");
  return slug ? `fulbito-card-${slug}.webp` : "fulbito-card.webp";
}

function teamLineupFileName(value: string) {
  const slug = slugify(value || "equipo");
  return slug ? `fulbito-plantel-${slug}.webp` : "fulbito-plantel.webp";
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function frameShapePath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, shape: StoredImageFrameShape) {
  ctx.beginPath();
  if (shape === "circle") {
    ctx.arc(x + width / 2, y + height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
  } else if (shape === "shield") {
    ctx.moveTo(x + width * 0.5, y + height * 0.015);
    ctx.lineTo(x + width * 0.88, y + height * 0.12);
    ctx.lineTo(x + width * 0.98, y + height * 0.43);
    ctx.lineTo(x + width * 0.78, y + height * 0.78);
    ctx.lineTo(x + width * 0.5, y + height * 0.99);
    ctx.lineTo(x + width * 0.22, y + height * 0.78);
    ctx.lineTo(x + width * 0.02, y + height * 0.43);
    ctx.lineTo(x + width * 0.12, y + height * 0.12);
  } else if (shape === "hex") {
    ctx.moveTo(x + width * 0.5, y);
    ctx.lineTo(x + width * 0.94, y + height * 0.25);
    ctx.lineTo(x + width * 0.94, y + height * 0.75);
    ctx.lineTo(x + width * 0.5, y + height);
    ctx.lineTo(x + width * 0.06, y + height * 0.75);
    ctx.lineTo(x + width * 0.06, y + height * 0.25);
  } else {
    roundRectPath(ctx, x, y, width, height, Math.min(width, height) * 0.18);
    return;
  }
  ctx.closePath();
}

function drawCoverImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawContainImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawFramedBadge(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, frame: unknown) {
  const transform = storedImageFrameTransform(frame, "shield");
  const padding = Math.max(4, Math.min(width, height) * 0.08);
  const imageX = x + padding;
  const imageY = y + padding;
  const imageWidth = width - padding * 2;
  const imageHeight = height - padding * 2;
  const ratio = Math.min(imageWidth / image.naturalWidth, imageHeight / image.naturalHeight) * transform.zoom;
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  const drawX = imageX + (imageWidth - drawWidth) / 2 + transform.offsetX * imageWidth;
  const drawY = imageY + (imageHeight - drawHeight) / 2 + transform.offsetY * imageHeight;
  ctx.save();
  frameShapePath(ctx, x, y, width, height, transform.shape);
  ctx.clip();
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

async function createPlayerCardShareFile(player: ArenaPlayer, team?: ArenaTeam) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 1260;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar la carta.");

  const rating = getPlayerRating(player, team);
  const stars = getPlayerStars(rating);
  const status = getPlayerStatus(player);
  const positionCode = playerPositionCode(player);
  const portraitUrl = playerCardImage(player);
  const badgeUrl = teamBadgeCardImage(team);
  const [portrait, badge] = await Promise.all([loadCanvasImage(portraitUrl), loadCanvasImage(badgeUrl)]);

  const bg = ctx.createLinearGradient(0, 0, 900, 1260);
  bg.addColorStop(0, "#0b2d63");
  bg.addColorStop(.46, "#071a46");
  bg.addColorStop(1, status === "Suspendido" ? "#331425" : "#04131f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 900, 1260);

  ctx.globalAlpha = .5;
  ctx.strokeStyle = "#5bf5ff";
  ctx.lineWidth = 2;
  for (let x = -220; x < 920; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 420, 1260);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const frame = ctx.createLinearGradient(0, 0, 900, 1260);
  frame.addColorStop(0, "#fff1a7");
  frame.addColorStop(.5, "#c99025");
  frame.addColorStop(1, "#5bf5ff");
  ctx.strokeStyle = frame;
  ctx.lineWidth = 12;
  roundRectPath(ctx, 48, 46, 804, 1168, 72);
  ctx.stroke();

  const inner = ctx.createLinearGradient(80, 130, 820, 1100);
  inner.addColorStop(0, "rgba(255,255,255,.16)");
  inner.addColorStop(.6, "rgba(255,255,255,.04)");
  inner.addColorStop(1, "rgba(0,0,0,.28)");
  ctx.fillStyle = inner;
  roundRectPath(ctx, 86, 108, 728, 1044, 42);
  ctx.fill();

  ctx.fillStyle = "#ffdf6f";
  ctx.font = "900 104px Arial";
  ctx.fillText(String(rating), 104, 178);
  ctx.font = "900 42px Arial";
  ctx.fillText(positionCode, 116, 228);
  ctx.font = "800 30px Arial";
  ctx.fillStyle = "rgba(255,255,255,.84)";
  ctx.fillText(`#${player.jersey_number ?? "--"}`, 116, 268);

  if (badge) {
    drawFramedBadge(ctx, badge, 706, 126, 96, 96, team?.badge_frame);
  }
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.font = "900 30px Arial";
  ctx.textAlign = "right";
  ctx.fillText(team?.short_name ?? "FA", 804, 266);
  ctx.textAlign = "left";

  const portraitBox = { x: 252, y: 238, width: 396, height: 430 };
  ctx.save();
  roundRectPath(ctx, portraitBox.x, portraitBox.y, portraitBox.width, portraitBox.height, 42);
  ctx.clip();
  if (portrait) {
    drawCoverImage(ctx, portrait, portraitBox.x, portraitBox.y, portraitBox.width, portraitBox.height);
  } else {
    const avatarBg = ctx.createLinearGradient(portraitBox.x, portraitBox.y, portraitBox.x + portraitBox.width, portraitBox.y + portraitBox.height);
    avatarBg.addColorStop(0, "#103d5d");
    avatarBg.addColorStop(1, "#0d1222");
    ctx.fillStyle = avatarBg;
    ctx.fillRect(portraitBox.x, portraitBox.y, portraitBox.width, portraitBox.height);
    ctx.fillStyle = "#ffdf6f";
    ctx.font = "900 110px Arial";
    ctx.textAlign = "center";
    ctx.fillText(getPlayerInitials(player), portraitBox.x + portraitBox.width / 2, portraitBox.y + 252);
    ctx.textAlign = "left";
  }
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffdf6f";
  ctx.font = "900 82px Arial";
  ctx.fillText((player.alias || player.display_name).toUpperCase().slice(0, 16), 450, 765);
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.font = "800 32px Arial";
  ctx.fillText(`${player.display_name} / ${player.position ?? "Posicion"}`.slice(0, 34), 450, 814);
  ctx.fillStyle = "#ffdf6f";
  ctx.font = "900 38px Arial";
  ctx.fillText(`${stars}/5 estrellas`, 450, 872);
  ctx.textAlign = "left";

  const stats = playerGameStats(player, team);
  ctx.strokeStyle = "rgba(255,223,111,.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(140, 910);
  ctx.lineTo(760, 910);
  ctx.stroke();
  ctx.font = "900 44px Arial";
  stats.forEach((stat, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = 166 + column * 240;
    const y = 978 + row * 92;
    ctx.fillStyle = "#ffdf6f";
    ctx.fillText(stat.label, x, y);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(stat.value), x + 92, y);
  });

  ctx.fillStyle = "rgba(255,255,255,.86)";
  ctx.font = "800 30px Arial";
  ctx.fillText(`Goles ${player.goals ?? 0}`, 150, 1160);
  ctx.fillText(`PJ ${team?.played ?? 0}`, 360, 1160);
  ctx.fillText(status, 540, 1160);
  ctx.fillStyle = "#ffdf6f";
  ctx.font = "900 24px Arial";
  ctx.textAlign = "center";
  ctx.fillText("FULBITO ARENA", 450, 1210);

  const blob = await canvasToBlob(canvas, "image/webp", .9) ?? await canvasToBlob(canvas, "image/png");
  if (!blob) throw new Error("No se pudo generar la imagen.");
  return new File([blob], shareFileName(player.alias || player.display_name), { type: blob.type || "image/webp" });
}

async function createTeamLineupShareFile(
  team: ArenaTeam,
  slots: FormationSlot[],
  players: Array<ArenaPlayer | null>,
  benchPlayers: ArenaPlayer[],
  mode: FieldMode,
  preset: FormationPreset
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1520;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar la plantilla.");

  const badgeUrl = teamBadgeCardImage(team);
  const badge = await loadCanvasImage(badgeUrl);
  const starterImages = await Promise.all(players.map((player) => loadCanvasImage(playerAvatarImage(player) || playerCardImage(player))));
  const bench = benchPlayers.slice(0, 8);
  const benchImages = await Promise.all(bench.map((player) => loadCanvasImage(playerAvatarImage(player) || playerCardImage(player))));

  const bg = ctx.createLinearGradient(0, 0, 1080, 1520);
  bg.addColorStop(0, "#061b2c");
  bg.addColorStop(.48, "#07121f");
  bg.addColorStop(1, "#02060b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1520);

  ctx.globalAlpha = .36;
  ctx.fillStyle = "#132a40";
  for (let x = -80; x < 1160; x += 92) {
    ctx.fillRect(x, 0, 18, 1520);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#ffdf6f";
  ctx.font = "900 34px Arial";
  ctx.fillText("FULBITO ARENA", 70, 82);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 78px Arial";
  ctx.fillText(team.name.toUpperCase().slice(0, 19), 70, 166);
  ctx.fillStyle = "rgba(255,255,255,.76)";
  ctx.font = "800 30px Arial";
  ctx.fillText(`${mode} / ${preset.shape} / ${players.filter(Boolean).length} titulares`, 72, 216);

  if (badge) {
    drawFramedBadge(ctx, badge, 884, 48, 126, 126, team.badge_frame);
  }

  const pitch = { x: 70, y: 270, width: 940, height: 830 };
  const pitchBg = ctx.createLinearGradient(pitch.x, pitch.y, pitch.x + pitch.width, pitch.y + pitch.height);
  pitchBg.addColorStop(0, "#0aa65e");
  pitchBg.addColorStop(.5, "#08763f");
  pitchBg.addColorStop(1, "#0ab56b");
  ctx.fillStyle = pitchBg;
  roundRectPath(ctx, pitch.x, pitch.y, pitch.width, pitch.height, 42);
  ctx.fill();
  ctx.save();
  roundRectPath(ctx, pitch.x, pitch.y, pitch.width, pitch.height, 42);
  ctx.clip();
  ctx.globalAlpha = .42;
  ctx.fillStyle = "#053b22";
  for (let x = pitch.x; x < pitch.x + pitch.width; x += pitch.width / 7) {
    ctx.fillRect(x, pitch.y, pitch.width / 14, pitch.height);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255,255,255,.55)";
  ctx.lineWidth = 5;
  ctx.strokeRect(pitch.x + 50, pitch.y + 50, pitch.width - 100, pitch.height - 100);
  ctx.beginPath();
  ctx.moveTo(pitch.x + pitch.width / 2, pitch.y + 50);
  ctx.lineTo(pitch.x + pitch.width / 2, pitch.y + pitch.height - 50);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(pitch.x + pitch.width / 2, pitch.y + pitch.height / 2, 92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(pitch.x + pitch.width / 2 - 190, pitch.y + 50, 380, 104);
  ctx.strokeRect(pitch.x + pitch.width / 2 - 190, pitch.y + pitch.height - 154, 380, 104);
  ctx.restore();

  const renderCtx = ctx;
  function drawPlayer(player: ArenaPlayer | null, image: HTMLImageElement | null, x: number, y: number, small = false) {
    const ctx = renderCtx;
    const size = small ? 66 : 78;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.48)";
    ctx.shadowBlur = 16;
    ctx.fillStyle = player ? "rgba(4, 12, 22, .88)" : "rgba(5, 12, 19, .74)";
    roundRectPath(ctx, x - size / 2 - 8, y - size / 2 - 8, size + 16, size + 18, 20);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = player ? "#ffdf6f" : "rgba(255,255,255,.24)";
    ctx.lineWidth = 4;
    roundRectPath(ctx, x - size / 2, y - size / 2, size, size, 18);
    ctx.stroke();
    roundRectPath(ctx, x - size / 2, y - size / 2, size, size, 18);
    ctx.clip();
    if (image) {
      drawCoverImage(ctx, image, x - size / 2, y - size / 2, size, size);
    } else {
      ctx.fillStyle = player ? "#102d42" : "#17202b";
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
      ctx.fillStyle = "#ffdf6f";
      ctx.font = `900 ${small ? 22 : 26}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText(player ? getPlayerInitials(player) : "FA", x, y + 8);
    }
    ctx.restore();
    if (!player) return;
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffdf6f";
    ctx.font = `900 ${small ? 22 : 26}px Arial`;
    ctx.fillText(String(player.jersey_number ?? "--"), x, y + size / 2 + 30);
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 ${small ? 20 : 24}px Arial`;
    ctx.fillText((player.alias || player.display_name).slice(0, 11), x, y + size / 2 + 58);
    ctx.textAlign = "left";
  }

  slots.forEach((slot, index) => {
    const player = players[index] ?? null;
    const x = pitch.x + (slot.x / 100) * pitch.width;
    const y = pitch.y + (slot.y / 100) * pitch.height;
    drawPlayer(player, starterImages[index], x, y);
  });

  ctx.fillStyle = "rgba(2, 7, 14, .78)";
  roundRectPath(ctx, 70, 1160, 940, 250, 34);
  ctx.fill();
  ctx.fillStyle = "#ffdf6f";
  ctx.font = "900 30px Arial";
  ctx.fillText("SUPLENTES", 110, 1210);
  if (bench.length) {
    bench.forEach((player, index) => {
      const x = 145 + (index % 4) * 250;
      const y = 1280 + Math.floor(index / 4) * 104;
      drawPlayer(player, benchImages[index], x, y, true);
    });
  } else {
    ctx.fillStyle = "rgba(255,255,255,.68)";
    ctx.font = "800 30px Arial";
    ctx.fillText("Banco sin jugadores cargados", 110, 1286);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.font = "800 26px Arial";
  ctx.fillText("Plantilla generada en Fulbito Arena", 540, 1460);
  ctx.textAlign = "left";

  const blob = await canvasToBlob(canvas, "image/webp", .88) ?? await canvasToBlob(canvas, "image/png");
  if (!blob) throw new Error("No se pudo generar la plantilla.");
  return new File([blob], teamLineupFileName(team.name), { type: blob.type || "image/webp" });
}

function PlayerAvatar({ player }: { player?: ArenaPlayer | null }) {
  const initials = getPlayerInitials(player);
  const avatarUrl = playerAvatarImage(player);

  return (
    <span className="player-disc">
      {avatarUrl ? <img alt="" src={avatarUrl} /> : initials}
    </span>
  );
}

function PlayerCardModal({
  canManage = false,
  onChangePlayer,
  onClose,
  player,
  team
}: {
  canManage?: boolean;
  onChangePlayer?: (playerId: string) => void;
  onClose: () => void;
  player: ArenaPlayer;
  team?: ArenaTeam;
}) {
  const rating = getPlayerRating(player, team);
  const stars = getPlayerStars(rating);
  const status = getPlayerStatus(player);
  const played = team?.played ?? 0;
  const initials = getPlayerInitials(player);
  const portraitUrl = playerCardImage(player);
  const positionCode = playerPositionCode(player);
  const gameStats = playerGameStats(player, team);
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [onClose]);

  async function createShareFile() {
    setShareMessage("Generando imagen WebP...");
    return createPlayerCardShareFile(player, team);
  }

  function downloadFile(file: File) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  async function shareCard() {
    const shareTitle = `${player.alias || player.display_name} en Fulbito Arena`;
    const shareText = `${player.alias || player.display_name} | ${rating} OVR ${positionCode} | ${team?.name ?? "Fulbito Arena"}`;
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    try {
      const file = await createShareFile();
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: shareTitle, text: shareText, files: [file] });
        setShareMessage("Imagen de la carta compartida.");
        return;
      }
      downloadFile(file);
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`.trim());
      setShareMessage("Carta descargada y texto copiado.");
    } catch {
      setShareMessage("No se pudo compartir la imagen. Proba descargarla nuevamente.");
    }
    window.setTimeout(() => setShareMessage(""), 2200);
  }

  async function downloadCard() {
    try {
      const file = await createShareFile();
      downloadFile(file);
      setShareMessage("Carta descargada en WebP.");
    } catch {
      setShareMessage("No se pudo descargar la carta.");
    }
    window.setTimeout(() => setShareMessage(""), 2200);
  }

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
      <article className={`player-ultimate-card player-ultimate-card--${status.toLowerCase()}`}>
        <button aria-label="Cerrar ficha del jugador" className="player-card-close" onClick={onClose} type="button">
          <X size={18} />
        </button>
        <div className="player-card-edition">Fulbito Ultimate</div>
        <header className="player-card-top">
          <div className="player-card-rating">
            <strong>{rating}</strong>
            <span>{positionCode}</span>
            <small>#{player.jersey_number ?? "--"}</small>
          </div>
          <div className="player-card-club">
            <TeamCrest team={team} />
            <span>{team?.short_name ?? "FA"}</span>
          </div>
        </header>
        <div className="player-card-art">
          <span className="player-card-art__flare" />
          <div className="player-card-portrait">
            {portraitUrl ? <img alt="" src={portraitUrl} /> : <span>{initials}</span>}
          </div>
        </div>
        <section className="player-card-name">
          <h2 id="player-card-title">{player.alias || player.display_name}</h2>
          <span>{player.display_name} / {player.position ?? "Posicion"}</span>
        </section>
        <div className="player-card-stars" aria-label={`${stars} estrellas`}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Star className={index < stars ? "is-active" : ""} fill="currentColor" key={index} size={17} />
          ))}
        </div>
        <div className="player-card-actions">
          <button className="player-card-share" onClick={shareCard} type="button">
            <Share2 size={15} />
            Compartir imagen
          </button>
          <button className="player-card-share player-card-share--secondary" onClick={downloadCard} type="button">
            <Download size={15} />
            Descargar
          </button>
          {canManage && onChangePlayer ? (
            <button
              className="player-card-share player-card-share--change"
              onClick={() => {
                onChangePlayer(player.id);
                onClose();
              }}
              type="button"
            >
              <Repeat2 size={15} />
              Cambiar
            </button>
          ) : null}
        </div>
        {shareMessage ? <p className="player-card-share-message">{shareMessage}</p> : null}
        <dl className="player-card-stats-grid">
          {gameStats.map((item) => (
            <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
          ))}
        </dl>
        <dl className="player-card-metrics">
          <div><dt>Goles</dt><dd>{player.goals}</dd></div>
          <div><dt>PJ</dt><dd>{played}</dd></div>
          <div><dt>Estado</dt><dd>{status}</dd></div>
        </dl>
        <footer>
          <BadgeCheck size={17} />
          <span>DT o veedor actualiza goles, tarjetas y estado desde el acta. Foto optimizada en WebP.</span>
        </footer>
      </article>
    </div>
  );
}

function PlayerTacticalCard({
  canManage,
  onChangePlayer,
  onFullCard,
  onOpenFormationTools,
  player,
  slotLabel,
  team
}: {
  canManage: boolean;
  onChangePlayer: (playerId: string) => void;
  onFullCard: (playerId: string) => void;
  onOpenFormationTools: () => void;
  player?: ArenaPlayer | null;
  slotLabel: string;
  team?: ArenaTeam;
}) {
  const [shareMessage, setShareMessage] = useState("");

  if (!player) {
    return (
      <aside className="player-tactical-card player-tactical-card--empty">
        <span className="player-tactical-card__eyebrow">Puesto libre</span>
        <strong>{slotLabel}</strong>
        <p>Toca un jugador cargado para ver su ficha. Si sos creador del club, podes completar este puesto desde Formacion.</p>
        {canManage ? <button onClick={onOpenFormationTools} type="button">Cargar puesto</button> : null}
      </aside>
    );
  }

  const activePlayer = player;
  const rating = getPlayerRating(activePlayer, team);
  const stars = getPlayerStars(rating);
  const status = getPlayerStatus(activePlayer);
  const portraitUrl = playerCardImage(activePlayer) || playerAvatarImage(activePlayer);
  const initials = getPlayerInitials(activePlayer);
  const stats = playerGameStats(activePlayer, team).slice(0, 4);

  async function shareCard() {
    setShareMessage("Generando WebP...");
    try {
      const file = await createPlayerCardShareFile(activePlayer, team);
      const title = `${activePlayer.alias || activePlayer.display_name} en Fulbito Arena`;
      const text = `${activePlayer.alias || activePlayer.display_name} | ${rating} OVR | ${team?.name ?? "Fulbito Arena"}`;
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
        setShareMessage("Carta compartida.");
      } else {
        const url = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1200);
        setShareMessage("Carta descargada.");
      }
    } catch {
      setShareMessage("No se pudo compartir.");
    }
    window.setTimeout(() => setShareMessage(""), 2200);
  }

  return (
    <aside className={`player-tactical-card player-tactical-card--${status.toLowerCase()}`}>
      <div className="player-tactical-card__head">
        <div className="player-tactical-card__photo">
          {portraitUrl ? <img alt="" src={portraitUrl} /> : <span>{initials}</span>}
        </div>
        <div>
          <span className="player-tactical-card__eyebrow">{playerPositionCode(activePlayer)} #{activePlayer.jersey_number ?? "--"}</span>
          <strong>{activePlayer.alias || activePlayer.display_name}</strong>
          <small>{activePlayer.display_name} / {activePlayer.position ?? "Posicion"}</small>
        </div>
        <b>{rating}</b>
      </div>
      <div className="player-tactical-card__stars" aria-label={`${stars} estrellas`}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Star className={index < stars ? "is-active" : ""} fill="currentColor" key={index} size={13} />
        ))}
      </div>
      <dl className="player-tactical-card__stats">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
      <div className="player-tactical-card__meta">
        <span>{activePlayer.goals ?? 0} goles</span>
        <span>{status}</span>
        <span>{team?.short_name ?? "FA"}</span>
      </div>
      <div className="player-tactical-card__actions">
        <button onClick={() => onFullCard(activePlayer.id)} type="button">Ver card</button>
        <button onClick={shareCard} type="button">
          <Share2 size={14} />
          Compartir
        </button>
        {canManage ? (
          <button onClick={() => onChangePlayer(activePlayer.id)} type="button">
            <Repeat2 size={14} />
            Cambiar
          </button>
        ) : null}
      </div>
      {shareMessage ? <p>{shareMessage}</p> : null}
    </aside>
  );
}

function SquadBenchRail({
  benchPlayers,
  canManage,
  inviteHref,
  onOpenPlayer,
  onShareTeam,
  onUseBenchPlayer,
  pendingSwap,
  rosterRule,
  shareMessage
}: {
  benchPlayers: ArenaPlayer[];
  canManage: boolean;
  inviteHref?: string;
  onOpenPlayer: (playerId: string) => void;
  onShareTeam?: () => void;
  onUseBenchPlayer?: (playerId: string) => void;
  pendingSwap?: boolean;
  rosterRule: ReturnType<typeof getRosterRule>;
  shareMessage?: string;
}) {
  return (
    <section className={`squad-bench-rail ${pendingSwap ? "squad-bench-rail--swap" : ""}`}>
      <header>
        <div>
          <span>Suplentes</span>
          <strong>{benchPlayers.length}/{rosterRule.substitutes}</strong>
        </div>
        <small>{pendingSwap ? "Elegi quien entra al campo." : `${rosterRule.label}: ${rosterRule.starters} titulares + ${rosterRule.substitutes} suplentes`}</small>
      </header>
      <div className="squad-bench-rail__actions">
        {onShareTeam ? (
          <button onClick={onShareTeam} type="button">
            <Share2 size={15} />
            Compartir plantilla
          </button>
        ) : null}
        {canManage && inviteHref ? (
          <a href={inviteHref} rel="noreferrer" target="_blank">
            <UserCheck size={15} />
            Invitar jugadores
          </a>
        ) : null}
      </div>
      {shareMessage ? <p className="squad-bench-rail__message">{shareMessage}</p> : null}
      {benchPlayers.length ? (
        <div className="squad-bench-rail__list">
          {benchPlayers.map((player) => (
            <button
              key={player.id}
              onClick={() => {
                if (pendingSwap && canManage && onUseBenchPlayer) {
                  onUseBenchPlayer(player.id);
                  return;
                }
                onOpenPlayer(player.id);
              }}
              type="button"
            >
              <PlayerAvatar player={player} />
              <span>{player.alias || player.display_name}</span>
              <small>#{player.jersey_number ?? "-"} / {playerPositionCode(player)}</small>
            </button>
          ))}
        </div>
      ) : (
        <div className="squad-bench-rail__empty">
          <p>Sin suplentes cargados. El creador puede sumar jugadores para armar el banco.</p>
        </div>
      )}
    </section>
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
    badgeUrl: teamBadgeCardImage(team)
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
            <div
              className="draw-reveal-card__crest"
              data-frame-shape={storedImageFrameShape(currentReveal?.team.badgeFrame, "shield")}
              style={storedImageFrameCssVars(currentReveal?.team.badgeFrame, "shield") as CSSProperties}
            >
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
  const hasLogo = Boolean(campaign.logo_url || isYouTube);
  const ledText = `${campaign.headline} ${campaign.body ?? ""}`.trim();
  const shouldScroll = ledText.length > 24;
  const renderMessage = (suffix: string) => (
    <span className="arena-ad-board__message" key={`${campaign.id}-${suffix}`}>
      <b>{campaign.headline}</b>
      {campaign.body ? <small>{campaign.body}</small> : null}
    </span>
  );
  return (
    <span className={`arena-ad-board arena-ad-board--${targetKind} ${hasLogo ? "arena-ad-board--with-logo" : ""} ${shouldScroll ? "is-marquee" : ""}`}>
      <span className="arena-ad-board__edge" />
      <span className="arena-ad-board__signal" />
      {hasLogo ? (
        <span className="arena-ad-board__icon">
          {campaign.logo_url ? <img alt="" src={campaign.logo_url} /> : <YouTubeLogo size={22} />}
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
      splash_creative_scale: 1,
      splash_creative_animation: "stadium_bounce",
      splash_sound_variant: "stadium_whistle",
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
      splash_creative_scale: 1,
      splash_creative_animation: "stadium_bounce",
      splash_sound_variant: "stadium_whistle",
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

function makeNoiseBuffer(audio: AudioContext, durationSeconds: number, decay = true) {
  const sampleRate = audio.sampleRate;
  const frameCount = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const buffer = audio.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < frameCount; index += 1) {
    const envelope = decay ? 1 - index / frameCount : 1;
    data[index] = (Math.random() * 2 - 1) * envelope;
  }
  return buffer;
}

function connectWithPan(audio: AudioContext, node: AudioNode, destination: AudioNode, pan = 0) {
  if (typeof audio.createStereoPanner === "function") {
    const panner = audio.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), audio.currentTime);
    node.connect(panner);
    panner.connect(destination);
    return;
  }
  node.connect(destination);
}

function addFilteredNoise(
  audio: AudioContext,
  destination: AudioNode,
  startAt: number,
  duration: number,
  peak: number,
  type: BiquadFilterType,
  frequency: number,
  q = 0.7,
  pan = 0,
  decay = false
) {
  const noise = audio.createBufferSource();
  noise.buffer = makeNoiseBuffer(audio, duration, decay);
  const filter = audio.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(frequency, startAt);
  filter.Q.setValueAtTime(q, startAt);
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), startAt + 0.035);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
  noise.connect(filter);
  filter.connect(gain);
  connectWithPan(audio, gain, destination, pan);
  noise.start(startAt);
  noise.stop(startAt + duration);
}

function addCrowdBurst(
  audio: AudioContext,
  destination: AudioNode,
  startAt: number,
  duration = 1.05,
  peak = 0.045,
  pan = 0,
  frequencyStart = 980,
  frequencyEnd = 1420
) {
  const noise = audio.createBufferSource();
  noise.buffer = makeNoiseBuffer(audio, duration, false);
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(frequencyStart, startAt);
  filter.frequency.linearRampToValueAtTime(frequencyEnd, startAt + duration * 0.45);
  filter.Q.setValueAtTime(0.7, startAt);
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
  noise.connect(filter);
  filter.connect(gain);
  connectWithPan(audio, gain, destination, pan);
  noise.start(startAt);
  noise.stop(startAt + duration);
}

function addWhistleTone(audio: AudioContext, destination: AudioNode, startAt: number, peak = 0.075, duration = 0.82) {
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
  connectWithPan(audio, gain, destination, -0.08);

  const main = audio.createOscillator();
  main.type = "sine";
  main.frequency.setValueAtTime(1880, startAt);
  main.frequency.linearRampToValueAtTime(2440, startAt + duration * 0.2);
  main.frequency.linearRampToValueAtTime(2120, startAt + duration * 0.48);
  main.frequency.linearRampToValueAtTime(2580, startAt + duration * 0.74);
  main.connect(gain);
  main.start(startAt);
  main.stop(startAt + duration);

  const vibrato = audio.createOscillator();
  vibrato.type = "sine";
  vibrato.frequency.setValueAtTime(17, startAt);
  const vibratoDepth = audio.createGain();
  vibratoDepth.gain.setValueAtTime(22, startAt);
  vibrato.connect(vibratoDepth);
  vibratoDepth.connect(main.frequency);
  vibrato.start(startAt);
  vibrato.stop(startAt + duration);

  const overtone = audio.createOscillator();
  overtone.type = "triangle";
  overtone.frequency.setValueAtTime(2780, startAt + 0.02);
  overtone.frequency.linearRampToValueAtTime(3260, startAt + duration * 0.26);
  overtone.frequency.linearRampToValueAtTime(2860, startAt + duration * 0.72);
  overtone.connect(gain);
  overtone.start(startAt + 0.02);
  overtone.stop(startAt + Math.max(0.28, duration * 0.86));

  addFilteredNoise(audio, destination, startAt + 0.01, Math.min(0.48, duration * 0.72), peak * 0.28, "highpass", 2700, 0.45, 0.08, true);
}

function addKick(audio: AudioContext, destination: AudioNode, startAt: number) {
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.06, startAt + 0.014);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.28);
  gain.connect(destination);
  const kick = audio.createOscillator();
  kick.type = "sine";
  kick.frequency.setValueAtTime(138, startAt);
  kick.frequency.exponentialRampToValueAtTime(52, startAt + 0.24);
  kick.connect(gain);
  kick.start(startAt);
  kick.stop(startAt + 0.3);
  addFilteredNoise(audio, destination, startAt + 0.002, 0.09, 0.018, "highpass", 1150, 0.42, 0, true);
}

function addStadiumHorn(audio: AudioContext, destination: AudioNode, startAt: number, duration = 0.9, peak = 0.06) {
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
  connectWithPan(audio, gain, destination, -0.12);

  const horn = audio.createOscillator();
  horn.type = "sawtooth";
  horn.frequency.setValueAtTime(172, startAt);
  horn.frequency.linearRampToValueAtTime(196, startAt + duration * 0.26);
  horn.frequency.linearRampToValueAtTime(146, startAt + duration * 0.78);
  horn.connect(gain);
  horn.start(startAt);
  horn.stop(startAt + duration);

  const body = audio.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(86, startAt);
  body.frequency.linearRampToValueAtTime(74, startAt + duration);
  body.connect(gain);
  body.start(startAt);
  body.stop(startAt + duration);
}

function addBrightRiser(audio: AudioContext, destination: AudioNode, startAt: number, duration = 0.72, peak = 0.026) {
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + duration * 0.42);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
  connectWithPan(audio, gain, destination, 0.18);

  const riser = audio.createOscillator();
  riser.type = "triangle";
  riser.frequency.setValueAtTime(520, startAt);
  riser.frequency.exponentialRampToValueAtTime(1680, startAt + duration);
  riser.connect(gain);
  riser.start(startAt);
  riser.stop(startAt + duration);
  addFilteredNoise(audio, destination, startAt, duration, peak * 0.38, "highpass", 2200, 0.55, -0.18, true);
}

function addPulseHits(audio: AudioContext, destination: AudioNode, startAt: number, count = 3, spacing = 0.16) {
  for (let index = 0; index < count; index += 1) {
    const offset = startAt + index * spacing;
    addKick(audio, destination, offset);
    addFilteredNoise(audio, destination, offset + 0.01, 0.08, 0.012, "bandpass", 1850 + index * 260, 0.9, index % 2 ? 0.36 : -0.36, true);
  }
}

function playSponsorSound(variant: AdCampaign["splash_sound_variant"] = "stadium_whistle") {
  const soundVariant = isSponsorSoundVariant(variant) ? variant : "stadium_whistle";
  if (soundVariant === "off") return;
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audio = new AudioContextClass();
    const now = audio.currentTime + 0.02;
    const master = audio.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.86, now + 0.025);
    master.gain.exponentialRampToValueAtTime(0.001, now + 2.65);

    const compressor = audio.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-18, now);
    compressor.knee.setValueAtTime(18, now);
    compressor.ratio.setValueAtTime(5, now);
    compressor.attack.setValueAtTime(0.006, now);
    compressor.release.setValueAtTime(0.18, now);

    const dry = audio.createGain();
    dry.gain.setValueAtTime(0.82, now);
    const delay = audio.createDelay(0.65);
    delay.delayTime.setValueAtTime(0.115, now);
    const wet = audio.createGain();
    wet.gain.setValueAtTime(0.13, now);
    const feedback = audio.createGain();
    feedback.gain.setValueAtTime(0.18, now);

    master.connect(compressor);
    compressor.connect(dry);
    dry.connect(audio.destination);
    compressor.connect(delay);
    delay.connect(wet);
    wet.connect(audio.destination);
    delay.connect(feedback);
    feedback.connect(delay);
    void audio.resume?.();

    if (soundVariant === "crowd_goal") {
      addKick(audio, master, now);
      addCrowdBurst(audio, master, now + 0.04, 1.75, 0.082, -0.55, 720, 1180);
      addCrowdBurst(audio, master, now + 0.11, 1.9, 0.074, 0.48, 1040, 1620);
      addCrowdBurst(audio, master, now + 0.2, 1.55, 0.052, 0.04, 1560, 2200);
      addFilteredNoise(audio, master, now + 0.16, 0.42, 0.02, "highpass", 2600, 0.5, 0.2, true);
    } else if (soundVariant === "double_whistle") {
      addWhistleTone(audio, master, now, 0.07, 0.42);
      addWhistleTone(audio, master, now + 0.29, 0.055, 0.46);
      addFilteredNoise(audio, master, now + 0.1, 0.55, 0.012, "highpass", 2800, 0.45, 0.2, true);
    } else if (soundVariant === "kickoff_hype") {
      addPulseHits(audio, master, now, 3, 0.18);
      addBrightRiser(audio, master, now + 0.06, 0.82, 0.03);
      addCrowdBurst(audio, master, now + 0.22, 1.35, 0.052, -0.42, 860, 1420);
      addCrowdBurst(audio, master, now + 0.36, 1.32, 0.044, 0.44, 1240, 1880);
    } else if (soundVariant === "final_whistle") {
      addWhistleTone(audio, master, now, 0.072, 0.78);
      addWhistleTone(audio, master, now + 0.52, 0.05, 0.58);
      addKick(audio, master, now + 0.14);
      addCrowdBurst(audio, master, now + 0.38, 1.78, 0.07, -0.52, 760, 1320);
      addCrowdBurst(audio, master, now + 0.52, 1.85, 0.064, 0.5, 1120, 1760);
    } else if (soundVariant === "stadium_horn") {
      addStadiumHorn(audio, master, now, 0.92, 0.058);
      addStadiumHorn(audio, master, now + 0.58, 0.72, 0.038);
      addCrowdBurst(audio, master, now + 0.18, 1.45, 0.044, 0.38, 760, 1320);
    } else if (soundVariant === "penalty_alert") {
      addWhistleTone(audio, master, now, 0.076, 0.5);
      addPulseHits(audio, master, now + 0.28, 2, 0.12);
      addFilteredNoise(audio, master, now + 0.08, 0.64, 0.024, "highpass", 3400, 0.72, 0.05, true);
      addCrowdBurst(audio, master, now + 0.42, 0.95, 0.034, -0.36, 980, 1520);
    } else {
      addWhistleTone(audio, master, now, soundVariant === "classic_whistle" ? 0.074 : 0.066, soundVariant === "classic_whistle" ? 0.78 : 0.7);
      if (soundVariant === "stadium_whistle") {
        addKick(audio, master, now + 0.04);
        addWhistleTone(audio, master, now + 0.34, 0.034, 0.36);
        addCrowdBurst(audio, master, now + 0.1, 1.35, 0.044, -0.5, 780, 1320);
        addCrowdBurst(audio, master, now + 0.24, 1.42, 0.038, 0.52, 1240, 1720);
        addFilteredNoise(audio, master, now + 0.42, 0.32, 0.014, "highpass", 3100, 0.55, 0.14, true);
      }
    }

    window.setTimeout(() => void audio.close(), 3200);
  } catch {
    // Browser audio permissions may block automatic sponsor sounds before user interaction.
  }
}

function sponsorCreativeScale(campaign: AdCampaign) {
  const value = Number(campaign.splash_creative_scale ?? 1);
  if (!Number.isFinite(value)) return 1;
  return Math.max(0.55, Math.min(1.55, Math.round(value * 100) / 100));
}

function sponsorCreativeAnimation(campaign: AdCampaign) {
  const value = campaign.splash_creative_animation ?? "stadium_bounce";
  if (["none", "soft_zoom", "stadium_bounce", "pulse_glow", "slide_pan"].includes(value)) return value;
  return "stadium_bounce";
}

type SponsorSplashScene = "yellow_card" | "yellow_match" | "official_ball" | "official_cup" | "match_ready" | "fulbito_tv_fans" | "yellow_card_premium";

const sponsorSplashScenes: SponsorSplashScene[] = ["yellow_card", "yellow_match", "official_ball", "official_cup", "match_ready", "fulbito_tv_fans", "yellow_card_premium"];

function pickSponsorSplashScene(): SponsorSplashScene {
  const fallback = "yellow_card";
  if (typeof window === "undefined") return fallback;
  try {
    const storageKey = "fulbito:sponsor-splash-last-scene";
    const lastScene = window.localStorage.getItem(storageKey) as SponsorSplashScene | null;
    const candidates = sponsorSplashScenes.filter((scene) => scene !== lastScene);
    const nextScene = candidates[Math.floor(Math.random() * candidates.length)] ?? fallback;
    window.localStorage.setItem(storageKey, nextScene);
    return nextScene;
  } catch {
    return sponsorSplashScenes[Math.floor(Math.random() * sponsorSplashScenes.length)] ?? fallback;
  }
}

function sponsorSplashSceneLabel(scene: SponsorSplashScene) {
  if (scene === "yellow_match") return "Tarjeta en cancha";
  if (scene === "official_ball") return "Balon auspiciado";
  if (scene === "official_cup") return "Copa oficial Fulbito";
  if (scene === "match_ready") return "Todo listo para jugar";
  if (scene === "fulbito_tv_fans") return "Fulbito TV en vivo";
  if (scene === "yellow_card_premium") return "Presenta esta jugada";
  return "Tarjeta del arbitro";
}

function sponsorSplashSceneImage(scene: SponsorSplashScene) {
  if (scene === "yellow_match") return "/assets/sponsor-scene-yellow-match.webp";
  if (scene === "official_ball") return "/assets/sponsor-scene-official-ball.webp";
  if (scene === "official_cup") return "/assets/sponsor-scene-official-cup.webp";
  if (scene === "match_ready") return "/assets/sponsor-scene-match-ready.webp";
  if (scene === "fulbito_tv_fans") return "/assets/sponsor-scene-fulbito-tv-fans.webp";
  if (scene === "yellow_card_premium") return "/assets/sponsor-scene-yellow-card-premium.webp";
  return "/assets/sponsor-yellow-card-hand.webp";
}

function SponsorBall3D({ logoUrl, advertiserName }: { logoUrl?: string | null; advertiserName: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    async function mountBall() {
      const mount = mountRef.current;
      if (!mount) return;
      const THREE = await import("three");
      if (cancelled || !mountRef.current) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(0, 0, 4.1);

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      mount.appendChild(renderer.domElement);

      const textureCanvas = document.createElement("canvas");
      textureCanvas.width = 1024;
      textureCanvas.height = 512;
      const texture = new THREE.CanvasTexture(textureCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.anisotropy = 4;

      const drawTexture = (logo?: HTMLImageElement) => {
        const ctx = textureCanvas.getContext("2d");
        if (!ctx) return;
        const width = textureCanvas.width;
        const height = textureCanvas.height;
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, "#f7f1dc");
        gradient.addColorStop(0.18, "#f3d262");
        gradient.addColorStop(0.4, "#10222d");
        gradient.addColorStop(0.62, "#14c7d6");
        gradient.addColorStop(0.82, "#071219");
        gradient.addColorStop(1, "#f3c44e");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.globalAlpha = 0.36;
        ctx.strokeStyle = "#031018";
        ctx.lineWidth = 9;
        for (let x = -160; x < width + 220; x += 170) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.bezierCurveTo(x + 72, 150, x - 28, 330, x + 80, height);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = "#ffe68a";
        ctx.lineWidth = 4;
        for (let y = 70; y < height; y += 118) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.bezierCurveTo(260, y - 46, 650, y + 54, width, y - 10);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        const panels = [
          [512, 256, 118, 0],
          [246, 170, 88, -13],
          [756, 170, 88, 13],
          [260, 342, 82, 18],
          [756, 344, 82, -18],
          [510, 84, 76, 0],
          [508, 430, 76, 0],
          [78, 258, 70, -8],
          [946, 258, 70, 8],
          [400, 250, 62, -22],
          [624, 250, 62, 22]
        ];

        panels.forEach(([cx, cy, size, rotation], index) => {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.beginPath();
          for (let i = 0; i < 6; i += 1) {
            const angle = -Math.PI / 2 + (i * Math.PI * 2) / 6;
            const px = Math.cos(angle) * size;
            const py = Math.sin(angle) * size * 0.82;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fillStyle = index % 3 === 0 ? "rgba(255, 219, 76, .94)" : index % 3 === 1 ? "rgba(2, 15, 22, .92)" : "rgba(22, 210, 220, .82)";
          ctx.fill();
          ctx.lineWidth = Math.max(5, size * 0.07);
          ctx.strokeStyle = "rgba(255, 239, 151, .72)";
          ctx.stroke();
          ctx.clip();
          ctx.globalAlpha = 0.22;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(-size, -size, size * 0.7, size * 2);
          ctx.globalAlpha = 1;
          if (logo) {
            const logoSize = size * 1.18;
            ctx.drawImage(logo, -logoSize / 2, -logoSize / 2, logoSize, logoSize);
          } else {
            ctx.fillStyle = index % 3 === 1 ? "#f4d45d" : "#061018";
            ctx.font = `900 ${Math.max(15, size * 0.25)}px system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("SPONSOR", 0, 0);
          }
          ctx.restore();
        });

        ctx.globalAlpha = 0.18;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(290, 84, 230, 42, -0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        texture.needsUpdate = true;
      };

      drawTexture();
      if (logoUrl) {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.decoding = "async";
        image.onload = () => drawTexture(image);
        image.onerror = () => drawTexture();
        image.src = logoUrl;
      }

      const geometry = new THREE.SphereGeometry(1.18, 96, 64);
      const material = new THREE.MeshPhysicalMaterial({
        map: texture,
        roughness: 0.44,
        metalness: 0.08,
        clearcoat: 0.68,
        clearcoatRoughness: 0.26
      });
      const ball = new THREE.Mesh(geometry, material);
      ball.rotation.set(-0.16, -0.32, 0.08);
      scene.add(ball);

      const rimLight = new THREE.DirectionalLight(0x5df4ff, 2.25);
      rimLight.position.set(-3.2, 2.4, 4);
      scene.add(rimLight);
      const keyLight = new THREE.DirectionalLight(0xffdf84, 2.6);
      keyLight.position.set(3.4, 3.1, 4.8);
      scene.add(keyLight);
      const ambient = new THREE.AmbientLight(0xffffff, 0.9);
      scene.add(ambient);

      const resize = () => {
        const rect = mount.getBoundingClientRect();
        const size = Math.max(180, Math.min(rect.width, rect.height || rect.width));
        renderer.setSize(size, size, false);
        camera.aspect = 1;
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(mount);

      let frame = 0;
      const animate = () => {
        if (cancelled) return;
        frame = window.requestAnimationFrame(animate);
        ball.rotation.y += 0.0105;
        ball.rotation.x = -0.16 + Math.sin(performance.now() * 0.001) * 0.025;
        ball.rotation.z = 0.08 + Math.sin(performance.now() * 0.0008) * 0.018;
        renderer.render(scene, camera);
      };
      animate();

      cleanup = () => {
        cancelled = true;
        window.cancelAnimationFrame(frame);
        observer.disconnect();
        geometry.dispose();
        material.dispose();
        texture.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    }

    void mountBall();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [advertiserName, logoUrl]);

  return <div className="sponsor-splash__ball3d" ref={mountRef} aria-label={`Balon 3D auspiciado por ${advertiserName}`} />;
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
  const [scene, setScene] = useState<SponsorSplashScene>("yellow_card");
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
    setScene(pickSponsorSplashScene());
    setCampaign(eligible);
    setSecondsLeft(Math.max(0, eligible.splash_close_after_seconds ?? 5));
    window.setTimeout(() => playSponsorSound(eligible.splash_sound_variant ?? "stadium_whistle"), 120);
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
  const creativeScale = sponsorCreativeScale(campaign);
  const creativeAnimation = sponsorCreativeAnimation(campaign);
  const creativeStyle = { "--sponsor-creative-scale": creativeScale } as CSSProperties;
  const sceneLabel = sponsorSplashSceneLabel(scene);
  const sceneImageUrl = sponsorSplashSceneImage(scene);
  const isBallSponsorScene = scene === "official_ball";

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
    <section className={`sponsor-splash sponsor-splash--${scene}`} aria-label={`Auspicia Fulbito Arena: ${campaign.advertiser_name}`} aria-modal="true" role="dialog">
      <button className="sponsor-splash__hitbox" onClick={visitSponsor} type="button" aria-label={`Abrir sponsor ${campaign.advertiser_name}`} />
      <span className="sponsor-splash__beam sponsor-splash__beam--left" aria-hidden="true" />
      <span className="sponsor-splash__beam sponsor-splash__beam--right" aria-hidden="true" />
      <article className="sponsor-splash__card">
        <div className="sponsor-splash__match-ribbon">
          <span className="sponsor-splash__eyebrow">Auspicia Fulbito Arena</span>
          <span>Publicidad oficial</span>
        </div>
        <div className={`sponsor-splash__stage sponsor-splash__stage--${scene}`} aria-hidden="true">
          <div className={`sponsor-splash__scene sponsor-splash__scene--${scene}`}>
            <img alt="" className="sponsor-splash__photo" src={sceneImageUrl} />
          </div>
          <span className="sponsor-splash__card-aura" />
          <div className={`sponsor-splash__brand sponsor-splash__brand--${creativeAnimation}`} style={creativeStyle}>
            <span className="sponsor-splash__card-label">Sponsor</span>
            {logoUrl ? <img alt="" src={logoUrl} /> : <Megaphone size={46} />}
            <span className="sponsor-splash__card-footer">Fulbito Arena</span>
          </div>
          {isBallSponsorScene ? <SponsorBall3D logoUrl={logoUrl} advertiserName={campaign.advertiser_name} /> : null}
        </div>
        <div className="sponsor-splash__copy">
          <span className="sponsor-splash__presented">{sceneLabel}</span>
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

function isNotificationVisible(notification: UserNotification) {
  if (notification.status === "dismissed") return false;
  if (!notification.expires_at) return true;
  const expiresAt = new Date(notification.expires_at).getTime();
  return !Number.isFinite(expiresAt) || expiresAt > Date.now();
}

function entitlementDaysRemaining(entitlement: AccountEntitlement) {
  if (!entitlement.expires_at) return null;
  const diff = new Date(entitlement.expires_at).getTime() - Date.now();
  if (!Number.isFinite(diff)) return null;
  return Math.ceil(diff / 86400000);
}

function entitlementNoticeTitle(entitlement: AccountEntitlement) {
  if (entitlement.plan_code === "tournament_pro") return "Torneo Pro";
  if (entitlement.plan_code === "team_pro") return "Equipo Pro";
  if (entitlement.plan_code === "featured_venue") return "Cancha Pro";
  return "Sponsor";
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
  entitlements,
  userNotifications,
  onLogin
}: {
  user: ArenaData["user"];
  configured: boolean;
  team?: ArenaTeam | null;
  activeTournament: ArenaTournament | null;
  paymentRequests: PaymentRequest[];
  entitlements: AccountEntitlement[];
  userNotifications: UserNotification[];
  onLogin: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const ownInitialRequests = useMemo(() => paymentRequests.filter((request) => !user || request.requester_id === user.id), [paymentRequests, user?.id]);
  const [menuRequests, setMenuRequests] = useState(ownInitialRequests);
  const freshRequests = useMemo(() => menuRequests.filter((request) => isFreshNotification(request)), [menuRequests]);
  const visibleUserNotifications = useMemo(() => userNotifications.filter(isNotificationVisible), [userNotifications]);
  const renewalNotices = useMemo(() => {
    if (!user) return [];
    return entitlements
      .filter((entitlement) => entitlement.owner_id === user.id)
      .map((entitlement) => {
        const days = entitlementDaysRemaining(entitlement);
        if (days === null) return null;
        const title = entitlementNoticeTitle(entitlement);
        if (days > 0 && days <= 3) {
          return {
            id: `renewal-${entitlement.id}`,
            status: "pending_review" as PaymentRequest["status"],
            label: "Vence pronto",
            title: `${title} vence en ${days} dia${days === 1 ? "" : "s"}`,
            body: "Podes renovarlo con una promo activa desde la pantalla correspondiente.",
            href: "",
            actionLabel: ""
          };
        }
        if (days <= 0) {
          return {
            id: `expired-${entitlement.id}`,
            status: "rejected" as PaymentRequest["status"],
            label: "Beneficio pausado",
            title: `${title} sin renovar`,
            body: "No se recibio el pago de renovacion. Tus datos quedan guardados, pero los beneficios Pro quedan bloqueados hasta renovar.",
            href: "",
            actionLabel: ""
          };
        }
        return null;
      })
      .filter(Boolean) as Array<{ id: string; status: PaymentRequest["status"]; label: string; title: string; body: string; href: string; actionLabel: string }>;
  }, [entitlements, user]);
  const approvedCount = freshRequests.filter((request) => request.status === "approved").length;
  const pendingCount = freshRequests.filter((request) => request.status === "pending_review").length;
  const userNotificationCount = visibleUserNotifications.filter((notification) => notification.status === "unread").length;
  const latestRequests = freshRequests;
  const approvedTournamentRequests = freshRequests.filter((request) => request.status === "approved" && request.target_type === "tournament");
  const totalNotificationCount = approvedCount + pendingCount + userNotificationCount + renewalNotices.length;

  useEffect(() => {
    if (!user) return;
    setOrigin(window.location.origin);
    const storageKey = `fulbito-approved-count-${user.id}`;
    const previous = Number(window.localStorage.getItem(storageKey) || approvedCount);
    if (approvedCount > previous) playApprovalWhistle();
    window.localStorage.setItem(storageKey, String(approvedCount));
  }, [approvedCount, user]);

  useEffect(() => {
    setMenuRequests(ownInitialRequests);
  }, [ownInitialRequests]);

  useEffect(() => {
    if (!user) return;
    const currentUserId = user.id;
    let mounted = true;

    function handleCreated(event: Event) {
      const request = (event as CustomEvent<PaymentRequest>).detail;
      if (!request) return;
      if (request.requester_id !== currentUserId) return;
      setMenuRequests((current) => [request, ...current.filter((item) => item.id !== request.id)]);
      setNotificationsOpen(true);
      setOpen(false);
    }

    async function refreshRequests() {
      const supabase = createSupabaseBrowserClient();
      const { data: nextRequests } = await supabase
        .from("payment_requests")
        .select("*")
        .eq("requester_id", currentUserId)
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
        className={`top-notification-button ${approvedCount || userNotificationCount ? "is-approved" : pendingCount || renewalNotices.length ? "is-pending" : ""}`}
        onClick={() => {
          setNotificationsOpen((current) => !current);
          setOpen(false);
        }}
        type="button"
      >
        <BellRing size={17} />
        {totalNotificationCount > 0 ? <span>{totalNotificationCount}</span> : null}
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
            <small>{approvedCount ? "Hay beneficios aprobados." : pendingCount ? "Tenes comprobantes en revision." : visibleUserNotifications.length ? "Tenes avisos del administrador." : renewalNotices.length ? "Hay vencimientos para revisar." : "Sin novedades."}</small>
          </header>
          {visibleUserNotifications.length || renewalNotices.length || latestRequests.length ? (
            <div className="notification-list">
              {visibleUserNotifications.map((notification) => (
                <article className={`notification-item notification-item--${notification.priority === "high" ? "approved" : "pending_review"}`} key={notification.id}>
                  <span>{notification.notification_type.replaceAll("_", " ")}</span>
                  <strong>{notification.title}</strong>
                  <small>{notification.body}</small>
                  {notification.action_url ? <a href={notification.action_url}>Abrir</a> : null}
                </article>
              ))}
              {renewalNotices.map((notice) => (
                <article className={`notification-item notification-item--${notice.status}`} key={notice.id}>
                  <span>{notice.label}</span>
                  <strong>{notice.title}</strong>
                  <small>{notice.body}</small>
                </article>
              ))}
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
    <section className="team-carousel" aria-label="Selector de mis equipos">
      <header>
        <span>Mis equipos</span>
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
              <span>{selected ? "Seleccionado" : "Cambiar club"}</span>
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
  const gallery = venueGallery(venue);
  const cardImage = venueCardImage(venue);
  const logoImage = venueLogoImage(venue);
  const ghostImage = venueHeroImage(venue) || cardImage;
  const pro = venueIsPro(venue);
  const modePrices = venueModePriceItems(venue).slice(0, 3);
  return (
    <button className={`venue-row venue-row--button ${pro ? "venue-row--pro" : "venue-row--free"}`} onClick={onOpen} type="button">
      {ghostImage ? <img alt="" className="venue-row__ghost" src={ghostImage} /> : null}
      <span className="venue-row__photo">
        {logoImage ? <img alt="" src={logoImage} /> : <MapPinned size={18} />}
      </span>
      <div className="venue-row__main">
        <span className="venue-row__badge">{pro ? "Cancha partner" : "Sede gratis"}</span>
        <strong>{venue.name}</strong>
        <span>{venueAddressLine(venue)}</span>
        <div className="venue-row__chips">
          {modePrices.map((item) => <i key={item.mode}>{item.label} {item.price}</i>)}
          {venue.phone ? <i>WhatsApp</i> : null}
          {gallery.length ? <i>{gallery.length} fotos</i> : null}
        </div>
      </div>
      <b>{venuePriceSummary(venue)}<small>{venue.price_per_hour ? "por hora" : pro ? "precio pro" : "gratis"}</small></b>
      <ChevronRight size={17} />
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
                      {venue.name}{venue.neighborhood ? ` / ${venue.neighborhood}` : ""} / {venueSurfaceSummary(venue.field_modes, venue.surface)} / {venuePriceSummary(venue)}
                    </option>
                  ))}
                </select>
                {selectedFriendlyVenue ? (
                  <div className="friendly-venue-summary">
                    <div>
                      <strong>{selectedFriendlyVenue.name}</strong>
                      <span>{selectedFriendlyVenue.address ?? selectedFriendlyVenue.neighborhood} / {venueSurfaceSummary(selectedFriendlyVenue.field_modes, selectedFriendlyVenue.surface)} / {venuePriceSummary(selectedFriendlyVenue)}</span>
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
  onEditTeamPhoto,
  onOpenPlayer,
  onSelectSlot,
  onSwapSlots,
  pendingSwapSlotIndex,
  lockedMode = false
}: {
  team?: ArenaTeam;
  players: Array<ArenaPlayer | null>;
  mode: FieldMode;
  preset: FormationPreset;
  presetId: string;
  selectedSlotIndex: number;
  isManager: boolean;
  onModeChange: (mode: FieldMode) => void;
  onPresetChange: (presetId: string) => void;
  onEditTeamPhoto?: () => void;
  onOpenPlayer: (playerId: string, slotIndex: number) => void;
  onSelectSlot: (index: number) => void;
  onSwapSlots?: (fromIndex: number, toIndex: number) => void;
  pendingSwapSlotIndex?: number | null;
  lockedMode?: boolean;
}) {
  const fieldModes = lockedMode ? [mode] : (["5v5", "7v7", "11v11"] as FieldMode[]);

  return (
    <article className="console-panel formation-console">
      <div className="formation-console__head">
        <div>
          {isManager && onEditTeamPhoto ? (
            <button
              aria-label="Editar escudo del club"
              className="team-crest-edit-trigger"
              onClick={onEditTeamPhoto}
              type="button"
            >
              <TeamCrest team={team} size="large" />
              <span>Editar</span>
            </button>
          ) : (
            <TeamCrest team={team} size="large" />
          )}
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
          const canSwapInto = Boolean(isManager && player && selectedSlotIndex !== index && players[selectedSlotIndex]);
          const playerName = player?.display_name ?? "jugador";
          return (
            <button
              className={`formation-slot formation-slot--button ${selected ? "is-selected" : ""} ${canSwapInto ? "is-swap-target" : ""} ${pendingSwapSlotIndex === index ? "is-pending-swap" : ""} ${player ? "is-filled" : "is-empty"}`}
              aria-label={canSwapInto ? `Cambiar posicion con ${playerName}` : player ? `Abrir ficha de ${player.display_name}` : `Cargar ${slot.label} ${index + 1}`}
              key={`${mode}-${slot.label}-${index}`}
              onClick={() => {
                if (canSwapInto && onSwapSlots) {
                  onSwapSlots(selectedSlotIndex, index);
                  return;
                }
                onSelectSlot(index);
                if (player) onOpenPlayer(player.id, index);
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

function buildFormationSlotPlayers(players: ArenaPlayer[], slotOrder: string[], slotCount: number) {
  const byId = new Map(players.map((player) => [player.id, player]));
  const used = new Set<string>();
  return Array.from({ length: slotCount }, (_, index) => {
    const orderedId = slotOrder[index];
    const orderedPlayer = orderedId ? byId.get(orderedId) : null;
    if (orderedPlayer && !used.has(orderedPlayer.id)) {
      used.add(orderedPlayer.id);
      return orderedPlayer;
    }
    const fallback = players.find((player) => !used.has(player.id));
    if (!fallback) return null;
    used.add(fallback.id);
    return fallback;
  });
}

function TeamFormationManager({
  activePanel,
  benchPlayers,
  canEdit,
  inviteHref,
  onAssignSlot,
  onClearSlot,
  onDeletePlayer,
  onOpenPlayer,
  onSaveFormation,
  onSetCaptain,
  onSelectSlot,
  onUseBenchPlayer,
  pendingSwapSlotIndex,
  players,
  rosterRule,
  saveState,
  selectedSlotIndex,
  slots,
  slotPlayers,
  team,
  teamProActive
}: {
  activePanel: Exclude<SquadPanel, "field" | "edit">;
  benchPlayers: ArenaPlayer[];
  canEdit: boolean;
  inviteHref: string;
  onAssignSlot: (slotIndex: number, playerId: string) => void;
  onClearSlot: (slotIndex: number) => void;
  onDeletePlayer: (playerId: string) => Promise<void>;
  onOpenPlayer: (playerId: string) => void;
  onSaveFormation: () => Promise<void>;
  onSetCaptain: (playerId: string) => Promise<void>;
  onSelectSlot: (slotIndex: number) => void;
  onUseBenchPlayer?: (playerId: string) => void;
  pendingSwapSlotIndex?: number | null;
  players: ArenaPlayer[];
  rosterRule: ReturnType<typeof getRosterRule>;
  saveState: string;
  selectedSlotIndex: number;
  slots: FormationSlot[];
  slotPlayers: Array<ArenaPlayer | null>;
  team: ArenaTeam;
  teamProActive: boolean;
}) {
  const [deletingId, setDeletingId] = useState("");
  const [captainSavingId, setCaptainSavingId] = useState("");
  const activeSlotIndex = pendingSwapSlotIndex ?? selectedSlotIndex;
  const selectedSlot = slots[activeSlotIndex] ?? slots[0];
  const selectedPlayer = slotPlayers[activeSlotIndex] ?? null;
  const rosterFull = players.length >= rosterRule.maxPlayers;
  const showFormationTools = activePanel === "formation";
  const showBenchTools = activePanel === "bench";
  const showInviteTools = activePanel === "invite";

  async function deletePlayer(playerId: string) {
    setDeletingId(playerId);
    try {
      await onDeletePlayer(playerId);
    } finally {
      setDeletingId("");
    }
  }

  async function setCaptain(playerId: string) {
    setCaptainSavingId(playerId);
    try {
      await onSetCaptain(playerId);
    } finally {
      setCaptainSavingId("");
    }
  }

  return (
    <section className={`team-formation-manager team-formation-manager--${activePanel} ${canEdit ? "" : "team-formation-manager--readonly"}`}>
      <header>
        <div>
          <span>{showFormationTools ? "Formacion" : showBenchTools ? "Suplentes y cambios" : "Invitar plantel"}</span>
          <strong>{showBenchTools && pendingSwapSlotIndex != null ? `Cambiar ${selectedSlot?.label ?? "puesto"} ${pendingSwapSlotIndex + 1}` : team.name}</strong>
          <small>{players.length}/{rosterRule.maxPlayers} jugadores · {teamProActive ? "Equipo Pro activo" : "Equipo gratis"}</small>
        </div>
        {canEdit && showFormationTools ? (
          <button className="team-save-formation" onClick={onSaveFormation} type="button">
            <Save size={16} />
            {saveState || "Guardar formacion"}
          </button>
        ) : null}
      </header>

      {canEdit && showFormationTools ? (
        <div className={`team-slot-editor ${selectedPlayer ? "team-slot-editor--filled" : "team-slot-editor--empty"}`}>
          <div className="team-slot-editor__summary">
            <PlayerAvatar player={selectedPlayer} />
            <div>
              <span>Puesto seleccionado</span>
              <strong>{selectedSlot?.label ?? "Puesto"} {activeSlotIndex + 1}</strong>
              <small>{selectedPlayer ? `${selectedPlayer.display_name} / #${selectedPlayer.jersey_number ?? "-"}` : "Libre para asignar titular"}</small>
            </div>
          </div>
          <div className="team-slot-editor__actions">
            <select
            aria-label="Asignar jugador al puesto"
            value={selectedPlayer?.id ?? ""}
              onChange={(event) => onAssignSlot(activeSlotIndex, event.target.value)}
          >
            <option value="">Dejar puesto libre</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                #{player.jersey_number ?? "-"} {player.display_name} · {player.position ?? "Posicion"}
              </option>
            ))}
            </select>
            <button onClick={() => onClearSlot(activeSlotIndex)} type="button">Liberar</button>
          </div>
        </div>
      ) : null}

      {showFormationTools ? <div className="team-lineup-grid" aria-label="Titulares">
        {slots.map((slot, index) => {
          const player = slotPlayers[index];
          return (
            <button className={index === selectedSlotIndex ? "is-selected" : ""} key={`${slot.label}-${index}`} onClick={() => onSelectSlot(index)} type="button">
              <PlayerAvatar player={player} />
              <span>{slot.label} {index + 1}</span>
              <strong>{player?.alias || player?.display_name || "Libre"}</strong>
            </button>
          );
        })}
      </div> : null}

      {showBenchTools ? <div className="team-bench-panel">
        <div>
          <strong>Suplentes</strong>
          <span>{benchPlayers.length}/{rosterRule.substitutes}</span>
          {pendingSwapSlotIndex != null ? <p>Elegi un suplente para reemplazar a {selectedPlayer?.alias || selectedPlayer?.display_name || "este titular"}. El titular pasa al banco al guardar.</p> : null}
        </div>
        {benchPlayers.length ? (
          <div className="team-bench-list">
            {benchPlayers.map((player) => (
              <button
                disabled={!canEdit}
                key={player.id}
                onClick={() => {
                  if (pendingSwapSlotIndex != null && onUseBenchPlayer) onUseBenchPlayer(player.id);
                  else onAssignSlot(selectedSlotIndex, player.id);
                }}
                type="button"
              >
                <PlayerAvatar player={player} />
                <span>{player.alias || player.display_name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="team-bench-empty">
            <p>{players.length ? "Sin suplentes cargados." : "Todavia no hay jugadores en el plantel."}</p>
            {canEdit && inviteHref && !rosterFull ? (
              <a href={inviteHref} rel="noreferrer" target="_blank">
                <UserCheck size={15} />
                Invitar jugadores por WhatsApp
              </a>
            ) : null}
          </div>
        )}
      </div> : null}

      {showInviteTools ? (
        <section className="team-invite-console">
          <div>
            <span>Link del plantel</span>
            <strong>{rosterFull ? "Plantel completo" : "Invita jugadores a tu equipo"}</strong>
            <p>
              {rosterFull
                ? `Ya llegaste al limite de ${rosterRule.maxPlayers} jugadores para ${rosterRule.label}.`
                : `El enlace abre la ficha de ${team.name} y respeta el limite de ${rosterRule.starters} titulares + ${rosterRule.substitutes} suplentes.`}
            </p>
          </div>
          {inviteHref && !rosterFull ? (
            <a href={inviteHref} rel="noreferrer" target="_blank">
              <UserCheck size={17} />
              Enviar enlace por WhatsApp
            </a>
          ) : (
            <button disabled type="button">
              <UserCheck size={17} />
              {rosterFull ? "Plantel completo" : "Link no disponible"}
            </button>
          )}
        </section>
      ) : null}

      {showBenchTools ? <div className="team-roster-tools">
        {inviteHref ? (
          <a aria-disabled={rosterFull} className={rosterFull ? "is-disabled" : ""} href={rosterFull ? undefined : inviteHref} rel="noreferrer" target="_blank">
            <UserCheck size={16} />
            {rosterFull ? "Plantel completo" : "Invitar jugadores"}
          </a>
        ) : null}
        <span>{rosterRule.label}: {rosterRule.starters} titulares + {rosterRule.substitutes} suplentes</span>
      </div> : null}

      {(showBenchTools || showInviteTools) ? <details className="team-roster-admin" open={showBenchTools}>
        <summary>{canEdit ? "Editar plantel" : "Ver plantel"}</summary>
        <div>
          {players.map((player) => {
            const canDelete = canEdit && player.profile_id !== team.owner_id;
            return (
              <article key={player.id}>
                <button className="team-roster-admin__player" onClick={() => onOpenPlayer(player.id)} type="button">
                  <PlayerAvatar player={player} />
                  <span>
                    <strong>{player.display_name}</strong>
                    <small>#{player.jersey_number ?? "-"} / {player.position ?? "Posicion"} / {player.goals} goles{player.role === "captain" ? " / Capitan" : ""}</small>
                  </span>
                </button>
                {canEdit ? (
                  <button
                    className={`team-roster-admin__captain ${player.role === "captain" ? "is-active" : ""}`}
                    disabled={player.role === "captain" || captainSavingId === player.id}
                    onClick={() => setCaptain(player.id)}
                    type="button"
                  >
                    {captainSavingId === player.id ? <LoaderCircle className="button-spinner" size={15} /> : <UserCheck size={15} />}
                    {player.role === "captain" ? "Capitan" : "Hacer capitan"}
                  </button>
                ) : null}
                {canDelete ? (
                  <button className="team-roster-admin__delete" disabled={deletingId === player.id} onClick={() => deletePlayer(player.id)} type="button">
                    {deletingId === player.id ? <LoaderCircle className="button-spinner" size={15} /> : <UserMinus size={15} />}
                    Quitar
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      </details> : null}
    </section>
  );
}

function SquadSectionTabs({
  active,
  canEdit,
  onChange
}: {
  active: SquadPanel;
  canEdit: boolean;
  onChange: (panel: SquadPanel) => void;
}) {
  const items: Array<{ id: SquadPanel; label: string; helper: string; icon: ReactNode; managerOnly?: boolean }> = [
    { id: "field", label: "Titulares", helper: "Campo del equipo", icon: <Shield size={16} /> },
    { id: "formation", label: "Formacion", helper: "Guardar esquema", icon: <Save size={16} /> },
    { id: "bench", label: "Suplentes", helper: "Cambios", icon: <Users size={16} /> },
    { id: "invite", label: "Invitar", helper: "Nuevos jugadores", icon: <UserCheck size={16} /> },
    { id: "edit", label: "Editar club", helper: "Escudo y Pro", icon: <ShieldCheck size={16} />, managerOnly: true }
  ];

  return (
    <nav className="squad-section-tabs" aria-label="Menu de equipo">
      {items.filter((item) => !item.managerOnly || canEdit).map((item) => (
        <button className={active === item.id ? "is-active" : ""} key={item.id} onClick={() => onChange(item.id)} type="button">
          {item.icon}
          <span>{item.label}</span>
          <small>{item.helper}</small>
        </button>
      ))}
    </nav>
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
  const gallery = venueGallery(venue);
  const heroImage = venueHeroImage(venue);
  const mapsUrl = venueMapsUrl(venue);
  const pro = venueIsPro(venue);
  const modePrices = venueModePriceItems(venue);
  return (
    <section className={`venue-spotlight ${gallery.length ? "venue-spotlight--with-gallery" : ""} ${pro ? "venue-spotlight--pro" : "venue-spotlight--free"}`} id="venue-spotlight">
      {heroImage ? <img alt="" className="venue-spotlight__backdrop" src={heroImage} /> : null}
      <div className="venue-spotlight__hero" aria-label={`Fotos de ${venue.name}`}>
        {heroImage ? <img alt="" src={heroImage} /> : <MapPinned size={34} />}
        <span>{pro ? "Cancha destacada" : "Sede registrada"}</span>
        {gallery.length > 1 ? (
          <div className="venue-spotlight__thumbs">
            {gallery.slice(0, 5).map((photo, index) => <img alt="" key={`${photo}-${index}`} src={photo} />)}
          </div>
        ) : null}
      </div>
      <div className="venue-spotlight__body">
        <span>{venue.status === "verified" ? "Cancha verificada" : pro ? "Cancha PRO" : "Cancha gratis"}</span>
        <h2>{venue.name}</h2>
        <p>{venueAddressLine(venue)}</p>
        <div className="venue-spotlight__details">
          <small>{venueSurfaceSummary(venue.field_modes, venue.surface)}</small>
          <small>{venue.open_hours ?? "Horario a cargar"}</small>
          <small>{venuePhoneLabel(venue)}</small>
        </div>
        <div className="venue-spotlight__prices">
          {modePrices.map((item) => (
            <span key={item.mode}>
              <b>{item.label}</b>
              <small>{item.price}</small>
            </span>
          ))}
        </div>
      </div>
      <div className="venue-spotlight__cta">
        <strong>{venuePriceSummary(venue)}<small>{venue.price_per_hour ? "por hora" : "precio"}</small></strong>
        <div>
          {whatsappUrl ? <a className="venue-contact-link" href={whatsappUrl} rel="noreferrer" target="_blank">Consultar turno</a> : null}
          {mapsUrl ? <a className="venue-map-link" href={mapsUrl} rel="noreferrer" target="_blank">Abrir en Maps <ExternalLink size={14} /></a> : null}
        </div>
      </div>
    </section>
  );
}

function VenueMapPreview({
  onClose,
  onOpen,
  venue
}: {
  onClose: () => void;
  onOpen: () => void;
  venue: ArenaVenue;
}) {
  const gallery = venueGallery(venue);
  const heroImage = venueHeroImage(venue);
  const logoImage = venueLogoImage(venue);
  const whatsappUrl = venueWhatsappUrl(venue.phone);
  const mapsUrl = venueMapsUrl(venue);
  const modePrices = venueModePriceItems(venue).slice(0, 3);
  const heroPhotos = gallery.length ? gallery.slice(0, 3) : heroImage ? [heroImage] : [];

  return (
    <section className="venue-map-popover" aria-live="polite">
      {heroImage ? <img alt="" className="venue-map-popover__backdrop" src={heroImage} /> : null}
      <button className="venue-map-popover__close" onClick={onClose} type="button" aria-label="Cerrar vista previa">
        <X size={16} />
      </button>
      <div className="venue-map-popover__media" aria-label={`Vista previa de ${venue.name}`}>
        {heroPhotos.length ? (
          <div className="venue-map-popover__photos">
            {heroPhotos.map((photo, index) => <img alt="" key={`${photo}-${index}`} src={photo} />)}
          </div>
        ) : (
          <div className="venue-map-popover__field">
            <MapPinned size={34} />
          </div>
        )}
        <span className="venue-map-popover__crest">
          {logoImage ? <img alt="" src={logoImage} /> : venue.name.slice(0, 2).toUpperCase()}
        </span>
      </div>
      <div className="venue-map-popover__body">
        <span>{venueIsPro(venue) ? "Cancha PRO cercana" : "Sede cercana"}</span>
        <strong>{venue.name}</strong>
        <small>{venueAddressLine(venue)}</small>
        <div className="venue-map-popover__chips">
          {modePrices.map((item) => <b key={item.mode}>{item.label} <i>{item.price}</i></b>)}
        </div>
      </div>
      <div className="venue-map-popover__actions">
        {whatsappUrl ? <a href={whatsappUrl} rel="noreferrer" target="_blank">Consultar</a> : null}
        {mapsUrl ? <a href={mapsUrl} rel="noreferrer" target="_blank">Maps <ExternalLink size={13} /></a> : null}
        <button onClick={onOpen} type="button">Ver ficha</button>
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
      <span className="arena-splash__stadium" aria-hidden="true" />
      <div className="arena-splash__scene">
        <span className="arena-splash__orbit arena-splash__orbit--cyan" aria-hidden="true" />
        <span className="arena-splash__orbit arena-splash__orbit--gold" aria-hidden="true" />
        <div className="arena-splash__ball" aria-hidden="true">
          <img alt="" className="arena-splash__ball-image" src="/assets/fulbito-splash-ball.webp" />
          <span className="arena-splash__shine" />
        </div>
        <span className="arena-splash__ground" aria-hidden="true" />
      </div>
      <div className="arena-splash__copy">
        <strong>Fulbito Arena</strong>
        <small>Modo torneo</small>
      </div>
      <span className="arena-splash__loading" aria-hidden="true"><i /></span>
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
          <small>{rosterRule.label}: {rosterRule.starters} titulares + {rosterRule.substitutes} suplentes. Una cuenta, una ficha por club.</small>
        </div>
      </header>
      {ownPlayer ? (
        <>
          <div className="player-self-panel__ready">
            <PlayerAvatar player={ownPlayer} />
            <div>
              <strong>{ownPlayer.display_name}</strong>
              <span>#{ownPlayer.jersey_number ?? "-"} / {ownPlayer.alias ?? "Sin apodo"} / {ownPlayer.position ?? "Posicion"}</span>
            </div>
          </div>
          <details className="player-self-edit">
            <summary>Editar mi ficha</summary>
            <ArenaActions data={data} mode="self-player" selectedTeamId={team.id} />
          </details>
        </>
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
  const ownedTeams = useMemo(
    () => data.user ? data.teams.filter((team) => team.owner_id === data.user?.id) : [],
    [data.teams, data.user]
  );
  const memberTeamIds = useMemo(() => {
    if (!data.user) return new Set<string>();
    return new Set(data.players.filter((player) => player.profile_id === data.user?.id).map((player) => player.team_id));
  }, [data.players, data.user]);
  const memberTeams = useMemo(
    () => data.user ? data.teams.filter((team) => memberTeamIds.has(team.id)) : [],
    [data.teams, data.user, memberTeamIds]
  );
  const ownedTeam = ownedTeams[0] ?? null;
  const memberTeam = memberTeams[0] ?? null;
  const squadTeams = ownedTeams.length ? ownedTeams : memberTeams;
  const invitedTeam = inviteTeamCode
    ? data.teams.find((team) => team.slug === inviteTeamCode || team.id === inviteTeamCode || team.short_name.toLowerCase() === inviteTeamCode.toLowerCase())
    : null;
  const playerInviteMode = Boolean(inviteTeamCode && invitedTeam);
  const friendlyInvite = friendlyCode ? data.friendlyMatches.find((match) => match.invite_code === friendlyCode) : null;
  const inferredTeam = playerInviteMode
    ? invitedTeam
    : inviteMode
      ? ownedTeam ?? null
      : data.user
        ? ownedTeam ?? memberTeam ?? null
        : data.teams[0] ?? null;
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
    if (playerInviteMode) return "player";
    if (inviteMode) return "captain";
    if (data.tournaments.some((tournament) => tournament.organizer_id === data.user?.id)) return "organizer";
    if (ownedTeam) return "captain";
    if (memberTeam) return "player";
    if (data.venues.some((venue) => venue.owner_id === data.user?.id)) return "venue_owner";
    return inferredAccountRoles[0] ?? "player";
  }, [data.tournaments, data.user, data.venues, inferredAccountRoles, inviteMode, memberTeam, ownedTeam, playerInviteMode]);

  const [showSplash, setShowSplash] = useState(true);
  const [active, setActive] = useState<TabId>(() => (inviteMode || playerInviteMode) && data.user ? "squad" : "home");
  const [leagueView, setLeagueView] = useState<LeagueView>("classification");
  const [formationMode, setFormationMode] = useState<FieldMode>(data.activeTournament?.field_mode ?? "7v7");
  const [formationPresetId, setFormationPresetId] = useState(formationPresets[data.activeTournament?.field_mode ?? "7v7"][0].id);
  const [selectedTeamId, setSelectedTeamId] = useState(inferredTeam?.id ?? "");
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [venuePreviewId, setVenuePreviewId] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState(data.matches.find((match) => match.status !== "final")?.id ?? data.matches[0]?.id ?? "");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(formationPresets[data.activeTournament?.field_mode ?? "7v7"][0].slots.length - 1);
  const [formationSlotOrder, setFormationSlotOrder] = useState<string[]>([]);
  const [formationSaveState, setFormationSaveState] = useState("");
  const [teamShareMessage, setTeamShareMessage] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [playerCardModalId, setPlayerCardModalId] = useState<string | null>(null);
  const [squadPanel, setSquadPanel] = useState<SquadPanel>("field");
  const [focusTeamBadgeEditor, setFocusTeamBadgeEditor] = useState(false);
  const [pendingSwapSlotIndex, setPendingSwapSlotIndex] = useState<number | null>(null);
  const [origin, setOrigin] = useState("");
  const [userRoles, setUserRoles] = useState<AppRole[]>(() => inferredAccountRoles);
  const [activeRole, setActiveRole] = useState<AppRole>(() => preferredInitialRole);
  const inferredRoleKey = inferredAccountRoles.join("|");
  const effectiveUserRoles = useMemo(() => uniqueRoles([...userRoles, ...inferredAccountRoles]), [inferredAccountRoles, userRoles]);
  const [roleMessage, setRoleMessage] = useState("");
  const [venueLocation, setVenueLocation] = useState<GeoPoint | null>(null);
  const [venueLocationAsked, setVenueLocationAsked] = useState(false);
  const [venueLocationStatus, setVenueLocationStatus] = useState("Mostrando canchas registradas.");
  const [showVenueForm, setShowVenueForm] = useState(true);
  const [friendlyFocus, setFriendlyFocus] = useState(Boolean(friendlyCode));
  const [tournamentFocus, setTournamentFocus] = useState(false);
  const [loginNextTarget, setLoginNextTarget] = useState("/");
  const [sponsorTriggerKey, setSponsorTriggerKey] = useState(0);
  const activeRef = useRef<TabId>(active);
  const historyReadyRef = useRef(false);
  const sponsorTabSwitchCountRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 3400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
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
    : data.teams.find((team) => team.id === selectedTeamId) ?? (inviteMode && !inferredTeam ? undefined : inferredTeam ?? undefined);
  const selectedTeamIsPersonal = Boolean(selectedTeam && squadTeams.some((team) => team.id === selectedTeam.id));
  const selectedTeamFormation = selectedTeam ? data.teamFormations.find((formation) => formation.team_id === selectedTeam.id) : undefined;
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
  const selectedVenue = selectedVenueId ? nearbyVenues.find((venue) => venue.id === selectedVenueId) : undefined;
  const previewVenue = venuePreviewId ? nearbyVenues.find((venue) => venue.id === venuePreviewId) : undefined;
  const selectedPlayers = data.players.filter((player) => player.team_id === selectedTeam?.id);
  const selectedPlayer = selectedPlayers.find((player) => player.id === selectedPlayerId) ?? null;
  const modalPlayer = selectedPlayers.find((player) => player.id === playerCardModalId) ?? null;
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
  useEffect(() => {
    if (!selectedTeam) return;
    const tournamentFieldMode = (inviteMode || selectedTeamEnrolledInActiveTournament) ? data.activeTournament?.field_mode : undefined;
    const savedMode = selectedTeamFormation?.field_mode ?? tournamentFieldMode ?? "7v7";
    const savedPresetId = formationPresets[savedMode].some((preset) => preset.id === selectedTeamFormation?.formation)
      ? selectedTeamFormation?.formation ?? formationPresets[savedMode][0].id
      : formationPresets[savedMode][0].id;
    const nextPreset = getFormationPreset(savedMode, savedPresetId);
    setFormationMode(savedMode);
    setFormationPresetId(savedPresetId);
    setFormationSlotOrder(selectedTeamFormation?.slot_order ?? []);
    setSelectedSlotIndex((current) => Math.min(current, nextPreset.slots.length - 1));
  }, [data.activeTournament?.field_mode, inviteMode, selectedTeam?.id, selectedTeamEnrolledInActiveTournament, selectedTeamFormation?.field_mode, selectedTeamFormation?.formation, selectedTeamFormation?.slot_order, selectedTeamFormation?.updated_at]);
  const selectedSlot = currentFormation.slots[selectedSlotIndex] ?? currentFormation.slots[0];
  const rosterRule = getRosterRule((inviteMode || selectedTeamEnrolledInActiveTournament) ? data.activeTournament?.field_mode : selectedTeamFormation?.field_mode ?? formationMode);
  const isTeamManager = Boolean(
    data.user &&
    selectedTeam?.owner_id === data.user.id
  );
  const formationSlotPlayers = useMemo(
    () => buildFormationSlotPlayers(selectedPlayers, formationSlotOrder, currentFormation.slots.length),
    [currentFormation.slots.length, formationSlotOrder, selectedPlayers]
  );
  const formationBenchPlayers = useMemo(() => {
    const activeIds = new Set(formationSlotPlayers.filter(Boolean).map((player) => player?.id));
    return selectedPlayers.filter((player) => !activeIds.has(player.id));
  }, [formationSlotPlayers, selectedPlayers]);
  const selectedFormationSlotPlayer = formationSlotPlayers[selectedSlotIndex] ?? null;
  const selectedTeamPlayerInviteHref = useMemo(() => {
    if (!selectedTeam || !origin) return "";
    const teamCode = selectedTeam.slug || selectedTeam.id;
    if (!teamCode) return "";
    const tournament = data.activeTournament;
    const hasTournamentContext = Boolean(tournament?.slug && selectedTeamEnrolledInActiveTournament);
    const joinQuery = hasTournamentContext && tournament
      ? `join=${encodeURIComponent(tournament.slug)}&team=${encodeURIComponent(teamCode)}`
      : `team=${encodeURIComponent(teamCode)}`;
    const joinUrl = `${origin}/?${joinQuery}`;
    const premiumCopy = selectedTeamProActive
      ? " Tambien podes subir foto para tu carta Fulbito."
      : " En modo gratis cargas nombre, dorsal y apodo; la foto se habilita si el club activa Equipo Pro.";
    const tournamentCopy = hasTournamentContext && tournament ? ` en ${tournament.name}` : "";
    const text = `Te invito a sumarte a ${selectedTeam.name}${tournamentCopy}. Entra a ${joinUrl}, carga tu ficha y queda en el plantel.${premiumCopy}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }, [data.activeTournament, origin, selectedTeam, selectedTeamEnrolledInActiveTournament, selectedTeamProActive]);
  const shareTeamLineup = useCallback(async () => {
    if (!selectedTeam) return;
    setTeamShareMessage("Generando plantilla WebP...");
    try {
      const file = await createTeamLineupShareFile(selectedTeam, currentFormation.slots, formationSlotPlayers, formationBenchPlayers, formationMode, currentFormation);
      const title = `${selectedTeam.name} en Fulbito Arena`;
      const text = `${selectedTeam.name} | ${formationMode} ${currentFormation.shape} | Plantel Fulbito`;
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
        setTeamShareMessage("Plantilla compartida.");
      } else {
        const url = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1200);
        await navigator.clipboard?.writeText(`${text} ${window.location.href}`.trim());
        setTeamShareMessage("Plantilla descargada y texto copiado.");
      }
    } catch {
      setTeamShareMessage("No se pudo generar la plantilla.");
    }
    window.setTimeout(() => setTeamShareMessage(""), 2400);
  }, [currentFormation, formationBenchPlayers, formationMode, formationSlotPlayers, selectedTeam]);
  const slotOrderFromCurrent = useCallback(() => {
    return Array.from({ length: currentFormation.slots.length }, (_, index) => formationSlotPlayers[index]?.id ?? formationSlotOrder[index] ?? "");
  }, [currentFormation.slots.length, formationSlotOrder, formationSlotPlayers]);
  const persistFormationSlotOrder = useCallback(async (slotOrder: string[], successLabel = "Guardada") => {
    setFormationSaveState("Guardando...");
    if (!data.user || !selectedTeam || selectedTeam.owner_id !== data.user.id) {
      setFormationSaveState("Solo creador");
      window.setTimeout(() => setFormationSaveState(""), 2200);
      return false;
    }
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("team_formation_settings")
      .upsert({
        team_id: selectedTeam.id,
        field_mode: formationMode,
        formation: formationPresetId,
        slot_order: slotOrder,
        updated_by: data.user.id,
        updated_at: new Date().toISOString()
      }, { onConflict: "team_id" });
    if (error) {
      setFormationSaveState("Error");
      window.setTimeout(() => setFormationSaveState(""), 2600);
      return false;
    }
    setFormationSaveState(successLabel);
    window.setTimeout(() => setFormationSaveState(""), 1800);
    return true;
  }, [data.user, formationMode, formationPresetId, selectedTeam]);
  const assignPlayerToFormationSlot = useCallback((slotIndex: number, playerId: string) => {
    const next = slotOrderFromCurrent();
    next.forEach((value, index) => {
      if (playerId && value === playerId) next[index] = "";
    });
    next[slotIndex] = playerId;
    setFormationSlotOrder(next);
    setSelectedSlotIndex(slotIndex);
    setSelectedPlayerId(playerId || null);
    void persistFormationSlotOrder(next, "Cambio guardado");
  }, [persistFormationSlotOrder, slotOrderFromCurrent]);
  const clearFormationSlot = useCallback((slotIndex: number) => {
    const next = slotOrderFromCurrent();
    next[slotIndex] = "";
    setFormationSlotOrder(next);
    setSelectedSlotIndex(slotIndex);
    setSelectedPlayerId(null);
    void persistFormationSlotOrder(next, "Puesto liberado");
  }, [persistFormationSlotOrder, slotOrderFromCurrent]);
  const saveSelectedTeamFormation = useCallback(async () => {
    await persistFormationSlotOrder(slotOrderFromCurrent());
  }, [persistFormationSlotOrder, slotOrderFromCurrent]);
  const deleteSelectedTeamPlayer = useCallback(async (playerId: string) => {
    if (!data.user || !selectedTeam || selectedTeam.owner_id !== data.user.id) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", playerId)
      .eq("team_id", selectedTeam.id);
    if (error) {
      setFormationSaveState(error.message);
      window.setTimeout(() => setFormationSaveState(""), 2600);
      return;
    }
    setFormationSlotOrder((current) => current.map((item) => item === playerId ? "" : item));
    window.setTimeout(() => window.location.reload(), 700);
  }, [data.user, selectedTeam]);
  const setSelectedTeamCaptain = useCallback(async (playerId: string) => {
    if (!data.user || !selectedTeam || selectedTeam.owner_id !== data.user.id) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("team_members")
      .update({ role: "captain" })
      .eq("id", playerId)
      .eq("team_id", selectedTeam.id);
    if (error) {
      setFormationSaveState(error.message);
      window.setTimeout(() => setFormationSaveState(""), 2600);
      return;
    }
    const { error: demoteError } = await supabase
      .from("team_members")
      .update({ role: "player" })
      .eq("team_id", selectedTeam.id)
      .eq("role", "captain")
      .neq("id", playerId);
    if (demoteError) {
      setFormationSaveState(demoteError.message);
      window.setTimeout(() => setFormationSaveState(""), 2600);
      return;
    }
    setFormationSaveState("Capitan actualizado");
    window.setTimeout(() => window.location.reload(), 700);
  }, [data.user, selectedTeam]);
  const openFormationPlayer = useCallback((playerId: string, slotIndex: number) => {
    setSelectedSlotIndex(slotIndex);
    setSelectedPlayerId(playerId);
  }, []);
  const swapFormationSlots = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const next = slotOrderFromCurrent();
    const fromPlayerId = next[fromIndex];
    const toPlayerId = next[toIndex];
    if (!fromPlayerId || !toPlayerId) return;
    next[fromIndex] = toPlayerId;
    next[toIndex] = fromPlayerId;
    setFormationSlotOrder(next);
    setSelectedSlotIndex(toIndex);
    setSelectedPlayerId(fromPlayerId);
    setPendingSwapSlotIndex(null);
    void persistFormationSlotOrder(next, "Posiciones cambiadas");
  }, [persistFormationSlotOrder, slotOrderFromCurrent]);
  const startSwapForPlayer = useCallback((playerId: string) => {
    const slotIndex = formationSlotPlayers.findIndex((player) => player?.id === playerId);
    if (slotIndex < 0) return;
    setSelectedSlotIndex(slotIndex);
    setPendingSwapSlotIndex(slotIndex);
    setSquadPanel("bench");
  }, [formationSlotPlayers]);
  const useBenchPlayerForPendingSwap = useCallback((playerId: string) => {
    if (pendingSwapSlotIndex == null) return;
    const next = slotOrderFromCurrent();
    next.forEach((value, index) => {
      if (value === playerId) next[index] = "";
    });
    next[pendingSwapSlotIndex] = playerId;
    setFormationSlotOrder(next);
    setSelectedSlotIndex(pendingSwapSlotIndex);
    setSelectedPlayerId(playerId);
    setPendingSwapSlotIndex(null);
    setSquadPanel("field");
    void persistFormationSlotOrder(next, "Cambio guardado");
  }, [pendingSwapSlotIndex, persistFormationSlotOrder, slotOrderFromCurrent]);
  const openTeamBadgeEditor = useCallback(() => {
    setFocusTeamBadgeEditor(true);
    setSquadPanel("edit");
  }, []);
  const myTeam = ownedTeam ?? memberTeam ?? null;
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
    if (!focusTeamBadgeEditor || squadPanel !== "edit") return;
    const timers = [90, 240, 520].map((delay) => window.setTimeout(() => {
      const target = document.getElementById("team-badge-editor") ?? document.getElementById("team-edit-panel");
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      setFocusTeamBadgeEditor(false);
    }, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [focusTeamBadgeEditor, squadPanel]);

  useEffect(() => {
    if (selectedVenueId && !nearbyVenues.some((venue) => venue.id === selectedVenueId)) setSelectedVenueId("");
    if (venuePreviewId && !nearbyVenues.some((venue) => venue.id === venuePreviewId)) setVenuePreviewId("");
  }, [nearbyVenues, selectedVenueId, venuePreviewId]);

  useEffect(() => {
    if (!venuePreviewId) return;
    const timer = window.setTimeout(() => {
      setVenuePreviewId((current) => current === venuePreviewId ? "" : current);
    }, 8500);
    return () => window.clearTimeout(timer);
  }, [venuePreviewId]);

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
      setSelectedTeamId(squadTeams[0]?.id ?? "__new__");
      setActive("squad");
    } else if (startTarget === "venues") {
      activeRef.current = "venues";
      setActive("venues");
      setShowVenueForm(true);
    } else {
      return;
    }
    window.history.replaceState({ ...(window.history.state ?? {}), fulbitoTab: activeRef.current }, "", "/");
  }, [data.user, inviteMode, squadTeams]);

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

  const openPersonalSquad = useCallback(() => {
    setSquadPanel("field");
    setPendingSwapSlotIndex(null);
    setSelectedPlayerId(null);
    setPlayerCardModalId(null);
    setSelectedTeamId(squadTeams[0]?.id ?? "__new__");
    setActiveTab("squad");
  }, [setActiveTab, squadTeams]);

  const openTeam = useCallback((teamId: string) => {
    setSelectedTeamId(teamId);
    setSquadPanel("field");
    setPendingSwapSlotIndex(null);
    setActiveTab("squad");
  }, [setActiveTab]);

  const openVenue = useCallback((venueId: string) => {
    setSelectedVenueId(venueId);
    setVenuePreviewId("");
    setActiveTab("venues");
    window.setTimeout(() => {
      document.getElementById("venue-spotlight")?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 90);
  }, [setActiveTab]);

  const previewVenueFromMap = useCallback((venueId: string) => {
    setVenuePreviewId(venueId);
    setSelectedVenueId("");
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
            <button
              onClick={() => {
                if (!data.user) {
                  openLoginPanel();
                  return;
                }
                if (playerInviteMode && invitedTeam) {
                  openTeam(invitedTeam.id);
                  return;
                }
                openPersonalSquad();
              }}
              type="button"
            >
              {playerInviteMode ? "Cargar ficha" : "Cargar equipo"}
            </button>
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
            onOpenSquad={openPersonalSquad}
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
            <MiniStat icon={<Users />} label="Mis equipos" onClick={openPersonalSquad} value={squadTeams.length} />
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
            onCreateTeam={openPersonalSquad}
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

    const firstFieldPlayer = formationSlotPlayers.find((player): player is ArenaPlayer => Boolean(player)) ?? null;
    const tacticalPlayer = selectedPlayer ?? selectedFormationSlotPlayer ?? firstFieldPlayer;
    const renderFormationPanel = () => (
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
        onEditTeamPhoto={openTeamBadgeEditor}
        onOpenPlayer={openFormationPlayer}
        onSelectSlot={setSelectedSlotIndex}
        onSwapSlots={swapFormationSlots}
        pendingSwapSlotIndex={pendingSwapSlotIndex}
        players={formationSlotPlayers}
        preset={currentFormation}
        presetId={formationPresetId}
        selectedSlotIndex={selectedSlotIndex}
        team={selectedTeam}
        lockedMode={inviteMode}
      />
    );

    return (
      <>
        <ScreenHeader compact eyebrow={isTeamManager ? "Panel del club" : "Club"} title="Equipo">
          {inviteMode
            ? `${rosterRule.label}: hasta ${rosterRule.maxPlayers} jugadores (${rosterRule.starters} titulares + ${rosterRule.substitutes} suplentes).`
            : `${selectedTeam.name}: toca un jugador para ver su card o usa los botones para gestionar formacion, suplentes e invitaciones.`}
        </ScreenHeader>
        {inviteMode && isTeamManager && data.activeTournament && !selectedTeamEnrolledInActiveTournament ? (
          <section className="player-invite-panel player-invite-panel--locked">
            <div>
              <span>Invitacion bloqueada</span>
              <strong>Primero inscribi {selectedTeam.name}</strong>
              <p>El link de jugadores se habilita cuando este club queda asociado a {data.activeTournament.name}. Asi cada ficha cae en la copa correcta.</p>
            </div>
            <button disabled type="button">Inscribir equipo abajo</button>
          </section>
        ) : null}
        {data.user && (playerInviteMode || selectedTeam.owner_id === data.user.id) ? (
          <PlayerSelfJoinPanel data={data} players={selectedPlayers} rosterRule={rosterRule} team={selectedTeam} />
        ) : null}
        {squadPanel === "field" ? (
          <section className="squad-tactical-stage">
            <div className="squad-tactical-stage__pitch">
              {renderFormationPanel()}
            </div>
            <PlayerTacticalCard
              canManage={isTeamManager}
              onChangePlayer={startSwapForPlayer}
              onFullCard={setPlayerCardModalId}
              onOpenFormationTools={() => setSquadPanel("formation")}
              player={tacticalPlayer}
              slotLabel={`${selectedSlot.label} ${selectedSlotIndex + 1}`}
              team={selectedTeam}
            />
          </section>
        ) : renderFormationPanel()}
        {squadPanel === "field" ? (
          <SquadBenchRail
            benchPlayers={formationBenchPlayers}
            canManage={isTeamManager}
            inviteHref={selectedTeamPlayerInviteHref}
            onOpenPlayer={setSelectedPlayerId}
            onShareTeam={shareTeamLineup}
            onUseBenchPlayer={useBenchPlayerForPendingSwap}
            pendingSwap={pendingSwapSlotIndex != null}
            rosterRule={rosterRule}
            shareMessage={teamShareMessage}
          />
        ) : null}
        <SquadSectionTabs
          active={squadPanel}
          canEdit={isTeamManager}
          onChange={(panel) => {
            setSquadPanel(panel);
            if (panel !== "bench") setPendingSwapSlotIndex(null);
          }}
        />
        {squadPanel === "formation" || squadPanel === "bench" || squadPanel === "invite" ? (
          <TeamFormationManager
            activePanel={squadPanel}
            benchPlayers={formationBenchPlayers}
            canEdit={isTeamManager}
            inviteHref={selectedTeamPlayerInviteHref}
            onAssignSlot={assignPlayerToFormationSlot}
            onClearSlot={clearFormationSlot}
            onDeletePlayer={deleteSelectedTeamPlayer}
            onOpenPlayer={setPlayerCardModalId}
            onSaveFormation={saveSelectedTeamFormation}
            onSetCaptain={setSelectedTeamCaptain}
            onSelectSlot={setSelectedSlotIndex}
            onUseBenchPlayer={useBenchPlayerForPendingSwap}
            pendingSwapSlotIndex={pendingSwapSlotIndex}
            players={selectedPlayers}
            rosterRule={rosterRule}
            saveState={formationSaveState}
            selectedSlotIndex={selectedSlotIndex}
            slots={currentFormation.slots}
            slotPlayers={formationSlotPlayers}
            team={selectedTeam}
            teamProActive={selectedTeamProActive}
          />
        ) : null}
        {squadPanel === "formation" ? <section className={`slot-editor-console ${isTeamManager ? "" : "slot-editor-console--public"}`}>
          <div>
            <UserCheck size={18} />
            <strong>{slotDraft.label}</strong>
            <span>{isTeamManager ? (selectedFormationSlotPlayer ? "Puesto ocupado" : "Alta rapida desde formacion") : "Ficha publica del puesto"}</span>
          </div>
          {isTeamManager && !selectedFormationSlotPlayer ? (
            <ArenaActions data={data} mode="slot" selectedTeamId={selectedTeam?.id} slotDraft={slotDraft} />
          ) : isTeamManager && selectedFormationSlotPlayer ? (
            <p>Este puesto lo ocupa {selectedFormationSlotPlayer.display_name}. Para reemplazarlo elegi un suplente en el panel del creador y guarda la formacion.</p>
          ) : (
            <p>Toca un jugador cargado para ver su card. Solo el creador del club puede modificar escudo, formacion, sustituciones y bajas.</p>
          )}
        </section> : null}
        {squadPanel === "field" && selectedTeamIsPersonal && squadTeams.length > 1 ? (
          <TeamCarousel onSelect={setSelectedTeamId} selectedTeamId={selectedTeam.id} teams={squadTeams} />
        ) : null}
        {squadPanel === "edit" && isTeamManager ? (
          <section className="team-edit-panel-anchor" id="team-edit-panel">
            <ArenaActions data={data} mode="squad" selectedTeamId={selectedTeam?.id} teamEditorOnly />
          </section>
        ) : null}
        {squadPanel === "edit" && data.user && isTeamManager ? <PaymentConsole data={data} planCodes={["team_pro"]} /> : null}
        {modalPlayer ? <PlayerCardModal canManage={isTeamManager} onChangePlayer={startSwapForPlayer} onClose={() => setPlayerCardModalId(null)} player={modalPlayer} team={selectedTeam} /> : null}
      </>
    );
  }

  function renderVenues() {
    const proVenueCount = nearbyVenues.filter(venueIsPro).length;
    const locationSummary = venueLocation
      ? `${nearbyVenues.length} sedes hasta 50 km`
      : data.venues.length
        ? `${data.venues.length} sedes cargadas`
        : "Mapa listo";
    const marketplaceState = venueLocation ? `${nearbyVenues.length} a 50 km` : "Activa ubicacion";
    return (
      <>
        <ScreenHeader eyebrow="Alta de sede" title="Canchas">
          Busca canchas cercanas, mira fotos, consulta por WhatsApp y registra tu sede para aparecer en el mapa de Fulbito.
        </ScreenHeader>
        <section className="venue-discovery-console">
          <div className="venue-discovery-console__copy">
            <span>Mapa barrial</span>
            <strong>Encontra sede, precio y contacto sin salir de Fulbito.</strong>
            <p>{venueLocationStatus}</p>
          </div>
          <button onClick={requestVenueLocation} type="button">
            <LocateFixed size={17} />
            {venueLocation ? "Actualizar zona" : "Activar ubicacion"}
          </button>
          <div className="venue-discovery-console__stats">
            <article>
              <b>{locationSummary}</b>
              <small>{venueLocation ? "Radio real" : "Vista general"}</small>
            </article>
            <article>
              <b>{proVenueCount}</b>
              <small>Canchas PRO</small>
            </article>
            <article>
              <b>WhatsApp</b>
              <small>Consulta directa</small>
            </article>
          </div>
        </section>
        <section className="venues-marketplace">
          <header>
            <div>
              <span>Sedes activas</span>
              <small>Toca un pin para ver fotos, precios y acceso a Maps.</small>
            </div>
            <strong>{marketplaceState}</strong>
          </header>
          <VenueMap onSelectVenue={previewVenueFromMap} selectedVenueId={previewVenue?.id ?? selectedVenue?.id} userLocation={venueLocation} venues={nearbyVenues} />
          {nearbyVenues.length ? (
            <>
              {previewVenue ? (
                <VenueMapPreview
                  onClose={() => setVenuePreviewId("")}
                  onOpen={() => openVenue(previewVenue.id)}
                  venue={previewVenue}
                />
              ) : null}
              {selectedVenue ? (
                <VenueSpotlight venue={selectedVenue} />
              ) : (
                <section className="venue-select-hint">
                  <MapPinned size={20} />
                  <div>
                    <strong>Toca una sede del mapa</strong>
                    <span>Vas a ver una vista previa con fotos, precios, WhatsApp y Maps. Despues podes abrir la ficha completa.</span>
                  </div>
                </section>
              )}
              <section className="venue-stack" aria-label="Canchas cercanas">
                {nearbyVenues.map((venue) => <VenueRow key={venue.id} onOpen={() => openVenue(venue.id)} venue={venue} />)}
              </section>
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
          entitlements={data.entitlements}
          onLogin={openLoginPanel}
          paymentRequests={data.paymentRequests}
          team={myTeam}
          user={data.user}
          userNotifications={data.userNotifications}
        />
      </header>

      <main className="game-screen" key={active}>
        {screens[active]()}
      </main>

      <nav className="game-tabbar" aria-label="Navegacion principal">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button className={active === item.id ? "is-active" : ""} key={item.id} onClick={() => item.id === "squad" ? openPersonalSquad() : setActiveTab(item.id)} type="button">
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

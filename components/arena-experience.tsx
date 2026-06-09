"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Crown,
  Flag,
  Gamepad2,
  MapPinned,
  Plus,
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
import { LogoutButton } from "@/components/logout-button";
import { VenueMap } from "@/components/venue-map";
import { roleCatalog } from "@/lib/demo";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AppRole, ArenaData, ArenaMatch, ArenaPlayer, ArenaTeam, ArenaVenue, FieldMode } from "@/lib/types";

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

const positionLabels: Record<string, string> = {
  ARQ: "Arquero",
  DEF: "Defensa",
  VOL: "Volante",
  DEL: "Delantero"
};

type FormationSlot = { x: number; y: number; label: string };
type FormationPreset = { id: string; name: string; shape: string; slots: FormationSlot[] };

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

function MatchTile({
  match,
  featured = false,
  onOpen
}: {
  match: ArenaMatch;
  featured?: boolean;
  onOpen: () => void;
}) {
  const isFinal = match.status === "final";
  return (
    <button className={featured ? "match-tile match-tile--featured match-tile--button" : "match-tile match-tile--button"} onClick={onOpen} type="button">
      <div className="match-tile__meta">
        <span>{match.round_name}</span>
        <b>{isFinal ? "Final" : "Por jugar"}</b>
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
        <span>{venue.neighborhood} / {venue.surface ?? "Sintetico"} / {venue.address ?? "Direccion pendiente"}</span>
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
  onChangeRole,
  onAddRole
}: {
  user: ArenaData["user"];
  roles: AppRole[];
  activeRole: AppRole;
  message: string;
  onChangeRole: (role: AppRole) => void;
  onAddRole: (role: AppRole) => void;
}) {
  const info = roleCatalog[activeRole];
  return (
    <section className="role-console">
      <div className="session-console session-console--arena">
        {user?.avatarUrl ? <img alt="" src={user.avatarUrl} /> : <span>{user?.name?.[0] ?? "F"}</span>}
        <div>
          <strong>{user?.name}</strong>
          <small>Una cuenta puede activar varios roles</small>
        </div>
        <LogoutButton />
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
          <strong>{info.headline}</strong>
          <span>{info.actions.slice(0, 3).join(" / ")}</span>
        </div>
      </article>
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
  onSelectSlot
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
}) {
  return (
    <article className="console-panel formation-console">
      <div className="formation-console__head">
        <div>
          <TeamCrest team={team} size="large" />
          <strong>{team?.name ?? "Equipo"}</strong>
          <span>{isManager ? "Toca un puesto y carga jugador" : "Plantel y formacion publica"}</span>
        </div>
        <div className="formation-controls" aria-label="Modo de cancha">
          {(["5v5", "7v7", "11v11"] as FieldMode[]).map((item) => (
            <button className={mode === item ? "is-active" : ""} key={item} onClick={() => onModeChange(item)} type="button">
              {item}
            </button>
          ))}
        </div>
      </div>
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
  return (
    <section className="venue-spotlight">
      <div>
        <span>{venue.status === "verified" ? "Cancha verificada" : "Cancha partner"}</span>
        <h2>{venue.name}</h2>
        <p>{venue.address ?? venue.neighborhood} / {venue.open_hours ?? "Horario a cargar"}</p>
      </div>
      <strong>{money(venue.price_per_hour)}<small>por hora</small></strong>
    </section>
  );
}

function SplashScreen() {
  return (
    <div className="arena-splash" aria-label="Cargando Fulbito Arena">
      <div className="arena-splash__ball">
        <span />
      </div>
      <strong>Fulbito Arena</strong>
      <small>Modo torneo</small>
    </div>
  );
}

export function ArenaExperience({ data }: { data: ArenaData }) {
  const [showSplash, setShowSplash] = useState(true);
  const [active, setActive] = useState<TabId>("home");
  const [formationMode, setFormationMode] = useState<FieldMode>(data.activeTournament?.field_mode ?? "7v7");
  const [formationPresetId, setFormationPresetId] = useState(formationPresets[data.activeTournament?.field_mode ?? "7v7"][0].id);
  const [selectedTeamId, setSelectedTeamId] = useState(data.teams[0]?.id ?? "");
  const [selectedVenueId, setSelectedVenueId] = useState(data.venues[0]?.id ?? "");
  const [selectedMatchId, setSelectedMatchId] = useState(data.matches.find((match) => match.status !== "final")?.id ?? data.matches[0]?.id ?? "");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(formationPresets[data.activeTournament?.field_mode ?? "7v7"][0].slots.length - 1);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<AppRole[]>(() => data.user?.roles.length ? data.user.roles : ["player"]);
  const [activeRole, setActiveRole] = useState<AppRole>(() => data.user?.roles[0] ?? "player");
  const [roleMessage, setRoleMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  const nextMatch = useMemo(() => data.matches.find((match) => match.status !== "final") ?? data.matches[0], [data.matches]);
  const selectedMatch = data.matches.find((match) => match.id === selectedMatchId) ?? nextMatch;
  const selectedTeam = data.teams.find((team) => team.id === selectedTeamId) ?? data.teams[0];
  const selectedVenue = data.venues.find((venue) => venue.id === selectedVenueId) ?? data.venues[0];
  const selectedPlayers = data.players.filter((player) => player.team_id === selectedTeam?.id);
  const selectedPlayer = selectedPlayers.find((player) => player.id === selectedPlayerId) ?? null;
  const totalPot = data.teams.length * (data.activeTournament?.registration_fee ?? 0);
  const groups = useMemo(() => groupTeams(data.standings.length ? data.standings : data.teams), [data.standings, data.teams]);
  const knockoutRounds = useMemo(() => buildKnockoutRounds(data.teams), [data.teams]);
  const currentFormation = getFormationPreset(formationMode, formationPresetId);
  const selectedSlot = currentFormation.slots[selectedSlotIndex] ?? currentFormation.slots[0];
  const isTeamManager = Boolean(
    data.user &&
    (selectedTeam?.owner_id === data.user.id || userRoles.includes("organizer") || userRoles.includes("admin"))
  );

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
        <section className="console-hero-panel console-hero-panel--2026">
          <img alt="" className="hero-mark" src="/assets/icon.svg" />
          <span>Fulbito Arena 2026</span>
          <h1>Tu liga entra en modo juego.</h1>
          <p>Fixture, tabla, plantel y canchas con una experiencia de torneo para futbol amateur.</p>
          <div className="hero-actions">
            <InstallAppButton variant="hero" />
            <button onClick={() => setActive("matches")} type="button">Ver fecha</button>
          </div>
        </section>

        {nextMatch ? <MatchTile match={nextMatch} featured onOpen={() => openMatch(nextMatch)} /> : null}

        <section className="mini-grid">
          <MiniStat icon={<Trophy />} label={data.activeTournament ? formatLabels[data.activeTournament.format] : "Formato"} onClick={() => setActive("league")} value={data.activeTournament?.name ?? "Torneo"} />
          <MiniStat icon={<Users />} label="Equipos" onClick={() => setActive("squad")} value={data.teams.length} />
          <MiniStat icon={<CalendarDays />} label="Partidos" onClick={() => setActive("matches")} value={data.matches.length} />
          <MiniStat icon={<CircleDollarSign />} label="Pozo demo" onClick={() => setActive("venues")} value={money(totalPot)} />
        </section>

        <section className="console-panel">
          <ScreenHeader eyebrow="Identidad" title={data.user ? roleCatalog[activeRole].label : "Entrar rapido"}>
            {data.user ? "Tu Gmail puede tener varios roles: jugador, capitan, cancha, organizador o veedor." : "Google Login con rol inicial para jugador, capitan, cancha, organizador o veedor."}
          </ScreenHeader>
          {data.user ? (
            <RoleConsole
              activeRole={activeRole}
              message={roleMessage}
              onAddRole={addRole}
              onChangeRole={setActiveRole}
              roles={userRoles}
              user={data.user}
            />
          ) : (
            <LoginPanel configured={data.configured} />
          )}
        </section>
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
        ) : null}
        <div className="match-stack">{data.matches.map((match) => <MatchTile key={match.id} match={match} onOpen={() => openMatch(match)} />)}</div>
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
        <StandingCompact onTeamOpen={openTeam} teams={data.standings} />
        <GroupTables groups={groups} />
        <KnockoutPath rounds={knockoutRounds} teams={data.standings.length ? data.standings : data.teams} />
      </>
    );
  }

  function renderSquad() {
    const slotDraft = {
      label: `${selectedSlot.label} ${selectedSlotIndex + 1}`,
      jersey: selectedSlotIndex + 1,
      position: positionLabels[selectedSlot.label] ?? selectedSlot.label
    };

    return (
      <>
        <ScreenHeader compact eyebrow={isTeamManager ? "Panel del club" : "Club"} title={selectedTeam?.name ?? "Equipo"}>
          Toca una posicion del campo para cargar jugador. Cambia de equipo desde el selector.
        </ScreenHeader>
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
        {selectedPlayer ? <PlayerCardModal onClose={() => setSelectedPlayerId(null)} player={selectedPlayer} team={selectedTeam} /> : null}
      </>
    );
  }

  function renderVenues() {
    return (
      <>
        <ScreenHeader eyebrow="Sedes" title="Canchas">
          Canchas de alquiler con mapa, precio por hora, inscripcion sugerida, comision y detalle de ubicacion.
        </ScreenHeader>
        <VenueMap onSelectVenue={openVenue} selectedVenueId={selectedVenue?.id} venues={data.venues} />
        <VenueSpotlight venue={selectedVenue} />
        <section className="venue-stack">{data.venues.map((venue) => <VenueRow key={venue.id} onOpen={() => setSelectedVenueId(venue.id)} venue={venue} />)}</section>
        <section className="console-panel money-console">
          <MiniStat icon={<CircleDollarSign />} label="Ticket promedio" onClick={() => setActive("venues")} value={money(selectedVenue?.price_per_hour ?? 0)} />
          <MiniStat icon={<Crown />} label="Comision demo" onClick={() => setActive("league")} value="8-9%" />
          <MiniStat icon={<Route />} label="Sedes activas" onClick={() => setActive("matches")} value={data.venues.length} />
        </section>
        <ArenaActions data={data} mode="venue" />
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
        <InstallAppButton />
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

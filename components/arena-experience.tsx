"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Crown,
  Flag,
  Gamepad2,
  MapPinned,
  Shield,
  ShieldCheck,
  Trophy,
  Users
} from "lucide-react";
import { ArenaActions } from "@/components/arena-actions";
import { InstallAppButton } from "@/components/install-app-button";
import { LoginPanel } from "@/components/login-panel";
import { LogoutButton } from "@/components/logout-button";
import { roleCatalog } from "@/lib/demo";
import type { AppRole, ArenaData, ArenaMatch, ArenaPlayer, ArenaTeam, FieldMode } from "@/lib/types";

type TabId = "home" | "matches" | "league" | "squad" | "venues";

const tabs: Array<{ id: TabId; label: string; icon: typeof Gamepad2 }> = [
  { id: "home", label: "Inicio", icon: Gamepad2 },
  { id: "matches", label: "Partidos", icon: CalendarDays },
  { id: "league", label: "Liga", icon: Trophy },
  { id: "squad", label: "Equipo", icon: Shield },
  { id: "venues", label: "Canchas", icon: MapPinned }
];

const formatLabels = {
  league: "Liga todos contra todos",
  world_cup: "Mundial barrial",
  knockout: "Copa eliminatoria"
};

const formationSlots: Record<FieldMode, Array<{ x: number; y: number; label: string }>> = {
  "5v5": [
    { x: 50, y: 84, label: "ARQ" },
    { x: 28, y: 60, label: "DEF" },
    { x: 72, y: 60, label: "DEF" },
    { x: 35, y: 34, label: "VOL" },
    { x: 65, y: 24, label: "DEL" }
  ],
  "7v7": [
    { x: 50, y: 86, label: "ARQ" },
    { x: 23, y: 67, label: "DEF" },
    { x: 50, y: 63, label: "DEF" },
    { x: 77, y: 67, label: "DEF" },
    { x: 32, y: 43, label: "VOL" },
    { x: 68, y: 43, label: "VOL" },
    { x: 50, y: 20, label: "DEL" }
  ],
  "11v11": [
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
};

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

function TeamCrest({ team, size = "normal" }: { team?: ArenaTeam | null; size?: "normal" | "large" }) {
  return (
    <span className={`team-crest ${size === "large" ? "team-crest--large" : ""}`} style={{ "--crest": team?.primary_color ?? "#eec15c" } as CSSProperties}>
      {team?.badge_url ? <img alt="" src={team.badge_url} /> : team?.short_name ?? "FC"}
    </span>
  );
}

function PlayerAvatar({ player }: { player?: ArenaPlayer | null }) {
  const initials = player?.display_name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "FA";

  return (
    <span className="player-disc">
      {player?.photo_url ? <img alt="" src={player.photo_url} /> : initials}
    </span>
  );
}

function ScreenHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="screen-header">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <article className="mini-stat">
      {icon}
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function MatchTile({ match, featured = false }: { match: ArenaMatch; featured?: boolean }) {
  const isFinal = match.status === "final";
  return (
    <article className={featured ? "match-tile match-tile--featured" : "match-tile"}>
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
    </article>
  );
}

function RoleStrip({ role }: { role: AppRole }) {
  const info = roleCatalog[role];
  return (
    <article className="role-strip">
      <ShieldCheck size={18} />
      <div>
        <strong>{info.label}</strong>
        <span>{info.consumes.slice(0, 3).join(" / ")}</span>
      </div>
    </article>
  );
}

function TeamRow({ team }: { team: ArenaTeam }) {
  return (
    <article className="team-row">
      <TeamCrest team={team} />
      <div>
        <strong>{team.name}</strong>
        <span>{team.neighborhood ?? "Barrio"} / {team.points ?? 0} pts</span>
      </div>
      <ChevronRight size={18} />
    </article>
  );
}

function VenueRow({ venue }: { venue: ArenaData["venues"][number] }) {
  return (
    <article className="venue-row">
      <div>
        <strong>{venue.name}</strong>
        <span>{venue.neighborhood} / {venue.surface ?? "Sintetico"}</span>
      </div>
      <b>{money(venue.price_per_hour)}</b>
    </article>
  );
}

function StandingCompact({ teams }: { teams: ArenaTeam[] }) {
  return (
    <div className="standings-compact">
      {teams.map((team, index) => (
        <article key={team.id}>
          <span>{index + 1}</span>
          <TeamCrest team={team} />
          <strong>{team.short_name}</strong>
          <b>{team.points ?? 0}</b>
          <small>{team.played ?? 0} PJ / DG {team.goalDiff ?? 0}</small>
        </article>
      ))}
    </div>
  );
}

function FormationPanel({
  team,
  players,
  mode,
  onModeChange
}: {
  team?: ArenaTeam;
  players: ArenaPlayer[];
  mode: FieldMode;
  onModeChange: (mode: FieldMode) => void;
}) {
  return (
    <article className="console-panel formation-console">
      <div className="formation-console__head">
        <div>
          <TeamCrest team={team} size="large" />
          <strong>{team?.name ?? "Equipo"}</strong>
        </div>
        <div className="formation-controls" aria-label="Modo de cancha">
          {(["5v5", "7v7", "11v11"] as FieldMode[]).map((item) => (
            <button className={mode === item ? "is-active" : ""} key={item} onClick={() => onModeChange(item)} type="button">
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="formation-pitch formation-pitch--console">
        {formationSlots[mode].map((slot, index) => {
          const player = players[index] ?? null;
          return (
            <div className="formation-slot" key={`${mode}-${slot.label}-${index}`} style={{ "--x": `${slot.x}%`, "--y": `${slot.y}%` } as CSSProperties}>
              <PlayerAvatar player={player} />
              <strong>{player?.jersey_number ?? index + 1}</strong>
              <span>{player?.alias || player?.display_name || slot.label}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export function ArenaExperience({ data }: { data: ArenaData }) {
  const [active, setActive] = useState<TabId>("home");
  const [formationMode, setFormationMode] = useState<FieldMode>(data.activeTournament?.field_mode ?? "7v7");
  const currentRole = data.user?.roles[0] ?? "player";
  const currentRoleInfo = roleCatalog[currentRole];
  const nextMatch = useMemo(() => data.matches.find((match) => match.status !== "final") ?? data.matches[0], [data.matches]);
  const totalPot = data.teams.length * (data.activeTournament?.registration_fee ?? 0);
  const featuredTeam = data.teams[0];
  const featuredPlayers = data.players.filter((player) => player.team_id === featuredTeam?.id);

  function renderHome() {
    return (
      <>
        <section className="console-hero-panel">
          <span>Fulbito Arena 2026</span>
          <h1>Tu liga entra en modo juego.</h1>
          <p>Partidos, tabla, plantel y canchas en una experiencia compacta para futbol amateur.</p>
          <div className="hero-actions">
            <InstallAppButton variant="hero" />
            <button onClick={() => setActive("matches")} type="button">Ver fecha</button>
          </div>
        </section>

        {nextMatch ? <MatchTile match={nextMatch} featured /> : null}

        <section className="mini-grid">
          <MiniStat icon={<Trophy />} label={data.activeTournament ? formatLabels[data.activeTournament.format] : "Formato"} value={data.activeTournament?.name ?? "Torneo"} />
          <MiniStat icon={<Users />} label="Equipos" value={data.teams.length} />
          <MiniStat icon={<CalendarDays />} label="Partidos" value={data.matches.length} />
          <MiniStat icon={<CircleDollarSign />} label="Pozo demo" value={money(totalPot)} />
        </section>

        <section className="console-panel">
          <ScreenHeader eyebrow="Rol activo" title={data.user ? currentRoleInfo.label : "Entrar rapido"}>
            {data.user ? currentRoleInfo.headline : "Google Login con rol inicial para jugador, capitan, cancha, organizador o veedor."}
          </ScreenHeader>
          {data.user ? (
            <div className="session-console">
              {data.user.avatarUrl ? <img alt="" src={data.user.avatarUrl} /> : <span>{data.user.name?.[0] ?? "F"}</span>}
              <div><strong>{data.user.name}</strong><small>{currentRoleInfo.consumes.slice(0, 3).join(" / ")}</small></div>
              <LogoutButton />
            </div>
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
          Fechas compactas, resultado pendiente y carga de marcador por veedor, cancha u organizador.
        </ScreenHeader>
        <div className="match-stack">{data.matches.map((match) => <MatchTile key={match.id} match={match} />)}</div>
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
        <ScreenHeader eyebrow="Clasificacion" title="Liga">
          Tabla automatica con puntos, PJ, G, E, P, GF, GC y DG.
        </ScreenHeader>
        <StandingCompact teams={data.standings} />
        <section className="console-panel bracket-console">
          {["Grupos", "Clasificados", "Octavos", "Cuartos", "Semi", "Final"].map((step, index) => (
            <article key={step}>
              <span>0{index + 1}</span>
              <strong>{step}</strong>
            </article>
          ))}
        </section>
      </>
    );
  }

  function renderSquad() {
    return (
      <>
        <ScreenHeader eyebrow="Club" title="Equipo">
          Plantel con dorsal, apodo, posicion, foto y formacion visual 5v5, 7v7 o 11v11.
        </ScreenHeader>
        <FormationPanel mode={formationMode} onModeChange={setFormationMode} players={featuredPlayers} team={featuredTeam} />
        <section className="player-strip">
          {featuredPlayers.map((player) => (
            <article key={player.id}>
              <PlayerAvatar player={player} />
              <div>
                <strong>{player.display_name}</strong>
                <span>#{player.jersey_number ?? "-"} / {player.position ?? "Posicion"} / {player.goals} goles</span>
              </div>
            </article>
          ))}
        </section>
        <section className="team-stack">{data.teams.map((team) => <TeamRow key={team.id} team={team} />)}</section>
        <ArenaActions data={data} mode="squad" />
      </>
    );
  }

  function renderVenues() {
    return (
      <>
        <ScreenHeader eyebrow="Sedes" title="Canchas">
          Canchas de alquiler por hora con precio, barrio, inscripcion sugerida y comision.
        </ScreenHeader>
        <section className="venue-stack">{data.venues.map((venue) => <VenueRow key={venue.id} venue={venue} />)}</section>
        <section className="console-panel money-console">
          <MiniStat icon={<CircleDollarSign />} label="Ticket promedio" value={money(data.venues[0]?.price_per_hour ?? 0)} />
          <MiniStat icon={<Crown />} label="Comision demo" value="8-9%" />
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

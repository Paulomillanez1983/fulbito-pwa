"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Crown,
  Gamepad2,
  MapPinned,
  Shield,
  Trophy,
  Users,
  Workflow
} from "lucide-react";
import { ArenaActions } from "@/components/arena-actions";
import { InstallAppButton } from "@/components/install-app-button";
import { LoginPanel } from "@/components/login-panel";
import { LogoutButton } from "@/components/logout-button";
import { roleCatalog } from "@/lib/demo";
import type { AppRole, ArenaData, ArenaMatch, ArenaPlayer, ArenaTeam, FieldMode } from "@/lib/types";

const nav = [
  { id: "arena", label: "Arena", icon: Gamepad2 },
  { id: "roles", label: "Roles", icon: Users },
  { id: "fixture", label: "Fixture", icon: CalendarDays },
  { id: "tabla", label: "Tabla", icon: Trophy },
  { id: "equipos", label: "Equipos", icon: Shield },
  { id: "plantel", label: "Plantel", icon: Crown },
  { id: "canchas", label: "Canchas", icon: MapPinned }
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
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "A confirmar";
  return new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function TeamCrest({ team, size = "normal" }: { team?: ArenaTeam | null; size?: "normal" | "large" }) {
  return (
    <span className={`team-crest ${size === "large" ? "team-crest--large" : ""}`} style={{ "--crest": team?.primary_color ?? "#eec15c" } as CSSProperties}>
      {team?.badge_url ? <img alt="" src={team.badge_url} /> : team?.short_name ?? "FC"}
    </span>
  );
}

function MatchCard({ match }: { match: ArenaMatch }) {
  const isFinal = match.status === "final";
  return (
    <article className="match-card">
      <div className="match-meta">
        <span>{match.round_name}</span>
        <span>{formatDate(match.scheduled_at)}</span>
      </div>
      <div className="match-line">
        <div>
          <TeamCrest team={match.homeTeam} />
          <strong>{match.homeTeam?.name ?? "Local"}</strong>
        </div>
        <b>{isFinal ? `${match.home_score} - ${match.away_score}` : "VS"}</b>
        <div>
          <TeamCrest team={match.awayTeam} />
          <strong>{match.awayTeam?.name ?? "Visitante"}</strong>
        </div>
      </div>
      <footer>
        <span>{match.venue?.name ?? "Cancha a confirmar"}</span>
        <span className={`status-pill status-pill--${match.status}`}>{isFinal ? "Final" : "Por jugar"}</span>
      </footer>
    </article>
  );
}

function StandingRow({ team, index }: { team: ArenaTeam; index: number }) {
  return (
    <tr>
      <td><span className={index === 0 ? "rank rank--top" : "rank"}>{index + 1}</span></td>
      <td>
        <div className="table-team">
          <TeamCrest team={team} />
          <strong>{team.name}</strong>
        </div>
      </td>
      <td>{team.points ?? 0}</td>
      <td>{team.played ?? 0}</td>
      <td>{team.won ?? 0}</td>
      <td>{team.drawn ?? 0}</td>
      <td>{team.lost ?? 0}</td>
      <td>{team.goalsFor ?? 0}</td>
      <td>{team.goalsAgainst ?? 0}</td>
      <td>{team.goalDiff ?? 0}</td>
    </tr>
  );
}

function RolePanel({ role }: { role: AppRole }) {
  const item = roleCatalog[role];
  return (
    <article className="role-card">
      <div>
        <span>{item.label}</span>
        <h3>{item.headline}</h3>
      </div>
      <div>
        <strong>Consume</strong>
        <ul>{item.consumes.map((entry) => <li key={entry}>{entry}</li>)}</ul>
      </div>
      <div>
        <strong>Puede hacer</strong>
        <ul>{item.actions.map((entry) => <li key={entry}>{entry}</li>)}</ul>
      </div>
    </article>
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

export function ArenaExperience({ data }: { data: ArenaData }) {
  const [active, setActive] = useState("arena");
  const [formationMode, setFormationMode] = useState<FieldMode>(data.activeTournament?.field_mode ?? "7v7");
  const currentRole = data.user?.roles[0] ?? "player";
  const currentRoleInfo = roleCatalog[currentRole];
  const nextMatch = useMemo(() => data.matches.find((match) => match.status !== "final") ?? data.matches[0], [data.matches]);
  const totalPot = data.teams.length * (data.activeTournament?.registration_fee ?? 0);
  const featuredTeam = data.teams[0];
  const featuredPlayers = data.players.filter((player) => player.team_id === featuredTeam?.id);
  const selectedSlots = formationSlots[formationMode];

  function goToSection(sectionId: string) {
    setActive(sectionId);
    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="arena-shell">
      <header className="arena-topbar">
        <button className="arena-brand" onClick={() => goToSection("arena")} type="button">
          <img alt="" src="/assets/icon.svg" />
          <span>
            <strong>Fulbito Arena</strong>
            <small>Tu cancha. Tu historia. Tu momento.</small>
          </span>
        </button>
        <nav aria-label="Navegacion principal">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button className={active === item.id ? "is-active" : ""} key={item.id} onClick={() => goToSection(item.id)} type="button">
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="top-actions">
          <InstallAppButton />
          {data.user ? (
            <div className="session-pill">
              {data.user.avatarUrl ? <img alt="" src={data.user.avatarUrl} /> : <span>{data.user.name?.[0] ?? "F"}</span>}
              <strong>{data.user.name}</strong>
              <LogoutButton />
            </div>
          ) : (
            <a className="top-login" href="#login">Entrar</a>
          )}
        </div>
      </header>

      <main>
        <section className="hero-arena" id="arena">
          <div className="hero-copy">
            <p className="eyebrow">Fulbito Arena 2026</p>
            <h1>El barrio entra en modo torneo.</h1>
            <p>
              Plataforma PWA con login Google, roles, canchas, equipos, fixture, tabla, grupos, eliminatorias y resultado validado.
            </p>
            <div className="hero-actions">
              <InstallAppButton variant="hero" />
              <button onClick={() => goToSection("fixture")} type="button">Ver calendario</button>
              <button onClick={() => goToSection("roles")} type="button">Definir roles</button>
            </div>
          </div>

          <aside className="broadcast-card">
            <div className="broadcast-top">
              <span>Proximo partido</span>
              <b>{nextMatch?.round_name ?? "Fixture"}</b>
            </div>
            <div className="versus-stage">
              <div><TeamCrest team={nextMatch?.homeTeam} size="large" /><strong>{nextMatch?.homeTeam?.name ?? "Local"}</strong></div>
              <span>VS</span>
              <div><TeamCrest team={nextMatch?.awayTeam} size="large" /><strong>{nextMatch?.awayTeam?.name ?? "Visitante"}</strong></div>
            </div>
            <p>{nextMatch?.venue?.name ?? "Cancha a confirmar"} / {formatDate(nextMatch?.scheduled_at ?? null)}</p>
          </aside>
        </section>

        <section className="quick-grid">
          <article><Trophy /><strong>{data.activeTournament?.name ?? "Torneo"}</strong><span>{data.activeTournament ? formatLabels[data.activeTournament.format] : "Formato pendiente"}</span></article>
          <article><Users /><strong>{data.teams.length}</strong><span>Equipos activos</span></article>
          <article><CalendarDays /><strong>{data.matches.length}</strong><span>Partidos</span></article>
          <article><CircleDollarSign /><strong>{money(totalPot)}</strong><span>Pozo inscripciones demo</span></article>
        </section>

        {!data.user ? <LoginPanel configured={data.configured} /> : (
          <section className="my-role-panel">
            <p className="eyebrow">Sesion activa</p>
            <h2>{currentRoleInfo.headline}</h2>
            <p>Estas entrando como <strong>{currentRoleInfo.label}</strong>. Tu panel prioriza lo que consumis y las acciones que podes ejecutar.</p>
          </section>
        )}

        <section className={active === "roles" ? "arena-section is-focused" : "arena-section"} id="roles">
          <div className="section-heading">
            <p className="eyebrow">Roles del producto</p>
            <h2>Quien entra y que consume</h2>
            <p>El permiso vive en Supabase `user_roles`; no se decide con metadata editable del usuario.</p>
          </div>
          <div className="roles-grid">
            {(["player", "captain", "venue_owner", "organizer", "referee", "admin"] as AppRole[]).map((role) => <RolePanel key={role} role={role} />)}
          </div>
        </section>

        <section className={active === "fixture" ? "arena-section is-focused" : "arena-section"} id="fixture">
          <div className="section-heading">
            <p className="eyebrow">Calendario</p>
            <h2>Partidos y estados</h2>
            <p>El resultado oficial pasa por submission, confirmacion o disputa antes de cerrar tabla.</p>
          </div>
          <div className="match-grid">{data.matches.map((match) => <MatchCard key={match.id} match={match} />)}</div>
        </section>

        <section className={active === "tabla" ? "arena-section is-focused" : "arena-section"} id="tabla">
          <div className="section-heading">
            <p className="eyebrow">Clasificacion</p>
            <h2>Tabla automatica</h2>
            <p>Solo cuenta partidos con estado final. Los pendientes no alteran puntos.</p>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Equipo</th><th>Pts</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th></tr></thead>
              <tbody>{data.standings.map((team, index) => <StandingRow key={team.id} team={team} index={index} />)}</tbody>
            </table>
          </div>
        </section>

        <section className={active === "equipos" ? "arena-section is-focused" : "arena-section"} id="equipos">
          <div className="section-heading">
            <p className="eyebrow">Clubes</p>
            <h2>Equipos participantes</h2>
            <p>El capitan puede crear equipo, subir escudo y gestionar plantel.</p>
          </div>
          <div className="team-grid">
            {data.teams.map((team) => (
              <article className="team-card" key={team.id}>
                <TeamCrest team={team} size="large" />
                <div>
                  <h3>{team.name}</h3>
                  <p>{team.neighborhood ?? "Barrio sin cargar"}</p>
                </div>
                <ChevronRight />
              </article>
            ))}
          </div>
        </section>

        <section className={active === "plantel" ? "arena-section is-focused" : "arena-section"} id="plantel">
          <div className="section-heading">
            <p className="eyebrow">Plantel gamer</p>
            <h2>Formacion visual</h2>
            <p>Dorsal, apodo, posicion y foto quedan listos para que cada equipo se sienta dentro del campeonato.</p>
          </div>
          <div className="squad-board">
            <article className="formation-card">
              <div className="formation-head">
                <div>
                  <TeamCrest team={featuredTeam} size="large" />
                  <strong>{featuredTeam?.name ?? "Equipo"}</strong>
                </div>
                <div className="formation-controls" aria-label="Modo de cancha">
                  {(["5v5", "7v7", "11v11"] as FieldMode[]).map((mode) => (
                    <button className={formationMode === mode ? "is-active" : ""} key={mode} onClick={() => setFormationMode(mode)} type="button">
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              <div className="formation-pitch">
                {selectedSlots.map((slot, index) => {
                  const player = featuredPlayers[index] ?? null;
                  return (
                    <div className="formation-slot" key={`${formationMode}-${slot.label}-${index}`} style={{ "--x": `${slot.x}%`, "--y": `${slot.y}%` } as CSSProperties}>
                      <PlayerAvatar player={player} />
                      <strong>{player?.jersey_number ?? index + 1}</strong>
                      <span>{player?.alias || player?.display_name || slot.label}</span>
                    </div>
                  );
                })}
              </div>
            </article>
            <aside className="squad-list">
              {featuredPlayers.map((player) => (
                <article key={player.id}>
                  <PlayerAvatar player={player} />
                  <div>
                    <strong>{player.display_name}</strong>
                    <span>{player.jersey_number ? `#${player.jersey_number}` : "SD"} / {player.position ?? "Posicion"} / {player.alias ?? "Sin apodo"}</span>
                  </div>
                  <b>{player.goals}</b>
                </article>
              ))}
            </aside>
          </div>
        </section>

        <section className={active === "canchas" ? "arena-section is-focused" : "arena-section"} id="canchas">
          <div className="section-heading">
            <p className="eyebrow">Sedes</p>
            <h2>Canchas partner</h2>
            <p>El operador registra precio por hora, inscripcion sugerida, horarios y torneos en su sede.</p>
          </div>
          <div className="venue-grid">
            {data.venues.map((venue) => (
              <article className="venue-card" key={venue.id}>
                <span>{venue.status}</span>
                <h3>{venue.name}</h3>
                <p>{venue.neighborhood} / {venue.surface}</p>
                <strong>{money(venue.price_per_hour)} hora</strong>
                <small>Inscripcion sugerida {money(venue.inscription_fee)} / comision {venue.commission_rate}%</small>
              </article>
            ))}
          </div>
        </section>

        <section className="arena-section">
          <div className="section-heading">
            <p className="eyebrow">Formato Mundial</p>
            <h2>Grupos + eliminatorias</h2>
            <p>El sistema puede arrancar con grupos y pasar a 16avos, octavos, cuartos, semi y final segun cantidad de equipos.</p>
          </div>
          <div className="flow-grid">
            {["Inscripcion", "Grupos", "Mejores clasificados", "Eliminatoria", "Final", "Campeon"].map((step, index) => (
              <article key={step}>
                <Workflow />
                <span>0{index + 1}</span>
                <strong>{step}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="arena-section">
          <div className="section-heading">
            <p className="eyebrow">Resultado oficial</p>
            <h2>Quien actualiza la tabla</h2>
            <p>La tabla se actualiza solo cuando el marcador queda final.</p>
          </div>
          <div className="result-flow">
            <article><Crown /><strong>Arbitro / veedor</strong><span>Carga acta y marcador.</span></article>
            <article><MapPinned /><strong>Cancha u organizador</strong><span>Valida si no hay veedor.</span></article>
            <article><Shield /><strong>Capitanes</strong><span>Confirman o disputan.</span></article>
            <article><Trophy /><strong>Tabla</strong><span>Se recalcula al cerrar final.</span></article>
          </div>
        </section>

        <ArenaActions data={data} />
      </main>
    </div>
  );
}

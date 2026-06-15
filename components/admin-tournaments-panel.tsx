"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { CalendarDays, CheckCircle2, Clock3, Crown, Filter, MapPin, Medal, Search, ShieldCheck, Trophy, Users } from "lucide-react";
import type { AccountEntitlement, ArenaMatch, ArenaTeam, ArenaTournament, ArenaTournamentDraw, ArenaTournamentTeam, ArenaVenue, FieldMode, TournamentFormat } from "@/lib/types";

type AdminProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

type AdminTournament = ArenaTournament & {
  created_at: string;
  updated_at: string;
  rules?: string | null;
};

type AdminTournamentTeam = ArenaTournamentTeam & {
  created_at?: string;
};

type AdminTournamentVenue = Pick<ArenaVenue, "id" | "name" | "neighborhood" | "address" | "status">;

type TournamentBucket = "all" | "pending" | "active" | "completed" | "archived" | "stale";
type TournamentSort = "recent" | "oldest" | "active_time" | "teams" | "zone" | "name";

type TeamStats = {
  team: ArenaTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  gc: number;
  dg: number;
  points: number;
  rating: number;
  championBonus: number;
};

const statusCopy: Record<string, { label: string; tone: string }> = {
  draft: { label: "Borrador", tone: "pending" },
  registration: { label: "Inscripcion", tone: "pending" },
  active: { label: "Activo", tone: "active" },
  completed: { label: "Finalizado", tone: "completed" },
  archived: { label: "Archivado", tone: "archived" }
};

const formatCopy: Record<TournamentFormat, string> = {
  league: "Liga",
  world_cup: "Grupos + eliminatoria",
  knockout: "Eliminatoria directa"
};

const fieldCopy: Record<FieldMode, string> = {
  "5v5": "Futbol 5",
  "7v7": "Futbol 7",
  "11v11": "Futbol 11"
};

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires"
  }).format(date);
}

function daysFrom(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function ageLabel(days: number) {
  if (days <= 0) return "Hoy";
  if (days === 1) return "1 dia";
  if (days < 30) return `${days} dias`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 mes" : `${months} meses`;
}

function tournamentRegisterNumber(tournament: AdminTournament) {
  const date = new Date(tournament.created_at);
  const datePart = Number.isNaN(date.getTime())
    ? "SINFECHA"
    : `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  return `TOR-${datePart}-${tournament.id.replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}

function isActiveEntitlement(entitlement: AccountEntitlement) {
  return !entitlement.expires_at || new Date(entitlement.expires_at).getTime() >= Date.now();
}

function scoreFor(team: TeamStats, championId?: string | null) {
  const championBonus = championId === team.team.id ? 80 : 0;
  return Math.max(0, Math.round(50 + team.points * 4 + team.won * 5 + team.gf + team.dg * 2 - team.lost * 2 + championBonus));
}

function computeTournamentRanking(teams: ArenaTeam[], matches: ArenaMatch[], championId?: string | null) {
  const table = new Map<string, TeamStats>();
  teams.forEach((team) => {
    table.set(team.id, {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      gc: 0,
      dg: 0,
      points: 0,
      rating: 0,
      championBonus: championId === team.id ? 80 : 0
    });
  });

  matches.forEach((match) => {
    if (match.status !== "final" || match.home_score === null || match.away_score === null) return;
    const home = match.home_team_id ? table.get(match.home_team_id) : null;
    const away = match.away_team_id ? table.get(match.away_team_id) : null;
    if (!home || !away) return;

    home.played += 1;
    away.played += 1;
    home.gf += match.home_score;
    home.gc += match.away_score;
    away.gf += match.away_score;
    away.gc += match.home_score;

    if (match.home_score > match.away_score) {
      home.won += 1;
      away.lost += 1;
      home.points += 3;
    } else if (match.home_score < match.away_score) {
      away.won += 1;
      home.lost += 1;
      away.points += 3;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }

    home.dg = home.gf - home.gc;
    away.dg = away.gf - away.gc;
  });

  const rows = [...table.values()].map((row) => ({ ...row, rating: scoreFor(row, championId) }));
  return rows.sort((left, right) => {
    return right.rating - left.rating ||
      right.points - left.points ||
      right.dg - left.dg ||
      right.gf - left.gf ||
      left.team.name.localeCompare(right.team.name);
  });
}

function detectFinalMatch(matches: ArenaMatch[]) {
  return matches
    .filter((match) => match.status === "final" && match.home_score !== null && match.away_score !== null)
    .sort((left, right) => {
      const leftFinal = `${left.phase} ${left.round_name}`.toLowerCase().includes("final") ? 1 : 0;
      const rightFinal = `${right.phase} ${right.round_name}`.toLowerCase().includes("final") ? 1 : 0;
      if (rightFinal !== leftFinal) return rightFinal - leftFinal;
      const leftTime = left.scheduled_at ? new Date(left.scheduled_at).getTime() : 0;
      const rightTime = right.scheduled_at ? new Date(right.scheduled_at).getTime() : 0;
      return rightTime - leftTime || right.match_order - left.match_order;
    })[0] ?? null;
}

function winnerIdFromMatch(match: ArenaMatch | null) {
  if (!match || match.home_score === null || match.away_score === null) return null;
  if (match.home_score > match.away_score) return match.home_team_id;
  if (match.away_score > match.home_score) return match.away_team_id;
  return null;
}

function bucketForTournament(tournament: AdminTournament, teamCount: number) {
  const age = daysFrom(tournament.created_at);
  if (tournament.status === "completed") return "completed" as TournamentBucket;
  if (tournament.status === "archived") return "archived" as TournamentBucket;
  if (["draft", "registration"].includes(tournament.status) && age >= 10 && teamCount === 0) return "stale" as TournamentBucket;
  if (["draft", "registration"].includes(tournament.status)) return "pending" as TournamentBucket;
  return "active" as TournamentBucket;
}

function zoneFor(venue?: AdminTournamentVenue | null, organizer?: AdminProfile | null) {
  return venue?.neighborhood || venue?.address || organizer?.display_name || "Sin zona";
}

function teamBadge(team: ArenaTeam, compact = false) {
  return (
    <span className={`admin-tournament-team-badge ${compact ? "is-compact" : ""}`} style={{ "--team-color": team.primary_color || "#f1c75b" } as CSSProperties}>
      {team.badge_url ? <img alt="" src={team.badge_url} /> : team.short_name.slice(0, 3)}
    </span>
  );
}

export function AdminTournamentsPanel({
  draws,
  entitlements,
  matches,
  profiles,
  teams,
  tournamentTeams,
  tournaments,
  venues
}: {
  draws: ArenaTournamentDraw[];
  entitlements: AccountEntitlement[];
  matches: ArenaMatch[];
  profiles: AdminProfile[];
  teams: ArenaTeam[];
  tournamentTeams: AdminTournamentTeam[];
  tournaments: AdminTournament[];
  venues: AdminTournamentVenue[];
}) {
  const [bucket, setBucket] = useState<TournamentBucket>("all");
  const [query, setQuery] = useState("");
  const [zone, setZone] = useState("all");
  const [sort, setSort] = useState<TournamentSort>("recent");

  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const venueMap = useMemo(() => new Map(venues.map((venue) => [venue.id, venue])), [venues]);
  const teamMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const tournamentProIds = useMemo(() => new Set(entitlements
    .filter((entitlement) => entitlement.plan_code === "tournament_pro" && entitlement.target_type === "tournament" && entitlement.target_id && isActiveEntitlement(entitlement))
    .map((entitlement) => entitlement.target_id as string)), [entitlements]);

  const tournamentRows = useMemo(() => {
    return tournaments.map((tournament) => {
      const organizer = tournament.organizer_id ? profileMap.get(tournament.organizer_id) ?? null : null;
      const venue = tournament.venue_id ? venueMap.get(tournament.venue_id) ?? null : null;
      const enrollments = tournamentTeams.filter((row) => row.tournament_id === tournament.id);
      const enrolledTeams = enrollments
        .map((enrollment) => enrollment.team_id ? teamMap.get(enrollment.team_id) ?? null : null)
        .filter(Boolean) as ArenaTeam[];
      const tournamentMatches = matches.filter((match) => match.tournament_id === tournament.id);
      const finalMatches = tournamentMatches.filter((match) => match.status === "final");
      const finalMatch = detectFinalMatch(tournamentMatches);
      const officialChampionId = winnerIdFromMatch(finalMatch);
      const preliminaryRanking = computeTournamentRanking(enrolledTeams, tournamentMatches, officialChampionId);
      const rankingLeader = preliminaryRanking.find((rank) => rank.played > 0) ?? null;
      const champion = officialChampionId
        ? teamMap.get(officialChampionId) ?? null
        : tournament.status === "completed"
          ? rankingLeader?.team ?? null
          : null;
      const championSource = officialChampionId ? "Final oficial" : champion && rankingLeader ? "Ranking estimado" : "Sin campeon";
      const ranking = computeTournamentRanking(enrolledTeams, tournamentMatches, champion?.id ?? null);
      const createdDays = daysFrom(tournament.created_at);
      const bucketName = bucketForTournament(tournament, enrolledTeams.length);
      const zoneName = zoneFor(venue, organizer);
      const officialDraw = draws.find((draw) => draw.tournament_id === tournament.id && draw.mode === "official");

      return {
        tournament,
        registerNumber: tournamentRegisterNumber(tournament),
        organizer,
        venue,
        zoneName,
        enrollments,
        enrolledTeams,
        matches: tournamentMatches,
        finalMatches,
        ranking,
        champion,
        championSource,
        bucket: bucketName,
        ageDays: createdDays,
        hasTournamentPro: tournamentProIds.has(tournament.id),
        officialDraw
      };
    });
  }, [draws, entitlements, matches, profileMap, teamMap, tournamentProIds, tournamentTeams, tournaments, venueMap]);

  const zones = useMemo(() => {
    return Array.from(new Set(tournamentRows.map((row) => row.zoneName))).sort((a, b) => a.localeCompare(b));
  }, [tournamentRows]);

  const counts = useMemo<Record<TournamentBucket, number>>(() => ({
    all: tournamentRows.length,
    pending: tournamentRows.filter((row) => row.bucket === "pending").length,
    active: tournamentRows.filter((row) => row.bucket === "active").length,
    completed: tournamentRows.filter((row) => row.bucket === "completed").length,
    archived: tournamentRows.filter((row) => row.bucket === "archived").length,
    stale: tournamentRows.filter((row) => row.bucket === "stale").length
  }), [tournamentRows]);

  const globalRanking = useMemo(() => {
    const grouped = new Map<string, TeamStats>();
    tournamentRows.forEach((row) => {
      row.ranking.forEach((rank) => {
        const current = grouped.get(rank.team.id);
        if (!current) {
          grouped.set(rank.team.id, { ...rank });
          return;
        }
        current.played += rank.played;
        current.won += rank.won;
        current.drawn += rank.drawn;
        current.lost += rank.lost;
        current.gf += rank.gf;
        current.gc += rank.gc;
        current.dg = current.gf - current.gc;
        current.points += rank.points;
        current.championBonus += rank.championBonus;
        current.rating = Math.max(current.rating, rank.rating) + Math.round(rank.rating * 0.22);
      });
    });
    return [...grouped.values()]
      .sort((left, right) => right.rating - left.rating || right.points - left.points || right.dg - left.dg)
      .slice(0, 8);
  }, [tournamentRows]);

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = tournamentRows.filter((row) => {
      if (bucket !== "all" && row.bucket !== bucket) return false;
      if (zone !== "all" && row.zoneName !== zone) return false;
      if (!normalized) return true;
      const haystack = [
        row.tournament.name,
        row.tournament.slug,
        row.registerNumber,
        row.tournament.status,
        row.tournament.field_mode,
        row.zoneName,
        row.organizer?.display_name,
        row.venue?.name,
        row.champion?.name,
        ...row.enrolledTeams.map((team) => team.name)
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(normalized);
    });

    return filtered.sort((left, right) => {
      if (sort === "oldest") return new Date(left.tournament.created_at).getTime() - new Date(right.tournament.created_at).getTime();
      if (sort === "active_time") return right.ageDays - left.ageDays;
      if (sort === "teams") return right.enrolledTeams.length - left.enrolledTeams.length || right.matches.length - left.matches.length;
      if (sort === "zone") return left.zoneName.localeCompare(right.zoneName) || left.tournament.name.localeCompare(right.tournament.name);
      if (sort === "name") return left.tournament.name.localeCompare(right.tournament.name);
      return new Date(right.tournament.created_at).getTime() - new Date(left.tournament.created_at).getTime();
    });
  }, [bucket, query, sort, tournamentRows, zone]);

  return (
    <main className="admin-shell admin-tournaments-shell">
      <a className="admin-floating-app-link" href="/">Ver app</a>
      <header className="admin-topbar admin-topbar--ops">
        <a className="admin-brand-link" href="/admin">
          <span className="admin-brand-mark">FA</span>
          <span>
            Fulbito Arena
            <small>Torneos</small>
          </span>
        </a>
        <div className="admin-topbar-actions">
          <span>Admin activo</span>
          <a href="/admin">Panel completo</a>
          <a href="/admin/publicidad">Publicidad</a>
          <a href="/admin/canchas">Canchas</a>
          <a href="/">Ver app</a>
        </div>
      </header>

      <section className="admin-hero admin-hero--ops admin-tournaments-hero">
        <span>Control de competencias</span>
        <h1>Torneos, campeones y ranking</h1>
        <p>Identifica cada copa por numero de registro, estado, zona, organizador, antiguedad, equipos inscritos, partidos y rendimiento deportivo.</p>
        <div className="admin-hero-actions">
          <a href="#torneos">Ver torneos</a>
          <a href="#ranking">Ranking deportivo</a>
          <a href="/admin">Pagos y resultados</a>
        </div>
      </section>

      <section className="admin-tournament-scoreboard" aria-label="Resumen de torneos">
        <article><Clock3 size={18} /><strong>{counts.pending}</strong><span>Pendientes</span></article>
        <article className={counts.active ? "is-live" : ""}><ShieldCheck size={18} /><strong>{counts.active}</strong><span>Activos</span></article>
        <article><Crown size={18} /><strong>{counts.completed}</strong><span>Finalizados</span></article>
        <article className={counts.stale ? "is-hot" : ""}><CalendarDays size={18} /><strong>{counts.stale}</strong><span>Sin avanzar +10 dias</span></article>
        <article><Users size={18} /><strong>{tournamentRows.reduce((total, row) => total + row.enrolledTeams.length, 0)}</strong><span>Inscripciones</span></article>
        <article><Trophy size={18} /><strong>{tournamentRows.filter((row) => row.hasTournamentPro).length}</strong><span>Torneo Pro activo</span></article>
      </section>

      <section className="admin-tournament-controls" id="torneos">
        <div className="admin-tournament-tabs" aria-label="Estados de torneos">
          {[
            ["all", "Todos"],
            ["pending", "Pendientes"],
            ["active", "Activos"],
            ["completed", "Finalizados"],
            ["stale", "Atascados"],
            ["archived", "Archivados"]
          ].map(([value, label]) => (
            <button className={bucket === value ? "is-active" : ""} key={value} onClick={() => setBucket(value as TournamentBucket)} type="button">
              <span>{label}</span>
              <strong>{counts[value as TournamentBucket]}</strong>
            </button>
          ))}
        </div>

        <div className="admin-tournament-filters">
          <label>
            <Search size={16} />
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, registro, zona, usuario o equipo" type="search" value={query} />
          </label>
          <label>
            <MapPin size={16} />
            <select onChange={(event) => setZone(event.target.value)} value={zone}>
              <option value="all">Todas las zonas</option>
              {zones.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <Filter size={16} />
            <select onChange={(event) => setSort(event.target.value as TournamentSort)} value={sort}>
              <option value="recent">Mas recientes</option>
              <option value="oldest">Mas antiguos</option>
              <option value="active_time">Mas tiempo activos</option>
              <option value="teams">Mas equipos</option>
              <option value="zone">Por zona</option>
              <option value="name">Por nombre</option>
            </select>
          </label>
        </div>
      </section>

      <section className="admin-tournament-grid">
        {visibleRows.length ? visibleRows.map((row) => {
          const status = statusCopy[row.tournament.status] ?? { label: row.tournament.status, tone: "pending" };
          const quota = row.tournament.max_teams ? `${row.enrolledTeams.length}/${row.tournament.max_teams}` : String(row.enrolledTeams.length);
          const topRanking = row.ranking.slice(0, 4);
          return (
            <article className={`admin-tournament-card admin-tournament-card--${status.tone}`} key={row.tournament.id}>
              <header>
                <div>
                  <span>{row.registerNumber}</span>
                  <h2>{row.tournament.name}</h2>
                  <small>{formatCopy[row.tournament.format]} / {fieldCopy[row.tournament.field_mode]} / {row.zoneName}</small>
                </div>
                <b>{status.label}</b>
              </header>

              <div className="admin-tournament-card__meta">
                <span>Creado <strong>{formatDate(row.tournament.created_at)}</strong></span>
                <span>Edad <strong>{ageLabel(row.ageDays)}</strong></span>
                <span>Equipos <strong>{quota}</strong></span>
                <span>Partidos <strong>{row.finalMatches.length}/{row.matches.length}</strong></span>
                <span>Organizador <strong>{row.organizer?.display_name ?? "Sin perfil"}</strong></span>
                <span>Sede <strong>{row.venue?.name ?? "Sin sede fija"}</strong></span>
              </div>

              <div className="admin-tournament-card__status">
                <span className={row.hasTournamentPro ? "is-pro" : ""}>{row.hasTournamentPro ? "Torneo Pro activo" : "Sin Torneo Pro activo"}</span>
                <span>{row.officialDraw ? "Sorteo oficial guardado" : "Sin sorteo oficial"}</span>
                <span>{row.tournament.starts_on ? `Inicio ${formatDate(row.tournament.starts_on)}` : "Sin fecha de inicio"}</span>
              </div>

              <section className="admin-tournament-champion">
                <div>
                  <Medal size={18} />
                  <span>{row.championSource}</span>
                </div>
                {row.champion ? (
                  <div className="admin-tournament-champion__team">
                    {teamBadge(row.champion)}
                    <strong>{row.champion.name}</strong>
                  </div>
                ) : (
                  <p>Todavia no hay campeon. Se completa cuando exista una final aprobada o el torneo quede cerrado.</p>
                )}
              </section>

              <section className="admin-tournament-ranking">
                <header>
                  <span>Ranking del torneo</span>
                  <small>Puntos + goles + DG + bonus campeon</small>
                </header>
                {topRanking.length ? topRanking.map((rank, index) => (
                  <div className="admin-tournament-rank-row" key={rank.team.id}>
                    <span>{index + 1}</span>
                    {teamBadge(rank.team, true)}
                    <strong>{rank.team.name}</strong>
                    <small>{rank.points} pts / DG {rank.dg}</small>
                    <b>{rank.rating}</b>
                  </div>
                )) : (
                  <p className="admin-tournament-empty-line">Sin equipos inscritos todavia.</p>
                )}
              </section>
            </article>
          );
        }) : (
          <article className="admin-empty">
            <Trophy size={24} />
            <strong>No hay torneos con este filtro.</strong>
            <span>Cambia estado, zona o busqueda para revisar otra bandeja.</span>
          </article>
        )}
      </section>

      <section className="admin-global-ranking" id="ranking">
        <header>
          <span>Ranking acumulado</span>
          <h2>Equipos con mejor desempeno</h2>
          <p>Este ranking operativo suma rendimiento en torneos cargados. Sirve como base para futuras divisiones regionales, provinciales y Fulbito Cup.</p>
        </header>
        <div>
          {globalRanking.length ? globalRanking.map((rank, index) => (
            <article key={rank.team.id}>
              <span>{index + 1}</span>
              {teamBadge(rank.team)}
              <div>
                <strong>{rank.team.name}</strong>
                <small>{rank.played} PJ / {rank.won} G / DG {rank.dg} / {rank.championBonus ? "campeon" : "sin titulo"}</small>
              </div>
              <b>{rank.rating}</b>
            </article>
          )) : (
            <article className="admin-empty">
              <Users size={22} />
              <strong>Sin ranking todavia.</strong>
              <span>Cuando haya equipos y resultados finales, Fulbito arma el ranking.</span>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}

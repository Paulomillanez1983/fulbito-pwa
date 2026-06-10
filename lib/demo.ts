import type { AppRole, ArenaData, ArenaMatch, ArenaPlayer, ArenaTeam, ArenaVenue } from "@/lib/types";

export const roleCatalog: Record<AppRole, {
  label: string;
  headline: string;
  consumes: string[];
  actions: string[];
}> = {
  player: {
    label: "Jugador",
    headline: "Vive el torneo como protagonista",
    consumes: ["Proximos partidos", "Tabla y bracket", "Ficha personal", "Formacion", "Goles, tarjetas y MVP"],
    actions: ["Completar perfil", "Confirmar asistencia", "Pedir sumarse a un equipo"]
  },
  captain: {
    label: "Capitan/DT",
    headline: "Gestiona tu club de barrio",
    consumes: ["Calendario del equipo", "Rivales", "Plantel", "Resultados pendientes"],
    actions: ["Crear equipo", "Subir escudo", "Invitar jugadores", "Cargar formacion", "Confirmar resultado"]
  },
  venue_owner: {
    label: "Cancha",
    headline: "Convierte horarios en torneos",
    consumes: ["Reservas", "Partidos en sede", "Ingresos", "Resultados por validar"],
    actions: ["Registrar cancha", "Definir precio por hora", "Crear torneo", "Validar resultados"]
  },
  organizer: {
    label: "Organizador",
    headline: "Control total del campeonato",
    consumes: ["Inscripciones", "Fixture", "Grupos", "Llaves", "Disputas"],
    actions: ["Crear torneo", "Aprobar equipos", "Asignar canchas", "Cerrar fechas"]
  },
  referee: {
    label: "Veedor",
    headline: "Carga el resultado oficial",
    consumes: ["Partidos asignados", "Planteles", "Historial de incidencias"],
    actions: ["Cargar marcador", "Registrar tarjetas", "Elegir MVP", "Enviar acta"]
  },
  admin: {
    label: "Admin Fulbito",
    headline: "Opera la red completa",
    consumes: ["Usuarios", "Canchas", "Torneos", "Pagos", "Moderacion"],
    actions: ["Resolver reclamos", "Auditar resultados", "Activar sponsors", "Gestionar roles"]
  }
};

const venues = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Arena La Diez",
    slug: "arena-la-diez",
    neighborhood: "Villa del Parque",
    address: "Terrada 1234",
    latitude: -34.6009,
    longitude: -58.4894,
    price_per_hour: 42000,
    inscription_fee: 18000,
    commission_rate: 8,
    status: "verified",
    surface: "Sintetico premium",
    open_hours: "17:00 a 01:00"
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Potrero San Martin",
    slug: "potrero-san-martin",
    neighborhood: "Barracas",
    address: "Luna 550",
    latitude: -34.6412,
    longitude: -58.3772,
    price_per_hour: 38000,
    inscription_fee: 16000,
    commission_rate: 8,
    status: "verified",
    surface: "Sintetico LED",
    open_hours: "18:00 a 00:30"
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "El Fortin F7",
    slug: "el-fortin-f7",
    neighborhood: "Almagro",
    address: "Guardia Vieja 3100",
    latitude: -34.6033,
    longitude: -58.4216,
    price_per_hour: 50000,
    inscription_fee: 22000,
    commission_rate: 9,
    status: "partner",
    surface: "Sintetico mixto",
    open_hours: "16:00 a 02:00"
  }
];

const teams = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Los Pibes FC", slug: "los-pibes-fc", short_name: "LPF", badge_url: null, primary_color: "#eec15c", neighborhood: "Almagro", home_venue_id: venues[0].id },
  { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "La Cantera", slug: "la-cantera", short_name: "LCT", badge_url: null, primary_color: "#40c8ff", neighborhood: "Barracas", home_venue_id: venues[1].id },
  { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Barrio Norte", slug: "barrio-norte", short_name: "BN", badge_url: null, primary_color: "#5b7cff", neighborhood: "Palermo", home_venue_id: venues[2].id },
  { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Atletico Potrero", slug: "atletico-potrero", short_name: "ATP", badge_url: null, primary_color: "#ff6475", neighborhood: "Boedo", home_venue_id: venues[0].id }
];

const activeTournament = {
  id: "99999999-9999-4999-8999-999999999999",
  name: "Fulbito Arena Apertura",
  slug: "fulbito-arena-apertura",
  format: "world_cup" as const,
  status: "active",
  field_mode: "7v7" as const,
  registration_fee: 18000,
  max_teams: 16,
  starts_on: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  venue_id: venues[0].id
};

const players: ArenaPlayer[] = [
  { id: "player-1", team_id: teams[0].id, display_name: "Nico Gomez", alias: "Nico", jersey_number: 1, position: "Arquero", photo_url: null, goals: 0 },
  { id: "player-2", team_id: teams[0].id, display_name: "Tomi Medina", alias: "Tomi", jersey_number: 3, position: "Defensa", photo_url: null, goals: 1 },
  { id: "player-3", team_id: teams[0].id, display_name: "Beto Cabrera", alias: "Beto", jersey_number: 4, position: "Defensa", photo_url: null, goals: 0 },
  { id: "player-4", team_id: teams[0].id, display_name: "Rulo Alvarez", alias: "Rulo", jersey_number: 5, position: "Volante", photo_url: null, goals: 2 },
  { id: "player-5", team_id: teams[0].id, display_name: "Mati Romero", alias: "Mati", jersey_number: 7, position: "Volante", photo_url: null, goals: 3 },
  { id: "player-6", team_id: teams[0].id, display_name: "Facu Molina", alias: "Facu", jersey_number: 10, position: "Enganche", photo_url: null, goals: 6 },
  { id: "player-7", team_id: teams[0].id, display_name: "Joaco Ruiz", alias: "Joaco", jersey_number: 9, position: "Delantero", photo_url: null, goals: 4 }
];

const matches: ArenaMatch[] = [
  {
    id: "12121212-1212-4121-8121-121212121212",
    tournament_id: activeTournament.id,
    venue_id: venues[0].id,
    home_team_id: teams[0].id,
    away_team_id: teams[1].id,
    phase: "groups",
    round_name: "Fecha 1",
    group_code: "A",
    scheduled_at: new Date(Date.now() + 3 * 86400000).toISOString(),
    status: "scheduled",
    home_score: null,
    away_score: null
  },
  {
    id: "23232323-2323-4232-8232-232323232323",
    tournament_id: activeTournament.id,
    venue_id: venues[2].id,
    home_team_id: teams[2].id,
    away_team_id: teams[3].id,
    phase: "groups",
    round_name: "Fecha 1",
    group_code: "B",
    scheduled_at: new Date(Date.now() + 3 * 86400000 + 7200000).toISOString(),
    status: "scheduled",
    home_score: null,
    away_score: null
  },
  {
    id: "34343434-3434-4343-8343-343434343434",
    tournament_id: activeTournament.id,
    venue_id: venues[1].id,
    home_team_id: teams[0].id,
    away_team_id: teams[2].id,
    phase: "groups",
    round_name: "Fecha 0",
    group_code: "Interzona",
    scheduled_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    status: "final",
    home_score: 3,
    away_score: 1
  }
];

export function attachMatchRelations(rawMatches: ArenaMatch[], rawTeams: ArenaTeam[] = teams, rawVenues: ArenaVenue[] = venues) {
  return rawMatches.map((match) => ({
    ...match,
    homeTeam: rawTeams.find((team) => team.id === match.home_team_id) ?? null,
    awayTeam: rawTeams.find((team) => team.id === match.away_team_id) ?? null,
    venue: rawVenues.find((venue) => venue.id === match.venue_id) ?? null
  }));
}

export function computeStandings(rawTeams: ArenaTeam[], rawMatches: ArenaMatch[]) {
  const table = new Map<string, ArenaTeam>();
  rawTeams.forEach((team) => {
    table.set(team.id, {
      ...team,
      points: 0,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0
    });
  });

  rawMatches.forEach((match) => {
    if (match.status !== "final" || match.home_score === null || match.away_score === null) return;
    const home = match.home_team_id ? table.get(match.home_team_id) : null;
    const away = match.away_team_id ? table.get(match.away_team_id) : null;
    if (!home || !away) return;
    home.played = (home.played ?? 0) + 1;
    away.played = (away.played ?? 0) + 1;
    home.goalsFor = (home.goalsFor ?? 0) + match.home_score;
    home.goalsAgainst = (home.goalsAgainst ?? 0) + match.away_score;
    away.goalsFor = (away.goalsFor ?? 0) + match.away_score;
    away.goalsAgainst = (away.goalsAgainst ?? 0) + match.home_score;
    if (match.home_score > match.away_score) {
      home.won = (home.won ?? 0) + 1;
      away.lost = (away.lost ?? 0) + 1;
      home.points = (home.points ?? 0) + 3;
    } else if (match.home_score < match.away_score) {
      away.won = (away.won ?? 0) + 1;
      home.lost = (home.lost ?? 0) + 1;
      away.points = (away.points ?? 0) + 3;
    } else {
      home.drawn = (home.drawn ?? 0) + 1;
      away.drawn = (away.drawn ?? 0) + 1;
      home.points = (home.points ?? 0) + 1;
      away.points = (away.points ?? 0) + 1;
    }
    home.goalDiff = (home.goalsFor ?? 0) - (home.goalsAgainst ?? 0);
    away.goalDiff = (away.goalsFor ?? 0) - (away.goalsAgainst ?? 0);
  });

  return [...table.values()].sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || (b.goalDiff ?? 0) - (a.goalDiff ?? 0));
}

const relatedMatches = attachMatchRelations(matches);

export const demoArenaData: ArenaData = {
  source: "demo",
  configured: false,
  user: null,
  activeTournament,
  tournaments: [activeTournament],
  tournamentTeams: teams.map((team) => ({ tournament_id: activeTournament.id, team_id: team.id, status: "approved" })),
  venues,
  teams,
  players,
  matches: relatedMatches,
  standings: computeStandings(teams, relatedMatches),
  paymentRequests: [],
  paymentMessages: [],
  entitlements: [],
  billingPlans: [],
  liveChannels: [],
  livePermissions: [],
  liveEvents: [],
  featureFlags: []
};

const STORAGE_KEY = "fulbito:data:v2";

const formationCatalog = {
  "5v5": [
    { id: "gk", label: "Arquero", short: "ARQ", x: 50, y: 88 },
    { id: "def_l", label: "Defensa izquierda", short: "DEF", x: 34, y: 67 },
    { id: "def_r", label: "Defensa derecha", short: "DEF", x: 66, y: 67 },
    { id: "mid", label: "Volante", short: "VOL", x: 50, y: 46 },
    { id: "fw", label: "Delantero", short: "DEL", x: 50, y: 20 }
  ],
  "7v7": [
    { id: "gk", label: "Arquero", short: "ARQ", x: 50, y: 88 },
    { id: "def_l", label: "Defensa izquierda", short: "DEF", x: 24, y: 70 },
    { id: "def_c", label: "Defensa central", short: "DEF", x: 50, y: 72 },
    { id: "def_r", label: "Defensa derecha", short: "DEF", x: 76, y: 70 },
    { id: "mid_l", label: "Volante izquierda", short: "VOL", x: 36, y: 48 },
    { id: "mid_r", label: "Volante derecha", short: "VOL", x: 64, y: 48 },
    { id: "fw", label: "Delantero", short: "DEL", x: 50, y: 22 }
  ],
  "11v11": [
    { id: "gk", label: "Arquero", short: "ARQ", x: 50, y: 90 },
    { id: "lb", label: "Lateral izquierdo", short: "LI", x: 18, y: 72 },
    { id: "cb_l", label: "Central izquierdo", short: "DFC", x: 39, y: 74 },
    { id: "cb_r", label: "Central derecho", short: "DFC", x: 61, y: 74 },
    { id: "rb", label: "Lateral derecho", short: "LD", x: 82, y: 72 },
    { id: "cm_l", label: "Volante izquierdo", short: "MC", x: 30, y: 52 },
    { id: "cm", label: "Volante central", short: "MC", x: 50, y: 50 },
    { id: "cm_r", label: "Volante derecho", short: "MC", x: 70, y: 52 },
    { id: "lw", label: "Extremo izquierdo", short: "EI", x: 25, y: 27 },
    { id: "st", label: "Centro delantero", short: "DC", x: 50, y: 20 },
    { id: "rw", label: "Extremo derecho", short: "ED", x: 75, y: 27 }
  ]
};

const routes = {
  dashboard: "Inicio",
  torneos: "Campeonatos",
  equipos: "Equipos",
  jugadores: "Jugadores",
  fixture: "Fixture",
  tabla: "Tabla",
  formaciones: "Formaciones",
  canchas: "Canchas",
  modelo: "Negocio",
  ajustes: "Datos"
};

const $ = (selector, root = document) => root.querySelector(selector);
const app = $("#app");
const toastEl = $("#toast");
let installPrompt = null;
let toastTimer = null;
let state = normalizeData(loadData());
const routeFromHash = window.location.hash ? window.location.hash.slice(1) : "";
let currentRoute = routes[routeFromHash] ? routeFromHash : (state.ui?.route && routes[state.ui.route] ? state.ui.route : "dashboard");

function uid(prefix = "id") {
  const random = window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${random}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 2600);
}

function toInputDate(date = new Date()) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function addDays(isoDate, amount) {
  const date = isoDate ? new Date(`${isoDate}T12:00:00`) : new Date();
  date.setDate(date.getDate() + amount);
  return toInputDate(date);
}

function formatDate(isoDate) {
  if (!isoDate) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${isoDate}T12:00:00`));
}

function formatDateShort(isoDate) {
  if (!isoDate) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "2-digit", month: "short" }).format(new Date(`${isoDate}T12:00:00`));
}

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : createDemoData();
  } catch (error) {
    console.warn("No se pudo leer la base local de Fulbito", error);
    return createDemoData();
  }
}

function normalizeData(data) {
  const safe = data && typeof data === "object" ? data : createDemoData();
  safe.schemaVersion = safe.schemaVersion || 1;
  safe.venues = Array.isArray(safe.venues) ? safe.venues : [];
  safe.teams = Array.isArray(safe.teams) ? safe.teams : [];
  safe.tournaments = Array.isArray(safe.tournaments) ? safe.tournaments : [];
  safe.matches = Array.isArray(safe.matches) ? safe.matches : [];
  safe.ui = safe.ui && typeof safe.ui === "object" ? safe.ui : {};
  safe.venues.forEach((venue) => {
    venue.owner = venue.owner || "Operador barrial";
    venue.hourlyRate = venue.hourlyRate || venue.price || "$ 0";
    venue.commissionRate = Number.isFinite(Number(venue.commissionRate)) ? Number(venue.commissionRate) : 8;
    venue.status = venue.status || "Verificada";
    venue.surface = venue.surface || "Cesped sintetico";
    venue.openHours = venue.openHours || "18:00 a 00:00";
  });
  safe.teams.forEach((team) => {
    team.players = Array.isArray(team.players) ? team.players : [];
    team.lineup = team.lineup && typeof team.lineup === "object" ? team.lineup : {};
    team.formation = formationCatalog[team.formation] ? team.formation : "7v7";
  });
  if (!safe.activeTournamentId || !safe.tournaments.some((item) => item.id === safe.activeTournamentId)) {
    safe.activeTournamentId = safe.tournaments[0]?.id || "";
  }
  if (!safe.ui.selectedTeamId || !safe.teams.some((team) => team.id === safe.ui.selectedTeamId)) {
    safe.ui.selectedTeamId = safe.teams[0]?.id || "";
  }
  return safe;
}

function saveData() {
  state.ui.route = currentRoute;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createDemoData() {
  const venues = [
    { id: "cancha-la-10", name: "La Canchita del Barrio", neighborhood: "Villa del Parque", address: "Terrada 1234", phone: "+54 9 11 5555 1010", price: "$ 42.000 / hora", hourlyRate: "$ 42.000", commissionRate: 9, owner: "Familia Gomez", status: "Verificada", surface: "Cesped sintetico", openHours: "17:00 a 01:00", notes: "Cancha 7, buffet, luces LED y vestuarios." },
    { id: "potrero-sur", name: "Potrero San Martin", neighborhood: "Barracas", address: "Luna 550", phone: "+54 9 11 5555 2020", price: "$ 38.000 / hora", hourlyRate: "$ 38.000", commissionRate: 8, owner: "Club San Martin", status: "Verificada", surface: "Sintetico premium", openHours: "18:00 a 00:30", notes: "Cancha 5 y 7 con estacionamiento." },
    { id: "la-esquina", name: "El Fortin F5", neighborhood: "Almagro", address: "Guardia Vieja 3100", phone: "+54 9 11 5555 3030", price: "$ 34.000 / hora", hourlyRate: "$ 34.000", commissionRate: 7, owner: "El Fortin", status: "Alta demanda", surface: "Cesped sintetico", openHours: "16:00 a 02:00", notes: "Ideal para torneos nocturnos y sponsors locales." },
    { id: "la-union", name: "Barrio La Union", neighborhood: "Lanus", address: "Mendoza 861", phone: "+54 9 11 5555 4040", price: "$ 36.000 / hora", hourlyRate: "$ 36.000", commissionRate: 8, owner: "Cooperativa La Union", status: "Partner", surface: "Sintetico mixto", openHours: "17:30 a 00:00", notes: "Sede preparada para finales y streaming barrial." }
  ];

  const teams = [
    makeTeam("team-esquina", "Los Pibes FC", "LPF", "#d8aa4d", "Tomi Pereyra", "Almagro", "cancha-la-10", "7v7", [
      [1, "Nico Gómez", "Nico", "Arquero"], [4, "Lucho Díaz", "Lucho", "Defensa"], [2, "Bruno Salvatierra", "Bruno", "Defensa"], [8, "Eze Quiroga", "Eze", "Volante"], [10, "Facu Molina", "Facu", "Enganche"], [7, "Santi Vera", "Santi", "Extremo"], [9, "Joaco Ruiz", "Joaco", "Delantero"], [11, "Mati Torres", "Mati", "Delantero"]
    ]),
    makeTeam("team-pibes", "La Cantera", "LCT", "#44d7ff", "Rama Soto", "Barracas", "potrero-sur", "7v7", [
      [1, "Agus Franco", "Agus", "Arquero"], [3, "Ciro Medina", "Ciro", "Defensa"], [6, "Pedro Márquez", "Pedro", "Defensa"], [5, "Nacho López", "Nacho", "Volante"], [8, "Tano Beltrán", "Tano", "Volante"], [10, "Rulo Acosta", "Rulo", "Enganche"], [9, "Gonza Silva", "Gonza", "Delantero"], [14, "Damián Paz", "Dami", "Defensa"]
    ]),
    makeTeam("team-potrero", "Atletico Potrero", "ATP", "#ff6b8a", "Leo Cabrera", "Boedo", "la-esquina", "7v7", [
      [12, "Leo Fernández", "Leo", "Arquero"], [4, "Fede Castro", "Fede", "Defensa"], [13, "Pato Benítez", "Pato", "Defensa"], [6, "Chino Arias", "Chino", "Volante"], [18, "Maxi Rojas", "Maxi", "Volante"], [22, "Iñaki Sosa", "Iñaki", "Extremo"], [9, "Fran Herrera", "Fran", "Delantero"]
    ]),
    makeTeam("team-barrio", "Barrio Norte", "BN", "#4f7cff", "Seba Mena", "Palermo", "cancha-la-10", "7v7", [
      [1, "Juan Peralta", "Juan", "Arquero"], [2, "Toto Ramos", "Toto", "Defensa"], [4, "Guille Costa", "Guille", "Defensa"], [5, "Rafa Núñez", "Rafa", "Volante"], [7, "Jere Fuentes", "Jere", "Extremo"], [10, "Lucas Peña", "Luqui", "Enganche"], [9, "Alan Suárez", "Alan", "Delantero"]
    ]),
    makeTeam("team-toque", "Al Toque", "ALT", "#b7f252", "Diego Pazos", "Caballito", "la-esquina", "7v7", [
      [1, "Manu Ibarra", "Manu", "Arquero"], [4, "Tute Soria", "Tute", "Defensa"], [6, "Gero Blanco", "Gero", "Defensa"], [8, "Bauti Mieres", "Bauti", "Volante"], [15, "Lautaro Rey", "Lauta", "Volante"], [10, "Pipi Alonso", "Pipi", "Enganche"], [9, "Moro Aguirre", "Moro", "Delantero"]
    ]),
    makeTeam("team-banda", "La Banda FC", "LBF", "#a78bfa", "Nico Casas", "Flores", "potrero-sur", "7v7", [
      [1, "Dante Correa", "Dante", "Arquero"], [3, "Mauro Vidal", "Mauro", "Defensa"], [4, "Ricky Luna", "Ricky", "Defensa"], [8, "Tomi Lagos", "Tomi", "Volante"], [11, "Kevin Ortiz", "Kevin", "Extremo"], [10, "Enzo Veliz", "Enzo", "Enganche"], [9, "Brian Vega", "Brian", "Delantero"]
    ])
  ];

  const tournament = {
    id: "torneo-apertura-demo",
    name: "Fulbito Cup Apertura",
    season: "2026",
    modality: "Liga todos contra todos",
    fieldMode: "7v7",
    status: "En curso",
    startDate: addDays(toInputDate(new Date()), 2),
    pointsWin: 3,
    pointsDraw: 1,
    primaryVenueId: "cancha-la-10",
    teamIds: teams.map((team) => team.id)
  };

  const demo = {
    schemaVersion: 1,
    activeTournamentId: tournament.id,
    venues,
    teams,
    tournaments: [tournament],
    matches: [],
    ui: { selectedTeamId: teams[0].id, route: "dashboard" }
  };

  demo.matches = buildFixtureFor(demo, tournament.id, tournament.startDate);
  const completed = [
    [0, 3, 2], [1, 1, 1], [2, 4, 0], [3, 2, 2], [4, 1, 0], [5, 2, 3]
  ];
  completed.forEach(([index, homeGoals, awayGoals]) => {
    if (demo.matches[index]) {
      demo.matches[index].homeGoals = homeGoals;
      demo.matches[index].awayGoals = awayGoals;
      demo.matches[index].status = "finalizado";
    }
  });
  return demo;
}

function makeTeam(id, name, shortName, color, coach, neighborhood, venueId, formation, rawPlayers) {
  const players = rawPlayers.map(([number, fullName, alias, position], index) => ({
    id: `${id}-p${index + 1}`,
    number,
    name: fullName,
    alias,
    position,
    photo: "",
    goals: 0,
    yellowCards: 0,
    redCards: 0
  }));
  const lineup = {};
  formationCatalog[formation].forEach((slot, index) => {
    if (players[index]) lineup[slot.id] = players[index].id;
  });
  return { id, name, shortName, color, coach, neighborhood, venueId, formation, players, lineup };
}

function activeTournament() {
  return state.tournaments.find((tournament) => tournament.id === state.activeTournamentId) || null;
}

function getTeam(teamId) {
  return state.teams.find((team) => team.id === teamId) || null;
}

function getVenue(venueId) {
  return state.venues.find((venue) => venue.id === venueId) || null;
}

function getTournamentTeams(tournamentId = state.activeTournamentId) {
  const tournament = state.tournaments.find((item) => item.id === tournamentId);
  if (!tournament) return [];
  return tournament.teamIds.map(getTeam).filter(Boolean);
}

function getTournamentMatches(tournamentId = state.activeTournamentId) {
  return state.matches
    .filter((match) => match.tournamentId === tournamentId)
    .sort((a, b) => a.round - b.round || `${a.date || ""}${a.time || ""}`.localeCompare(`${b.date || ""}${b.time || ""}`));
}

function getPlayer(team, playerId) {
  return team?.players?.find((player) => player.id === playerId) || null;
}

function getFormationSlots(name) {
  return formationCatalog[name] || formationCatalog["7v7"];
}

function initials(name = "?") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function teamBadge(team, extraClass = "") {
  if (!team) return `<span class="badge ${extraClass}">?</span>`;
  const style = `style="background: linear-gradient(135deg, ${escapeHtml(team.color || "#25d977")}, #f8fff9);"`;
  return `<span class="badge ${extraClass}" ${style}>${escapeHtml(team.shortName || initials(team.name))}</span>`;
}

function avatar(player, extraClass = "") {
  if (!player) return `<span class="avatar ${extraClass}">?</span>`;
  const label = player.alias || player.name;
  if (player.photo) {
    return `<span class="avatar ${extraClass}"><img src="${escapeHtml(player.photo)}" alt="Foto de ${escapeHtml(label)}" loading="lazy"></span>`;
  }
  return `<span class="avatar ${extraClass}">${escapeHtml(initials(label))}</span>`;
}

function venueName(venueId) {
  return getVenue(venueId)?.name || "Cancha a confirmar";
}

function teamName(teamId) {
  return getTeam(teamId)?.name || "Equipo eliminado";
}

function buildFixtureFor(data, tournamentId, startDate = toInputDate(new Date())) {
  const tournament = data.tournaments.find((item) => item.id === tournamentId);
  if (!tournament || tournament.teamIds.length < 2) return [];
  const rounds = roundRobin(tournament.teamIds);
  const times = ["20:00", "21:00", "22:00", "23:00"];
  const matches = [];
  rounds.forEach((games, roundIndex) => {
    const roundDate = addDays(startDate, roundIndex * 7);
    games.forEach((game, gameIndex) => {
      const home = data.teams.find((team) => team.id === game.homeId);
      matches.push({
        id: uid("match"),
        tournamentId,
        round: roundIndex + 1,
        homeId: game.homeId,
        awayId: game.awayId,
        date: roundDate,
        time: times[gameIndex % times.length],
        venueId: home?.venueId || tournament.primaryVenueId || data.venues[0]?.id || "",
        status: "programado",
        homeGoals: null,
        awayGoals: null
      });
    });
  });
  return matches;
}

function roundRobin(teamIds) {
  const list = [...teamIds];
  if (list.length % 2 !== 0) list.push(null);
  const rounds = [];
  let rotating = [...list];
  const totalRounds = rotating.length - 1;
  const gamesPerRound = rotating.length / 2;

  for (let round = 0; round < totalRounds; round += 1) {
    const games = [];
    for (let index = 0; index < gamesPerRound; index += 1) {
      let homeId = rotating[index];
      let awayId = rotating[rotating.length - 1 - index];
      if (homeId && awayId) {
        if (round % 2 === 1) [homeId, awayId] = [awayId, homeId];
        games.push({ homeId, awayId });
      }
    }
    rounds.push(games);
    rotating = [rotating[0], rotating[rotating.length - 1], ...rotating.slice(1, rotating.length - 1)];
  }
  return rounds;
}

function computeStandings(tournamentId = state.activeTournamentId) {
  const tournament = state.tournaments.find((item) => item.id === tournamentId);
  if (!tournament) return [];
  const table = new Map();
  tournament.teamIds.forEach((teamId) => {
    const team = getTeam(teamId);
    if (team) {
      table.set(teamId, {
        team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0
      });
    }
  });

  getTournamentMatches(tournamentId).forEach((match) => {
    if (match.status !== "finalizado" || match.homeGoals === null || match.awayGoals === null) return;
    const home = table.get(match.homeId);
    const away = table.get(match.awayId);
    if (!home || !away) return;
    home.played += 1;
    away.played += 1;
    home.goalsFor += Number(match.homeGoals);
    home.goalsAgainst += Number(match.awayGoals);
    away.goalsFor += Number(match.awayGoals);
    away.goalsAgainst += Number(match.homeGoals);

    if (Number(match.homeGoals) > Number(match.awayGoals)) {
      home.won += 1;
      away.lost += 1;
      home.points += Number(tournament.pointsWin || 3);
    } else if (Number(match.homeGoals) < Number(match.awayGoals)) {
      away.won += 1;
      home.lost += 1;
      away.points += Number(tournament.pointsWin || 3);
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += Number(tournament.pointsDraw ?? 1);
      away.points += Number(tournament.pointsDraw ?? 1);
    }
  });

  return [...table.values()]
    .map((row) => ({ ...row, goalDiff: row.goalsFor - row.goalsAgainst }))
    .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor || a.team.name.localeCompare(b.team.name));
}

function currencyARS(value) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value || 0);
}

function businessMetrics() {
  const tournament = activeTournament();
  const teams = tournament ? getTournamentTeams(tournament.id) : state.teams;
  const matches = tournament ? getTournamentMatches(tournament.id) : state.matches;
  const bookingAverage = 38000;
  const inscriptionFee = 18000;
  const sponsorFee = 65000;
  const platformMonthlyFee = 24000;
  const commissionAverage = state.venues.length
    ? state.venues.reduce((sum, venue) => sum + Number(venue.commissionRate || 8), 0) / state.venues.length
    : 8;
  const bookingRevenue = Math.round(matches.length * bookingAverage * (commissionAverage / 100));
  const inscriptionRevenue = teams.length * inscriptionFee;
  const venueSaasRevenue = state.venues.length * platformMonthlyFee;
  const sponsorRevenue = Math.max(1, Math.ceil(matches.length / 4)) * sponsorFee;
  return {
    bookingRevenue,
    inscriptionRevenue,
    venueSaasRevenue,
    sponsorRevenue,
    total: bookingRevenue + inscriptionRevenue + venueSaasRevenue + sponsorRevenue,
    commissionAverage,
    bookingAverage,
    inscriptionFee,
    sponsorFee,
    platformMonthlyFee
  };
}

function render() {
  state = normalizeData(state);
  saveData();
  if (window.location.hash !== `#${currentRoute}`) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${currentRoute}`);
  }
  renderTournamentSelect();
  renderNavState();
  renderHeroMatch();

  const view = {
    dashboard: renderDashboard,
    torneos: renderTournaments,
    equipos: renderTeams,
    jugadores: renderPlayers,
    fixture: renderFixture,
    tabla: renderTable,
    formaciones: renderLineups,
    canchas: renderVenues,
    modelo: renderBusiness,
    ajustes: renderSettings
  }[currentRoute] || renderDashboard;

  app.innerHTML = view();
  app.focus({ preventScroll: true });
}

function renderTournamentSelect() {
  const select = $("#tournamentSelect");
  if (!select) return;
  if (!state.tournaments.length) {
    select.innerHTML = `<option value="">Sin campeonatos</option>`;
    select.disabled = true;
    return;
  }
  select.disabled = false;
  select.innerHTML = state.tournaments.map((tournament) => `<option value="${escapeHtml(tournament.id)}" ${tournament.id === state.activeTournamentId ? "selected" : ""}>${escapeHtml(tournament.name)}</option>`).join("");
}

function renderNavState() {
  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.route === currentRoute);
  });
}

function renderHeroMatch() {
  const title = $("#heroMatch");
  const meta = $("#heroMatchMeta");
  const tournament = activeTournament();
  if (!title || !meta || !tournament) return;
  const nextMatch = getTournamentMatches(tournament.id).find((match) => match.status !== "finalizado");
  if (nextMatch) {
    title.textContent = `${teamName(nextMatch.homeId)} vs ${teamName(nextMatch.awayId)}`;
    meta.textContent = `${formatDateShort(nextMatch.date)} · ${nextMatch.time} · ${venueName(nextMatch.venueId)}`;
  } else {
    title.textContent = tournament.name;
    meta.textContent = `${getTournamentTeams(tournament.id).length} equipos · ${tournament.status}`;
  }
}

function viewHeader(title, text, actions = "") {
  return `
    <header class="view-header">
      <div>
        <p class="eyebrow">${escapeHtml(routes[currentRoute] || "Fulbito")}</p>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(text)}</p>
      </div>
      ${actions ? `<div class="actions">${actions}</div>` : ""}
    </header>
  `;
}

function renderDashboard() {
  const tournament = activeTournament();
  if (!tournament) {
    return `${viewHeader("Bienvenido a Fulbito", "Creá tu primer campeonato para empezar a cargar equipos, fechas y tablas.")}${emptyState("Todavía no hay campeonatos", "Abrí la sección Campeonatos y creá la primera liga amateur.", "Crear campeonato", "torneos")}`;
  }
  const teams = getTournamentTeams(tournament.id);
  const matches = getTournamentMatches(tournament.id);
  const completed = matches.filter((match) => match.status === "finalizado");
  const pending = matches.filter((match) => match.status !== "finalizado");
  const leaders = computeStandings(tournament.id).slice(0, 5);
  const nextMatches = pending.slice(0, 3);
  const featuredMatch = nextMatches[0] || matches[0] || null;
  const metrics = businessMetrics();

  return `
    ${viewHeader(
      tournament.name,
      `${tournament.modality} · ${tournament.fieldMode} · ${tournament.status}. Esta pantalla resume el campeonato activo con tabla, fixture y equipos.` ,
      `<button class="btn btn--primary" data-route="fixture">Cargar resultados</button><button class="btn btn--ghost" data-route="formaciones">Ver formaciones</button>`
    )}

    ${renderCommandCenter(tournament, featuredMatch, metrics)}

    <section class="grid grid--4">
      ${statCard(teams.length, "Equipos inscriptos")}
      ${statCard(matches.length, "Partidos generados")}
      ${statCard(completed.length, "Resultados cargados")}
      ${statCard(currencyARS(metrics.total), "Ingresos demo")}
    </section>

    <section class="grid grid--2" style="margin-top: 16px;">
      <article class="panel">
        <div class="team-head">
          <div>
            <h3>Tabla rápida</h3>
            <p class="muted">Los primeros puestos del campeonato activo.</p>
          </div>
          <button class="btn btn--small btn--ghost" data-route="tabla">Tabla completa</button>
        </div>
        ${leaders.length ? `<div class="table-wrap" style="box-shadow:none;"><table><thead><tr><th>#</th><th>Equipo</th><th>Pts</th><th>DG</th><th>PJ</th></tr></thead><tbody>${leaders.map((row, index) => `
          <tr>
            <td><span class="rank ${index === 0 ? "rank--top" : ""}">${index + 1}</span></td>
            <td>${teamBadge(row.team)} ${escapeHtml(row.team.name)}</td>
            <td><strong>${row.points}</strong></td>
            <td>${row.goalDiff}</td>
            <td>${row.played}</td>
          </tr>`).join("")}</tbody></table></div>` : `<p class="muted">Todavía no hay equipos para calcular tabla.</p>`}
      </article>

      <article class="panel">
        <div class="team-head">
          <div>
            <h3>Próximas fechas</h3>
            <p class="muted">Agenda de partidos pendientes.</p>
          </div>
          <button class="btn btn--small btn--ghost" data-route="fixture">Ver fixture</button>
        </div>
        ${nextMatches.length ? `<div class="match-list">${nextMatches.map(renderMiniMatch).join("")}</div>` : `<p class="muted">No hay partidos pendientes. Generá un fixture nuevo o creá otro campeonato.</p>`}
      </article>
    </section>

    <section style="margin-top: 16px;">
      <div class="team-head" style="margin-bottom: 12px;">
        <div>
          <h3>Equipos protagonistas</h3>
          <p class="muted">Cada equipo puede tener plantel, foto del jugador y formación propia.</p>
        </div>
        <button class="btn btn--small btn--ghost" data-route="equipos">Ver equipos</button>
      </div>
      <div class="grid grid--3">${teams.slice(0, 6).map(renderTeamCard).join("") || emptyInline("No hay equipos inscriptos todavía.")}</div>
    </section>
  `;
}

function statCard(value, label) {
  return `<article class="stat"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`;
}

function renderCommandCenter(tournament, match, metrics) {
  const home = match ? getTeam(match.homeId) : null;
  const away = match ? getTeam(match.awayId) : null;
  return `
    <section class="command-center">
      <article class="match-spotlight">
        <span class="screen-label">Proximo partido</span>
        <div class="spotlight-teams">
          <div>${teamBadge(home, "badge--large")}<strong>${escapeHtml(home?.name || "Local")}</strong></div>
          <b>VS</b>
          <div>${teamBadge(away, "badge--large")}<strong>${escapeHtml(away?.name || "Visitante")}</strong></div>
        </div>
        <p>${escapeHtml(match ? `Fecha ${match.round} · ${formatDateShort(match.date)} · ${match.time} · ${venueName(match.venueId)}` : "Fixture pendiente")}</p>
      </article>
      <article class="market-pulse">
        <span class="screen-label">Pulso comercial</span>
        <strong>${currencyARS(metrics.total)}</strong>
        <p>Demo: inscripciones, canchas partner, sponsors y comision por reservas.</p>
        <button class="btn btn--small btn--ghost" data-route="modelo">Ver modelo</button>
      </article>
    </section>
  `;
}

function renderMiniMatch(match) {
  const home = getTeam(match.homeId);
  const away = getTeam(match.awayId);
  return `
    <div class="match-row">
      <div class="match-teams" style="grid-template-columns: 1fr; gap: 4px;">
        <strong>${escapeHtml(home?.name || "Equipo") } vs ${escapeHtml(away?.name || "Equipo")}</strong>
        <span class="meta">Fecha ${match.round} · ${formatDateShort(match.date)} · ${match.time} · ${escapeHtml(venueName(match.venueId))}</span>
      </div>
      <span class="status-pill">Programado</span>
    </div>
  `;
}

function renderTournaments() {
  const tournament = activeTournament();
  const teamCheckboxes = state.teams.length ? state.teams.map((team) => `
    <label class="check-card">
      <input type="checkbox" data-action="toggleTournamentTeam" data-tournament-id="${escapeHtml(tournament?.id || "")}" data-team-id="${escapeHtml(team.id)}" ${tournament?.teamIds?.includes(team.id) ? "checked" : ""} ${!tournament ? "disabled" : ""}>
      <span>${teamBadge(team)} ${escapeHtml(team.name)}</span>
    </label>`).join("") : `<p class="muted">Primero cargá equipos para poder inscribirlos.</p>`;

  return `
    ${viewHeader(
      "Campeonatos y ligas",
      "Creá torneos para una cancha específica o para varias sedes barriales. Podés usar formato liga todos contra todos y mantener puntos automáticamente.",
      `<button class="btn btn--ghost" data-route="equipos">Crear equipo</button>`
    )}

    <section class="grid grid--2">
      <form id="tournamentForm" class="panel">
        <h3>Nuevo campeonato</h3>
        <div class="form-grid">
          <label class="field"><span>Nombre</span><input class="input" name="name" required placeholder="Fulbito Cup Clausura"></label>
          <label class="field"><span>Temporada</span><input class="input" name="season" placeholder="2026"></label>
          <label class="field"><span>Modalidad</span><select name="modality"><option>Liga todos contra todos</option><option>Grupos + final</option><option>Copa eliminación directa</option></select></label>
          <label class="field"><span>Formato de cancha</span><select name="fieldMode"><option>5v5</option><option selected>7v7</option><option>11v11</option></select></label>
          <label class="field"><span>Puntos por victoria</span><input class="input" name="pointsWin" type="number" min="1" value="3"></label>
          <label class="field"><span>Puntos por empate</span><input class="input" name="pointsDraw" type="number" min="0" value="1"></label>
          <label class="field"><span>Cancha principal</span><select name="primaryVenueId">${venueOptions()}</select></label>
          <label class="field"><span>Inicio estimado</span><input class="input" name="startDate" type="date" value="${addDays(toInputDate(new Date()), 7)}"></label>
          <label class="check-card span-2"><input type="checkbox" name="addAllTeams" checked><span>Inscribir todos los equipos ya cargados</span></label>
        </div>
        <button class="btn btn--primary" type="submit">Crear campeonato</button>
      </form>

      <article class="panel">
        <h3>Inscripción del campeonato activo</h3>
        <p class="muted">Marcá qué equipos participan en <strong>${escapeHtml(tournament?.name || "el campeonato activo")}</strong>. La tabla y el fixture usan esta lista.</p>
        <div class="checkbox-grid">${teamCheckboxes}</div>
        <div class="inline-actions">
          <button class="btn btn--primary" data-action="generateFixture">Generar fixture con inscriptos</button>
          <button class="btn btn--ghost" data-route="tabla">Ver tabla</button>
        </div>
      </article>
    </section>

    <section style="margin-top: 16px;">
      <h3>Todos los campeonatos</h3>
      <div class="tournament-list">${state.tournaments.map(renderTournamentRow).join("") || emptyInline("No hay campeonatos creados.")}</div>
    </section>
  `;
}

function renderTournamentRow(tournament) {
  const teams = getTournamentTeams(tournament.id).length;
  const matches = getTournamentMatches(tournament.id).length;
  const isActive = tournament.id === state.activeTournamentId;
  return `
    <article class="tournament-row">
      <div class="tournament-main">
        <strong>${escapeHtml(tournament.name)} ${isActive ? `<span class="pill">Activo</span>` : ""}</strong>
        <span class="meta">${escapeHtml(tournament.modality)} · ${escapeHtml(tournament.fieldMode)} · ${teams} equipos · ${matches} partidos</span>
      </div>
      <div class="inline-actions">
        <button class="btn btn--small ${isActive ? "btn--primary" : "btn--ghost"}" data-action="activateTournament" data-tournament-id="${escapeHtml(tournament.id)}">${isActive ? "Activo" : "Activar"}</button>
        <button class="btn btn--small btn--danger" data-action="deleteTournament" data-tournament-id="${escapeHtml(tournament.id)}">Eliminar</button>
      </div>
    </article>
  `;
}

function renderTeams() {
  const tournament = activeTournament();
  const teams = tournament ? getTournamentTeams(tournament.id) : state.teams;
  return `
    ${viewHeader(
      "Equipos con identidad propia",
      "Cargá escudo por iniciales, color, barrio, DT/delegado y cancha local. Cada equipo puede tener su plantel y su formación.",
      `<button class="btn btn--ghost" data-route="jugadores">Cargar jugadores</button>`
    )}

    <section class="grid grid--2">
      <form id="teamForm" class="panel">
        <h3>Inscribir equipo</h3>
        <div class="form-grid">
          <label class="field"><span>Nombre del equipo</span><input class="input" name="name" required placeholder="Los del Miércoles FC"></label>
          <label class="field"><span>Sigla / escudo</span><input class="input" name="shortName" maxlength="4" placeholder="LDM"></label>
          <label class="field"><span>Delegado / DT</span><input class="input" name="coach" placeholder="Nombre del responsable"></label>
          <label class="field"><span>Barrio</span><input class="input" name="neighborhood" placeholder="Caballito"></label>
          <label class="field"><span>Color principal</span><input class="input" name="color" type="color" value="#25d977"></label>
          <label class="field"><span>Cancha local</span><select name="venueId">${venueOptions()}</select></label>
          <label class="field"><span>Formación base</span><select name="formation"><option>5v5</option><option selected>7v7</option><option>11v11</option></select></label>
          <label class="check-card"><input type="checkbox" name="enrollActive" checked><span>Inscribir en el campeonato activo</span></label>
        </div>
        <button class="btn btn--primary" type="submit">Guardar equipo</button>
      </form>

      <article class="panel">
        <h3>Resumen de inscripción</h3>
        <p class="muted">Campeonato activo: <strong>${escapeHtml(tournament?.name || "Sin campeonato")}</strong>.</p>
        <div class="kpi-row">
          <span class="pill">${state.teams.length} equipos totales</span>
          <span class="pill">${teams.length} inscriptos activos</span>
          <span class="pill">${state.venues.length} canchas</span>
        </div>
        <hr>
        <p class="muted">Tip: después de crear el equipo, entrá en Jugadores para cargar fotos y en Formaciones para armar el once, siete o cinco inicial.</p>
      </article>
    </section>

    <section style="margin-top: 16px;">
      <div class="team-head" style="margin-bottom: 12px;">
        <h3>${tournament ? "Equipos del campeonato activo" : "Equipos"}</h3>
        <button class="btn btn--small btn--ghost" data-route="torneos">Cambiar inscriptos</button>
      </div>
      <div class="grid grid--3">${teams.map(renderTeamCard).join("") || emptyState("No hay equipos inscriptos", "Cargá el primer equipo para empezar a armar el campeonato.", "Crear equipo", "equipos")}</div>
    </section>
  `;
}

function renderTeamCard(team) {
  const venue = getVenue(team.venueId);
  return `
    <article class="card team-card">
      <div class="team-head">
        <div class="team-side">
          ${teamBadge(team)}
          <div class="team-title">
            <strong>${escapeHtml(team.name)}</strong>
            <span class="meta"><span class="color-dot" style="--dot:${escapeHtml(team.color || "#25d977")}"></span> ${escapeHtml(team.neighborhood || "Barrio sin cargar")}</span>
          </div>
        </div>
        <span class="pill">${escapeHtml(team.formation)}</span>
      </div>
      <div class="kpi-row">
        <span class="pill">${team.players.length} jugadores</span>
        <span class="pill">DT: ${escapeHtml(team.coach || "Sin DT")}</span>
        <span class="pill">${escapeHtml(venue?.name || "Sin cancha")}</span>
      </div>
      <div class="card-actions">
        <button class="btn btn--small btn--primary" data-focus-team="${escapeHtml(team.id)}" data-route-target="formaciones">Formación</button>
        <button class="btn btn--small btn--ghost" data-focus-team="${escapeHtml(team.id)}" data-route-target="jugadores">Plantel</button>
        <button class="btn btn--small btn--danger" data-action="deleteTeam" data-team-id="${escapeHtml(team.id)}">Eliminar</button>
      </div>
    </article>
  `;
}

function renderPlayers() {
  const selectedTeam = getTeam(state.ui.selectedTeamId) || state.teams[0] || null;
  const playerRows = selectedTeam?.players?.map((player) => renderPlayerRow(player, selectedTeam)).join("") || "";
  return `
    ${viewHeader(
      "Planteles y fichas de jugador",
      "Cargá nombre, apodo, dorsal, posición y foto. Las fotos se guardan localmente si subís un archivo desde este dispositivo.",
      `<button class="btn btn--ghost" data-route="formaciones">Armar formación</button>`
    )}

    <section class="grid grid--2">
      <form id="playerForm" class="panel">
        <h3>Agregar jugador</h3>
        <label class="field"><span>Equipo</span><select id="playerTeamSelect" name="teamId">${teamOptions(selectedTeam?.id)}</select></label>
        <div class="form-grid">
          <label class="field"><span>Nombre completo</span><input class="input" name="name" required placeholder="Nombre y apellido"></label>
          <label class="field"><span>Apodo en camiseta</span><input class="input" name="alias" placeholder="El 10"></label>
          <label class="field"><span>Dorsal</span><input class="input" name="number" type="number" min="0" max="999" placeholder="10"></label>
          <label class="field"><span>Posición</span><select name="position"><option>Arquero</option><option>Defensa</option><option>Volante</option><option>Enganche</option><option>Extremo</option><option>Delantero</option></select></label>
          <label class="field"><span>Foto por URL</span><input class="input" name="photoUrl" type="url" placeholder="https://..."></label>
          <label class="field"><span>O subir foto</span><input class="input" name="photoFile" type="file" accept="image/*"></label>
        </div>
        <button class="btn btn--primary" type="submit" ${selectedTeam ? "" : "disabled"}>Guardar jugador</button>
      </form>

      <article class="panel">
        <h3>Plantel de ${escapeHtml(selectedTeam?.name || "un equipo")}</h3>
        <p class="muted">Los jugadores se pueden asignar a una posición exacta desde Formaciones.</p>
        <div class="player-list">${playerRows || emptyInline("Este equipo todavía no tiene jugadores.")}</div>
      </article>
    </section>
  `;
}

function renderPlayerRow(player, team) {
  return `
    <div class="player-row">
      <div class="team-side">
        ${avatar(player)}
        <div class="player-main">
          <strong>#${escapeHtml(player.number || "-")} ${escapeHtml(player.name)}</strong>
          <span class="meta">${escapeHtml(player.alias || "Sin apodo")} · ${escapeHtml(player.position || "Sin posición")}</span>
        </div>
      </div>
      <button class="btn btn--small btn--danger" data-action="deletePlayer" data-team-id="${escapeHtml(team.id)}" data-player-id="${escapeHtml(player.id)}">Eliminar</button>
    </div>
  `;
}

function renderFixture() {
  const tournament = activeTournament();
  if (!tournament) return `${viewHeader("Fixture", "Creá un campeonato antes de generar partidos.")}${emptyState("Sin campeonato activo", "Necesitás crear o activar un campeonato.", "Ir a campeonatos", "torneos")}`;
  const teams = getTournamentTeams(tournament.id);
  const matches = getTournamentMatches(tournament.id);
  const grouped = groupBy(matches, (match) => match.round);
  const defaultStart = tournament.startDate || addDays(toInputDate(new Date()), 7);

  return `
    ${viewHeader(
      "Fixture y resultados",
      "Generá fechas todos contra todos, asigná canchas y cargá resultados. La tabla se recalcula automáticamente.",
      `<button class="btn btn--ghost" data-route="tabla">Ver tabla</button>`
    )}

    <section class="panel" id="fixtureGenerator">
      <form id="fixtureForm" class="form-grid form-grid--3">
        <label class="field"><span>Fecha de inicio</span><input class="input" type="date" name="startDate" value="${escapeHtml(defaultStart)}"></label>
        <label class="field"><span>Equipos inscriptos</span><input class="input" value="${teams.length}" disabled></label>
        <label class="field"><span>Partidos actuales</span><input class="input" value="${matches.length}" disabled></label>
        <div class="span-3 inline-actions">
          <button class="btn btn--primary" type="submit" ${teams.length < 2 ? "disabled" : ""}>Generar / regenerar fixture</button>
          <button class="btn btn--ghost" type="button" data-route="torneos">Editar inscriptos</button>
        </div>
      </form>
      ${teams.length < 2 ? `<p class="muted">Necesitás al menos 2 equipos inscriptos para generar el fixture.</p>` : ""}
    </section>

    <section style="margin-top: 18px;">
      ${matches.length ? Object.keys(grouped).map((round) => renderRound(Number(round), grouped[round])).join("") : emptyState("Todavía no hay fixture", "Generá las fechas con los equipos inscriptos en el campeonato activo.", "Generar fixture", "fixture")}
    </section>
  `;
}

function renderRound(round, matches) {
  const firstDate = matches[0]?.date;
  return `
    <article class="fixture-round">
      <div class="round-title"><span>Fecha ${round}</span><span>${formatDate(firstDate)}</span></div>
      ${matches.map(renderMatchCard).join("")}
    </article>
  `;
}

function renderMatchCard(match) {
  const home = getTeam(match.homeId);
  const away = getTeam(match.awayId);
  const done = match.status === "finalizado";
  return `
    <article class="match-card">
      <div>
        <div class="match-teams">
          <div class="team-side">${teamBadge(home)}<strong>${escapeHtml(home?.name || "Equipo")}</strong></div>
          <span class="score">${done ? `${match.homeGoals} - ${match.awayGoals}` : "vs"}</span>
          <div class="team-side team-side--away"><strong>${escapeHtml(away?.name || "Equipo")}</strong>${teamBadge(away)}</div>
        </div>
        <div class="kpi-row">
          <span class="status-pill ${done ? "status-pill--done" : ""}">${done ? "Finalizado" : "Programado"}</span>
          <span class="pill">${formatDateShort(match.date)}</span>
          <span class="pill">${escapeHtml(match.time || "Hora a confirmar")}</span>
          <span class="pill">${escapeHtml(venueName(match.venueId))}</span>
        </div>
      </div>
      <div class="match-editor" aria-label="Cargar resultado">
        <input class="input score-input" data-score-home="${escapeHtml(match.id)}" type="number" min="0" inputmode="numeric" value="${done ? escapeHtml(match.homeGoals) : ""}" aria-label="Goles local">
        <span>-</span>
        <input class="input score-input" data-score-away="${escapeHtml(match.id)}" type="number" min="0" inputmode="numeric" value="${done ? escapeHtml(match.awayGoals) : ""}" aria-label="Goles visitante">
        <button class="btn btn--small btn--primary" data-action="saveResult" data-match-id="${escapeHtml(match.id)}">Guardar</button>
        <button class="btn btn--small btn--ghost" data-action="clearResult" data-match-id="${escapeHtml(match.id)}">Limpiar</button>
      </div>
    </article>
  `;
}

function renderTable() {
  const tournament = activeTournament();
  const rows = computeStandings(tournament?.id);
  return `
    ${viewHeader(
      "Tabla de posiciones",
      "Puntos, partidos jugados, diferencia de gol y goles a favor se actualizan cada vez que cargás un resultado.",
      `<button class="btn btn--primary" data-route="fixture">Cargar resultado</button>`
    )}
    ${rows.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Pos</th><th>Equipo</th><th>Pts</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th></tr></thead>
      <tbody>${rows.map((row, index) => `
        <tr>
          <td><span class="rank ${index === 0 ? "rank--top" : ""}">${index + 1}</span></td>
          <td>${teamBadge(row.team)} <strong>${escapeHtml(row.team.name)}</strong></td>
          <td><strong>${row.points}</strong></td>
          <td>${row.played}</td>
          <td>${row.won}</td>
          <td>${row.drawn}</td>
          <td>${row.lost}</td>
          <td>${row.goalsFor}</td>
          <td>${row.goalsAgainst}</td>
          <td>${row.goalDiff}</td>
        </tr>`).join("")}</tbody>
    </table></div>` : emptyState("Sin equipos en tabla", "Inscribí equipos en el campeonato activo para ver posiciones.", "Ir a equipos", "equipos")}
  `;
}

function renderLineups() {
  const tournamentTeams = getTournamentTeams();
  const selectedTeam = getTeam(state.ui.selectedTeamId) || tournamentTeams[0] || state.teams[0] || null;
  const slots = getFormationSlots(selectedTeam?.formation || "7v7");
  const controls = selectedTeam ? slots.map((slot) => renderSlotControl(selectedTeam, slot)).join("") : "";
  return `
    ${viewHeader(
      "Formaciones estilo transmisión",
      "Elegí el equipo, el formato de cancha y asigná jugadores a cada posición. Ideal para mostrar la previa como una liga profesional.",
      `<button class="btn btn--ghost" data-route="jugadores">Cargar fotos</button>`
    )}

    ${selectedTeam ? `
      <section class="formation-layout">
        <article class="formation-pitch" aria-label="Cancha con formación de ${escapeHtml(selectedTeam.name)}">
          ${slots.map((slot) => renderPitchPlayer(selectedTeam, slot)).join("")}
        </article>
        <aside class="panel">
          <h3>${escapeHtml(selectedTeam.name)}</h3>
          <label class="field"><span>Equipo</span><select id="formationTeamSelect">${teamOptions(selectedTeam.id)}</select></label>
          <label class="field"><span>Formato</span><select id="formationNameSelect">${Object.keys(formationCatalog).map((name) => `<option value="${name}" ${name === selectedTeam.formation ? "selected" : ""}>${name}</option>`).join("")}</select></label>
          <p class="muted">Arriba se ve cómo saldría la formación publicada para el partido.</p>
          <div class="slot-list">${controls}</div>
        </aside>
      </section>` : emptyState("Sin equipos", "Cargá al menos un equipo para armar formaciones.", "Crear equipo", "equipos")}
  `;
}

function renderPitchPlayer(team, slot) {
  const player = getPlayer(team, team.lineup?.[slot.id]);
  return `
    <div class="pitch-player" style="--x:${slot.x}%; --y:${slot.y}%">
      ${player ? avatar(player) : `<span class="avatar">${escapeHtml(slot.short)}</span>`}
      <strong>${escapeHtml(player?.alias || player?.name || "Sin jugador")}</strong>
      <small>${escapeHtml(slot.label)}</small>
    </div>
  `;
}

function renderSlotControl(team, slot) {
  const currentPlayerId = team.lineup?.[slot.id] || "";
  const options = [`<option value="">Sin asignar</option>`].concat(team.players.map((player) => `<option value="${escapeHtml(player.id)}" ${player.id === currentPlayerId ? "selected" : ""}>#${escapeHtml(player.number || "-")} ${escapeHtml(player.alias || player.name)} · ${escapeHtml(player.position || "")}</option>`));
  return `
    <div class="slot-item">
      <label>
        <span>${escapeHtml(slot.label)}</span>
        <select data-action="lineupSlot" data-team-id="${escapeHtml(team.id)}" data-slot-id="${escapeHtml(slot.id)}">${options.join("")}</select>
      </label>
    </div>
  `;
}

function renderVenues() {
  return `
    ${viewHeader(
      "Canchas de barrio",
      "Registrá sedes, horarios, tarifa por hora y comision para operar torneos entre canchas.",
      `<button class="btn btn--ghost" data-route="modelo">Ver negocio</button>`
    )}
    <section class="grid grid--2">
      <form id="venueForm" class="panel">
        <h3>Nueva cancha</h3>
        <div class="form-grid">
          <label class="field"><span>Nombre</span><input class="input" name="name" required placeholder="La 10 del Barrio"></label>
          <label class="field"><span>Barrio</span><input class="input" name="neighborhood" placeholder="Almagro"></label>
          <label class="field"><span>Dirección</span><input class="input" name="address" placeholder="Calle 123"></label>
          <label class="field"><span>Teléfono / WhatsApp</span><input class="input" name="phone" placeholder="+54 9 ..."></label>
          <label class="field"><span>Tarifa por hora</span><input class="input" name="hourlyRate" placeholder="$ 38.000"></label>
          <label class="field"><span>Comisión Fulbito %</span><input class="input" name="commissionRate" type="number" min="0" max="30" value="8"></label>
          <label class="field"><span>Responsable</span><input class="input" name="owner" placeholder="Operador / club"></label>
          <label class="field"><span>Horario fuerte</span><input class="input" name="openHours" placeholder="18:00 a 00:00"></label>
          <label class="field"><span>Superficie</span><input class="input" name="surface" placeholder="Cesped sintetico"></label>
          <label class="field"><span>Estado</span><select name="status"><option>Verificada</option><option>Partner</option><option>Alta demanda</option><option>En revision</option></select></label>
          <label class="field"><span>Notas</span><input class="input" name="notes" placeholder="Césped sintético, luces, buffet..."></label>
        </div>
        <button class="btn btn--primary" type="submit">Guardar cancha</button>
      </form>
      <article class="panel">
        <h3>Sedes cargadas</h3>
        <div class="venue-list">${state.venues.map(renderVenueRow).join("") || emptyInline("No hay canchas cargadas.")}</div>
      </article>
    </section>
  `;
}

function renderVenueRow(venue) {
  return `
    <div class="venue-row">
      <div class="venue-main">
        <strong>${escapeHtml(venue.name)}</strong>
        <span class="meta">${escapeHtml(venue.neighborhood || "Sin barrio")} · ${escapeHtml(venue.address || "Sin dirección")}</span>
        <span class="meta">${escapeHtml(venue.hourlyRate || venue.price || "Sin tarifa")} · ${escapeHtml(venue.openHours || "Sin horario")} · ${escapeHtml(venue.status || "Sin estado")}</span>
        <span class="meta">${escapeHtml(venue.phone || "Sin contacto")} · ${escapeHtml(venue.owner || "Sin responsable")} · ${escapeHtml(venue.notes || "")}</span>
        <span class="venue-chip">${escapeHtml(venue.surface || "Superficie")} · ${Number(venue.commissionRate || 0)}% Fulbito</span>
      </div>
      <button class="btn btn--small btn--danger" data-action="deleteVenue" data-venue-id="${escapeHtml(venue.id)}">Eliminar</button>
    </div>
  `;
}

function renderBusiness() {
  const metrics = businessMetrics();
  const revenueStreams = [
    ["Inscripción por equipo", currencyARS(metrics.inscriptionFee), "Cobro al anotar un equipo en torneos barriales."],
    ["Canchas partner", currencyARS(metrics.platformMonthlyFee), "Abono mensual para publicar torneos, fixture y demanda."],
    ["Comisión por reserva", `${Math.round(metrics.commissionAverage)}%`, "Ingreso por partidos que pasan por una cancha adherida."],
    ["Sponsor por fecha", currencyARS(metrics.sponsorFee), "Marcas locales en fixture, tabla, camiseta digital y MVP."],
    ["Stats premium", "Addon", "Goleadores, MVP, tarjetas, perfiles y reportes para jugadores."]
  ];
  const roles = [
    ["Cancha", "Publica sede, cupos, horarios fuertes y torneos propios."],
    ["Organizador", "Arma campeonato, inscribe equipos, carga resultados y resuelve fixture."],
    ["Equipo", "Gestiona plantel, fotos, formacion y disponibilidad."],
    ["Jugador", "Sigue partidos, tabla, goles, MVP y perfil publico."]
  ];
  return `
    ${viewHeader(
      "Modelo Fulbito",
      "Una PWA para convertir canchas de alquiler por hora en una red de torneos barriales con ingresos recurrentes.",
      `<button class="btn btn--primary" data-route="canchas">Cargar cancha partner</button>`
    )}
    <section class="revenue-board">
      <article class="revenue-total">
        <span class="screen-label">Proyección demo</span>
        <strong>${currencyARS(metrics.total)}</strong>
        <p>Estimado con el campeonato activo, canchas cargadas y partidos generados.</p>
      </article>
      <div class="grid grid--4">
        ${statCard(currencyARS(metrics.inscriptionRevenue), "Inscripciones")}
        ${statCard(currencyARS(metrics.venueSaasRevenue), "Canchas SaaS")}
        ${statCard(currencyARS(metrics.bookingRevenue), "Comisiones")}
        ${statCard(currencyARS(metrics.sponsorRevenue), "Sponsors")}
      </div>
    </section>

    <section class="grid grid--2" style="margin-top: 16px;">
      <article class="panel">
        <h3>Vías de ingreso</h3>
        <div class="model-list">
          ${revenueStreams.map(([title, amount, text]) => `
            <div class="model-row">
              <div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>
              <b>${escapeHtml(amount)}</b>
            </div>
          `).join("")}
        </div>
      </article>
      <article class="panel">
        <h3>Roles para la versión online</h3>
        <div class="role-grid">
          ${roles.map(([title, text]) => `
            <div class="role-card">
              <strong>${escapeHtml(title)}</strong>
              <span>${escapeHtml(text)}</span>
            </div>
          `).join("")}
        </div>
      </article>
    </section>

    <section class="panel roadmap-panel" style="margin-top: 16px;">
      <div>
        <h3>Próximo salto comercial</h3>
        <p class="muted">Login por rol, base de datos online, pagos de inscripción, reservas por cancha, ranking público, notificaciones y panel de sponsors.</p>
      </div>
      <div class="inline-actions">
        <button class="btn btn--ghost" data-route="ajustes">Exportar demo</button>
        <button class="btn btn--primary" data-route="torneos">Crear otro torneo</button>
      </div>
    </section>
  `;
}

function renderSettings() {
  const counts = `${state.tournaments.length} campeonatos · ${state.teams.length} equipos · ${state.venues.length} canchas · ${state.matches.length} partidos`;
  return `
    ${viewHeader(
      "Datos, backup y demo",
      "Fulbito guarda la información en este navegador. Exportá un backup JSON para moverlo a otra compu o para usarlo como base de un backend futuro.",
      `<button class="btn btn--primary" data-action="exportData">Exportar backup</button>`
    )}
    <section class="grid grid--2">
      <article class="panel">
        <h3>Base local</h3>
        <p class="muted">Estado actual: <strong>${escapeHtml(counts)}</strong>.</p>
        <div class="inline-actions">
          <button class="btn btn--primary" data-action="exportData">Descargar JSON</button>
          <button class="btn btn--danger" data-action="resetDemo">Restaurar demo</button>
        </div>
        <hr>
        <p class="muted">Para producción, el próximo paso lógico es conectar usuarios, canchas, pagos de inscripción, reservas y base de datos online.</p>
        <button class="btn btn--ghost" data-route="modelo">Ver modelo comercial</button>
      </article>
      <form id="importForm" class="panel">
        <h3>Importar backup</h3>
        <label class="field"><span>Pegá un JSON exportado</span><textarea class="input import-box" name="json" placeholder='{"schemaVersion":1,...}'></textarea></label>
        <button class="btn btn--ghost" type="submit">Importar datos</button>
      </form>
    </section>
  `;
}

function venueOptions(selectedId = "") {
  if (!state.venues.length) return `<option value="">Sin canchas cargadas</option>`;
  return state.venues.map((venue) => `<option value="${escapeHtml(venue.id)}" ${venue.id === selectedId ? "selected" : ""}>${escapeHtml(venue.name)} · ${escapeHtml(venue.neighborhood || "")}</option>`).join("");
}

function teamOptions(selectedId = "") {
  if (!state.teams.length) return `<option value="">Sin equipos cargados</option>`;
  return state.teams.map((team) => `<option value="${escapeHtml(team.id)}" ${team.id === selectedId ? "selected" : ""}>${escapeHtml(team.name)}</option>`).join("");
}

function groupBy(items, keyGetter) {
  return items.reduce((acc, item) => {
    const key = keyGetter(item);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

function emptyInline(text) {
  return `<p class="muted">${escapeHtml(text)}</p>`;
}

function emptyState(title, text, buttonText, route) {
  return `
    <article class="empty-state">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
      ${buttonText && route ? `<button class="btn btn--primary" data-route="${escapeHtml(route)}">${escapeHtml(buttonText)}</button>` : ""}
    </article>
  `;
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

function activateTournament(tournamentId) {
  if (!state.tournaments.some((tournament) => tournament.id === tournamentId)) return;
  state.activeTournamentId = tournamentId;
  saveData();
  render();
  toast("Campeonato activo actualizado");
}

function generateFixture(startDate) {
  const tournament = activeTournament();
  if (!tournament) return toast("Primero creá un campeonato");
  if ((tournament.teamIds || []).length < 2) return toast("Necesitás al menos 2 equipos inscriptos");
  const hasMatches = state.matches.some((match) => match.tournamentId === tournament.id);
  if (hasMatches && !window.confirm("Esto reemplazará el fixture actual de este campeonato. ¿Continuar?")) return;
  tournament.startDate = startDate || tournament.startDate || toInputDate(new Date());
  state.matches = state.matches.filter((match) => match.tournamentId !== tournament.id);
  state.matches.push(...buildFixtureFor(state, tournament.id, tournament.startDate));
  saveData();
  currentRoute = "fixture";
  render();
  toast("Fixture generado");
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `fulbito-backup-${toInputDate(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  toast("Backup exportado");
}

async function handleSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  if (form.id === "tournamentForm") {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    if (!name) return toast("El campeonato necesita nombre");
    const tournament = {
      id: uid("torneo"),
      name,
      season: String(data.get("season") || new Date().getFullYear()).trim(),
      modality: String(data.get("modality") || "Liga todos contra todos"),
      fieldMode: String(data.get("fieldMode") || "7v7"),
      status: "Inscripción abierta",
      startDate: String(data.get("startDate") || toInputDate(new Date())),
      pointsWin: Number(data.get("pointsWin") || 3),
      pointsDraw: Number(data.get("pointsDraw") ?? 1),
      primaryVenueId: String(data.get("primaryVenueId") || state.venues[0]?.id || ""),
      teamIds: data.get("addAllTeams") ? state.teams.map((team) => team.id) : []
    };
    state.tournaments.push(tournament);
    state.activeTournamentId = tournament.id;
    saveData();
    currentRoute = "torneos";
    render();
    toast("Campeonato creado");
    return;
  }

  if (form.id === "teamForm") {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    if (!name) return toast("El equipo necesita nombre");
    const shortName = String(data.get("shortName") || initials(name)).trim().slice(0, 4).toUpperCase();
    const team = {
      id: uid("team"),
      name,
      shortName,
      coach: String(data.get("coach") || "").trim(),
      neighborhood: String(data.get("neighborhood") || "").trim(),
      color: String(data.get("color") || "#25d977"),
      venueId: String(data.get("venueId") || ""),
      formation: String(data.get("formation") || "7v7"),
      players: [],
      lineup: {}
    };
    state.teams.push(team);
    const tournament = activeTournament();
    if (data.get("enrollActive") && tournament && !tournament.teamIds.includes(team.id)) {
      tournament.teamIds.push(team.id);
    }
    state.ui.selectedTeamId = team.id;
    saveData();
    render();
    toast("Equipo inscripto");
    return;
  }

  if (form.id === "playerForm") {
    event.preventDefault();
    const data = new FormData(form);
    const team = getTeam(String(data.get("teamId") || state.ui.selectedTeamId));
    const name = String(data.get("name") || "").trim();
    if (!team) return toast("Elegí un equipo");
    if (!name) return toast("El jugador necesita nombre");
    const file = form.querySelector('[name="photoFile"]')?.files?.[0];
    let photo = String(data.get("photoUrl") || "").trim();
    if (file) {
      try {
        photo = await fileToDataUrl(file);
      } catch (error) {
        console.warn(error);
        return toast("No se pudo cargar la foto");
      }
    }
    const player = {
      id: uid("player"),
      name,
      alias: String(data.get("alias") || "").trim(),
      number: String(data.get("number") || "").trim(),
      position: String(data.get("position") || "Sin posición"),
      photo,
      goals: 0,
      yellowCards: 0,
      redCards: 0
    };
    team.players.push(player);
    const firstEmptySlot = getFormationSlots(team.formation).find((slot) => !team.lineup?.[slot.id]);
    if (firstEmptySlot) team.lineup[firstEmptySlot.id] = player.id;
    state.ui.selectedTeamId = team.id;
    saveData();
    render();
    toast("Jugador agregado");
    return;
  }

  if (form.id === "fixtureForm") {
    event.preventDefault();
    const data = new FormData(form);
    generateFixture(String(data.get("startDate") || toInputDate(new Date())));
    return;
  }

  if (form.id === "venueForm") {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    if (!name) return toast("La cancha necesita nombre");
    state.venues.push({
      id: uid("venue"),
      name,
      neighborhood: String(data.get("neighborhood") || "").trim(),
      address: String(data.get("address") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      price: String(data.get("hourlyRate") || "").trim(),
      hourlyRate: String(data.get("hourlyRate") || "").trim(),
      commissionRate: Number(data.get("commissionRate") || 8),
      owner: String(data.get("owner") || "").trim(),
      openHours: String(data.get("openHours") || "").trim(),
      surface: String(data.get("surface") || "").trim(),
      status: String(data.get("status") || "Verificada"),
      notes: String(data.get("notes") || "").trim()
    });
    saveData();
    render();
    toast("Cancha guardada");
    return;
  }

  if (form.id === "importForm") {
    event.preventDefault();
    const raw = String(new FormData(form).get("json") || "").trim();
    if (!raw) return toast("Pegá un JSON para importar");
    try {
      const imported = normalizeData(JSON.parse(raw));
      state = imported;
      currentRoute = state.ui.route || "dashboard";
      saveData();
      render();
      toast("Datos importados");
    } catch (error) {
      console.warn(error);
      toast("JSON inválido");
    }
  }
}

function handleClick(event) {
  const focusTeamButton = event.target.closest("[data-focus-team]");
  if (focusTeamButton) {
    state.ui.selectedTeamId = focusTeamButton.dataset.focusTeam;
    currentRoute = focusTeamButton.dataset.routeTarget || "formaciones";
    saveData();
    render();
    return;
  }

  const routeButton = event.target.closest("[data-route]");
  if (routeButton) {
    currentRoute = routeButton.dataset.route;
    saveData();
    render();
    if (routeButton.dataset.focusGenerator) {
      setTimeout(() => $("#fixtureGenerator")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.action;

  if (action === "generateFixture") {
    generateFixture(activeTournament()?.startDate || addDays(toInputDate(new Date()), 7));
  }

  if (action === "activateTournament") {
    activateTournament(actionButton.dataset.tournamentId);
  }

  if (action === "deleteTournament") {
    const tournamentId = actionButton.dataset.tournamentId;
    if (state.tournaments.length === 1) return toast("Debe quedar al menos un campeonato");
    if (!window.confirm("¿Eliminar este campeonato y sus partidos?")) return;
    state.tournaments = state.tournaments.filter((tournament) => tournament.id !== tournamentId);
    state.matches = state.matches.filter((match) => match.tournamentId !== tournamentId);
    if (state.activeTournamentId === tournamentId) state.activeTournamentId = state.tournaments[0]?.id || "";
    saveData();
    render();
    toast("Campeonato eliminado");
  }

  if (action === "deleteTeam") {
    const teamId = actionButton.dataset.teamId;
    if (!window.confirm("¿Eliminar este equipo, sus jugadores y sus partidos?")) return;
    state.teams = state.teams.filter((team) => team.id !== teamId);
    state.tournaments.forEach((tournament) => {
      tournament.teamIds = tournament.teamIds.filter((id) => id !== teamId);
    });
    state.matches = state.matches.filter((match) => match.homeId !== teamId && match.awayId !== teamId);
    if (state.ui.selectedTeamId === teamId) state.ui.selectedTeamId = state.teams[0]?.id || "";
    saveData();
    render();
    toast("Equipo eliminado");
  }

  if (action === "deletePlayer") {
    const team = getTeam(actionButton.dataset.teamId);
    if (!team) return;
    const playerId = actionButton.dataset.playerId;
    team.players = team.players.filter((player) => player.id !== playerId);
    Object.keys(team.lineup || {}).forEach((slotId) => {
      if (team.lineup[slotId] === playerId) delete team.lineup[slotId];
    });
    saveData();
    render();
    toast("Jugador eliminado");
  }

  if (action === "saveResult") {
    const match = state.matches.find((item) => item.id === actionButton.dataset.matchId);
    if (!match) return;
    const homeValue = $(`[data-score-home="${CSS.escape(match.id)}"]`)?.value;
    const awayValue = $(`[data-score-away="${CSS.escape(match.id)}"]`)?.value;
    if (homeValue === "" || awayValue === "") return toast("Cargá ambos goles");
    match.homeGoals = Number(homeValue);
    match.awayGoals = Number(awayValue);
    match.status = "finalizado";
    saveData();
    render();
    toast("Resultado guardado");
  }

  if (action === "clearResult") {
    const match = state.matches.find((item) => item.id === actionButton.dataset.matchId);
    if (!match) return;
    match.homeGoals = null;
    match.awayGoals = null;
    match.status = "programado";
    saveData();
    render();
    toast("Resultado limpiado");
  }

  if (action === "deleteVenue") {
    const venueId = actionButton.dataset.venueId;
    if (!window.confirm("¿Eliminar esta cancha? Los equipos quedarán sin cancha si la usaban.")) return;
    state.venues = state.venues.filter((venue) => venue.id !== venueId);
    state.teams.forEach((team) => {
      if (team.venueId === venueId) team.venueId = "";
    });
    state.tournaments.forEach((tournament) => {
      if (tournament.primaryVenueId === venueId) tournament.primaryVenueId = state.venues[0]?.id || "";
    });
    state.matches.forEach((match) => {
      if (match.venueId === venueId) match.venueId = "";
    });
    saveData();
    render();
    toast("Cancha eliminada");
  }

  if (action === "exportData") {
    exportData();
  }

  if (action === "resetDemo") {
    if (!window.confirm("Esto borra los datos locales y restaura la demo inicial. ¿Continuar?")) return;
    state = createDemoData();
    currentRoute = "dashboard";
    saveData();
    render();
    toast("Demo restaurada");
  }
}

function handleChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement || target instanceof HTMLInputElement)) return;

  if (target.id === "tournamentSelect") {
    state.activeTournamentId = target.value;
    saveData();
    render();
    return;
  }

  if (target.id === "playerTeamSelect" || target.id === "formationTeamSelect") {
    state.ui.selectedTeamId = target.value;
    saveData();
    render();
    return;
  }

  if (target.id === "formationNameSelect") {
    const team = getTeam(state.ui.selectedTeamId);
    if (!team) return;
    team.formation = target.value;
    team.lineup = sanitizeLineup(team.lineup, target.value);
    saveData();
    render();
    toast("Formato de formación actualizado");
    return;
  }

  if (target.dataset.action === "lineupSlot") {
    const team = getTeam(target.dataset.teamId);
    if (!team) return;
    team.lineup = team.lineup || {};
    if (target.value) {
      team.lineup[target.dataset.slotId] = target.value;
    } else {
      delete team.lineup[target.dataset.slotId];
    }
    saveData();
    render();
    return;
  }

  if (target.dataset.action === "toggleTournamentTeam") {
    const tournament = state.tournaments.find((item) => item.id === target.dataset.tournamentId);
    if (!tournament) return;
    const teamId = target.dataset.teamId;
    tournament.teamIds = tournament.teamIds || [];
    if (target.checked && !tournament.teamIds.includes(teamId)) {
      tournament.teamIds.push(teamId);
    }
    if (!target.checked) {
      tournament.teamIds = tournament.teamIds.filter((id) => id !== teamId);
      state.matches = state.matches.filter((match) => match.tournamentId !== tournament.id || (match.homeId !== teamId && match.awayId !== teamId));
    }
    saveData();
    render();
    toast(target.checked ? "Equipo inscripto" : "Equipo quitado");
  }
}

function sanitizeLineup(lineup = {}, formationName = "7v7") {
  const validSlots = new Set(getFormationSlots(formationName).map((slot) => slot.id));
  return Object.fromEntries(Object.entries(lineup).filter(([slotId]) => validSlots.has(slotId)));
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  const installBtn = $("#installBtn");
  if (installBtn) installBtn.hidden = false;
});

$("#installBtn")?.addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $("#installBtn").hidden = true;
});

document.addEventListener("submit", handleSubmit);
document.addEventListener("click", handleClick);
document.addEventListener("change", handleChange);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => console.warn("Service Worker no registrado", error));
  });
}

render();

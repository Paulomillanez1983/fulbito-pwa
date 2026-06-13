import type { ArenaMatch, ArenaTeam, ArenaTournament, FieldMode } from "@/lib/types";
import { getKnockoutRoundLabels, getQualifiedTeamCount } from "@/lib/tournament-structure";

type FixtureTeam = Pick<ArenaTeam, "id" | "name" | "short_name"> & {
  group_code?: string | null;
  seed?: number | null;
};

type MatchInsert = {
  tournament_id: string;
  venue_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  phase: string;
  round_name: string;
  group_code: string | null;
  match_order: number;
  scheduled_at: string | null;
  status: "scheduled";
};

type SupabaseLike = {
  from: (table: string) => any;
};

function fieldSlotMinutes(mode: FieldMode) {
  if (mode === "5v5") return 70;
  if (mode === "7v7") return 90;
  return 120;
}

function timeToMinutes(value?: string | null) {
  const [hours, minutes] = String(value || "18:00").slice(0, 5).split(":").map(Number);
  return (Number.isFinite(hours) ? hours : 18) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function minutesToTime(total: number) {
  const hours = Math.floor(total / 60).toString().padStart(2, "0");
  const minutes = (total % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function normalizeDateOnly(value?: string | null) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function addDays(dateOnly: string, days: number) {
  const date = new Date(`${dateOnly}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekday(dateOnly: string) {
  return new Date(`${dateOnly}T12:00:00Z`).getUTCDay();
}

function buildScheduleSlots(tournament: ArenaTournament, count: number) {
  const slots: Array<string | null> = [];
  if (count <= 0) return slots;

  const allowedDays = tournament.playable_weekdays?.length ? new Set(tournament.playable_weekdays) : new Set([0, 1, 2, 3, 4, 5, 6]);
  const startTime = timeToMinutes(tournament.playable_start_time);
  const endTime = timeToMinutes(tournament.playable_end_time || "23:00");
  const slotMinutes = fieldSlotMinutes(tournament.field_mode);
  const times: number[] = [];
  if (endTime <= startTime) {
    times.push(startTime);
  } else {
    for (let current = startTime; current + Math.min(45, slotMinutes) <= endTime; current += slotMinutes) {
      times.push(current);
    }
    if (!times.length) times.push(startTime);
  }

  let cursor = normalizeDateOnly(tournament.starts_on);
  const hardStop = tournament.ends_on ? normalizeDateOnly(tournament.ends_on) : null;
  let guard = 0;

  while (slots.length < count && guard < 730) {
    const insidePreferredRange = !hardStop || cursor <= hardStop;
    if (allowedDays.has(weekday(cursor)) || !insidePreferredRange) {
      for (const time of times) {
        slots.push(`${cursor}T${minutesToTime(time)}:00-03:00`);
        if (slots.length >= count) break;
      }
    }
    cursor = addDays(cursor, 1);
    guard += 1;
  }

  while (slots.length < count) slots.push(null);
  return slots;
}

function roundRobinPairs(teams: FixtureTeam[]) {
  const entries: Array<FixtureTeam | null> = teams.length % 2 === 0 ? [...teams] : [...teams, null];
  const rounds: Array<Array<[FixtureTeam, FixtureTeam]>> = [];
  const roundsCount = Math.max(0, entries.length - 1);

  for (let round = 0; round < roundsCount; round += 1) {
    const pairs: Array<[FixtureTeam, FixtureTeam]> = [];
    for (let index = 0; index < entries.length / 2; index += 1) {
      const left = entries[index];
      const right = entries[entries.length - 1 - index];
      if (left && right) {
        pairs.push(round % 2 === 0 ? [left, right] : [right, left]);
      }
    }
    rounds.push(pairs);
    const fixed = entries[0];
    const rotated = [fixed, entries[entries.length - 1], ...entries.slice(1, entries.length - 1)];
    entries.splice(0, entries.length, ...rotated);
  }

  return rounds;
}

function groupedTeams(teams: FixtureTeam[]) {
  const groups = new Map<string, FixtureTeam[]>();
  teams.forEach((team) => {
    const groupCode = team.group_code || "A";
    groups.set(groupCode, [...(groups.get(groupCode) ?? []), team]);
  });
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, groupTeams]) => ({
      code,
      teams: groupTeams.sort((left, right) => (left.seed ?? 99) - (right.seed ?? 99) || left.name.localeCompare(right.name))
    }));
}

function seededTeams(teams: FixtureTeam[]) {
  return [...teams].sort((left, right) => (left.seed ?? 999) - (right.seed ?? 999) || left.name.localeCompare(right.name));
}

function buildKnockoutPlaceholders(tournament: ArenaTournament, matchOrderStart: number, scheduleOffset: number, slots: Array<string | null>, firstRoundTeams: FixtureTeam[] = []) {
  const bracketSize = getQualifiedTeamCount(tournament, firstRoundTeams.length);
  const roundLabels = getKnockoutRoundLabels(bracketSize);
  const rows: MatchInsert[] = [];
  let matchOrder = matchOrderStart;
  let slotIndex = scheduleOffset;

  roundLabels.forEach((roundLabel, roundIndex) => {
    const size = bracketSize / Math.pow(2, roundIndex);
    const matchCount = Math.max(1, size / 2);
    const firstRoundSeeded = roundIndex === 0 && firstRoundTeams.length > 0;
    const padded = firstRoundSeeded
      ? [...firstRoundTeams, ...Array.from({ length: Math.max(0, size - firstRoundTeams.length) }, () => null)]
      : [];

    for (let index = 0; index < matchCount; index += 1) {
      const home = firstRoundSeeded ? padded[index] ?? null : null;
      const away = firstRoundSeeded ? padded[padded.length - 1 - index] ?? null : null;
      rows.push({
        tournament_id: tournament.id,
        venue_id: tournament.venue_id ?? null,
        home_team_id: home?.id ?? null,
        away_team_id: away?.id ?? null,
        phase: "knockout",
        round_name: `${roundLabel} ${index + 1}`,
        group_code: null,
        match_order: matchOrder,
        scheduled_at: slots[slotIndex] ?? null,
        status: "scheduled"
      });
      matchOrder += 1;
      slotIndex += 1;
    }
  });

  return rows;
}

export function buildTournamentFixtureRows(tournament: ArenaTournament, teams: FixtureTeam[]) {
  const cleanTeams = teams.filter((team) => team.id);
  const groupMatches: MatchInsert[] = [];
  let matchOrder = 1;

  if (tournament.format === "world_cup" || tournament.format === "league") {
    const groups = tournament.format === "league"
      ? [{ code: "Liga", teams: seededTeams(cleanTeams) }]
      : groupedTeams(cleanTeams);

    groups.forEach((group) => {
      const rounds = roundRobinPairs(group.teams);
      rounds.forEach((pairs, roundIndex) => {
        pairs.forEach(([home, away], pairIndex) => {
          groupMatches.push({
            tournament_id: tournament.id,
            venue_id: tournament.venue_id ?? null,
            home_team_id: home.id,
            away_team_id: away.id,
            phase: tournament.format === "league" ? "league" : "groups",
            round_name: `Fecha ${roundIndex + 1}.${pairIndex + 1}`,
            group_code: tournament.format === "league" ? null : group.code,
            match_order: matchOrder,
            scheduled_at: null,
            status: "scheduled"
          });
          matchOrder += 1;
        });
      });
    });
  }

  const knockoutRows = tournament.format === "league"
    ? []
    : buildKnockoutPlaceholders(
        tournament,
        matchOrder,
        groupMatches.length,
        [],
        tournament.format === "knockout" ? seededTeams(cleanTeams) : []
      );

  const allRows = [...groupMatches, ...knockoutRows];
  const slots = buildScheduleSlots(tournament, allRows.length);
  return allRows.map((row, index) => ({ ...row, scheduled_at: slots[index] ?? row.scheduled_at }));
}

function matchWinnerId(match: ArenaMatch) {
  if (match.status !== "final" || match.home_score === null || match.away_score === null) return null;
  if (match.home_score === match.away_score) return null;
  return match.home_score > match.away_score ? match.home_team_id : match.away_team_id;
}

function roundKey(match: ArenaMatch) {
  const value = `${match.phase} ${match.round_name}`.toLowerCase();
  if (value.includes("16") || value.includes("dieciseis")) return "16avos";
  if (value.includes("octav")) return "Octavos";
  if (value.includes("cuart")) return "Cuartos";
  if (value.includes("semi")) return "Semis";
  if (value.includes("final")) return "Final";
  return "";
}

export async function ensureTournamentFixtures({
  supabase,
  tournament,
  teams
}: {
  supabase: SupabaseLike;
  tournament: ArenaTournament;
  teams: FixtureTeam[];
}) {
  const existing = await supabase.from("matches").select("id").eq("tournament_id", tournament.id).limit(1);
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.length) return { created: 0, skipped: true };

  const rows = buildTournamentFixtureRows(tournament, teams);
  if (!rows.length) return { created: 0, skipped: false };

  const inserted = await supabase.from("matches").insert(rows).select("id");
  if (inserted.error) throw new Error(inserted.error.message);

  await supabase.from("tournaments").update({ status: "active" }).eq("id", tournament.id);
  return { created: inserted.data?.length ?? rows.length, skipped: false };
}

export async function advanceTournamentBracket({ supabase, tournamentId }: { supabase: SupabaseLike; tournamentId: string }) {
  const [tournamentResult, teamsResult, tournamentTeamsResult, matchesResult] = await Promise.all([
    supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle(),
    supabase.from("teams").select("*"),
    supabase.from("tournament_teams").select("tournament_id,team_id,group_code,seed,status").eq("tournament_id", tournamentId),
    supabase.from("matches").select("*").eq("tournament_id", tournamentId).order("match_order", { ascending: true })
  ]);
  if (tournamentResult.error) throw new Error(tournamentResult.error.message);
  if (teamsResult.error) throw new Error(teamsResult.error.message);
  if (tournamentTeamsResult.error) throw new Error(tournamentTeamsResult.error.message);
  if (matchesResult.error) throw new Error(matchesResult.error.message);

  const tournament = tournamentResult.data as ArenaTournament | null;
  if (!tournament || tournament.format === "league") return { updated: 0 };

  const teamsById = new Map((teamsResult.data as ArenaTeam[]).map((team) => [team.id, team]));
  const tournamentTeams = tournamentTeamsResult.data as Array<{ team_id: string; group_code: string | null; seed: number | null }>;
  const matches = matchesResult.data as ArenaMatch[];
  const updates: Array<Promise<unknown>> = [];

  if (tournament.format === "world_cup") {
    const groupCodes = Array.from(new Set(tournamentTeams.map((team) => team.group_code).filter(Boolean) as string[])).sort();
    const qualifiers: ArenaTeam[] = [];
    groupCodes.forEach((code) => {
      const groupTeamIds = tournamentTeams.filter((team) => team.group_code === code).map((team) => team.team_id);
      const groupTeams = groupTeamIds.map((teamId) => teamsById.get(teamId)).filter((team): team is ArenaTeam => Boolean(team));
      const groupMatches = matches.filter((match) => match.phase === "groups" && match.group_code === code);
      if (!groupMatches.length || groupMatches.some((match) => match.status !== "final")) return;
      const table = new Map<string, ArenaTeam>();
      groupTeams.forEach((team) => table.set(team.id, { ...team, points: 0, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0 }));
      groupMatches.forEach((match) => {
        const home = match.home_team_id ? table.get(match.home_team_id) : null;
        const away = match.away_team_id ? table.get(match.away_team_id) : null;
        if (!home || !away || match.home_score === null || match.away_score === null) return;
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
      qualifiers.push(...[...table.values()].sort((a, b) =>
        (b.points ?? 0) - (a.points ?? 0) ||
        (b.goalDiff ?? 0) - (a.goalDiff ?? 0) ||
        (b.goalsFor ?? 0) - (a.goalsFor ?? 0) ||
        a.name.localeCompare(b.name)
      ).slice(0, 2));
    });

    const bracketSize = getQualifiedTeamCount(tournament, tournamentTeams.length);
    if (qualifiers.length >= bracketSize) {
      const firstRound = getKnockoutRoundLabels(bracketSize)[0];
      const firstRoundMatches = matches.filter((match) => roundKey(match) === firstRound).sort((a, b) => a.match_order - b.match_order);
      const padded = [...qualifiers.slice(0, bracketSize)];
      firstRoundMatches.forEach((match, index) => {
        if (match.home_team_id || match.away_team_id) return;
        updates.push(supabase.from("matches").update({
          home_team_id: padded[index]?.id ?? null,
          away_team_id: padded[padded.length - 1 - index]?.id ?? null
        }).eq("id", match.id));
      });
    }
  }

  const labels = getKnockoutRoundLabels(getQualifiedTeamCount(tournament, tournamentTeams.length));
  labels.forEach((label, index) => {
    const nextLabel = labels[index + 1];
    if (!nextLabel) return;
    const currentRound = matches.filter((match) => roundKey(match) === label).sort((a, b) => a.match_order - b.match_order);
    const nextRound = matches.filter((match) => roundKey(match) === nextLabel).sort((a, b) => a.match_order - b.match_order);
    if (!currentRound.length || currentRound.some((match) => !matchWinnerId(match))) return;
    nextRound.forEach((match, matchIndex) => {
      if (match.home_team_id || match.away_team_id) return;
      const homeWinner = matchWinnerId(currentRound[matchIndex * 2]);
      const awayWinner = matchWinnerId(currentRound[matchIndex * 2 + 1]);
      updates.push(supabase.from("matches").update({
        home_team_id: homeWinner,
        away_team_id: awayWinner
      }).eq("id", match.id));
    });
  });

  await Promise.all(updates);
  return { updated: updates.length };
}

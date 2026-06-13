import type { ArenaMatch, ArenaTeam, ArenaTournament } from "@/lib/types";

export function nextPowerOfTwo(value: number) {
  return Math.pow(2, Math.ceil(Math.log2(Math.max(2, value))));
}

export function getWorldCupGroupCount(tournament?: Pick<ArenaTournament, "max_teams" | "format"> | null, teamCount = 0) {
  if (!tournament || tournament.format !== "world_cup") return 0;
  return Math.max(1, Math.ceil(Math.max(tournament.max_teams ?? teamCount, teamCount, 4) / 4));
}

export function getQualifiedTeamCount(tournament?: Pick<ArenaTournament, "max_teams" | "format"> | null, teamCount = 0) {
  if (!tournament) return nextPowerOfTwo(teamCount);
  if (tournament.format === "world_cup") return nextPowerOfTwo(getWorldCupGroupCount(tournament, teamCount) * 2);
  if (tournament.format === "knockout") return nextPowerOfTwo(tournament.max_teams ?? teamCount);
  return 0;
}

export function getKnockoutBracketSize(tournament?: Pick<ArenaTournament, "max_teams" | "format"> | null, teamCount = 0) {
  if (!tournament) return nextPowerOfTwo(teamCount);
  if (tournament.format === "league") return 0;
  return getQualifiedTeamCount(tournament, teamCount);
}

export function getRoundLabelBySize(size: number) {
  const labels: Record<number, string> = {
    32: "16avos",
    16: "Octavos",
    8: "Cuartos",
    4: "Semis",
    2: "Final"
  };
  return labels[size] ?? `${size} equipos`;
}

export function getKnockoutRoundLabels(bracketSize: number) {
  const labels: string[] = [];
  for (let size = nextPowerOfTwo(bracketSize); size >= 2; size = size / 2) {
    labels.push(getRoundLabelBySize(size));
  }
  return labels;
}

export function getQualifiersFromGroup(groupTeams: ArenaTeam[], groupMatches: ArenaMatch[], slots = 2) {
  if (!groupTeams.length) return [];
  const table = new Map<string, ArenaTeam>();
  groupTeams.forEach((team) => {
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

  groupMatches.forEach((match) => {
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

  const allGroupMatchesFinal = groupMatches.length > 0 && groupMatches.every((match) => match.status === "final");
  if (!allGroupMatchesFinal) return [];

  return [...table.values()]
    .sort((a, b) =>
      (b.points ?? 0) - (a.points ?? 0) ||
      (b.goalDiff ?? 0) - (a.goalDiff ?? 0) ||
      (b.goalsFor ?? 0) - (a.goalsFor ?? 0) ||
      a.name.localeCompare(b.name)
    )
    .slice(0, slots);
}

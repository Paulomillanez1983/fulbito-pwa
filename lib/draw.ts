import type { ArenaTeam, TournamentFormat } from "@/lib/types";

export type DrawTeam = {
  id: string;
  name: string;
  shortName: string;
  badgeUrl: string | null;
  badgeFrame?: Record<string, unknown> | null;
};

export type DrawGroup = {
  code: string;
  teams: DrawTeam[];
};

export type DrawMatchSlot = {
  round: string;
  label: string;
  home: string;
  away: string;
};

export type DrawResult = {
  seed: string;
  teams: DrawTeam[];
  groups: DrawGroup[];
  bracket: DrawMatchSlot[];
};

type DrawScope = "full" | "groups";

const groupCodes = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function hashSeed(seed: string) {
  let hash = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}

function seededRandom(seed: string) {
  let state = hashSeed(seed)();
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], seed: string) {
  const random = seededRandom(seed);
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

function nextPowerOfTwo(value: number) {
  return Math.pow(2, Math.ceil(Math.log2(Math.max(2, value))));
}

function teamToDrawTeam(team: ArenaTeam): DrawTeam {
  return {
    id: team.id,
    name: team.name,
    shortName: team.short_name,
    badgeUrl: team.badge_card_url || team.badge_icon_url || team.badge_url,
    badgeFrame: team.badge_frame ?? null
  };
}

function buildGroups(teams: DrawTeam[], format: TournamentFormat, maxTeams?: number | null, scope: DrawScope = "full") {
  if (format === "knockout") return [];
  const plannedTeams = Math.max(teams.length, maxTeams ?? 0, 4);
  const groupCount = format === "league" && scope === "full" ? 1 : Math.max(1, Math.ceil(plannedTeams / 4));
  const groups: DrawGroup[] = Array.from({ length: groupCount }, (_, index) => ({
    code: groupCodes[index] ?? String(index + 1),
    teams: []
  }));
  teams.forEach((team, index) => {
    groups[index % groups.length].teams.push(team);
  });
  return groups;
}

function buildBracket(teams: DrawTeam[], format: TournamentFormat, groups: DrawGroup[], scope: DrawScope = "full") {
  if (scope === "groups") return [];
  if (format === "league") return [];

  if (format === "world_cup" && groups.length > 1) {
    const qualifiedSlots = groups.flatMap((group) => [`1${group.code}`, `2${group.code}`]);
    const bracketSize = nextPowerOfTwo(qualifiedSlots.length);
    const padded = [...qualifiedSlots, ...Array.from({ length: bracketSize - qualifiedSlots.length }, () => "Libre")];
    return Array.from({ length: bracketSize / 2 }, (_, index) => ({
      round: bracketSize === 16 ? "Octavos" : bracketSize === 8 ? "Cuartos" : `${bracketSize} clasificados`,
      label: `Llave ${index + 1}`,
      home: padded[index],
      away: padded[padded.length - 1 - index]
    }));
  }

  const bracketSize = nextPowerOfTwo(teams.length);
  const padded = [...teams.map((team) => team.shortName), ...Array.from({ length: bracketSize - teams.length }, () => "Libre")];
  return Array.from({ length: bracketSize / 2 }, (_, index) => ({
    round: bracketSize === 16 ? "Octavos" : bracketSize === 8 ? "Cuartos" : bracketSize === 4 ? "Semis" : "Final",
    label: `Partido ${index + 1}`,
    home: padded[index],
    away: padded[padded.length - 1 - index]
  }));
}

export function buildTournamentDraw({
  teams,
  format,
  maxTeams,
  seed,
  scope = "full"
}: {
  teams: ArenaTeam[];
  format: TournamentFormat;
  maxTeams?: number | null;
  seed: string;
  scope?: DrawScope;
}): DrawResult {
  const drawTeams = shuffle(teams.map(teamToDrawTeam), seed);
  const groups = buildGroups(drawTeams, format, maxTeams, scope);
  const bracket = buildBracket(drawTeams, format, groups, scope);
  return {
    seed,
    teams: drawTeams,
    groups,
    bracket
  };
}

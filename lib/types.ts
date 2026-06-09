export type AppRole = "player" | "captain" | "venue_owner" | "organizer" | "referee" | "admin";

export type FieldMode = "5v5" | "7v7" | "11v11";

export type TournamentFormat = "league" | "world_cup" | "knockout";

export type MatchStatus =
  | "scheduled"
  | "live"
  | "result_pending"
  | "confirmation_pending"
  | "final"
  | "disputed"
  | "postponed"
  | "cancelled";

export type ArenaVenue = {
  id: string;
  owner_id?: string | null;
  name: string;
  slug: string;
  neighborhood: string;
  address: string | null;
  cover_url?: string | null;
  price_per_hour: number;
  inscription_fee: number;
  commission_rate: number;
  status: string;
  surface: string | null;
  field_modes?: FieldMode[];
  open_hours: string | null;
};

export type ArenaTeam = {
  id: string;
  owner_id?: string | null;
  name: string;
  slug: string;
  short_name: string;
  badge_url: string | null;
  primary_color: string;
  neighborhood: string | null;
  home_venue_id: string | null;
  points?: number;
  played?: number;
  won?: number;
  drawn?: number;
  lost?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDiff?: number;
};

export type ArenaPlayer = {
  id: string;
  team_id: string;
  display_name: string;
  alias: string | null;
  jersey_number: number | null;
  position: string | null;
  photo_url: string | null;
  goals: number;
};

export type ArenaTournament = {
  id: string;
  name: string;
  slug: string;
  format: TournamentFormat;
  status: string;
  field_mode: FieldMode;
  registration_fee: number;
  max_teams: number | null;
  starts_on: string | null;
  venue_id: string | null;
};

export type ArenaMatch = {
  id: string;
  tournament_id: string;
  venue_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  phase: string;
  round_name: string;
  group_code: string | null;
  scheduled_at: string | null;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  homeTeam?: ArenaTeam | null;
  awayTeam?: ArenaTeam | null;
  venue?: ArenaVenue | null;
};

export type SessionUser = {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  roles: AppRole[];
};

export type ArenaData = {
  source: "supabase" | "demo";
  configured: boolean;
  user: SessionUser | null;
  activeTournament: ArenaTournament | null;
  venues: ArenaVenue[];
  teams: ArenaTeam[];
  players: ArenaPlayer[];
  matches: ArenaMatch[];
  standings: ArenaTeam[];
};

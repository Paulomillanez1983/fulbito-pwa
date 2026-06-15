import { AdminTournamentsPanel } from "@/components/admin-tournaments-panel";
import { LoginPanel } from "@/components/login-panel";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AccountEntitlement, AppRole, ArenaMatch, ArenaTeam, ArenaTournamentDraw, ArenaTournamentTeam, ArenaVenue } from "@/lib/types";

export const dynamic = "force-dynamic";

type AdminProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

type AdminTournament = {
  id: string;
  organizer_id: string | null;
  venue_id: string | null;
  name: string;
  slug: string;
  format: "league" | "world_cup" | "knockout";
  status: string;
  field_mode: "5v5" | "7v7" | "11v11";
  registration_fee: number;
  max_teams: number | null;
  starts_on: string | null;
  ends_on: string | null;
  playable_weekdays: number[];
  playable_start_time: string | null;
  playable_end_time: string | null;
  schedule_notes: string | null;
  rules: string | null;
  hero_url: string | null;
  created_at: string;
  updated_at: string;
};

type AdminVenueSummary = Pick<ArenaVenue, "id" | "name" | "neighborhood" | "address" | "status">;

export default async function AdminTournamentsPage() {
  const env = getSupabaseEnv();
  const supabase = await createSupabaseServerClient();

  if (!env.configured || !supabase) {
    return (
      <main className="admin-shell">
        <section className="admin-hero">
          <span>Torneos</span>
          <h1>Supabase no esta configurado</h1>
          <p>Configura las variables de entorno para administrar torneos.</p>
        </section>
      </main>
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return (
      <main className="admin-shell">
        <section className="admin-hero">
          <span>Torneos</span>
          <h1>Entrar como admin</h1>
          <p>Conecta tu cuenta de Google y despues vuelve a abrir /admin/torneos.</p>
        </section>
        <LoginPanel configured={env.configured} />
      </main>
    );
  }

  const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roles = ((rolesData ?? []).map((item) => item.role) as AppRole[]) || [];

  if (!roles.includes("admin")) {
    return (
      <main className="admin-shell">
        <header className="admin-topbar">
          <a href="/">Fulbito Arena</a>
          <span>Sin rol admin</span>
        </header>
        <section className="admin-hero">
          <span>Torneos</span>
          <h1>Esta cuenta no tiene rol admin</h1>
          <p>Para administrar torneos, agrega el rol admin a tu usuario en Supabase.</p>
        </section>
      </main>
    );
  }

  const [tournamentsResult, tournamentTeamsResult, teamsResult, teamMembersResult, matchesResult, venuesResult, drawsResult, entitlementsResult] = await Promise.all([
    supabase.from("tournaments").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("tournament_teams").select("tournament_id,team_id,group_code,seed,status,created_at").order("created_at", { ascending: false }).limit(3000),
    supabase.from("teams").select("*").order("created_at", { ascending: false }).limit(1500),
    supabase.from("team_members").select("id,team_id").limit(5000),
    supabase.from("matches").select("*").order("scheduled_at", { ascending: true, nullsFirst: false }).order("match_order", { ascending: true }).limit(4000),
    supabase.from("venues").select("id,name,neighborhood,address,status").order("created_at", { ascending: false }).limit(800),
    supabase.from("tournament_draws").select("*").order("created_at", { ascending: false }).limit(800),
    supabase.from("account_entitlements").select("*").in("plan_code", ["tournament_pro", "team_pro"]).order("created_at", { ascending: false }).limit(1500)
  ]);

  const tournaments = (tournamentsResult.data ?? []) as AdminTournament[];
  const tournamentTeams = (tournamentTeamsResult.data ?? []) as ArenaTournamentTeam[];
  const teams = (teamsResult.data ?? []) as ArenaTeam[];
  const matches = (matchesResult.data ?? []) as ArenaMatch[];
  const venues = (venuesResult.data ?? []) as AdminVenueSummary[];
  const draws = (drawsResult.data ?? []) as ArenaTournamentDraw[];
  const entitlements = (entitlementsResult.data ?? []) as AccountEntitlement[];
  const profileIds = Array.from(new Set([
    ...tournaments.map((tournament) => tournament.organizer_id).filter(Boolean),
    ...teams.map((team) => team.owner_id).filter(Boolean)
  ] as string[]));
  const profilesResult = profileIds.length
    ? await supabase.from("profiles").select("id,display_name,avatar_url").in("id", profileIds)
    : { data: [] };

  const memberCountByTeam = ((teamMembersResult.data ?? []) as Array<{ id: string; team_id: string }>).reduce<Record<string, number>>((groups, member) => {
    groups[member.team_id] = (groups[member.team_id] ?? 0) + 1;
    return groups;
  }, {});
  const teamsWithCounts = teams.map((team) => ({
    ...team,
    played: memberCountByTeam[team.id] ?? 0
  }));

  return (
    <AdminTournamentsPanel
      draws={draws}
      entitlements={entitlements}
      matches={matches}
      profiles={(profilesResult.data ?? []) as AdminProfile[]}
      teams={teamsWithCounts}
      tournamentTeams={tournamentTeams}
      tournaments={tournaments}
      venues={venues}
    />
  );
}

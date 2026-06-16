import { AdminPaymentsPanel } from "@/components/admin-payments-panel";
import { LoginPanel } from "@/components/login-panel";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AccountEntitlement, AdCampaign, AdCampaignEvent, AppRole, ArenaMatch, BillingPlanSetting, FieldMode, LiveStreamChannel, LiveStreamEvent, LiveStreamPermission, MatchResultSubmission, PaymentMessage, PaymentRequest, UserBlock } from "@/lib/types";

export const dynamic = "force-dynamic";

type AdminProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

type AdminTeamRow = {
  id: string;
  owner_id: string | null;
  name: string;
  slug: string;
  short_name: string;
  badge_url: string | null;
  badge_icon_url: string | null;
  badge_card_url: string | null;
  primary_color: string;
  neighborhood: string | null;
  created_at: string;
};

type AdminTournamentRow = {
  id: string;
  organizer_id: string | null;
  name: string;
  slug: string;
  status: string;
  field_mode: FieldMode;
};

type AdminTournamentTeamRow = {
  tournament_id: string;
  team_id: string;
  status: string;
  created_at: string;
};

export type AdminTeamAuditItem = {
  team: AdminTeamRow;
  owner: AdminProfile | null;
  playerCount: number;
  tournaments: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    teamStatus: string;
    fieldMode: FieldMode;
  }>;
  entitlements: AccountEntitlement[];
};

export default async function AdminPage() {
  const env = getSupabaseEnv();
  const supabase = await createSupabaseServerClient();

  if (!env.configured || !supabase) {
    return (
      <main className="admin-shell">
        <section className="admin-hero">
          <span>Panel administrador</span>
          <h1>Supabase no esta configurado</h1>
          <p>Configura las variables de entorno para revisar pagos manuales.</p>
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
          <span>Panel administrador</span>
          <h1>Entrar como admin</h1>
          <p>Conecta tu cuenta de Google y despues vuelve a abrir /admin.</p>
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
          <span>Panel administrador</span>
          <h1>Esta cuenta no tiene rol admin</h1>
          <p>Para aprobar comprobantes, agrega el rol admin a tu usuario en Supabase.</p>
        </section>
      </main>
    );
  }

  const [requestsResult, messagesResult, billingPlansResult, adCampaignsResult, adCampaignEventsResult, teamsResult, teamMembersResult, tournamentTeamsResult, tournamentsAuditResult, entitlementsAuditResult, userBlocksResult, liveChannelsResult, livePermissionsResult, liveEventsResult, matchResultsResult, matchesAuditResult] = await Promise.all([
    supabase.from("payment_requests").select("*").order("created_at", { ascending: false }).limit(80),
    supabase.from("payment_messages").select("*").order("created_at", { ascending: true }).limit(300),
    supabase.from("billing_plan_settings").select("*").order("sort_order", { ascending: true }),
    supabase.from("ad_campaigns").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false }).limit(200),
    supabase.from("ad_campaign_events").select("*").order("created_at", { ascending: false }).limit(2000),
    supabase.from("teams").select("id,owner_id,name,slug,short_name,badge_url,badge_icon_url,badge_card_url,primary_color,neighborhood,created_at").order("created_at", { ascending: false }).limit(160),
    supabase.from("team_members").select("id,team_id").limit(3000),
    supabase.from("tournament_teams").select("tournament_id,team_id,status,created_at").order("created_at", { ascending: false }).limit(600),
    supabase.from("tournaments").select("id,organizer_id,name,slug,status,field_mode").order("created_at", { ascending: false }).limit(160),
    supabase.from("account_entitlements").select("*").order("created_at", { ascending: false }).limit(400),
    supabase.from("user_blocks").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("live_stream_channels").select("*").order("created_at", { ascending: true }),
    supabase.from("live_stream_permissions").select("*").order("created_at", { ascending: false }).limit(400),
    supabase.from("live_stream_events").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("match_result_submissions").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("matches").select("*").order("scheduled_at", { ascending: true, nullsFirst: false }).order("match_order", { ascending: true }).limit(600)
  ]);

  const requests = (requestsResult.data ?? []) as PaymentRequest[];
  const messages = (messagesResult.data ?? []) as PaymentMessage[];
  const teamRows = (teamsResult.data ?? []) as AdminTeamRow[];
  const teamMembers = (teamMembersResult.data ?? []) as Array<{ id: string; team_id: string }>;
  const tournamentTeams = (tournamentTeamsResult.data ?? []) as AdminTournamentTeamRow[];
  const tournaments = (tournamentsAuditResult.data ?? []) as AdminTournamentRow[];
  const entitlements = (entitlementsAuditResult.data ?? []) as AccountEntitlement[];
  const userBlocks = (userBlocksResult.data ?? []) as UserBlock[];
  const liveChannels = (liveChannelsResult.data ?? []) as LiveStreamChannel[];
  const livePermissions = (livePermissionsResult.data ?? []) as LiveStreamPermission[];
  const liveEvents = (liveEventsResult.data ?? []) as LiveStreamEvent[];
  const matchResults = (matchResultsResult.data ?? []) as MatchResultSubmission[];
  const matches = (matchesAuditResult.data ?? []) as ArenaMatch[];
  const profileIds = Array.from(new Set([
    ...requests.map((item) => item.requester_id),
    ...messages.map((item) => item.sender_id),
    ...teamRows.map((item) => item.owner_id).filter(Boolean),
    ...userBlocks.map((item) => item.blocked_user_id),
    ...tournaments.map((item) => item.organizer_id).filter(Boolean),
    ...livePermissions.map((item) => item.user_id),
    ...livePermissions.map((item) => item.enabled_by_user_id).filter(Boolean),
    ...liveEvents.map((item) => item.created_by_user_id).filter(Boolean),
    ...matchResults.map((item) => item.submitted_by).filter(Boolean)
  ] as string[]));
  const profilesResult = profileIds.length
    ? await supabase.from("profiles").select("id,display_name,avatar_url").in("id", profileIds)
    : { data: [] };
  const profiles = (profilesResult.data ?? []) as AdminProfile[];
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const playerCountByTeam = teamMembers.reduce<Record<string, number>>((groups, item) => {
    groups[item.team_id] = (groups[item.team_id] ?? 0) + 1;
    return groups;
  }, {});
  const tournamentMap = new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  const enrollmentsByTeam = tournamentTeams.reduce<Record<string, AdminTournamentTeamRow[]>>((groups, item) => {
    groups[item.team_id] = groups[item.team_id] ?? [];
    groups[item.team_id].push(item);
    return groups;
  }, {});
  const entitlementsByTarget = entitlements.reduce<Record<string, AccountEntitlement[]>>((groups, item) => {
    if (!item.target_id) return groups;
    groups[item.target_id] = groups[item.target_id] ?? [];
    groups[item.target_id].push(item);
    return groups;
  }, {});
  const teamAudit: AdminTeamAuditItem[] = teamRows.map((team) => ({
    team,
    owner: team.owner_id ? profileMap.get(team.owner_id) ?? null : null,
    playerCount: playerCountByTeam[team.id] ?? 0,
    tournaments: (enrollmentsByTeam[team.id] ?? [])
      .map((enrollment) => {
        const tournament = tournamentMap.get(enrollment.tournament_id);
        if (!tournament) return null;
        return {
          id: tournament.id,
          name: tournament.name,
          slug: tournament.slug,
          status: tournament.status,
          teamStatus: enrollment.status,
          fieldMode: tournament.field_mode
        };
      })
      .filter(Boolean) as AdminTeamAuditItem["tournaments"],
    entitlements: entitlementsByTarget[team.id] ?? []
  }));

  return (
    <AdminPaymentsPanel
      adminId={user.id}
      adCampaigns={(adCampaignsResult.data ?? []) as AdCampaign[]}
      adCampaignEvents={(adCampaignEventsResult.data ?? []) as AdCampaignEvent[]}
      billingPlans={(billingPlansResult.data ?? []) as BillingPlanSetting[]}
      liveChannels={liveChannels}
      liveEvents={liveEvents}
      livePermissions={livePermissions}
      matchResults={matchResults}
      matches={matches}
      messages={messages}
      profiles={profiles}
      requests={requests}
      roles={roles}
      teamAudit={teamAudit}
      tournaments={tournaments}
      userBlocks={userBlocks}
    />
  );
}

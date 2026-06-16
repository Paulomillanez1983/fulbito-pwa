import { attachFriendlyRelations, attachMatchRelations, computeStandings, demoArenaData } from "@/lib/demo";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AccountEntitlement, AdCampaign, AppFeatureFlag, AppRole, ArenaData, ArenaMatch, ArenaPlayer, ArenaTeam, ArenaTeamFormation, ArenaTournament, ArenaTournamentDraw, ArenaTournamentTeam, ArenaVenue, BillingPlanSetting, BillingPromotion, FriendlyMatch, LiveStreamChannel, LiveStreamEvent, LiveStreamPermission, PaymentMessage, PaymentRequest, SessionUser, UserNotification } from "@/lib/types";

type TournamentTeamRow = {
  tournament_id: string;
  team_id: string;
  group_code: string | null;
  seed: number | null;
  status: string;
  created_at?: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function emptyUserArenaData(user: SessionUser | null): ArenaData {
  return {
    source: "supabase",
    configured: true,
    user,
    activeTournament: null,
    tournaments: [],
    tournamentDraws: [],
    tournamentTeams: [],
    teamFormations: [],
    venues: [],
    teams: [],
      players: [],
      matches: [],
      friendlyMatches: [],
      standings: [],
    paymentRequests: [],
    paymentMessages: [],
    entitlements: [],
    billingPlans: [],
    billingPromotions: [],
    userNotifications: [],
    adCampaigns: [],
    liveChannels: [],
    livePermissions: [],
    liveEvents: [],
    featureFlags: []
  };
}

export async function getArenaData({ joinCode, friendlyCode, teamCode }: { joinCode?: string; friendlyCode?: string; teamCode?: string } = {}): Promise<ArenaData> {
  const env = getSupabaseEnv();
  const supabase = await createSupabaseServerClient();
  if (!env.configured || !supabase) {
    return { ...demoArenaData, configured: false };
  }

  let sessionUser: SessionUser | null = null;
  const normalizedJoinCode = joinCode?.trim().slice(0, 140) || "";
  const normalizedFriendlyCode = friendlyCode?.trim().slice(0, 180) || "";
  const normalizedTeamCode = teamCode?.trim().slice(0, 140) || "";

  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    sessionUser = user
      ? {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0],
          avatarUrl: user.user_metadata?.avatar_url,
          roles: ["player"]
        }
      : null;

    const emptyResult = Promise.resolve({ data: [] });
    const tournamentQuery = normalizedJoinCode
      ? uuidPattern.test(normalizedJoinCode)
        ? supabase.from("tournaments").select("*").eq("id", normalizedJoinCode).limit(1)
        : supabase.from("tournaments").select("*").eq("slug", normalizedJoinCode).limit(1)
      : supabase.from("tournaments").select("*").order("created_at", { ascending: false }).limit(user ? 50 : 1);
    const friendlyQuery = normalizedFriendlyCode
      ? supabase.from("friendly_matches").select("*").eq("invite_code", normalizedFriendlyCode).limit(1)
      : supabase.from("friendly_matches").select("*").order("scheduled_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(user ? 80 : 12);
    const [rolesResult, tournamentsResult, venuesResult, teamsResult, playersResult, teamFormationsResult, matchesResult, friendlyMatchesResult, tournamentTeamsResult, tournamentDrawsResult, paymentRequestsResult, paymentMessagesResult, entitlementsResult, billingPlansResult, billingPromotionsResult, userNotificationsResult, adCampaignsResult, liveChannelsResult, livePermissionsResult, liveEventsResult, featureFlagsResult] = await Promise.all([
      user ? supabase.from("user_roles").select("role").eq("user_id", user.id) : Promise.resolve({ data: [] }),
      tournamentQuery,
      supabase.from("venues").select("*").order("created_at", { ascending: true }),
      supabase.from("teams").select("*").order("created_at", { ascending: true }),
      supabase.from("team_members").select("*").order("team_id", { ascending: true }).order("jersey_number", { ascending: true, nullsFirst: false }),
      supabase.from("team_formation_settings").select("*"),
      supabase.from("matches").select("*").order("scheduled_at", { ascending: true }),
      friendlyQuery,
      user || normalizedJoinCode ? supabase.from("tournament_teams").select("tournament_id,team_id,group_code,seed,status,created_at") : emptyResult,
      user || normalizedJoinCode ? supabase.from("tournament_draws").select("*").order("created_at", { ascending: false }) : emptyResult,
      user ? supabase.from("payment_requests").select("*").eq("requester_id", user.id).order("created_at", { ascending: false }).limit(12) : emptyResult,
      user ? supabase.from("payment_messages").select("*").order("created_at", { ascending: true }).limit(80) : emptyResult,
      user ? supabase.from("account_entitlements").select("*").order("created_at", { ascending: false }) : emptyResult,
      supabase.from("billing_plan_settings").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
      supabase.from("billing_promotions").select("*").order("created_at", { ascending: false }).limit(80),
      user ? supabase.from("user_notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(40) : emptyResult,
      supabase.from("ad_campaigns").select("*").in("placement", ["arena_led", "sponsor_splash", "both"]).order("sort_order", { ascending: true }).order("created_at", { ascending: false }).limit(32),
      supabase.from("live_stream_channels").select("*").order("created_at", { ascending: true }),
      user ? supabase.from("live_stream_permissions").select("*").order("created_at", { ascending: false }) : emptyResult,
      supabase.from("live_stream_events").select("*").order("scheduled_start_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
      supabase.from("app_feature_flags").select("*")
    ]);

    const rawTournaments = (tournamentsResult.data ?? []) as ArenaTournament[];
    const rawVenues = (venuesResult.data ?? []) as ArenaVenue[];
    const rawTeams = (teamsResult.data ?? []) as ArenaTeam[];
    const rawPlayers = (playersResult.data ?? []) as ArenaPlayer[];
    const rawTeamFormations = (teamFormationsResult.data ?? []) as ArenaTeamFormation[];
    const rawMatches = (matchesResult.data ?? []) as ArenaMatch[];
    const rawFriendlyMatches = (friendlyMatchesResult.data ?? []) as FriendlyMatch[];
    const rawLiveEvents = (liveEventsResult.data ?? []) as LiveStreamEvent[];
    const tournamentTeams = (tournamentTeamsResult.data ?? []) as TournamentTeamRow[];
    const invitedTournament = normalizedJoinCode ? (rawTournaments[0] ?? null) as ArenaTournament | null : null;
    const invitedTeam = normalizedTeamCode
      ? rawTeams.find((team) => {
          const code = normalizedTeamCode.toLowerCase();
          return team.id === normalizedTeamCode || team.slug === normalizedTeamCode || team.short_name.toLowerCase() === code;
        }) ?? null
      : null;
    let activeTournament = (invitedTournament ?? rawTournaments[0] ?? null) as ArenaTournament | null;
    let venues = rawVenues;
    let teams = rawTeams;
    let players = rawPlayers;
    let teamFormations = rawTeamFormations;
    let matchRows = rawMatches;
    let friendlyMatchRows = rawFriendlyMatches;
    let liveEvents = rawLiveEvents;
    let tournaments = activeTournament ? [activeTournament] : [];
    let tournamentTeamRows = tournamentTeams as ArenaTournamentTeam[];
    let tournamentDrawRows = (tournamentDrawsResult.data ?? []) as ArenaTournamentDraw[];
    let roles = ((rolesResult.data ?? []).map((item) => item.role) as AppRole[]) || ["player"];
    if (!roles.length) roles = ["player"];

    if (invitedTournament && !user) {
      const invitedTeamIds = new Set(
        tournamentTeams
          .filter((row) => row.tournament_id === invitedTournament.id)
          .map((row) => row.team_id)
      );
      teams = invitedTeamIds.size ? rawTeams.filter((team) => invitedTeamIds.has(team.id)) : [];
      players = invitedTeamIds.size ? rawPlayers.filter((player) => invitedTeamIds.has(player.team_id)) : [];
      teamFormations = invitedTeamIds.size ? rawTeamFormations.filter((formation) => invitedTeamIds.has(formation.team_id)) : [];
      matchRows = rawMatches.filter((match) => match.tournament_id === invitedTournament.id);
      friendlyMatchRows = rawFriendlyMatches.filter((match) => {
        return Boolean(
          (match.home_team_id && invitedTeamIds.has(match.home_team_id)) ||
          (match.away_team_id && invitedTeamIds.has(match.away_team_id))
        );
      });
      liveEvents = rawLiveEvents.filter((event) => event.tournament_id === invitedTournament.id);
      tournaments = [invitedTournament];
      tournamentTeamRows = tournamentTeamRows.filter((row) => row.tournament_id === invitedTournament.id);
      tournamentDrawRows = tournamentDrawRows.filter((row) => row.tournament_id === invitedTournament.id);
      const venueIds = new Set<string>();
      if (invitedTournament.venue_id) venueIds.add(invitedTournament.venue_id);
      matchRows.forEach((match) => {
        if (match.venue_id) venueIds.add(match.venue_id);
      });
      venues = venueIds.size ? rawVenues.filter((venue) => venueIds.has(venue.id) || Boolean(venue.owner_id)) : rawVenues.filter((venue) => Boolean(venue.owner_id));
    }

    if (user) {
      sessionUser = sessionUser ? { ...sessionUser, roles } : null;
      const userTeamIds = new Set<string>();
      rawTeams.forEach((team) => {
        if (team.owner_id === user.id) userTeamIds.add(team.id);
      });
      rawPlayers.forEach((player) => {
        if (player.profile_id === user.id) userTeamIds.add(player.team_id);
      });

      const relatedTournamentIds = new Set<string>();
      if (invitedTournament) relatedTournamentIds.add(invitedTournament.id);
      rawTournaments.forEach((tournament) => {
        if (tournament.organizer_id === user.id) relatedTournamentIds.add(tournament.id);
      });
      tournamentTeams.forEach((row) => {
        if (userTeamIds.has(row.team_id)) relatedTournamentIds.add(row.tournament_id);
      });

      const relatedTeamIds = new Set(userTeamIds);
      if (invitedTeam) relatedTeamIds.add(invitedTeam.id);
      rawFriendlyMatches.forEach((match) => {
        if (normalizedFriendlyCode && match.invite_code === normalizedFriendlyCode) {
          relatedTeamIds.add(match.home_team_id);
          if (match.away_team_id) relatedTeamIds.add(match.away_team_id);
        }
      });
      tournamentTeams.forEach((row) => {
        if (relatedTournamentIds.has(row.tournament_id)) relatedTeamIds.add(row.team_id);
      });

      teams = rawTeams.filter((team) => relatedTeamIds.has(team.id));
      players = rawPlayers.filter((player) => relatedTeamIds.has(player.team_id));
      teamFormations = rawTeamFormations.filter((formation) => relatedTeamIds.has(formation.team_id));
      matchRows = rawMatches.filter((match) => {
        const belongsToTournament = relatedTournamentIds.has(match.tournament_id);
        const belongsToTeam = Boolean(
          (match.home_team_id && relatedTeamIds.has(match.home_team_id)) ||
          (match.away_team_id && relatedTeamIds.has(match.away_team_id))
        );
        return belongsToTournament || belongsToTeam;
      });
      friendlyMatchRows = rawFriendlyMatches.filter((match) => {
        const belongsToTeam = Boolean(
          relatedTeamIds.has(match.home_team_id) ||
          (match.away_team_id && relatedTeamIds.has(match.away_team_id))
        );
        const createdByUser = match.created_by === user.id || match.accepted_by === user.id;
        return belongsToTeam || createdByUser || match.status === "open";
      });
      liveEvents = rawLiveEvents.filter((event) => relatedTournamentIds.has(event.tournament_id));
      tournamentTeamRows = tournamentTeamRows.filter((row) => relatedTournamentIds.has(row.tournament_id));
      tournamentDrawRows = tournamentDrawRows.filter((row) => relatedTournamentIds.has(row.tournament_id));

      const relatedVenueIds = new Set<string>();
      matchRows.forEach((match) => {
        if (match.venue_id) relatedVenueIds.add(match.venue_id);
      });
      rawTournaments.forEach((tournament) => {
        if (relatedTournamentIds.has(tournament.id) && tournament.venue_id) relatedVenueIds.add(tournament.venue_id);
      });

      venues = rawVenues.filter((venue) => Boolean(venue.owner_id) || relatedVenueIds.has(venue.id));
      activeTournament = invitedTournament ?? rawTournaments.find((tournament) => relatedTournamentIds.has(tournament.id)) ?? null;
      tournaments = rawTournaments.filter((tournament) => relatedTournamentIds.has(tournament.id));
    }

    const matches = attachMatchRelations(matchRows, teams, venues);
    const friendlyMatches = attachFriendlyRelations(friendlyMatchRows, teams, venues);
    const activeTournamentTeamIds = activeTournament
      ? new Set(tournamentTeamRows.filter((row) => row.tournament_id === activeTournament?.id).map((row) => row.team_id))
      : new Set<string>();
    const standingsTeams = activeTournament && activeTournamentTeamIds.size
      ? teams.filter((team) => activeTournamentTeamIds.has(team.id))
      : teams;
    const standingsMatches = activeTournament
      ? matches.filter((match) => match.tournament_id === activeTournament?.id && (match.phase === "groups" || match.phase === "league"))
      : matches;

    const paymentRequests = ((paymentRequestsResult.data ?? []) as PaymentRequest[])
      .filter((request) => !user || request.requester_id === user.id);
    const paymentRequestIds = new Set(paymentRequests.map((request) => request.id));
    const paymentMessages = ((paymentMessagesResult.data ?? []) as PaymentMessage[])
      .filter((message) => paymentRequestIds.has(message.payment_request_id));

    return {
      source: "supabase",
      configured: true,
      user: sessionUser,
      activeTournament,
      tournaments,
      tournamentDraws: tournamentDrawRows,
      tournamentTeams: tournamentTeamRows,
      teamFormations,
      venues,
      teams,
      players,
      matches,
      friendlyMatches,
      standings: computeStandings(standingsTeams, standingsMatches),
      paymentRequests,
      paymentMessages,
      entitlements: (entitlementsResult.data ?? []) as AccountEntitlement[],
      billingPlans: (billingPlansResult.data ?? []) as BillingPlanSetting[],
      billingPromotions: (billingPromotionsResult.data ?? []) as BillingPromotion[],
      userNotifications: (userNotificationsResult.data ?? []) as UserNotification[],
      adCampaigns: (adCampaignsResult.data ?? []) as AdCampaign[],
      liveChannels: (liveChannelsResult.data ?? []) as LiveStreamChannel[],
      livePermissions: (livePermissionsResult.data ?? []) as LiveStreamPermission[],
      liveEvents,
      featureFlags: (featureFlagsResult.data ?? []) as AppFeatureFlag[]
    };
  } catch (error) {
    console.error("Fulbito Arena data fallback", error);
    if (sessionUser) return emptyUserArenaData(sessionUser);
    return { ...demoArenaData, configured: true };
  }
}

import { attachMatchRelations, computeStandings, demoArenaData } from "@/lib/demo";
import { getSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AccountEntitlement, AppRole, ArenaData, ArenaMatch, ArenaTeam, ArenaTournament, ArenaVenue, PaymentMessage, PaymentRequest } from "@/lib/types";

export async function getArenaData(): Promise<ArenaData> {
  const env = getSupabaseEnv();
  const supabase = await createSupabaseServerClient();
  if (!env.configured || !supabase) {
    return { ...demoArenaData, configured: false };
  }

  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    const emptyResult = Promise.resolve({ data: [] });
    const [rolesResult, tournamentsResult, venuesResult, teamsResult, playersResult, matchesResult, paymentRequestsResult, paymentMessagesResult, entitlementsResult] = await Promise.all([
      user ? supabase.from("user_roles").select("role").eq("user_id", user.id) : Promise.resolve({ data: [] }),
      supabase.from("tournaments").select("*").order("created_at", { ascending: false }).limit(1),
      supabase.from("venues").select("*").order("created_at", { ascending: true }),
      supabase.from("teams").select("*").order("created_at", { ascending: true }),
      supabase.from("team_members").select("*").order("team_id", { ascending: true }).order("jersey_number", { ascending: true, nullsFirst: false }),
      supabase.from("matches").select("*").order("scheduled_at", { ascending: true }),
      user ? supabase.from("payment_requests").select("*").order("created_at", { ascending: false }).limit(12) : emptyResult,
      user ? supabase.from("payment_messages").select("*").order("created_at", { ascending: true }).limit(80) : emptyResult,
      user ? supabase.from("account_entitlements").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }) : emptyResult
    ]);

    const activeTournament = ((tournamentsResult.data ?? [])[0] ?? null) as ArenaTournament | null;
    const venues = (venuesResult.data ?? []) as ArenaVenue[];
    const teams = (teamsResult.data ?? []) as ArenaTeam[];
    const matches = attachMatchRelations((matchesResult.data ?? []) as ArenaMatch[], teams, venues);

    return {
      source: "supabase",
      configured: true,
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0],
            avatarUrl: user.user_metadata?.avatar_url,
            roles: ((rolesResult.data ?? []).map((item) => item.role) as AppRole[]) || ["player"]
          }
        : null,
      activeTournament,
      venues,
      teams,
      players: playersResult.data ?? [],
      matches,
      standings: computeStandings(teams, matches),
      paymentRequests: (paymentRequestsResult.data ?? []) as PaymentRequest[],
      paymentMessages: (paymentMessagesResult.data ?? []) as PaymentMessage[],
      entitlements: (entitlementsResult.data ?? []) as AccountEntitlement[]
    };
  } catch (error) {
    console.error("Fulbito Arena data fallback", error);
    return { ...demoArenaData, configured: true };
  }
}

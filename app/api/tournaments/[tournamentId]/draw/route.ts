import { NextResponse, type NextRequest } from "next/server";
import { buildTournamentDraw } from "@/lib/draw";
import { ensureTournamentFixtures } from "@/lib/fixtures";
import { normalizeLiveWatchUrl } from "@/lib/live";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ArenaTeam, ArenaTournament } from "@/lib/types";

type DrawBody = {
  youtubeWatchUrl?: string;
};

export async function POST(request: NextRequest, context: { params: Promise<{ tournamentId: string }> }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 });

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({ error: "Entra con Google para iniciar el sorteo oficial." }, { status: 401 });

  const { tournamentId } = await context.params;
  const cleanTournamentId = String(tournamentId || "").trim();
  if (!cleanTournamentId) return NextResponse.json({ error: "Falta el torneo." }, { status: 400 });

  let body: DrawBody = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const [{ data: tournament, error: tournamentError }, { data: existingDraw }] = await Promise.all([
    supabase.from("tournaments").select("*").eq("id", cleanTournamentId).maybeSingle(),
    supabase.from("tournament_draws").select("*").eq("tournament_id", cleanTournamentId).eq("mode", "official").maybeSingle()
  ]);

  if (tournamentError) return NextResponse.json({ error: tournamentError.message }, { status: 400 });
  if (!tournament) return NextResponse.json({ error: "No encontramos ese torneo." }, { status: 404 });
  if ((tournament as ArenaTournament).organizer_id !== auth.user.id) {
    return NextResponse.json({ error: "Solo el organizador del torneo puede iniciar el sorteo oficial." }, { status: 403 });
  }
  if (existingDraw) {
    const { data: existingMatches, error: existingMatchesError } = await supabase
      .from("matches")
      .select("id")
      .eq("tournament_id", cleanTournamentId)
      .limit(1);
    if (existingMatchesError) return NextResponse.json({ error: existingMatchesError.message }, { status: 400 });
    if (existingMatches?.length) {
      return NextResponse.json({ error: "Este torneo ya tiene un sorteo oficial y fixture guardados. No se puede repetir sin auditoria." }, { status: 409 });
    }

    const { data: repairRows, error: repairRowsError } = await supabase
      .from("tournament_teams")
      .select("team_id,status,group_code,seed")
      .eq("tournament_id", cleanTournamentId)
      .eq("status", "approved");
    if (repairRowsError) return NextResponse.json({ error: repairRowsError.message }, { status: 400 });
    const repairTeamIds = (repairRows ?? []).map((row) => row.team_id);
    const { data: repairTeams, error: repairTeamsError } = await supabase.from("teams").select("*").in("id", repairTeamIds);
    if (repairTeamsError) return NextResponse.json({ error: repairTeamsError.message }, { status: 400 });
    const repairTeamsById = new Map(((repairTeams ?? []) as ArenaTeam[]).map((team) => [team.id, team]));
    const fixtureTeams = (repairRows ?? [])
      .map((row) => {
        const team = repairTeamsById.get(row.team_id);
        return team ? { ...team, group_code: row.group_code, seed: row.seed } : null;
      })
      .filter((team): team is ArenaTeam & { group_code: string | null; seed: number | null } => Boolean(team));
    const fixture = await ensureTournamentFixtures({ supabase, tournament: tournament as ArenaTournament, teams: fixtureTeams });
    return NextResponse.json({
      draw: existingDraw,
      fixture,
      reason: "El sorteo oficial ya existia. Se reparo el fixture sin repetir el sorteo."
    });
  }

  const { data: enrollmentRows, error: enrollmentError } = await supabase
    .from("tournament_teams")
    .select("team_id,status,group_code,seed")
    .eq("tournament_id", cleanTournamentId)
    .eq("status", "approved");
  if (enrollmentError) return NextResponse.json({ error: enrollmentError.message }, { status: 400 });

  const teamIds = (enrollmentRows ?? []).map((row) => row.team_id);
  if (teamIds.length < 2) return NextResponse.json({ error: "Necesitas al menos 2 equipos para sortear." }, { status: 400 });
  if ((tournament as ArenaTournament).max_teams && teamIds.length < ((tournament as ArenaTournament).max_teams ?? 0)) {
    return NextResponse.json({ error: `El sorteo oficial se habilita cuando esten los ${(tournament as ArenaTournament).max_teams} equipos.` }, { status: 400 });
  }

  const { data: teamRows, error: teamsError } = await supabase
    .from("teams")
    .select("*")
    .in("id", teamIds);
  if (teamsError) return NextResponse.json({ error: teamsError.message }, { status: 400 });

  const teams = (teamRows ?? []) as ArenaTeam[];
  const seed = `${cleanTournamentId}-${Date.now()}-${crypto.randomUUID()}`;
  const result = buildTournamentDraw({
    teams,
    format: (tournament as ArenaTournament).format,
    maxTeams: (tournament as ArenaTournament).max_teams,
    seed,
    scope: "groups"
  });
  const youtubeWatchUrl = normalizeLiveWatchUrl(String(body.youtubeWatchUrl || "")) || null;

  const { data: draw, error: insertError } = await supabase
    .from("tournament_draws")
    .insert({
      tournament_id: cleanTournamentId,
      created_by: auth.user.id,
      mode: "official",
      status: "completed",
      seed,
      duration_seconds: 150,
      teams_snapshot: result.teams,
      groups: result.groups,
      bracket: result.bracket,
      youtube_watch_url: youtubeWatchUrl
    })
    .select()
    .single();

  if (insertError) {
    const message = insertError.code === "23505"
      ? "Este torneo ya tiene un sorteo oficial guardado. No se puede repetir sin auditoria."
      : insertError.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await Promise.all(result.groups.flatMap((group) =>
    group.teams.map((team, index) =>
      supabase
        .from("tournament_teams")
        .update({ group_code: group.code, seed: index + 1 })
        .eq("tournament_id", cleanTournamentId)
        .eq("team_id", team.id)
    )
  ));

  if (!result.groups.length) {
    await Promise.all(result.teams.map((team, index) =>
      supabase
        .from("tournament_teams")
        .update({ group_code: null, seed: index + 1 })
        .eq("tournament_id", cleanTournamentId)
        .eq("team_id", team.id)
    ));
  }

  const fixtureTeams = result.groups.length
    ? result.groups.flatMap((group) =>
        group.teams.map((team, index) => ({
          id: team.id,
          name: team.name,
          slug: team.id,
          short_name: team.shortName,
          badge_url: team.badgeUrl,
          badge_frame: team.badgeFrame ?? null,
          primary_color: "#eec15c",
          neighborhood: null,
          home_venue_id: null,
          group_code: group.code,
          seed: index + 1
        }))
      )
    : result.teams.map((team, index) => ({
        id: team.id,
        name: team.name,
        slug: team.id,
        short_name: team.shortName,
        badge_url: team.badgeUrl,
        badge_frame: team.badgeFrame ?? null,
        primary_color: "#eec15c",
        neighborhood: null,
        home_venue_id: null,
        group_code: null,
        seed: index + 1
      }));
  const fixture = await ensureTournamentFixtures({ supabase, tournament: tournament as ArenaTournament, teams: fixtureTeams });

  return NextResponse.json({
    draw,
    fixture,
    reason: "Sorteo oficial guardado. El fixture real quedo creado y auditado."
  });
}

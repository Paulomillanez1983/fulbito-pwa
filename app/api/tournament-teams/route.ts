import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function readPayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json();
    return {
      teamId: String(body.teamId || "").trim(),
      tournamentId: String(body.tournamentId || "").trim()
    };
  }

  const formData = await request.formData();
  return {
    teamId: String(formData.get("teamId") || "").trim(),
    tournamentId: String(formData.get("tournamentId") || "").trim()
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 });

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({ error: "Entra con Google para inscribir tu equipo." }, { status: 401 });

  const { teamId, tournamentId } = await readPayload(request);
  if (!teamId || !tournamentId) return NextResponse.json({ error: "Falta equipo o copa para inscribir." }, { status: 400 });

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id,name,owner_id")
    .eq("id", teamId)
    .maybeSingle();

  if (teamError) return NextResponse.json({ error: teamError.message }, { status: 400 });
  if (!team) return NextResponse.json({ error: "No se encontro el equipo." }, { status: 404 });
  if (team.owner_id !== auth.user.id) return NextResponse.json({ error: "Solo el dueno del club puede inscribirlo en esta copa." }, { status: 403 });

  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id,name,field_mode")
    .eq("id", tournamentId)
    .maybeSingle();

  if (tournamentError) return NextResponse.json({ error: tournamentError.message }, { status: 400 });
  if (!tournament) return NextResponse.json({ error: "No se encontro la copa." }, { status: 404 });

  const { error: enrollError } = await supabase
    .from("tournament_teams")
    .upsert(
      { tournament_id: tournament.id, team_id: team.id, status: "approved" },
      { onConflict: "tournament_id,team_id" }
    );

  if (enrollError) return NextResponse.json({ error: enrollError.message }, { status: 400 });

  return NextResponse.json({
    team: { id: team.id, name: team.name },
    tournament: { id: tournament.id, name: tournament.name, fieldMode: tournament.field_mode }
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, userId: "", error: NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 }) };

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { supabase, userId: "", error: NextResponse.json({ error: "Entra con Google." }, { status: 401 }) };

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!role) return { supabase, userId: auth.user.id, error: NextResponse.json({ error: "Esta cuenta no tiene rol admin." }, { status: 403 }) };
  return { supabase, userId: auth.user.id, error: null };
}

export async function POST(request: NextRequest) {
  const { supabase, userId, error } = await requireAdmin();
  if (error || !supabase) return error;

  const body = await request.json();
  const action = String(body.action || "").trim();
  const tournamentId = String(body.tournamentId || "").trim();

  if (action !== "tournament_reminder") return NextResponse.json({ error: "Accion invalida." }, { status: 400 });
  if (!tournamentId) return NextResponse.json({ error: "Falta el torneo." }, { status: 400 });

  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id,name,slug,organizer_id,status")
    .eq("id", tournamentId)
    .maybeSingle();
  if (tournamentError) return NextResponse.json({ error: tournamentError.message }, { status: 400 });
  if (!tournament) return NextResponse.json({ error: "No se encontro el torneo." }, { status: 404 });

  const { data: enrollments, error: enrollmentsError } = await supabase
    .from("tournament_teams")
    .select("team_id")
    .eq("tournament_id", tournamentId);
  if (enrollmentsError) return NextResponse.json({ error: enrollmentsError.message }, { status: 400 });

  const teamIds = Array.from(new Set((enrollments ?? []).map((item) => item.team_id).filter(Boolean) as string[]));
  const [teamsResult, membersResult] = await Promise.all([
    teamIds.length ? supabase.from("teams").select("id,owner_id").in("id", teamIds) : Promise.resolve({ data: [] }),
    teamIds.length ? supabase.from("team_members").select("team_id,profile_id").in("team_id", teamIds) : Promise.resolve({ data: [] })
  ]);

  if ("error" in teamsResult && teamsResult.error) return NextResponse.json({ error: teamsResult.error.message }, { status: 400 });
  if ("error" in membersResult && membersResult.error) return NextResponse.json({ error: membersResult.error.message }, { status: 400 });

  const recipients = new Set<string>();
  if (tournament.organizer_id) recipients.add(tournament.organizer_id);
  (teamsResult.data ?? []).forEach((team) => {
    if (team.owner_id) recipients.add(team.owner_id);
  });
  (membersResult.data ?? []).forEach((member) => {
    if (member.profile_id) recipients.add(member.profile_id);
  });

  const rows = Array.from(recipients).map((recipientId) => ({
    user_id: recipientId,
    title: `Recordatorio: ${tournament.name}`,
    body: "Estas disputando este torneo. Revisen fixture, plantel, resultados pendientes y novedades del organizador.",
    notification_type: "tournament_reminder",
    target_type: "tournament",
    target_id: tournament.id,
    action_url: `/?join=${encodeURIComponent(tournament.slug)}`,
    priority: "high",
    created_by: userId,
    metadata: {
      tournament_name: tournament.name,
      tournament_status: tournament.status,
      sent_by: "admin"
    }
  }));

  if (!rows.length) return NextResponse.json({ sent: 0 });

  const { error: insertError } = await supabase.from("user_notifications").insert(rows);
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  return NextResponse.json({ sent: rows.length });
}

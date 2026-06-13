import { NextResponse, type NextRequest } from "next/server";
import { advanceTournamentBracket } from "@/lib/fixtures";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ArenaMatch, MatchResultSubmission } from "@/lib/types";

type ReviewBody = {
  submissionId?: string;
  status?: "accepted" | "rejected";
};

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 });

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({ error: "Entra como admin, organizador o veedor para revisar resultados." }, { status: 401 });

  let body: ReviewBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud invalida." }, { status: 400 });
  }

  const submissionId = String(body.submissionId || "").trim();
  const status = body.status;
  if (!submissionId || (status !== "accepted" && status !== "rejected")) {
    return NextResponse.json({ error: "Falta resultado o estado de revision." }, { status: 400 });
  }

  const { data: submission, error: submissionError } = await supabase
    .from("match_result_submissions")
    .select("*")
    .eq("id", submissionId)
    .maybeSingle();
  if (submissionError) return NextResponse.json({ error: submissionError.message }, { status: 400 });
  if (!submission) return NextResponse.json({ error: "No encontramos ese resultado enviado." }, { status: 404 });

  const currentSubmission = submission as MatchResultSubmission;
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("*")
    .eq("id", currentSubmission.match_id)
    .maybeSingle();
  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 400 });
  if (!match) return NextResponse.json({ error: "No encontramos el partido asociado." }, { status: 404 });

  let reviewedMatch = match as ArenaMatch;
  let bracketUpdate: { updated: number } | null = null;
  if (status === "accepted") {
    if (reviewedMatch.phase !== "groups" && reviewedMatch.phase !== "league" && currentSubmission.home_score === currentSubmission.away_score) {
      return NextResponse.json({ error: "En eliminatorias necesitas un ganador. Rechaza el acta y pedi cargar desempate o penales." }, { status: 400 });
    }
    const { data: updatedMatch, error: updateMatchError } = await supabase
      .from("matches")
      .update({
        home_score: currentSubmission.home_score,
        away_score: currentSubmission.away_score,
        status: "final",
        result_locked_at: new Date().toISOString()
      })
      .eq("id", currentSubmission.match_id)
      .select()
      .single();
    if (updateMatchError) {
      return NextResponse.json({ error: updateMatchError.message || "No se pudo cerrar el marcador oficial." }, { status: 403 });
    }
    reviewedMatch = updatedMatch as ArenaMatch;
    bracketUpdate = await advanceTournamentBracket({ supabase, tournamentId: reviewedMatch.tournament_id });
  }

  const { data: reviewedSubmission, error: reviewError } = await supabase
    .from("match_result_submissions")
    .update({ status })
    .eq("id", submissionId)
    .select()
    .single();
  if (reviewError) {
    return NextResponse.json({ error: reviewError.message || "No tenes permisos para revisar este resultado." }, { status: 403 });
  }

  return NextResponse.json({
    submission: reviewedSubmission as MatchResultSubmission,
    match: reviewedMatch,
    bracketUpdate,
    reason: status === "accepted" ? "Resultado aprobado. La tabla y la llave se actualizan con este marcador." : "Resultado rechazado. El partido queda pendiente."
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getFileExtension(file: File) {
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/svg+xml") return "svg";
  return file.name.split(".").pop()?.toLowerCase() || "png";
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 });

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({ error: "Entra con Google para crear tu equipo." }, { status: 401 });

  const formData = await request.formData();
  const name = String(formData.get("teamName") || "").trim();
  if (!name) return NextResponse.json({ error: "El equipo necesita nombre." }, { status: 400 });

  const shortName = String(formData.get("shortName") || name.slice(0, 3)).trim().slice(0, 4).toUpperCase();
  const neighborhood = String(formData.get("neighborhood") || "").trim();
  const primaryColor = String(formData.get("primaryColor") || "#eec15c").trim() || "#eec15c";
  const tournamentId = String(formData.get("tournamentId") || "").trim();

  await supabase.from("profiles").upsert({
    id: auth.user.id,
    display_name: auth.user.user_metadata?.full_name ?? auth.user.user_metadata?.name ?? auth.user.email?.split("@")[0] ?? "Jugador Fulbito",
    avatar_url: auth.user.user_metadata?.avatar_url ?? null
  });

  let badgePath: string | null = null;
  let badgeUrl: string | null = null;
  const badgeFile = formData.get("badgeFile");
  if (badgeFile instanceof File && badgeFile.size > 0) {
    const extension = getFileExtension(badgeFile);
    badgePath = `${auth.user.id}/${Date.now().toString(36)}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("team-badges").upload(badgePath, badgeFile, {
      cacheControl: "31536000",
      contentType: badgeFile.type || undefined,
      upsert: false
    });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });
    badgeUrl = supabase.storage.from("team-badges").getPublicUrl(badgePath).data.publicUrl;
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({
      owner_id: auth.user.id,
      name,
      slug: `${slugify(name)}-${Date.now().toString(36)}`,
      short_name: shortName,
      neighborhood,
      primary_color: primaryColor,
      badge_url: badgeUrl
    })
    .select("id,name")
    .single();

  if (teamError) {
    if (badgePath) await supabase.storage.from("team-badges").remove([badgePath]);
    return NextResponse.json({ error: teamError.message }, { status: 400 });
  }

  if (tournamentId) {
    const { error: enrollError } = await supabase
      .from("tournament_teams")
      .upsert(
        { tournament_id: tournamentId, team_id: team.id, status: "approved" },
        { onConflict: "tournament_id,team_id" }
      );
    if (enrollError) {
      return NextResponse.json({
        team,
        warning: `Equipo creado, pero no se pudo sumar a la copa: ${enrollError.message}`
      });
    }
  }

  return NextResponse.json({ team });
}

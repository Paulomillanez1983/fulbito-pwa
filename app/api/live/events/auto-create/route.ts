import { NextResponse, type NextRequest } from "next/server";
import { canCreateLiveStream, normalizeLiveWatchUrl, youtubeEmbedFromWatchUrl } from "@/lib/live";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LiveStreamEvent, LiveStreamMode, LiveStreamType, LiveStreamVisibility } from "@/lib/types";

type LiveCreateBody = {
  tournamentId?: string;
  matchId?: string;
  mode?: LiveStreamMode;
  streamType?: LiveStreamType;
  title?: string;
  description?: string;
  youtubeWatchUrl?: string;
  visibility?: LiveStreamVisibility;
  scheduledStartAt?: string;
  sponsorName?: string;
  sponsorUrl?: string;
};

const validModes: LiveStreamMode[] = ["external_link", "official_auto", "official_manual"];
const validStreamTypes: LiveStreamType[] = ["match", "final", "training", "press", "other"];
const validVisibilities: LiveStreamVisibility[] = ["public", "unlisted", "private"];

function officialMockUrl(channelUrl?: string | null) {
  if (!channelUrl) return "https://www.youtube.com/@FulbitoLIVE/live";
  return `${channelUrl.replace(/\/$/, "")}/live`;
}

function futureOrNow(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no esta configurado." }, { status: 500 });

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({ error: "Entra con Google para crear una transmision." }, { status: 401 });

  let body: LiveCreateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud invalida." }, { status: 400 });
  }

  const tournamentId = String(body.tournamentId || "").trim();
  const matchId = String(body.matchId || "").trim();
  const mode = validModes.includes(body.mode as LiveStreamMode) ? body.mode as LiveStreamMode : "external_link";
  const streamType = validStreamTypes.includes(body.streamType as LiveStreamType) ? body.streamType as LiveStreamType : "match";
  const visibility = validVisibilities.includes(body.visibility as LiveStreamVisibility) ? body.visibility as LiveStreamVisibility : "public";
  const scheduledStartAt = futureOrNow(body.scheduledStartAt);

  if (!tournamentId) return NextResponse.json({ error: "Falta el torneo." }, { status: 400 });
  if (!matchId) return NextResponse.json({ error: "Falta el partido." }, { status: 400 });
  if (mode === "official_manual") return NextResponse.json({ error: "El modo oficial manual lo controla Fulbito desde admin." }, { status: 403 });

  await supabase.from("profiles").upsert({
    id: auth.user.id,
    display_name: auth.user.user_metadata?.full_name ?? auth.user.user_metadata?.name ?? auth.user.email?.split("@")[0] ?? "Usuario Fulbito",
    avatar_url: auth.user.user_metadata?.avatar_url ?? null
  });

  const { data: existing } = await supabase
    .from("live_stream_events")
    .select("*")
    .eq("match_id", matchId)
    .eq("created_by_user_id", auth.user.id)
    .not("lifecycle_status", "in", "(complete,cancelled,failed)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      allowed: true,
      event: existing as LiveStreamEvent,
      reason: "Este partido ya tiene una transmision activa."
    });
  }

  const eligibility = await canCreateLiveStream({
    supabase,
    userId: auth.user.id,
    tournamentId,
    matchId,
    mode,
    streamType,
    scheduledStartAt
  });

  if (!eligibility.allowed) {
    return NextResponse.json({
      allowed: false,
      reason: eligibility.reason,
      limits: eligibility.limits,
      availableChannels: eligibility.availableChannels
    }, { status: 403 });
  }

  const externalUrl = normalizeLiveWatchUrl(String(body.youtubeWatchUrl || ""));
  if (mode === "external_link" && !externalUrl) {
    return NextResponse.json({ error: "Pega un link valido de YouTube, TikTok, Facebook o Instagram." }, { status: 400 });
  }

  const channel = mode === "official_auto" ? eligibility.availableChannels[0] : null;
  const watchUrl = mode === "official_auto" ? officialMockUrl(channel?.channel_url) : externalUrl;
  const title = String(body.title || "").trim() || "Fulbito Live";
  const description = String(body.description || "").trim() || null;
  const now = new Date();
  const scheduled = scheduledStartAt ?? now.toISOString();
  const lifecycleStatus = mode === "external_link"
    ? "live"
    : new Date(scheduled).getTime() > now.getTime() + 5 * 60 * 1000
      ? "scheduled"
      : "ready";

  const { data: event, error: insertError } = await supabase
    .from("live_stream_events")
    .insert({
      tournament_id: tournamentId,
      match_id: matchId,
      created_by_user_id: auth.user.id,
      channel_id: channel?.id ?? null,
      mode,
      stream_type: streamType,
      title,
      description,
      youtube_watch_url: watchUrl,
      youtube_embed_url: youtubeEmbedFromWatchUrl(watchUrl),
      youtube_broadcast_id: mode === "official_auto" ? `mock-broadcast-${crypto.randomUUID()}` : null,
      youtube_stream_id: mode === "official_auto" ? `mock-stream-${crypto.randomUUID()}` : null,
      lifecycle_status: lifecycleStatus,
      visibility,
      sponsor_name: String(body.sponsorName || "").trim() || null,
      sponsor_url: normalizeLiveWatchUrl(String(body.sponsorUrl || "")) || null,
      scheduled_start_at: scheduled
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  await supabase.from("live_stream_audit_logs").insert({
    actor_user_id: auth.user.id,
    live_stream_event_id: event.id,
    action: "live_event_created",
    metadata: {
      mode,
      streamType,
      provider: mode === "official_auto" ? "official_auto_mock" : "external_link",
      channelId: channel?.id ?? null
    }
  });

  return NextResponse.json({
    allowed: true,
    event: event as LiveStreamEvent,
    reason: mode === "official_auto" ? "Fulbito Live oficial mock creado." : "Link externo guardado como vivo."
  });
}

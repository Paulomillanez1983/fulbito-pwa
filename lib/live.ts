import type { SupabaseClient } from "@supabase/supabase-js";
import type { LiveStreamChannel, LiveStreamEvent, LiveStreamMode, LiveStreamPermission, LiveStreamType } from "@/lib/types";

type CanCreateLiveStreamArgs = {
  supabase: SupabaseClient;
  userId: string;
  tournamentId: string;
  matchId: string;
  mode: LiveStreamMode;
  streamType?: LiveStreamType;
  scheduledStartAt?: string | null;
};

export type LiveStreamEligibility = {
  allowed: boolean;
  reason: string;
  limits: {
    maxStreamsPerDay: number;
    maxStreamsPerWeek: number;
    usedToday: number;
    usedThisWeek: number;
  } | null;
  availableChannels: LiveStreamChannel[];
  permission: LiveStreamPermission | null;
};

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcWeek(date = new Date()) {
  const day = startOfUtcDay(date);
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() - weekday + 1);
  return day;
}

function isOfficialMode(mode: LiveStreamMode) {
  return mode === "official_auto" || mode === "official_manual";
}

export function normalizeLiveWatchUrl(input: string) {
  const value = input.trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function youtubeEmbedFromWatchUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = parsed.pathname.replace("/", "").trim();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host.endsWith("youtube.com")) {
      if (parsed.pathname.startsWith("/embed/")) return parsed.toString();
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function canCreateLiveStream({
  supabase,
  userId,
  tournamentId,
  matchId,
  mode,
  streamType = "match",
  scheduledStartAt
}: CanCreateLiveStreamArgs): Promise<LiveStreamEligibility> {
  const emptyLimits = { maxStreamsPerDay: 0, maxStreamsPerWeek: 0, usedToday: 0, usedThisWeek: 0 };

  const { data: flag } = await supabase
    .from("app_feature_flags")
    .select("enabled")
    .eq("key", "FULBITO_LIVE_ENABLED")
    .maybeSingle();
  if (!flag?.enabled) {
    return { allowed: false, reason: "Fulbito Live no esta activo en este momento.", limits: emptyLimits, availableChannels: [], permission: null };
  }

  const [{ data: tournament }, { data: match }, { data: block }, { data: roles }] = await Promise.all([
    supabase.from("tournaments").select("id,organizer_id,status,name,venue_id").eq("id", tournamentId).maybeSingle(),
    supabase.from("matches").select("id,tournament_id,scheduled_at,round_name").eq("id", matchId).maybeSingle(),
    supabase.from("user_blocks").select("id").eq("blocked_user_id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId)
  ]);
  const isAdmin = Boolean((roles ?? []).some((item: { role: string }) => item.role === "admin"));

  if (block) {
    return { allowed: false, reason: "Tu cuenta esta sancionada para crear transmisiones.", limits: emptyLimits, availableChannels: [], permission: null };
  }
  if (!tournament) {
    return { allowed: false, reason: "No se encontro el torneo.", limits: emptyLimits, availableChannels: [], permission: null };
  }
  let venueOwner = false;
  if (tournament.venue_id) {
    const { data: venue } = await supabase.from("venues").select("owner_id").eq("id", tournament.venue_id).maybeSingle();
    venueOwner = venue?.owner_id === userId;
  }
  if (tournament.organizer_id !== userId && !venueOwner && !isAdmin) {
    return { allowed: false, reason: "Necesitas ser creador o admin del torneo.", limits: emptyLimits, availableChannels: [], permission: null };
  }
  if (!["registration", "active"].includes(tournament.status)) {
    return { allowed: false, reason: "Tu torneo no tiene Fulbito Live habilitado.", limits: emptyLimits, availableChannels: [], permission: null };
  }
  if (!match || match.tournament_id !== tournamentId) {
    return { allowed: false, reason: "Este partido no pertenece a tu torneo.", limits: emptyLimits, availableChannels: [], permission: null };
  }

  const { data: permission } = await supabase
    .from("live_stream_permissions")
    .select("*")
    .eq("user_id", userId)
    .eq("tournament_id", tournamentId)
    .eq("status", "active")
    .maybeSingle();

  if (!permission) {
    return { allowed: false, reason: "Tu torneo no tiene Fulbito Live habilitado.", limits: emptyLimits, availableChannels: [], permission: null };
  }

  const typedPermission = permission as LiveStreamPermission;
  if (!typedPermission.allowed_stream_types.includes(streamType)) {
    return { allowed: false, reason: "Este tipo de transmision no esta habilitado para tu torneo.", limits: emptyLimits, availableChannels: [], permission: typedPermission };
  }
  if (mode === "external_link" && !typedPermission.can_use_external_link) {
    return { allowed: false, reason: "Tu torneo no permite links externos.", limits: emptyLimits, availableChannels: [], permission: typedPermission };
  }
  if (mode === "official_auto" && !typedPermission.can_use_official_auto) {
    return { allowed: false, reason: "Tu torneo no tiene Fulbito Live oficial automatico habilitado.", limits: emptyLimits, availableChannels: [], permission: typedPermission };
  }
  if (mode === "official_manual") {
    return { allowed: false, reason: "El modo oficial manual lo controla Fulbito desde admin.", limits: emptyLimits, availableChannels: [], permission: typedPermission };
  }

  const now = new Date();
  const [{ count: usedToday }, { count: usedThisWeek }] = await Promise.all([
    supabase
      .from("live_stream_events")
      .select("id", { count: "exact", head: true })
      .eq("created_by_user_id", userId)
      .gte("created_at", startOfUtcDay(now).toISOString())
      .not("lifecycle_status", "in", "(cancelled,failed)"),
    supabase
      .from("live_stream_events")
      .select("id", { count: "exact", head: true })
      .eq("created_by_user_id", userId)
      .gte("created_at", startOfUtcWeek(now).toISOString())
      .not("lifecycle_status", "in", "(cancelled,failed)")
  ]);

  const limits = {
    maxStreamsPerDay: typedPermission.max_streams_per_day,
    maxStreamsPerWeek: typedPermission.max_streams_per_week,
    usedToday: usedToday ?? 0,
    usedThisWeek: usedThisWeek ?? 0
  };

  if (limits.usedToday >= limits.maxStreamsPerDay || limits.usedThisWeek >= limits.maxStreamsPerWeek) {
    return { allowed: false, reason: "Superaste tu cupo de transmisiones.", limits, availableChannels: [], permission: typedPermission };
  }

  let availableChannels: LiveStreamChannel[] = [];
  if (isOfficialMode(mode)) {
    let channelQuery = supabase
      .from("live_stream_channels")
      .select("*")
      .eq("status", "active")
      .eq("is_official", true)
      .eq("supports_auto_mock", true);

    if (typedPermission.allowed_channel_ids.length) {
      channelQuery = channelQuery.in("id", typedPermission.allowed_channel_ids);
    }

    const { data: channels } = await channelQuery.order("created_at", { ascending: true });
    const requestedStart = scheduledStartAt ? new Date(scheduledStartAt) : match.scheduled_at ? new Date(match.scheduled_at) : null;
    const busyChannelIds = new Set<string>();

    if (requestedStart && channels?.length) {
      const start = new Date(requestedStart.getTime() - 2 * 60 * 60 * 1000).toISOString();
      const end = new Date(requestedStart.getTime() + 3 * 60 * 60 * 1000).toISOString();
      const { data: busyEvents } = await supabase
        .from("live_stream_events")
        .select("channel_id")
        .not("channel_id", "is", null)
        .not("lifecycle_status", "in", "(complete,cancelled,failed)")
        .gte("scheduled_start_at", start)
        .lte("scheduled_start_at", end);
      (busyEvents ?? []).forEach((event: Pick<LiveStreamEvent, "channel_id">) => {
        if (event.channel_id) busyChannelIds.add(event.channel_id);
      });
    }

    availableChannels = ((channels ?? []) as LiveStreamChannel[]).filter((channel) => !busyChannelIds.has(channel.id));
    if (!availableChannels.length) {
      return { allowed: false, reason: "No hay canal disponible en este horario.", limits, availableChannels: [], permission: typedPermission };
    }
  }

  return { allowed: true, reason: "Fulbito Live disponible.", limits, availableChannels, permission: typedPermission };
}

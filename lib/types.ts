export type AppRole = "player" | "captain" | "venue_owner" | "organizer" | "referee" | "admin";

export type FieldMode = "5v5" | "7v7" | "11v11";

export type TournamentFormat = "league" | "world_cup" | "knockout";

export type BillingPlanCode = "team_pro" | "tournament_pro" | "sponsor" | "featured_venue";

export type PaymentRequestStatus = "pending_review" | "approved" | "rejected" | "cancelled";

export type ResultReviewStatus = "pending" | "accepted" | "rejected";

export type AdCampaignStatus = "pending" | "active" | "paused" | "rejected" | "expired";

export type AdCampaignScope = "local" | "national";

export type AdSplashSoundVariant =
  | "off"
  | "classic_whistle"
  | "stadium_whistle"
  | "double_whistle"
  | "kickoff_hype"
  | "crowd_goal"
  | "final_whistle"
  | "stadium_horn"
  | "penalty_alert";

export type MatchStatus =
  | "scheduled"
  | "live"
  | "result_pending"
  | "confirmation_pending"
  | "final"
  | "disputed"
  | "postponed"
  | "cancelled";

export type LiveStreamMode = "external_link" | "official_auto" | "official_manual";

export type LiveStreamType = "match" | "final" | "draw" | "training" | "press" | "other";

export type LiveStreamLifecycleStatus = "scheduled" | "ready" | "testing" | "live" | "complete" | "cancelled" | "failed";

export type LiveStreamVisibility = "public" | "unlisted" | "private";

export type LiveStreamPermissionStatus = "active" | "suspended" | "expired";

export type LiveStreamChannelStatus = "active" | "busy" | "disabled";

export type ArenaVenue = {
  id: string;
  owner_id?: string | null;
  name: string;
  slug: string;
  neighborhood: string;
  address: string | null;
  phone?: string | null;
  phone_country_iso?: string | null;
  phone_country_code?: string | null;
  phone_national?: string | null;
  cover_url?: string | null;
  logo_url?: string | null;
  marker_url?: string | null;
  card_url?: string | null;
  hero_url?: string | null;
  gallery_urls?: string[] | null;
  media_frame?: Record<string, unknown> | null;
  latitude?: number | null;
  longitude?: number | null;
  price_per_hour: number;
  inscription_fee: number;
  format_prices?: Partial<Record<FieldMode, number>> | null;
  commission_rate: number;
  status: string;
  surface: string | null;
  field_modes?: FieldMode[];
  open_hours: string | null;
};

export type ArenaTeam = {
  id: string;
  owner_id?: string | null;
  name: string;
  slug: string;
  short_name: string;
  badge_url: string | null;
  badge_icon_url?: string | null;
  badge_card_url?: string | null;
  badge_frame?: Record<string, unknown> | null;
  primary_color: string;
  neighborhood: string | null;
  home_venue_id: string | null;
  points?: number;
  played?: number;
  won?: number;
  drawn?: number;
  lost?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDiff?: number;
};

export type ArenaPlayer = {
  id: string;
  team_id: string;
  profile_id?: string | null;
  display_name: string;
  alias: string | null;
  jersey_number: number | null;
  position: string | null;
  photo_url: string | null;
  avatar_url?: string | null;
  card_photo_url?: string | null;
  photo_frame?: Record<string, unknown> | null;
  goals: number;
  yellow_cards?: number;
  red_cards?: number;
};

export type ArenaTournament = {
  id: string;
  organizer_id?: string | null;
  name: string;
  slug: string;
  format: TournamentFormat;
  status: string;
  field_mode: FieldMode;
  registration_fee: number;
  max_teams: number | null;
  starts_on: string | null;
  ends_on?: string | null;
  playable_weekdays?: number[];
  playable_start_time?: string | null;
  playable_end_time?: string | null;
  schedule_notes?: string | null;
  venue_id: string | null;
};

export type ArenaTournamentDraw = {
  id: string;
  tournament_id: string;
  created_by: string | null;
  mode: "demo" | "official";
  status: "completed" | "cancelled";
  seed: string;
  duration_seconds: number;
  teams_snapshot: Array<{
    id: string;
    name: string;
    shortName: string;
    badgeUrl: string | null;
  }>;
  groups: Array<{
    code: string;
    teams: Array<{
      id: string;
      name: string;
      shortName: string;
      badgeUrl: string | null;
    }>;
  }>;
  bracket: Array<{
    round: string;
    label: string;
    home: string;
    away: string;
  }>;
  youtube_watch_url: string | null;
  created_at: string;
  completed_at: string;
};

export type ArenaTournamentTeam = {
  tournament_id: string;
  team_id: string;
  group_code: string | null;
  seed: number | null;
  status: string;
  created_at?: string;
};

export type ArenaTeamFormation = {
  team_id: string;
  field_mode: FieldMode;
  formation: string;
  slot_order: string[];
  updated_by: string | null;
  updated_at: string;
};

export type ArenaMatch = {
  id: string;
  tournament_id: string;
  venue_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  phase: string;
  round_name: string;
  group_code: string | null;
  match_order: number;
  scheduled_at: string | null;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  homeTeam?: ArenaTeam | null;
  awayTeam?: ArenaTeam | null;
  venue?: ArenaVenue | null;
};

export type FriendlyMatch = {
  id: string;
  created_by: string;
  home_team_id: string;
  away_team_id: string | null;
  venue_id: string | null;
  field_mode: FieldMode;
  invite_code: string;
  title: string;
  note: string | null;
  scheduled_at: string | null;
  status: "open" | "accepted" | "scheduled" | "result_pending" | "final" | "cancelled";
  home_score: number | null;
  away_score: number | null;
  accepted_by: string | null;
  accepted_at: string | null;
  result_locked_at: string | null;
  created_at: string;
  updated_at: string;
  homeTeam?: ArenaTeam | null;
  awayTeam?: ArenaTeam | null;
  venue?: ArenaVenue | null;
};

export type LiveStreamChannel = {
  id: string;
  name: string;
  handle: string;
  provider: string;
  channel_url: string | null;
  is_official: boolean;
  supports_auto_mock: boolean;
  status: LiveStreamChannelStatus;
  created_at: string;
  updated_at: string;
};

export type LiveStreamPermission = {
  id: string;
  user_id: string;
  tournament_id: string | null;
  can_use_external_link: boolean;
  can_use_official_auto: boolean;
  max_streams_per_day: number;
  max_streams_per_week: number;
  allowed_stream_types: LiveStreamType[];
  allowed_channel_ids: string[];
  status: LiveStreamPermissionStatus;
  enabled_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type LiveStreamEvent = {
  id: string;
  tournament_id: string;
  match_id: string | null;
  created_by_user_id: string | null;
  channel_id: string | null;
  mode: LiveStreamMode;
  stream_type: LiveStreamType;
  title: string;
  description: string | null;
  youtube_watch_url: string | null;
  youtube_embed_url: string | null;
  youtube_broadcast_id: string | null;
  youtube_stream_id: string | null;
  lifecycle_status: LiveStreamLifecycleStatus;
  visibility: LiveStreamVisibility;
  sponsor_name: string | null;
  sponsor_url: string | null;
  manual_view_count: number;
  manual_peak_viewers: number;
  manual_notes: string | null;
  scheduled_start_at: string | null;
  actual_started_at: string | null;
  actual_ended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AppFeatureFlag = {
  key: string;
  enabled: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SessionUser = {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  roles: AppRole[];
};

export type PaymentRequest = {
  id: string;
  requester_id: string;
  plan_code: BillingPlanCode;
  target_type: "team" | "tournament" | "sponsor" | "venue";
  target_id: string | null;
  title: string;
  amount: number;
  status: PaymentRequestStatus;
  proof_path: string | null;
  proof_filename: string | null;
  payer_note: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentMessage = {
  id: string;
  payment_request_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type MatchResultSubmission = {
  id: string;
  match_id: string;
  submitted_by: string | null;
  source_role: AppRole;
  home_score: number;
  away_score: number;
  status: ResultReviewStatus;
  note: string | null;
  created_at: string;
};

export type AccountEntitlement = {
  id: string;
  owner_id: string;
  plan_code: BillingPlanCode;
  target_type: "team" | "tournament" | "sponsor" | "venue";
  target_id: string | null;
  source_payment_request_id: string | null;
  starts_at: string;
  expires_at: string | null;
  created_at: string;
};

export type UserBlock = {
  id: string;
  blocked_user_id: string;
  blocked_by: string | null;
  reason: string | null;
  created_at: string;
};

export type BillingPlanSetting = {
  plan_code: BillingPlanCode;
  title: string;
  kicker: string;
  description: string;
  amount: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BillingPromotion = {
  id: string;
  plan_code: BillingPlanCode;
  title: string;
  badge: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  applies_to_renewals: boolean;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type UserNotification = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  notification_type: string;
  target_type: string | null;
  target_id: string | null;
  action_url: string | null;
  priority: "low" | "normal" | "high";
  status: "unread" | "read" | "dismissed";
  metadata: Record<string, unknown>;
  created_by: string | null;
  expires_at: string | null;
  read_at: string | null;
  created_at: string;
};

export type AdCampaign = {
  id: string;
  created_by: string | null;
  approved_by: string | null;
  advertiser_name: string;
  headline: string;
  body: string | null;
  logo_url: string | null;
  target_url: string | null;
  placement: string;
  scope: AdCampaignScope;
  latitude: number | null;
  longitude: number | null;
  radius_km: number;
  status: AdCampaignStatus;
  starts_at: string;
  ends_at: string | null;
  sort_order: number;
  splash_enabled: boolean;
  splash_cta_label: string;
  splash_close_after_seconds: number;
  splash_frequency_hours: number;
  splash_creative_url: string | null;
  splash_creative_scale: number;
  splash_creative_animation: "none" | "soft_zoom" | "stadium_bounce" | "pulse_glow" | "slide_pan";
  splash_sound_variant: AdSplashSoundVariant;
  created_at: string;
  updated_at: string;
};

export type AdCampaignEvent = {
  id: string;
  campaign_id: string;
  user_id: string | null;
  anon_id: string | null;
  event_type: "impression" | "click" | "dismiss";
  placement: string;
  source_path: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ArenaData = {
  source: "supabase" | "demo";
  configured: boolean;
  user: SessionUser | null;
  activeTournament: ArenaTournament | null;
  tournaments: ArenaTournament[];
  tournamentDraws: ArenaTournamentDraw[];
  tournamentTeams: ArenaTournamentTeam[];
  teamFormations: ArenaTeamFormation[];
  venues: ArenaVenue[];
  teams: ArenaTeam[];
  players: ArenaPlayer[];
  matches: ArenaMatch[];
  friendlyMatches: FriendlyMatch[];
  standings: ArenaTeam[];
  paymentRequests: PaymentRequest[];
  paymentMessages: PaymentMessage[];
  entitlements: AccountEntitlement[];
  billingPlans: BillingPlanSetting[];
  billingPromotions: BillingPromotion[];
  userNotifications: UserNotification[];
  adCampaigns: AdCampaign[];
  liveChannels: LiveStreamChannel[];
  livePermissions: LiveStreamPermission[];
  liveEvents: LiveStreamEvent[];
  featureFlags: AppFeatureFlag[];
};

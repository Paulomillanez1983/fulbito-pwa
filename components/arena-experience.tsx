"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Flag,
  Gamepad2,
  Globe2,
  LoaderCircle,
  LogIn,
  LogOut,
  LocateFixed,
  MapPinned,
  Megaphone,
  Plus,
  RadioTower,
  Repeat2,
  Save,
  Shield,
  ShieldCheck,
  Share2,
  Star,
  Trophy,
  UserCheck,
  UserMinus,
  Users,
  X
} from "lucide-react";
import { ArenaActions } from "@/components/arena-actions";
import { InstallAppButton } from "@/components/install-app-button";
import { LoginPanel } from "@/components/login-panel";
import { PaymentConsole } from "@/components/payment-console";
import { OutdoorModeToggle } from "@/components/outdoor-mode-toggle";
import { OnboardingTour } from "@/components/onboarding-tour";
import { triggerHaptic } from "@/lib/haptics";
import { isSponsorSoundVariant } from "@/lib/ad-sounds";
import { buildTournamentDraw, type DrawResult } from "@/lib/draw";
import { storedImageFrameCssVars, storedImageFrameShape, storedImageFrameTransform, type StoredImageFrameShape } from "@/lib/image-frame";
import { roleCatalog } from "@/lib/demo";
import { getRosterRule } from "@/lib/roster";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getKnockoutBracketSize } from "@/lib/tournament-structure";
import type { AccountEntitlement, AdCampaign, AppRole, ArenaData, ArenaMatch, ArenaPlayer, ArenaTeam, ArenaTournament, ArenaTournamentDraw, ArenaTournamentTeam, ArenaVenue, FieldMode, FriendlyMatch, LiveStreamEvent, LiveStreamMode, PaymentRequest, UserNotification } from "@/lib/types";
import { primaryVenuePrice, venueSurfaceSummary, venueSurfacesFromStored } from "@/lib/venue-options";

// Dynamic import of heavy map component for fast initial PWA load
const VenueMap = dynamic(() => import("@/components/venue-map").then((mod) => mod.VenueMap), {
  loading: () => (
    <div className="h-64 w-full animate-pulse bg-slate-900/60 rounded-xl border border-emerald-500/20 flex flex-col items-center justify-center gap-2 text-xs text-emerald-400">
      <LoaderCircle className="w-6 h-6 animate-spin text-emerald-400" />
      <span>Cargando mapa de canchas partner...</span>
    </div>
  ),
  ssr: false,
});

export { VenueMap, OutdoorModeToggle, OnboardingTour };

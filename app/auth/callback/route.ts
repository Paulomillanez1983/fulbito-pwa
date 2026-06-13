import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types";

const allowedRoles: AppRole[] = ["player", "captain", "venue_owner", "organizer", "referee"];

function safeRedirectUrl(next: string | null, origin: string) {
  try {
    const url = new URL(next || "/", origin);
    return url.origin === origin ? url : new URL("/", origin);
  } catch {
    return new URL("/", origin);
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const role = requestUrl.searchParams.get("role") as AppRole | null;
  const supabase = await createSupabaseServerClient();

  if (code && supabase) {
    await supabase.auth.exchangeCodeForSession(code);
    const { data } = await supabase.auth.getUser();
    if (data.user && role && allowedRoles.includes(role)) {
      await supabase.from("user_roles").upsert({ user_id: data.user.id, role }, { onConflict: "user_id,role" });
    }
  }

  return NextResponse.redirect(safeRedirectUrl(next, requestUrl.origin));
}

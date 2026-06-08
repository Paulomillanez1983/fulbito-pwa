"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/config";

export function createSupabaseBrowserClient() {
  const env = getSupabaseEnv();
  if (!env.configured || !env.url || !env.key) {
    throw new Error("Supabase is not configured");
  }

  return createBrowserClient(env.url, env.key);
}

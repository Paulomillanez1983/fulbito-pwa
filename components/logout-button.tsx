"use client";

import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LogoutButton() {
  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut({ scope: "local" });
    window.location.href = "/";
  }

  return (
    <button className="ghost-button" onClick={logout} type="button">
      <LogOut size={16} />
      Salir
    </button>
  );
}

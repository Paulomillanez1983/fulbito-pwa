"use client";

import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { roleCatalog } from "@/lib/demo";
import { getSiteUrl } from "@/lib/supabase/config";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AppRole } from "@/lib/types";

const loginRoles: AppRole[] = ["player", "captain", "venue_owner", "organizer", "referee"];

export function LoginPanel({ configured }: { configured: boolean }) {
  const [role, setRole] = useState<AppRole>("player");
  const selected = roleCatalog[role];
  const disabled = !configured;

  const redirectTo = useMemo(() => {
    const url = new URL("/auth/callback", getSiteUrl());
    url.searchParams.set("next", "/");
    url.searchParams.set("role", role);
    return url.toString();
  }, [role]);

  async function signInWithGoogle() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent"
        }
      }
    });
    if (error) window.alert(error.message);
  }

  return (
    <section className="login-panel" id="login">
      <div>
        <p className="eyebrow">Google Login + roles</p>
        <h2>Entrar a Fulbito Arena</h2>
        <p>
          Elegi tu rol principal. Despues podras sumar mas roles si sos capitan, duenio de cancha u organizador.
        </p>
      </div>

      <div className="role-picker" aria-label="Elegir rol">
        {loginRoles.map((item) => (
          <button
            className={item === role ? "role-chip is-active" : "role-chip"}
            key={item}
            onClick={() => setRole(item)}
            type="button"
          >
            <span>{roleCatalog[item].label}</span>
          </button>
        ))}
      </div>

      <article className="selected-role-card">
        <ShieldCheck size={20} />
        <div>
          <strong>{selected.headline}</strong>
          <span>{selected.consumes.slice(0, 3).join(" / ")}</span>
        </div>
      </article>

      <button className="google-button" disabled={disabled} onClick={signInWithGoogle} type="button">
        <span>G</span>
        Continuar con Google
      </button>
      {!configured ? (
        <p className="login-warning">Supabase todavia no esta configurado en el entorno. La UI queda en modo demo.</p>
      ) : null}
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { roleCatalog } from "@/lib/demo";
import { getSiteUrl } from "@/lib/supabase/config";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AppRole } from "@/lib/types";

const loginRoles: AppRole[] = ["player", "captain", "venue_owner", "organizer", "referee"];

export function LoginPanel({ configured, joinCode, tournamentName }: { configured: boolean; joinCode?: string; tournamentName?: string }) {
  const inviteMode = Boolean(joinCode);
  const [role, setRole] = useState<AppRole>(inviteMode ? "captain" : "player");
  const selected = roleCatalog[role];
  const disabled = !configured;

  const redirectTo = useMemo(() => {
    const url = new URL("/auth/callback", getSiteUrl());
    url.searchParams.set("next", joinCode ? `/?join=${encodeURIComponent(joinCode)}` : "/");
    url.searchParams.set("role", role);
    return url.toString();
  }, [joinCode, role]);

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
    <section className={`login-panel ${inviteMode ? "login-panel--invite" : ""}`} id="login">
      <div>
        <p className="eyebrow">{inviteMode ? "Invitacion recibida" : "Tu copa empieza aca"}</p>
        <h2>{inviteMode ? "Entra para cargar tu equipo" : "Crear torneo o sumarte a uno"}</h2>
        <p>
          {inviteMode
            ? `Google confirma tu cuenta y te lleva a la carga del club para ${tournamentName ?? "esta copa"}.`
            : "Elegi como vas a participar. Despues podes crear un mundial barrial, registrar tu equipo o entrar como jugador."}
        </p>
      </div>

      {inviteMode ? null : (
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
      )}

      <article className="selected-role-card">
        <ShieldCheck size={20} />
        <div>
          <strong>{inviteMode ? "Capitan / DT del equipo invitado" : selected.headline}</strong>
          <span>{inviteMode ? "Crear club / Cargar plantel / Inscribirse en la copa" : selected.consumes.slice(0, 3).join(" / ")}</span>
        </div>
      </article>

      <button className="google-button" disabled={disabled} onClick={signInWithGoogle} type="button">
        <span>G</span>
        {inviteMode ? "Entrar con Google y cargar equipo" : "Entrar con Google"}
      </button>
      {!configured ? (
        <p className="login-warning">Supabase todavia no esta configurado en el entorno. La UI queda en modo demo.</p>
      ) : null}
    </section>
  );
}

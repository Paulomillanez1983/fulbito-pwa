"use client";

import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { roleCatalog } from "@/lib/demo";
import { getSiteUrl } from "@/lib/supabase/config";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AppRole } from "@/lib/types";

const loginRoles: AppRole[] = ["player", "captain", "venue_owner", "organizer", "referee"];

const roleEntryCopy: Record<AppRole, { action: string; body: string; cta: string }> = {
  player: {
    action: "Ver mi equipo y completar ficha",
    body: "Para jugadores que quieren ver partidos, cargar dorsal, apodo y confirmar presencia.",
    cta: "Entrar como jugador"
  },
  captain: {
    action: "Cargar club e invitar jugadores",
    body: "Para capitanes o DT que inscriben el equipo en una copa y ordenan el plantel.",
    cta: "Entrar como capitan"
  },
  venue_owner: {
    action: "Registrar cancha",
    body: "Para duenos de sede que quieren publicar ubicacion, WhatsApp y precios.",
    cta: "Entrar como cancha"
  },
  organizer: {
    action: "Crear torneo e invitar equipos",
    body: "Para quien arma la copa, define formato, fechas y comparte invitaciones por WhatsApp.",
    cta: "Entrar y crear torneo"
  },
  referee: {
    action: "Cargar resultados oficiales",
    body: "Para veedores que cargan marcador, tarjetas, MVP y validan actas cuando esten habilitados.",
    cta: "Entrar como veedor"
  },
  admin: {
    action: "Administrar Fulbito",
    body: "Panel interno para pagos, auditoria, usuarios y configuracion operativa.",
    cta: "Entrar al panel"
  }
};

export function LoginPanel({
  configured,
  joinCode,
  teamCode,
  tournamentName,
  nextTarget = "/"
}: {
  configured: boolean;
  joinCode?: string;
  teamCode?: string;
  tournamentName?: string;
  nextTarget?: string;
}) {
  const inviteMode = Boolean(joinCode || teamCode);
  const playerInviteMode = Boolean(teamCode);
  const [role, setRole] = useState<AppRole>(playerInviteMode ? "player" : inviteMode ? "captain" : "player");
  const selected = roleCatalog[role];
  const selectedCopy = roleEntryCopy[role];
  const disabled = !configured;

  const redirectTo = useMemo(() => {
    const siteOrigin = typeof window !== "undefined" ? window.location.origin : getSiteUrl();
    const url = new URL("/auth/callback", siteOrigin);
    const nextParams = new URLSearchParams();
    if (joinCode) nextParams.set("join", joinCode);
    if (teamCode) nextParams.set("team", teamCode);
    const rawNext = nextParams.size ? `/?${nextParams.toString()}` : nextTarget;
    const safeNext = new URL(rawNext || "/", siteOrigin);
    url.searchParams.set("next", safeNext.origin === siteOrigin ? `${safeNext.pathname}${safeNext.search}${safeNext.hash}` : "/");
    url.searchParams.set("role", role);
    return url.toString();
  }, [joinCode, nextTarget, role, teamCode]);

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
        <h2>{inviteMode ? (playerInviteMode ? "Entra para ficharte" : "Entra para cargar tu equipo") : "Elegi tu rol inicial"}</h2>
        <p>
          {inviteMode
            ? playerInviteMode
              ? `Google confirma tu cuenta y te lleva directo a tu ficha de jugador para ${tournamentName ?? "esta copa"}.`
              : `Google confirma tu cuenta y te lleva a la carga del club para ${tournamentName ?? "esta copa"}.`
            : "Una misma cuenta puede tener varios permisos. Elegi lo que queres hacer ahora; despues podes activar otros roles."}
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
          <strong>
            {inviteMode
              ? playerInviteMode
                ? "Jugador invitado"
                : "Capitan / DT del equipo invitado"
              : `${selected.label}: ${selectedCopy.action}`}
          </strong>
          <span>
            {inviteMode
              ? playerInviteMode
                ? "Completar nombre, dorsal, posicion y apodo dentro del equipo correcto."
                : "Crear o elegir club, cargar plantel e inscribirse en la copa correcta."
              : selectedCopy.body}
          </span>
        </div>
      </article>

      <button className="google-button" disabled={disabled} onClick={signInWithGoogle} type="button">
        <span>G</span>
        {inviteMode ? (playerInviteMode ? "Entrar con Google y ficharme" : "Entrar con Google y cargar equipo") : selectedCopy.cta}
      </button>
      {!configured ? (
        <p className="login-warning">Supabase todavia no esta configurado en el entorno. La UI queda en modo demo.</p>
      ) : null}
    </section>
  );
}

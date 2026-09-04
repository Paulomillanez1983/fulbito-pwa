"use client";

import { useEffect, useState } from "react";
import { Sparkles, Trophy, Users, Shield, MapPin, CheckCircle2, X } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

type RoleOption = "jugador" | "capitan" | "duenio" | "organizador" | "arbitro";

interface OnboardingTourProps {
  userRole?: string;
}

export function OnboardingTour({ userRole = "jugador" }: OnboardingTourProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const hasSeen = localStorage.getItem("fulbito_onboarding_completed");
    if (!hasSeen) {
      const timer = setTimeout(() => setIsOpen(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    triggerHaptic("light");
    localStorage.setItem("fulbito_onboarding_completed", "true");
    setIsOpen(false);
  };

  const roleGuideContent: Record<RoleOption, Array<{ title: string; desc: string; icon: React.ReactNode }>> = {
    jugador: [
      {
        title: "¡Bienvenido al Barrio, Crack!",
        desc: "Fulbito Arena transforma tus partidos de fin de semana en un torneo profesional tipo Mundial Barrial.",
        icon: <Trophy className="w-8 h-8 text-emerald-400 animate-bounce" />,
      },
      {
        title: "Tu Perfil de Jugador",
        desc: "Personalizá tu apodo, dorsal y posición en la cancha. Sumá minutos y subí tu nivel partido a partido.",
        icon: <Users className="w-8 h-8 text-amber-400" />,
      },
      {
        title: "Sedes y Partidos",
        desc: "Explorá las canchas asociadas en el mapa, mirá el fixture en tiempo real y seguí las estadísticas.",
        icon: <MapPin className="w-8 h-8 text-cyan-400" />,
      },
    ],
    capitan: [
      {
        title: "Modo Capitán / DT",
        desc: "Tenés el control de tu equipo. Creá la insignia, asigná dorsales y armá la táctica de juego.",
        icon: <Shield className="w-8 h-8 text-emerald-400" />,
      },
      {
        title: "Formación 5v5, 7v7 o 11v11",
        desc: "Diagramá la alineación titular en la cancha interactiva y confirmá la lista de buena fe.",
        icon: <Users className="w-8 h-8 text-amber-400" />,
      },
      {
        title: "Inscripciones y Pagos",
        desc: "Gestioná los pagos del equipo con la consola de deslizamiento segura y recibí comprobantes instantáneos.",
        icon: <CheckCircle2 className="w-8 h-8 text-cyan-400" />,
      },
    ],
    duenio: [
      {
        title: "Consola de Canchas Partner",
        desc: "Administrá la disponibilidad de tus canchas, precios por hora y turnos de torneos.",
        icon: <MapPin className="w-8 h-8 text-emerald-400" />,
      },
      {
        title: "Gestión de Comisiones",
        desc: "Visualizá los ingresos generados por reservas e inscripciones sugeridas en tiempo real.",
        icon: <Trophy className="w-8 h-8 text-amber-400" />,
      },
    ],
    organizador: [
      {
        title: "Organización de Torneos",
        desc: "Creá ligas, copas eliminatorias o mundiales barriales. Generá fixtures y sorteos automáticos.",
        icon: <Trophy className="w-8 h-8 text-emerald-400" />,
      },
      {
        title: "Validación de Resultados",
        desc: "Revisá los planillajes cargados por los árbitros y actualizá la tabla de posiciones con un clic.",
        icon: <CheckCircle2 className="w-8 h-8 text-amber-400" />,
      },
    ],
    arbitro: [
      {
        title: "Panel de Veedor y Árbitro",
        desc: "Cargá goles, tarjetas amarillas/rojas y faltas en tiempo real durante los partidos.",
        icon: <Shield className="w-8 h-8 text-emerald-400" />,
      },
      {
        title: "Cierre de Planillas",
        desc: "Firma digital y envío de la planilla oficial de partido para validación del organizador.",
        icon: <CheckCircle2 className="w-8 h-8 text-cyan-400" />,
      },
    ],
  };

  const normalizedRole: RoleOption = (roleGuideContent[userRole as RoleOption] ? userRole : "jugador") as RoleOption;
  const currentSteps = roleGuideContent[normalizedRole];

  if (!isOpen) return null;

  const currentContent = currentSteps[step] || currentSteps[0];
  const isLast = step === currentSteps.length - 1;

  const nextStep = () => {
    triggerHaptic("light");
    if (isLast) {
      handleClose();
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 via-zinc-900 to-black border border-emerald-500/40 p-6 shadow-2xl shadow-emerald-950/50">
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 p-1 text-zinc-400 hover:text-white rounded-full bg-black/40"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center mt-2 space-y-4">
          <div className="p-3 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            {currentContent.icon}
          </div>

          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Sparkles className="w-3 h-3" /> Guía {normalizedRole}
            </span>
            <h3 className="text-xl font-black tracking-tight text-white">{currentContent.title}</h3>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed px-2">{currentContent.desc}</p>

          <div className="flex items-center gap-1.5 pt-2">
            {currentSteps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === step ? "w-6 bg-emerald-400" : "w-1.5 bg-zinc-700"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={nextStep}
            className="w-full py-2.5 px-4 mt-3 rounded-xl font-black text-xs uppercase tracking-wider text-black bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 active:scale-95 transition-all shadow-lg shadow-emerald-500/25"
          >
            {isLast ? "¡Empezar a Jugar!" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}

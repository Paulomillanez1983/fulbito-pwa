"use client";

import { useEffect, useState } from "react";
import { Sun, SunMoon } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

export function OutdoorModeToggle() {
  const [isOutdoorMode, setIsOutdoorMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("fulbito_outdoor_mode");
    if (saved === "true") {
      setIsOutdoorMode(true);
      document.documentElement.classList.add("outdoor-mode");
    }
  }, []);

  const toggleOutdoorMode = () => {
    triggerHaptic("medium");
    setIsOutdoorMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("outdoor-mode");
        localStorage.setItem("fulbito_outdoor_mode", "true");
      } else {
        document.documentElement.classList.remove("outdoor-mode");
        localStorage.setItem("fulbito_outdoor_mode", "false");
      }
      return next;
    });
  };

  return (
    <button
      type="button"
      onClick={toggleOutdoorMode}
      aria-label="Modo Sol Directo / Alto Contraste"
      title={isOutdoorMode ? "Modo Estadio Normal" : "Modo Cancha (Sol Directo)"}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide transition-all border shadow-sm ${
        isOutdoorMode
          ? "bg-amber-400 text-black border-amber-300 ring-2 ring-amber-400/50 font-bold"
          : "bg-black/40 hover:bg-black/60 text-emerald-300 border-emerald-500/30 backdrop-blur-md"
      }`}
    >
      {isOutdoorMode ? (
        <>
          <Sun className="w-3.5 h-3.5 animate-spin-slow text-black" />
          <span>SOL DIRECTO ON</span>
        </>
      ) : (
        <>
          <SunMoon className="w-3.5 h-3.5 text-emerald-400" />
          <span>Modo Sol</span>
        </>
      )}
    </button>
  );
}

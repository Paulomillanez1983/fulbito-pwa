import type { AdSplashSoundVariant } from "@/lib/types";

export const sponsorSoundOptions: Array<{
  value: AdSplashSoundVariant;
  label: string;
  description: string;
}> = [
  {
    value: "stadium_whistle",
    label: "Silbato estadio",
    description: "Silbato doble, golpe grave, tribuna y eco corto."
  },
  {
    value: "double_whistle",
    label: "Doble silbato arbitro",
    description: "Dos pitazos secos para llamar la atencion rapido."
  },
  {
    value: "kickoff_hype",
    label: "Arranque de partido",
    description: "Golpe de cancha, subida de publico y brillo de estadio."
  },
  {
    value: "crowd_goal",
    label: "Gol de tribuna",
    description: "Celebracion amplia con publico paneado izquierda/derecha."
  },
  {
    value: "final_whistle",
    label: "Final con festejo",
    description: "Silbato largo final y celebracion de cierre."
  },
  {
    value: "stadium_horn",
    label: "Bocina de estadio",
    description: "Bocina grave con ambiente de tribuna."
  },
  {
    value: "penalty_alert",
    label: "Alerta penal",
    description: "Pitazo intenso con pulsos cortos tipo decision importante."
  },
  {
    value: "classic_whistle",
    label: "Silbato clasico",
    description: "Pitazo limpio, mas liviano y sin festejo."
  },
  {
    value: "off",
    label: "Sin sonido",
    description: "No reproduce audio al mostrar el sponsor."
  }
];

export function isSponsorSoundVariant(value: unknown): value is AdSplashSoundVariant {
  return sponsorSoundOptions.some((option) => option.value === value);
}

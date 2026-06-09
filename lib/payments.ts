import type { BillingPlanCode, PaymentRequest } from "@/lib/types";

export type PaymentTargetType = "team" | "tournament" | "sponsor" | "venue";

export type PaymentPlan = {
  code: BillingPlanCode;
  title: string;
  amount: number;
  targetType: PaymentTargetType;
  kicker: string;
  description: string;
  features: string[];
};

export const paymentAccount = {
  alias: "FULBITO.AR",
  cvu: "0000168300000004090074"
};

export const paymentPlans: PaymentPlan[] = [
  {
    code: "team_pro",
    title: "Equipo Pro",
    amount: 5000,
    targetType: "team",
    kicker: "Identidad del club",
    description: "Fotos, escudo premium, cartas estilo juego y estadisticas del plantel.",
    features: ["Fotos de jugadores", "Cartas FIFA style", "MVP y ranking"]
  },
  {
    code: "tournament_pro",
    title: "Torneo Pro",
    amount: 15000,
    targetType: "tournament",
    kicker: "Camino a la copa",
    description: "Fixture avanzado, grupos, eliminatorias visuales y portada compartible.",
    features: ["Fixture premium", "Llave eliminatoria", "Portada social"]
  },
  {
    code: "sponsor",
    title: "Sponsor local",
    amount: 20000,
    targetType: "sponsor",
    kicker: "Publicidad barrial",
    description: "Marca visible dentro del torneo, fecha, MVP y piezas para compartir.",
    features: ["Banner de fecha", "MVP presentado por", "Logo en cards"]
  },
  {
    code: "featured_venue",
    title: "Cancha destacada",
    amount: 8000,
    targetType: "venue",
    kicker: "Visibilidad sin comision",
    description: "La cancha aparece destacada sin que Fulbito cobre alquileres ni reservas.",
    features: ["Mapa destacado", "Sede partner", "Contacto visible"]
  }
];

export const paymentStatusMeta: Record<PaymentRequest["status"], { label: string; tone: string }> = {
  pending_review: { label: "Pendiente", tone: "pending" },
  approved: { label: "Aprobado", tone: "approved" },
  rejected: { label: "Revisar", tone: "rejected" },
  cancelled: { label: "Cancelado", tone: "cancelled" }
};

export function formatPaymentMoney(value: number) {
  return `$ ${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

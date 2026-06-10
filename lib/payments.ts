import type { BillingPlanCode, BillingPlanSetting, PaymentRequest } from "@/lib/types";

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
    code: "tournament_pro",
    title: "Crear Torneo Pro",
    amount: 15000,
    targetType: "tournament",
    kicker: "Camino a la copa",
    description: "Crea una copa con grupos + eliminatorias o eliminacion directa. Despues invita equipos por WhatsApp.",
    features: ["Fixture premium", "Llave eliminatoria", "Portada social"]
  },
  {
    code: "team_pro",
    title: "Equipo Pro",
    amount: 5000,
    targetType: "team",
    kicker: "Identidad del club",
    description: "El equipo basico es gratis. Activa fotos, escudo premium, cartas estilo juego y estadisticas del plantel.",
    features: ["Fotos de jugadores", "Cartas FIFA style", "MVP y ranking"]
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

export function mergePaymentPlans(settings: BillingPlanSetting[] = []) {
  if (!settings.length) return paymentPlans;
  const byCode = new Map(settings.map((setting) => [setting.plan_code, setting]));
  return paymentPlans
    .map((plan) => {
      const setting = byCode.get(plan.code);
      if (!setting || !setting.is_active) return setting?.is_active === false ? null : plan;
      return {
        ...plan,
        title: setting.title,
        amount: setting.amount,
        kicker: setting.kicker,
        description: setting.description,
        features: setting.features.length ? setting.features : plan.features
      };
    })
    .filter((plan): plan is PaymentPlan => Boolean(plan));
}

import type { BillingPlanCode, BillingPlanSetting, BillingPromotion, PaymentRequest } from "@/lib/types";

export type PaymentTargetType = "team" | "tournament" | "sponsor" | "venue";

export type PaymentPlan = {
  code: BillingPlanCode;
  title: string;
  amount: number;
  regularAmount?: number;
  targetType: PaymentTargetType;
  kicker: string;
  description: string;
  features: string[];
  promotion?: {
    id: string;
    title: string;
    badge: string;
    description: string | null;
    discountType: BillingPromotion["discount_type"];
    discountValue: number;
    endsAt: string | null;
    appliesToRenewals: boolean;
  };
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

function isPromotionActive(promotion: BillingPromotion, now = Date.now()) {
  if (!promotion.is_active) return false;
  const startsAt = new Date(promotion.starts_at).getTime();
  const endsAt = promotion.ends_at ? new Date(promotion.ends_at).getTime() : null;
  if (Number.isFinite(startsAt) && startsAt > now) return false;
  if (endsAt && Number.isFinite(endsAt) && endsAt < now) return false;
  return true;
}

function promotedAmount(baseAmount: number, promotion: BillingPromotion) {
  if (promotion.discount_type === "percent") {
    const percent = Math.min(100, Math.max(0, promotion.discount_value));
    return Math.max(0, Math.round(baseAmount * (1 - percent / 100)));
  }
  return Math.max(0, Math.round(baseAmount - Math.max(0, promotion.discount_value)));
}

function attachPromotion(plan: PaymentPlan, promotions: BillingPromotion[]) {
  const promotion = promotions
    .filter((item) => item.plan_code === plan.code && isPromotionActive(item))
    .map((item) => ({ promotion: item, amount: promotedAmount(plan.amount, item) }))
    .sort((left, right) => left.amount - right.amount || new Date(left.promotion.created_at).getTime() - new Date(right.promotion.created_at).getTime())[0];

  if (!promotion || promotion.amount >= plan.amount) return plan;

  return {
    ...plan,
    amount: promotion.amount,
    regularAmount: plan.amount,
    promotion: {
      id: promotion.promotion.id,
      title: promotion.promotion.title,
      badge: promotion.promotion.badge,
      description: promotion.promotion.description,
      discountType: promotion.promotion.discount_type,
      discountValue: promotion.promotion.discount_value,
      endsAt: promotion.promotion.ends_at,
      appliesToRenewals: promotion.promotion.applies_to_renewals
    }
  };
}

export function mergePaymentPlans(settings: BillingPlanSetting[] = [], promotions: BillingPromotion[] = []) {
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
    .map((plan) => plan ? attachPromotion(plan, promotions) : null)
    .filter((plan): plan is PaymentPlan => Boolean(plan));
}

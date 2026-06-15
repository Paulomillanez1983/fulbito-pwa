"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CalendarClock, CheckCircle2, LoaderCircle, Percent, PlusCircle, ShieldCheck, Tag, Trash2 } from "lucide-react";
import { formatPaymentMoney, mergePaymentPlans } from "@/lib/payments";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { BillingPlanCode, BillingPlanSetting, BillingPromotion } from "@/lib/types";

const planLabels: Record<BillingPlanCode, string> = {
  tournament_pro: "Torneo Pro",
  team_pro: "Equipo Pro",
  sponsor: "Sponsor local",
  featured_venue: "Cancha Pro"
};

function dateInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function parseDate(value: FormDataEntryValue | null, endOfDay = false) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return `${raw}T${endOfDay ? "23:59:59" : "00:00:00"}-03:00`;
}

function promotionDiscountCopy(promotion: BillingPromotion) {
  return promotion.discount_type === "percent"
    ? `${promotion.discount_value}% OFF`
    : `${formatPaymentMoney(promotion.discount_value)} OFF`;
}

export function AdminPricingPanel({
  adminId,
  initialPlans,
  initialPromotions
}: {
  adminId: string;
  initialPlans: BillingPlanSetting[];
  initialPromotions: BillingPromotion[];
}) {
  const [settings, setSettings] = useState(initialPlans);
  const [promotions, setPromotions] = useState(initialPromotions);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const basePlans = useMemo(() => mergePaymentPlans(settings), [settings]);
  const promotedPlans = useMemo(() => mergePaymentPlans(settings, promotions), [settings, promotions]);
  const activePromotions = useMemo(() => promotions.filter((promotion) => {
    if (!promotion.is_active) return false;
    const now = Date.now();
    const starts = new Date(promotion.starts_at).getTime();
    const ends = promotion.ends_at ? new Date(promotion.ends_at).getTime() : null;
    return (!Number.isFinite(starts) || starts <= now) && (!ends || ends >= now);
  }), [promotions]);

  async function savePlan(event: FormEvent<HTMLFormElement>, planCode: BillingPlanCode) {
    event.preventDefault();
    setNotice("");
    setBusy(`plan-${planCode}`);
    const form = new FormData(event.currentTarget);
    const plan = basePlans.find((item) => item.code === planCode);
    const amount = Math.max(0, Math.round(Number(form.get("amount") || plan?.amount || 0)));
    if (!plan) {
      setNotice("No se encontro el plan.");
      setBusy("");
      return;
    }
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("billing_plan_settings")
        .upsert({
          plan_code: plan.code,
          title: plan.title,
          kicker: plan.kicker,
          description: plan.description,
          amount,
          features: plan.features,
          is_active: true,
          updated_by: adminId
        }, { onConflict: "plan_code" })
        .select()
        .single();
      if (error) throw error;
      const next = data as BillingPlanSetting;
      setSettings((current) => current.some((item) => item.plan_code === next.plan_code)
        ? current.map((item) => item.plan_code === next.plan_code ? next : item)
        : [...current, next]);
      setNotice("Precio base actualizado. La app ya puede mostrar el nuevo valor.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo guardar el precio.");
    } finally {
      setBusy("");
    }
  }

  async function createPromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setBusy("promo-create");
    const form = new FormData(event.currentTarget);
    const planCode = String(form.get("planCode") || "team_pro") as BillingPlanCode;
    const discountType = String(form.get("discountType") || "percent") as BillingPromotion["discount_type"];
    const discountValue = Math.max(0, Math.round(Number(form.get("discountValue") || 0)));
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("billing_promotions")
        .insert({
          plan_code: planCode,
          title: String(form.get("title") || "").trim() || `Promo ${planLabels[planCode]}`,
          badge: String(form.get("badge") || "").trim() || "Promo Fulbito",
          description: String(form.get("description") || "").trim() || null,
          discount_type: discountType,
          discount_value: discountValue,
          applies_to_renewals: form.get("appliesToRenewals") === "on",
          is_active: form.get("isActive") === "on",
          starts_at: parseDate(form.get("startsAt")) ?? new Date().toISOString(),
          ends_at: parseDate(form.get("endsAt"), true),
          created_by: adminId
        })
        .select()
        .single();
      if (error) throw error;
      setPromotions((current) => [data as BillingPromotion, ...current]);
      event.currentTarget.reset();
      setNotice("Campania creada. Los precios de la app toman la mejor promo activa.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo crear la promocion.");
    } finally {
      setBusy("");
    }
  }

  async function togglePromotion(promotion: BillingPromotion) {
    setNotice("");
    setBusy(`promo-${promotion.id}`);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("billing_promotions")
        .update({ is_active: !promotion.is_active })
        .eq("id", promotion.id)
        .select()
        .single();
      if (error) throw error;
      const next = data as BillingPromotion;
      setPromotions((current) => current.map((item) => item.id === next.id ? next : item));
      setNotice(next.is_active ? "Promocion activada." : "Promocion pausada.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo actualizar la promocion.");
    } finally {
      setBusy("");
    }
  }

  async function deletePromotion(promotion: BillingPromotion) {
    setNotice("");
    setBusy(`delete-${promotion.id}`);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("billing_promotions").delete().eq("id", promotion.id);
      if (error) throw error;
      setPromotions((current) => current.filter((item) => item.id !== promotion.id));
      setNotice("Promocion eliminada.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo eliminar la promocion.");
    } finally {
      setBusy("");
    }
  }

  async function sendRenewalNotices() {
    setNotice("");
    setBusy("renewals");
    try {
      const response = await fetch("/api/admin/notifications/renewals", { method: "POST" });
      const result = (await response.json()) as { expiring?: number; expired?: number; error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudieron generar avisos.");
      setNotice(`Avisos listos: ${result.expiring ?? 0} por vencer y ${result.expired ?? 0} vencidos.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudieron enviar avisos.");
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="admin-shell admin-pricing-shell">
      <a className="admin-floating-app-link" href="/">Ver app</a>
      <header className="admin-topbar admin-topbar--ops">
        <a className="admin-brand-link" href="/admin">
          <span className="admin-brand-mark">FA</span>
          <span>
            Fulbito Arena
            <small>Precios</small>
          </span>
        </a>
        <div className="admin-topbar-actions">
          <span>Admin activo</span>
          <a href="/admin">Pagos</a>
          <a href="/admin/torneos">Torneos</a>
          <a href="/admin/publicidad">Publicidad</a>
          <a href="/admin/canchas">Canchas</a>
          <a href="/">Ver app</a>
        </div>
      </header>

      <section className="admin-hero admin-hero--ops admin-pricing-hero">
        <span>Monetizacion</span>
        <h1>Precios, promociones y renovaciones</h1>
        <p>Segmenta precios base, crea campanias con descuento, activa renovaciones y bloquea automaticamente beneficios vencidos sin borrar datos.</p>
        <div className="admin-hero-actions">
          <a href="#precios">Precios base</a>
          <a href="#campanias">Campanias</a>
          <button disabled={busy === "renewals"} onClick={sendRenewalNotices} type="button">
            {busy === "renewals" ? <LoaderCircle className="button-spinner" size={16} /> : <CalendarClock size={16} />}
            Avisos renovacion
          </button>
        </div>
      </section>

      <section className="admin-pricing-scoreboard">
        <article><ShieldCheck size={18} /><strong>{basePlans.length}</strong><span>Planes</span></article>
        <article><Tag size={18} /><strong>{activePromotions.length}</strong><span>Promos activas</span></article>
        <article><Percent size={18} /><strong>30</strong><span>Dias por membresia</span></article>
        <article><CalendarClock size={18} /><strong>3</strong><span>Dias aviso previo</span></article>
      </section>

      {notice ? <p className="admin-notice">{notice}</p> : null}

      <section className="admin-plan-prices admin-plan-prices--segmented" id="precios">
        <header>
          <span>Precios base</span>
          <h2>Valores mensuales</h2>
          <p>Estos importes son la base. Si una campania activa aplica, el usuario ve la promo automaticamente.</p>
        </header>
        <div>
          {basePlans.map((plan) => {
            const promoted = promotedPlans.find((item) => item.code === plan.code);
            return (
              <form key={plan.code} onSubmit={(event) => savePlan(event, plan.code)}>
                <div>
                  <strong>{plan.title}</strong>
                  <small>{plan.kicker}</small>
                  {promoted?.promotion ? <em>{promoted.promotion.badge}: {formatPaymentMoney(promoted.amount)} visible</em> : null}
                </div>
                <input defaultValue={plan.amount} inputMode="numeric" name="amount" />
                <button disabled={busy === `plan-${plan.code}`} type="submit">
                  {busy === `plan-${plan.code}` ? <LoaderCircle className="button-spinner" size={16} /> : null}
                  Guardar precio
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <section className="admin-promotion-builder" id="campanias">
        <header>
          <span>Campanias</span>
          <h2>Promociones y descuentos de renovacion</h2>
          <p>Sirve para descuentos por lanzamiento, renovacion, zona, temporada o recuperacion de usuarios vencidos.</p>
        </header>

        <form className="admin-promotion-form" onSubmit={createPromotion}>
          <label>
            <span>Plan</span>
            <select name="planCode" defaultValue="tournament_pro">
              {Object.entries(planLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>Titulo</span>
            <input name="title" placeholder="Renovacion lanzamiento" />
          </label>
          <label>
            <span>Etiqueta visible</span>
            <input name="badge" placeholder="Promo junio" />
          </label>
          <label>
            <span>Tipo</span>
            <select name="discountType" defaultValue="percent">
              <option value="percent">Porcentaje</option>
              <option value="fixed">Monto fijo</option>
            </select>
          </label>
          <label>
            <span>Descuento</span>
            <input inputMode="numeric" name="discountValue" placeholder="20" />
          </label>
          <label>
            <span>Desde</span>
            <input name="startsAt" type="date" />
          </label>
          <label>
            <span>Hasta</span>
            <input name="endsAt" type="date" />
          </label>
          <label className="admin-promotion-form__wide">
            <span>Descripcion</span>
            <input name="description" placeholder="Se muestra como contexto comercial de la promo" />
          </label>
          <label className="admin-check-row">
            <input defaultChecked name="appliesToRenewals" type="checkbox" />
            <span>Aplicar tambien a renovaciones</span>
          </label>
          <label className="admin-check-row">
            <input defaultChecked name="isActive" type="checkbox" />
            <span>Publicar activa</span>
          </label>
          <button disabled={busy === "promo-create"} type="submit">
            {busy === "promo-create" ? <LoaderCircle className="button-spinner" size={17} /> : <PlusCircle size={17} />}
            Crear campania
          </button>
        </form>

        <div className="admin-promotion-list">
          {promotions.length ? promotions.map((promotion) => (
            <article className={promotion.is_active ? "is-active" : ""} key={promotion.id}>
              <div>
                <span>{planLabels[promotion.plan_code]}</span>
                <h3>{promotion.title}</h3>
                <p>{promotion.badge} / {promotionDiscountCopy(promotion)}</p>
                <small>
                  {dateInputValue(promotion.starts_at) || "sin inicio"} - {dateInputValue(promotion.ends_at) || "sin fin"}
                  {promotion.applies_to_renewals ? " / renovaciones" : ""}
                </small>
              </div>
              <div>
                <button disabled={busy === `promo-${promotion.id}`} onClick={() => togglePromotion(promotion)} type="button">
                  {busy === `promo-${promotion.id}` ? <LoaderCircle className="button-spinner" size={16} /> : <CheckCircle2 size={16} />}
                  {promotion.is_active ? "Pausar" : "Activar"}
                </button>
                <button disabled={busy === `delete-${promotion.id}`} onClick={() => deletePromotion(promotion)} type="button">
                  <Trash2 size={16} />
                  Eliminar
                </button>
              </div>
            </article>
          )) : (
            <article className="admin-empty">
              <Tag size={24} />
              <strong>Sin campanias todavia.</strong>
              <span>Crea una promo y la app va a mostrar el precio final automaticamente.</span>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}

import type { FieldMode } from "@/lib/types";

export const venueSurfaceOptions = [
  { value: "5v5", label: "5 vs 5", detail: "Futbol 5" },
  { value: "7v7", label: "7 vs 7", detail: "Futbol 7" },
  { value: "11v11", label: "11 vs 11", detail: "Futbol 11" }
] as const;

export type VenueSurfaceValue = FieldMode;

export const southAmericanPhoneCountries = [
  { iso: "AR", flag: "\u{1F1E6}\u{1F1F7}", name: "Argentina", dialCode: "+54", placeholder: "9 11 1234 5678" },
  { iso: "BO", flag: "\u{1F1E7}\u{1F1F4}", name: "Bolivia", dialCode: "+591", placeholder: "71234567" },
  { iso: "BR", flag: "\u{1F1E7}\u{1F1F7}", name: "Brasil", dialCode: "+55", placeholder: "11 91234 5678" },
  { iso: "CL", flag: "\u{1F1E8}\u{1F1F1}", name: "Chile", dialCode: "+56", placeholder: "9 1234 5678" },
  { iso: "CO", flag: "\u{1F1E8}\u{1F1F4}", name: "Colombia", dialCode: "+57", placeholder: "300 123 4567" },
  { iso: "EC", flag: "\u{1F1EA}\u{1F1E8}", name: "Ecuador", dialCode: "+593", placeholder: "99 123 4567" },
  { iso: "GF", flag: "\u{1F1EC}\u{1F1EB}", name: "Guayana Francesa", dialCode: "+594", placeholder: "694 12 34 56" },
  { iso: "GY", flag: "\u{1F1EC}\u{1F1FE}", name: "Guyana", dialCode: "+592", placeholder: "600 1234" },
  { iso: "PY", flag: "\u{1F1F5}\u{1F1FE}", name: "Paraguay", dialCode: "+595", placeholder: "981 123456" },
  { iso: "PE", flag: "\u{1F1F5}\u{1F1EA}", name: "Peru", dialCode: "+51", placeholder: "912 345 678" },
  { iso: "SR", flag: "\u{1F1F8}\u{1F1F7}", name: "Surinam", dialCode: "+597", placeholder: "741 2345" },
  { iso: "UY", flag: "\u{1F1FA}\u{1F1FE}", name: "Uruguay", dialCode: "+598", placeholder: "91 234 567" },
  { iso: "VE", flag: "\u{1F1FB}\u{1F1EA}", name: "Venezuela", dialCode: "+58", placeholder: "412 123 4567" }
] as const;

export type SouthAmericanPhoneCountryIso = typeof southAmericanPhoneCountries[number]["iso"];

export function normalizeVenueSurface(value?: string | null): VenueSurfaceValue {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  const match = venueSurfaceOptions.find((option) => option.value === normalized);
  return match?.value ?? "5v5";
}

export function normalizeVenueSurfaces(values: Array<unknown>) {
  const unique = new Set<VenueSurfaceValue>();
  values.forEach((value) => {
    if (typeof value !== "string") return;
    const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
    const match = venueSurfaceOptions.find((option) => option.value === normalized);
    if (match) unique.add(match.value);
  });
  return Array.from(unique).length ? Array.from(unique) : ["5v5" as VenueSurfaceValue];
}

export function venueSurfacesFromStored(fieldModes?: FieldMode[] | null, surface?: string | null) {
  if (fieldModes?.length) return normalizeVenueSurfaces(fieldModes);
  return normalizeVenueSurfaces(String(surface || "").split(","));
}

export function venueSurfaceLabel(value?: string | null) {
  const normalized = normalizeVenueSurface(value);
  return venueSurfaceOptions.find((option) => option.value === normalized)?.label ?? "5 vs 5";
}

export function venueSurfaceSummary(fieldModes?: FieldMode[] | null, surface?: string | null) {
  return venueSurfacesFromStored(fieldModes, surface).map((mode) => venueSurfaceLabel(mode)).join(" / ");
}

export function getPhoneCountry(iso?: string | null) {
  const normalized = String(iso || "AR").toUpperCase();
  return southAmericanPhoneCountries.find((country) => country.iso === normalized) ?? southAmericanPhoneCountries[0];
}

export function normalizePhoneNational(value?: string | null) {
  return String(value || "").replace(/[^\d]/g, "").replace(/^0+/, "");
}

export function normalizeVenuePhoneForCountry(iso?: string | null, value?: string | null) {
  const country = getPhoneCountry(iso);
  let phone = normalizePhoneNational(value);
  if (!phone) return "";

  if (country.iso === "AR") {
    if (phone.startsWith("54")) phone = phone.slice(2);
    phone = phone.replace(/^0+/, "");
    if (!phone.startsWith("9")) phone = `9${phone}`;
  }

  return phone;
}

export function composeInternationalPhone(iso?: string | null, national?: string | null) {
  const phone = normalizeVenuePhoneForCountry(iso, national);
  if (!phone) return null;
  const country = getPhoneCountry(iso);
  return `${country.dialCode} ${phone}`;
}

export function readVenueFormatPrices(formData: FormData, modes: VenueSurfaceValue[]) {
  return modes.reduce<Partial<Record<VenueSurfaceValue, number>>>((prices, mode) => {
    const value = Number(formData.get(`price_${mode}`) || 0);
    prices[mode] = Number.isFinite(value) && value > 0 ? value : 0;
    return prices;
  }, {});
}

export function primaryVenuePrice(prices: Partial<Record<VenueSurfaceValue, number>>, modes: VenueSurfaceValue[]) {
  for (const mode of modes) {
    const value = Number(prices[mode] || 0);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

export const venueSurfaceOptions = [
  { value: "5v5", label: "5 vs 5", detail: "Futbol 5" },
  { value: "7v7", label: "7 vs 7", detail: "Futbol 7" },
  { value: "11v11", label: "11 vs 11", detail: "Futbol 11" }
] as const;

export type VenueSurfaceValue = typeof venueSurfaceOptions[number]["value"];

export function normalizeVenueSurface(value?: string | null): VenueSurfaceValue {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  const match = venueSurfaceOptions.find((option) => option.value === normalized);
  return match?.value ?? "5v5";
}

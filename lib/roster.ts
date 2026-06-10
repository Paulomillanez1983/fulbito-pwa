import type { FieldMode } from "@/lib/types";

export type RosterRule = {
  fieldMode: FieldMode;
  label: string;
  starters: number;
  substitutes: number;
  maxPlayers: number;
};

export const rosterRules: Record<FieldMode, RosterRule> = {
  "5v5": { fieldMode: "5v5", label: "Futbol 5", starters: 5, substitutes: 5, maxPlayers: 10 },
  "7v7": { fieldMode: "7v7", label: "Futbol 7", starters: 7, substitutes: 4, maxPlayers: 11 },
  "11v11": { fieldMode: "11v11", label: "Futbol 11", starters: 11, substitutes: 5, maxPlayers: 16 }
};

export function getRosterRule(fieldMode?: FieldMode | null) {
  return rosterRules[fieldMode ?? "7v7"];
}

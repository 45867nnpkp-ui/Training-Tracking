import { formatKg, formatSets } from "@/lib/format";
import type { SessionType } from "@/lib/training/catalog";
import { deloadPrescription, type Suggestion } from "@/lib/training/progression";
import type { Bootstrap, ExerciseDTO } from "@/lib/training/types";
import { historyFor, suggestionFor } from "@/lib/training/workout";

export interface TargetInfo {
  headline: string;
  tone: "green" | "blue" | "amber" | "neutral";
  lastTime: string | null;
}

/** Zielanzeige für heute, z. B. „+5 kg!“ oder „Ziel: ≥ 28 Wdh. gesamt“. */
export function targetInfo(boot: Bootstrap, ex: ExerciseDTO, isDeload: boolean): TargetInfo {
  const s: Suggestion = suggestionFor(boot, ex);
  const lastTime = s.last ? `Letztes Mal: ${formatSets(s.last.sets)}` : null;
  if (isDeload) {
    const d = deloadPrescription(ex, historyFor(boot, ex.id));
    return {
      headline: `Deload: ${d.sets} ${d.sets === 1 ? "Satz" : "Sätze"}${d.weightKg !== null ? ` à ${formatKg(d.weightKg)} kg` : ""}, nicht bis Versagen`,
      tone: "blue",
      lastTime,
    };
  }
  switch (s.kind) {
    case "calibrate":
      return { headline: "Kalibrieren: Gewicht selbst eintragen", tone: "amber", lastTime };
    case "start":
      return { headline: `Start mit ${formatKg(s.weightKg)} kg`, tone: "neutral", lastTime };
    case "increase":
      return { headline: `+${formatKg(ex.incrementKg)} kg! Heute ${formatKg(s.weightKg)} kg`, tone: "green", lastTime };
    case "repeat":
      return { headline: `Ziel: ≥ ${s.targetTotalReps} Wdh. gesamt mit ${formatKg(s.weightKg)} kg`, tone: "neutral", lastTime };
  }
}

export function shortSuggestion(boot: Bootstrap, ex: ExerciseDTO, isDeload: boolean): string {
  const s = suggestionFor(boot, ex);
  if (isDeload) {
    const d = deloadPrescription(ex, historyFor(boot, ex.id));
    return d.weightKg === null ? `${d.sets} Sätze · kalibrieren` : `${d.sets} × ${formatKg(d.weightKg)} kg`;
  }
  switch (s.kind) {
    case "calibrate":
      return "kalibrieren";
    case "start":
      return `${formatKg(s.weightKg)} kg`;
    case "increase":
      return `${formatKg(s.weightKg)} kg (+${formatKg(ex.incrementKg)})`;
    case "repeat":
      return `${formatKg(s.weightKg)} kg · ≥ ${s.targetTotalReps} Wdh.`;
  }
}

export function formatRest(ex: ExerciseDTO): string {
  const fmt = (sec: number) => (sec >= 120 ? `${sec / 60}` : `${sec}`);
  return ex.restMinSec >= 120
    ? `${fmt(ex.restMinSec)}–${fmt(ex.restMaxSec)} min`
    : `${ex.restMinSec}–${ex.restMaxSec} s`;
}

export const TYPE_LABEL: Record<SessionType, string> = { UPPER: "Oberkörper", LOWER: "Beine" };

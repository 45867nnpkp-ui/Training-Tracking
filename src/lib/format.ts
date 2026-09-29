// Anzeige-Helfer: deutsche Zahlen (6,25 kg) und Zeiten in Europe/Berlin.
import type { LoggedSet } from "./training/progression";

export const TIME_ZONE = "Europe/Berlin";

export function formatKg(value: number | null | undefined): string {
  if (value === null || value === undefined) return "–";
  return value.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

/** „65 × 10 / 9 / 8“ – bei unterschiedlichen Gewichten „65×10 / 60×9“. */
export function formatSets(sets: LoggedSet[]): string {
  if (sets.length === 0) return "–";
  const sameWeight = sets.every((s) => s.weightKg === sets[0].weightKg);
  if (sameWeight) return `${formatKg(sets[0].weightKg)} × ${sets.map((s) => s.reps).join(" / ")}`;
  return sets.map((s) => `${formatKg(s.weightKg)}×${s.reps}`).join(" / ");
}

export function formatDate(iso: string, withWeekday = true): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    timeZone: TIME_ZONE,
    weekday: withWeekday ? "short" : undefined,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Deutsche Dezimaleingabe („62,5“) in eine Zahl umwandeln. */
export function parseDecimal(input: string): number | null {
  const normalized = input.trim().replace(",", ".");
  if (normalized === "") return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

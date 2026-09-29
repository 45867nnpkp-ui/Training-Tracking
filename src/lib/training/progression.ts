// Progressionslogik (SPEC.md, Abschnitt 6). Reine Funktionen ohne DB- oder
// Browser-Zugriff: Sie laufen auf dem Server und offline auf dem Handy und
// sind in progression.test.ts getestet.

export interface ProgressionConfig {
  sets: number;
  repMin: number;
  repMax: number;
  incrementKg: number;
  startWeightKg: number | null;
}

export interface LoggedSet {
  weightKg: number;
  reps: number;
}

/** Arbeitssätze einer Übung in einer Einheit (ohne Aufwärmsätze). */
export interface ExerciseSession {
  date: string;
  sets: LoggedSet[];
  isDeload?: boolean;
}

export type Suggestion =
  | { kind: "calibrate"; weightKg: null; targetTotalReps: null; last: null }
  | { kind: "start"; weightKg: number; targetTotalReps: null; last: null }
  | { kind: "increase"; weightKg: number; targetTotalReps: null; last: ExerciseSession }
  | { kind: "repeat"; weightKg: number; targetTotalReps: number; last: ExerciseSession };

export type StagnationAdvice =
  | { level: "none"; streak: number }
  | { level: "check-recovery"; streak: number }
  | { level: "reduce"; streak: number; weightKg: number };

export interface DeloadPrescription {
  sets: number;
  weightKg: number | null;
  toFailure: false;
}

const EPS = 1e-6;

/** Auf zwei Nachkommastellen runden (gegen Fließkomma-Reste wie 69.99999). */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Auf ein Vielfaches der Steigerungsstufe runden. */
export function roundToStep(value: number, step: number, mode: "nearest" | "down" = "nearest"): number {
  if (step <= 0) return round2(value);
  const ratio = value / step;
  const n = mode === "down" ? Math.floor(ratio + EPS) : Math.round(ratio);
  return round2(n * step);
}

export function totalReps(sets: LoggedSet[]): number {
  return sets.reduce((sum, s) => sum + s.reps, 0);
}

/**
 * Das Arbeitsgewicht einer Einheit: das Gewicht, mit dem die meisten Sätze
 * gemacht wurden (bei Gleichstand das höhere). Normalerweise sind alle Sätze
 * gleich schwer (6.2).
 */
export function workingWeight(sets: LoggedSet[]): number | null {
  if (sets.length === 0) return null;
  const counts = new Map<number, number>();
  for (const s of sets) counts.set(s.weightKg, (counts.get(s.weightKg) ?? 0) + 1);
  let best: number | null = null;
  let bestCount = 0;
  for (const [weight, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== null && weight > best)) {
      best = weight;
      bestCount = count;
    }
  }
  return best;
}

/** Nur Einheiten, die für die Progression zählen (keine Deloads, nicht leer). */
export function progressionHistory(history: ExerciseSession[]): ExerciseSession[] {
  return history.filter((h) => !h.isDeload && h.sets.length > 0);
}

/**
 * Doppelte Progression (6.3). `history` ist nach Datum absteigend sortiert
 * (neueste Einheit zuerst). Deload-Einheiten werden ignoriert (6.5).
 */
export function suggestNext(config: ProgressionConfig, history: ExerciseSession[]): Suggestion {
  const relevant = progressionHistory(history);
  if (relevant.length === 0) {
    if (config.startWeightKg === null) {
      return { kind: "calibrate", weightKg: null, targetTotalReps: null, last: null };
    }
    return { kind: "start", weightKg: config.startWeightKg, targetTotalReps: null, last: null };
  }

  const last = relevant[0];
  const weight = workingWeight(last.sets)!;
  const allAtTop =
    last.sets.length >= config.sets &&
    last.sets.every((s) => s.reps >= config.repMax && s.weightKg >= weight);

  if (allAtTop) {
    return { kind: "increase", weightKg: round2(weight + config.incrementKg), targetTotalReps: null, last };
  }
  return { kind: "repeat", weightKg: weight, targetTotalReps: totalReps(last.sets) + 1, last };
}

/** Fortschritt = Gewicht oder Gesamtwiederholungen gestiegen (6.4). */
export function madeProgress(previous: ExerciseSession, current: ExerciseSession): boolean {
  const wPrev = workingWeight(previous.sets) ?? 0;
  const wCur = workingWeight(current.sets) ?? 0;
  return wCur > wPrev + EPS || totalReps(current.sets) > totalReps(previous.sets);
}

/** Wie viele Einheiten in Folge (von der neuesten an) ohne Fortschritt waren. */
export function stagnationStreak(history: ExerciseSession[]): number {
  const relevant = progressionHistory(history);
  let streak = 0;
  for (let i = 0; i + 1 < relevant.length; i++) {
    if (madeProgress(relevant[i + 1], relevant[i])) break;
    streak++;
  }
  return streak;
}

/** Neustart-Gewicht: −10 %, abgerundet auf ein Vielfaches der Steigerungsstufe. */
export function resetWeight(weightKg: number, incrementKg: number): number {
  return roundToStep(weightKg * 0.9, incrementKg, "down");
}

/** Stagnationshinweise (6.4): ab 2× „Schlaf und Essen prüfen“, ab 3× −10 %. */
export function stagnationAdvice(config: ProgressionConfig, history: ExerciseSession[]): StagnationAdvice {
  const streak = stagnationStreak(history);
  if (streak >= 3) {
    const weight = workingWeight(progressionHistory(history)[0].sets)!;
    return { level: "reduce", streak, weightKg: resetWeight(weight, config.incrementKg) };
  }
  if (streak === 2) return { level: "check-recovery", streak };
  return { level: "none", streak };
}

/**
 * Deload-Einheit (6.5): halbe Satzzahl (aufgerundet), gleiches Gewicht wie
 * zuletzt (keine Steigerung), kein Satz bis zum Versagen.
 */
export function deloadPrescription(config: ProgressionConfig, history: ExerciseSession[]): DeloadPrescription {
  const relevant = progressionHistory(history);
  const weightKg = relevant.length > 0 ? workingWeight(relevant[0].sets) : config.startWeightKg;
  return { sets: Math.ceil(config.sets / 2), weightKg, toFailure: false };
}

/**
 * Zwei Aufwärmsätze mit ca. 50 % und 75 % des Arbeitsgewichts, gerundet auf
 * die Steigerungsstufe (5.4). Leeres Ergebnis, wenn noch kalibriert wird.
 */
export function warmupSets(workWeightKg: number | null, incrementKg: number): LoggedSet[] {
  if (workWeightKg === null || workWeightKg <= 0) return [];
  return [
    { weightKg: roundToStep(workWeightKg * 0.5, incrementKg), reps: 10 },
    { weightKg: roundToStep(workWeightKg * 0.75, incrementKg), reps: 6 },
  ];
}

/** Geschätztes 1RM nach Epley. */
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  return round2(weightKg * (1 + reps / 30));
}

export function bestOneRepMax(sets: LoggedSet[]): number {
  return sets.reduce((best, s) => Math.max(best, estimatedOneRepMax(s.weightKg, s.reps)), 0);
}

/** Satzzahl für die heutige Einheit. */
export function plannedSetCount(config: ProgressionConfig, isDeload: boolean): number {
  return isDeload ? Math.ceil(config.sets / 2) : config.sets;
}

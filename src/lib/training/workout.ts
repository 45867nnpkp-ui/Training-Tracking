// Zustand einer laufenden Einheit und alles, was daraus berechnet wird.
// Reine Funktionen: Der Zustand liegt auf dem Handy in IndexedDB.
import type { SessionType } from "./catalog";
import {
  bestOneRepMax,
  deloadPrescription,
  plannedSetCount,
  suggestNext,
  warmupSets,
  type ExerciseSession,
  type Suggestion,
} from "./progression";
import { RECENT_SESSIONS_PER_EXERCISE, type Bootstrap, type ExerciseDTO, type SetPayload, type WorkoutPayload } from "./types";

export interface SetEntry {
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  failure: boolean;
  note: string;
  done: boolean;
  completedAt: string | null;
}

export interface ExerciseEntry {
  exerciseId: string;
  warmups: SetEntry[];
  sets: SetEntry[];
  skipped: boolean;
}

export interface RestTimer {
  startedAt: string;
  exerciseId: string;
  minSec: number;
  maxSec: number;
}

export interface ActiveWorkout {
  id: string;
  type: SessionType;
  startedAt: string;
  isDeload: boolean;
  order: string[];
  entries: Record<string, ExerciseEntry>;
  currentIndex: number;
  rest: RestTimer | null;
}

export function findExercise(boot: Bootstrap, id: string): ExerciseDTO | undefined {
  return boot.exercises.find((e) => e.id === id);
}

export function historyFor(boot: Bootstrap, exerciseId: string): ExerciseSession[] {
  return boot.recent[exerciseId] ?? [];
}

export function suggestionFor(boot: Bootstrap, ex: ExerciseDTO): Suggestion {
  return suggestNext(ex, historyFor(boot, ex.id));
}

/** Die nächste Einheit laut Wechsel Oberkörper ↔ Beine. */
export function nextSessionType(boot: Bootstrap): SessionType {
  return boot.lastWorkoutType === "UPPER" ? "LOWER" : "UPPER";
}

function emptySet(weightKg: number | null): SetEntry {
  return { weightKg, reps: null, rir: null, failure: false, note: "", done: false, completedAt: null };
}

/** Das Gewicht, das heute vorgeschlagen wird. */
export function todaysWeight(boot: Bootstrap, ex: ExerciseDTO, isDeload: boolean): number | null {
  return isDeload ? deloadPrescription(ex, historyFor(boot, ex.id)).weightKg : suggestionFor(boot, ex).weightKg;
}

export function createEntry(boot: Bootstrap, ex: ExerciseDTO, isDeload: boolean, withWarmups: boolean): ExerciseEntry {
  const weight = todaysWeight(boot, ex, isDeload);
  const count = plannedSetCount(ex, isDeload);
  return {
    exerciseId: ex.id,
    warmups: withWarmups
      ? warmupSets(weight, ex.incrementKg).map((w) => ({ ...emptySet(w.weightKg), reps: w.reps }))
      : [],
    sets: Array.from({ length: count }, () => emptySet(weight)),
    skipped: false,
  };
}

/** Index der ersten Grundübung – nur sie bekommt Aufwärmsätze (5.4). */
export function firstCompoundIndex(boot: Bootstrap, order: string[]): number {
  return order.findIndex((id) => findExercise(boot, id)?.isCompound);
}

export function createWorkout(
  boot: Bootstrap,
  type: SessionType,
  isDeload: boolean,
  id: string,
  now: Date,
): ActiveWorkout {
  const order = boot.templates[type].filter((exId) => findExercise(boot, exId));
  const warmupIndex = firstCompoundIndex(boot, order);
  const entries: Record<string, ExerciseEntry> = {};
  order.forEach((exId, i) => {
    entries[exId] = createEntry(boot, findExercise(boot, exId)!, isDeload, i === warmupIndex);
  });
  return { id, type, startedAt: now.toISOString(), isDeload, order, entries, currentIndex: 0, rest: null };
}

/** „Maschine besetzt“: aktuelle Übung mit der nächsten tauschen (5.1). */
export function swapWithNext(w: ActiveWorkout): ActiveWorkout {
  const i = w.currentIndex;
  if (i + 1 >= w.order.length) return w;
  const order = [...w.order];
  [order[i], order[i + 1]] = [order[i + 1], order[i]];
  return { ...w, order };
}

/** Ausweichübungen zur aktuellen Übung, nach Priorität (5.3). */
export function alternativesFor(boot: Bootstrap, exerciseId: string): ExerciseDTO[] {
  const current = findExercise(boot, exerciseId);
  if (!current) return [];
  const mainId = current.mainExerciseId ?? current.id;
  const main = findExercise(boot, mainId);
  const alts = boot.exercises
    .filter((e) => e.mainExerciseId === mainId)
    .sort((a, b) => (a.alternativePriority ?? 99) - (b.alternativePriority ?? 99));
  return [...(main ? [main] : []), ...alts].filter((e) => e.id !== exerciseId);
}

/** Aktuelle Übung durch eine Ausweichübung ersetzen (eigener Verlauf). */
export function replaceCurrent(boot: Bootstrap, w: ActiveWorkout, newId: string): ActiveWorkout {
  const ex = findExercise(boot, newId);
  if (!ex || w.order.includes(newId)) return w;
  const i = w.currentIndex;
  const order = [...w.order];
  order[i] = newId;
  // Zurückwechseln behält bereits geloggte Sätze.
  const existing = w.entries[newId];
  const withWarmups = i === firstCompoundIndex(boot, w.order) && ex.isCompound;
  const entry = existing ? { ...existing, skipped: false } : createEntry(boot, ex, w.isDeload, withWarmups);
  return { ...w, order, entries: { ...w.entries, [newId]: entry } };
}

/**
 * Gewicht eines Satzes ändern. Noch nicht abgehakte Folgesätze mit demselben
 * alten Gewicht ziehen mit – so muss man beim Kalibrieren nur einmal tippen.
 */
export function setWeight(entry: ExerciseEntry, index: number, weightKg: number | null): ExerciseEntry {
  const old = entry.sets[index].weightKg;
  const sets = entry.sets.map((s, i) => {
    if (i === index) return { ...s, weightKg };
    if (i > index && !s.done && s.weightKg === old) return { ...s, weightKg };
    return s;
  });
  return { ...entry, sets };
}

/** Weichen die Gewichte der Arbeitssätze voneinander ab? (Hinweis aus 6.2) */
export function hasMixedWeights(entry: ExerciseEntry): boolean {
  const weights = new Set(entry.sets.filter((s) => s.weightKg !== null).map((s) => s.weightKg));
  return weights.size > 1;
}

function toSetPayloads(exerciseId: string, sets: SetEntry[], isWarmup: boolean): SetPayload[] {
  return sets
    .filter((s) => s.done && s.weightKg !== null && s.reps !== null)
    .map((s, i) => ({
      exerciseId,
      setNumber: i + 1,
      weightKg: s.weightKg!,
      reps: s.reps!,
      rir: s.rir,
      failure: s.failure,
      isWarmup,
      note: s.note.trim() || null,
      completedAt: s.completedAt,
    }));
}

/** Nur abgehakte Sätze werden gespeichert. */
export function buildPayload(w: ActiveWorkout, endedAt: Date): WorkoutPayload {
  const sets: SetPayload[] = [];
  for (const entry of Object.values(w.entries)) {
    sets.push(...toSetPayloads(entry.exerciseId, entry.warmups, true));
    sets.push(...toSetPayloads(entry.exerciseId, entry.sets, false));
  }
  return {
    id: w.id,
    type: w.type,
    startedAt: w.startedAt,
    endedAt: endedAt.toISOString(),
    isDeload: w.isDeload,
    sets,
  };
}

export function workingSetsByExercise(payload: WorkoutPayload): Map<string, { weightKg: number; reps: number }[]> {
  const map = new Map<string, { weightKg: number; reps: number }[]>();
  for (const s of payload.sets) {
    if (s.isWarmup) continue;
    const list = map.get(s.exerciseId) ?? [];
    list.push({ weightKg: s.weightKg, reps: s.reps });
    map.set(s.exerciseId, list);
  }
  return map;
}

/** Übungen mit neuem Rekord (geschätztes 1RM höher als je zuvor). */
export function personalRecords(boot: Bootstrap, payload: WorkoutPayload): { exerciseId: string; oneRepMax: number }[] {
  if (payload.isDeload) return [];
  const records: { exerciseId: string; oneRepMax: number }[] = [];
  for (const [exerciseId, sets] of workingSetsByExercise(payload)) {
    const previous = boot.best1RM[exerciseId] ?? 0;
    const now = bestOneRepMax(sets);
    if (previous > 0 && now > previous) records.push({ exerciseId, oneRepMax: now });
  }
  return records;
}

/**
 * Überträgt eine gerade beendete Einheit in den lokalen Verlauf, damit die
 * Vorschläge für die nächste Einheit auch offline sofort stimmen.
 */
export function applyWorkoutToBootstrap(boot: Bootstrap, payload: WorkoutPayload): Bootstrap {
  const recent = { ...boot.recent };
  const best1RM = { ...boot.best1RM };
  if (!payload.isDeload) {
    for (const [exerciseId, sets] of workingSetsByExercise(payload)) {
      const list = (recent[exerciseId] ?? []).filter((s) => s.date !== payload.startedAt);
      recent[exerciseId] = [{ date: payload.startedAt, sets }, ...list].slice(0, RECENT_SESSIONS_PER_EXERCISE);
      best1RM[exerciseId] = Math.max(best1RM[exerciseId] ?? 0, bestOneRepMax(sets));
    }
  }
  return { ...boot, recent, best1RM, lastWorkoutType: payload.type };
}

/** Offene (nicht abgehakte, nicht übersprungene) Arbeitssätze. */
export function openSetCount(w: ActiveWorkout): number {
  return w.order.reduce((sum, id) => {
    const e = w.entries[id];
    return e.skipped ? sum : sum + e.sets.filter((s) => !s.done).length;
  }, 0);
}

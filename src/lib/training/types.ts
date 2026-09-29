// Datenformate zwischen Server und App (auch offline in IndexedDB gespeichert).
import { z } from "zod";
import type { CatalogExercise, SessionType } from "./catalog";
import type { ExerciseSession } from "./progression";

export type ExerciseDTO = CatalogExercise;

export interface Bootstrap {
  exercises: ExerciseDTO[];
  templates: Record<SessionType, string[]>;
  /** Letzte Einheiten je Übung, neueste zuerst, nur Arbeitssätze. */
  recent: Record<string, ExerciseSession[]>;
  /** Bisher bestes geschätztes 1RM je Übung (für Rekorde). */
  best1RM: Record<string, number>;
  lastWorkoutType: SessionType | null;
  fetchedAt: string;
}

export const RECENT_SESSIONS_PER_EXERCISE = 6;

export const setPayloadSchema = z.object({
  exerciseId: z.string().min(1).max(100),
  setNumber: z.number().int().min(1).max(50),
  weightKg: z.number().min(0).max(1000),
  reps: z.number().int().min(0).max(200),
  rir: z.number().int().min(0).max(10).nullable(),
  failure: z.boolean(),
  isWarmup: z.boolean(),
  note: z.string().max(500).nullable(),
  completedAt: z.iso.datetime().nullable(),
});

export const workoutPayloadSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["UPPER", "LOWER"]),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  isDeload: z.boolean(),
  sets: z.array(setPayloadSchema).max(300),
});

export type SetPayload = z.infer<typeof setPayloadSchema>;
export type WorkoutPayload = z.infer<typeof workoutPayloadSchema>;

export interface WorkoutListItem {
  id: string;
  type: SessionType;
  startedAt: string;
  endedAt: string | null;
  isDeload: boolean;
  workingSets: number;
  exercises: string[];
}

export interface ExerciseHistoryEntry {
  workoutId: string;
  date: string;
  isDeload: boolean;
  sets: { weightKg: number; reps: number; rir: number | null; failure: boolean; note: string | null }[];
}

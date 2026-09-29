import { prisma } from "@/lib/db";
import type { SessionType } from "@/lib/training/catalog";
import { bestOneRepMax, type ExerciseSession } from "@/lib/training/progression";
import { RECENT_SESSIONS_PER_EXERCISE, type Bootstrap, type ExerciseDTO } from "@/lib/training/types";

/** Alles, was die App zum Trainieren braucht – wird auf dem Handy gecacht. */
export async function loadBootstrap(): Promise<Bootstrap> {
  const [exercises, templates, lastWorkout, workouts] = await Promise.all([
    prisma.exercise.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
    prisma.sessionTemplate.findMany(),
    prisma.workout.findFirst({ orderBy: { startedAt: "desc" }, select: { type: true } }),
    prisma.workout.findMany({
      where: { isDeload: false },
      orderBy: { startedAt: "desc" },
      select: {
        startedAt: true,
        sets: {
          where: { isWarmup: false },
          orderBy: { setNumber: "asc" },
          select: { exerciseId: true, weightKg: true, reps: true },
        },
      },
    }),
  ]);

  const recent: Record<string, ExerciseSession[]> = {};
  const best1RM: Record<string, number> = {};
  for (const w of workouts) {
    const byExercise = new Map<string, { weightKg: number; reps: number }[]>();
    for (const s of w.sets) {
      const list = byExercise.get(s.exerciseId) ?? [];
      list.push({ weightKg: s.weightKg, reps: s.reps });
      byExercise.set(s.exerciseId, list);
    }
    for (const [exerciseId, sets] of byExercise) {
      const list = (recent[exerciseId] ??= []);
      if (list.length < RECENT_SESSIONS_PER_EXERCISE) {
        list.push({ date: w.startedAt.toISOString(), sets });
      }
      best1RM[exerciseId] = Math.max(best1RM[exerciseId] ?? 0, bestOneRepMax(sets));
    }
  }

  const templateMap: Record<SessionType, string[]> = { UPPER: [], LOWER: [] };
  for (const t of templates) templateMap[t.type] = t.exerciseIds;

  return {
    exercises: exercises.map(
      (e): ExerciseDTO => ({
        id: e.id,
        name: e.name,
        category: e.category,
        isCompound: e.isCompound,
        sets: e.sets,
        repMin: e.repMin,
        repMax: e.repMax,
        restMinSec: e.restMinSec,
        restMaxSec: e.restMaxSec,
        incrementKg: e.incrementKg,
        startWeightKg: e.startWeightKg,
        setupNote: e.setupNote,
        hint: e.hint,
        isBonus: e.isBonus,
        mainExerciseId: e.mainExerciseId,
        alternativePriority: e.alternativePriority,
      }),
    ),
    templates: templateMap,
    recent,
    best1RM,
    lastWorkoutType: lastWorkout?.type ?? null,
    fetchedAt: new Date().toISOString(),
  };
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ExerciseHistoryEntry } from "@/lib/training/types";

export const dynamic = "force-dynamic";

/** Alle Einheiten einer Übung (ohne Aufwärmsätze), älteste zuerst. */
export async function GET(_req: Request, { params }: { params: Promise<{ exerciseId: string }> }) {
  const { exerciseId } = await params;
  const workouts = await prisma.workout.findMany({
    where: { sets: { some: { exerciseId, isWarmup: false } } },
    orderBy: { startedAt: "asc" },
    select: {
      id: true,
      startedAt: true,
      isDeload: true,
      sets: {
        where: { exerciseId, isWarmup: false },
        orderBy: { setNumber: "asc" },
        select: { weightKg: true, reps: true, rir: true, failure: true, note: true },
      },
    },
  });
  const entries: ExerciseHistoryEntry[] = workouts.map((w) => ({
    workoutId: w.id,
    date: w.startedAt.toISOString(),
    isDeload: w.isDeload,
    sets: w.sets,
  }));
  return NextResponse.json(entries);
}

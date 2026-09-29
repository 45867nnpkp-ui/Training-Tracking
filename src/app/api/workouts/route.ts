import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { workoutPayloadSchema, type WorkoutListItem } from "@/lib/training/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const workouts = await prisma.workout.findMany({
    orderBy: { startedAt: "desc" },
    take: 200,
    include: { sets: { select: { exerciseId: true, isWarmup: true, exercise: { select: { name: true } } } } },
  });
  const items: WorkoutListItem[] = workouts.map((w) => {
    const working = w.sets.filter((s) => !s.isWarmup);
    return {
      id: w.id,
      type: w.type,
      startedAt: w.startedAt.toISOString(),
      endedAt: w.endedAt?.toISOString() ?? null,
      isDeload: w.isDeload,
      workingSets: working.length,
      exercises: [...new Set(working.map((s) => s.exercise.name))],
    };
  });
  return NextResponse.json(items);
}

/**
 * Speichert eine komplette Einheit. Idempotent: Die App schickt eine offline
 * geloggte Einheit so lange, bis sie angekommen ist; ein zweites Senden
 * ersetzt die Sätze, statt sie zu verdoppeln.
 */
export async function POST(req: Request) {
  const parsed = workoutPayloadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Daten", details: parsed.error.issues }, { status: 400 });
  }
  const w = parsed.data;

  const exerciseIds = [...new Set(w.sets.map((s) => s.exerciseId))];
  const known = await prisma.exercise.count({ where: { id: { in: exerciseIds } } });
  if (known !== exerciseIds.length) {
    return NextResponse.json({ error: "Unbekannte Übung" }, { status: 400 });
  }

  const data = {
    type: w.type,
    startedAt: new Date(w.startedAt),
    endedAt: w.endedAt ? new Date(w.endedAt) : null,
    isDeload: w.isDeload,
  };
  await prisma.$transaction([
    prisma.workout.upsert({ where: { id: w.id }, create: { id: w.id, ...data }, update: data }),
    prisma.setLog.deleteMany({ where: { workoutId: w.id } }),
    prisma.setLog.createMany({
      data: w.sets.map((s) => ({
        workoutId: w.id,
        exerciseId: s.exerciseId,
        setNumber: s.setNumber,
        weightKg: s.weightKg,
        reps: s.reps,
        rir: s.rir,
        failure: s.failure,
        isWarmup: s.isWarmup,
        note: s.note,
        completedAt: s.completedAt ? new Date(s.completedAt) : null,
      })),
    }),
  ]);

  return NextResponse.json({ ok: true, id: w.id });
}

// Legt Übungen und Einheiten laut SPEC.md an, falls sie noch fehlen.
// Bestehende Einträge werden nie überschrieben (eigene Änderungen, z. B. die
// Maschinen-Notiz, bleiben erhalten). Läuft bei jedem Start auf dem Server.
import { PrismaClient } from "@prisma/client";
import { EXERCISES, TEMPLATES, type SessionType } from "../src/lib/training/catalog";

const prisma = new PrismaClient();

async function main() {
  // Hauptübungen zuerst, damit Ausweichübungen auf sie verweisen können.
  const ordered = [...EXERCISES].sort((a, b) => Number(a.mainExerciseId !== null) - Number(b.mainExerciseId !== null));
  let created = 0;
  for (const e of ordered) {
    const sortOrder = EXERCISES.indexOf(e);
    const existing = await prisma.exercise.findUnique({ where: { id: e.id }, select: { id: true } });
    if (existing) continue;
    await prisma.exercise.create({ data: { ...e, sortOrder } });
    created++;
  }
  for (const type of Object.keys(TEMPLATES) as SessionType[]) {
    await prisma.sessionTemplate.upsert({
      where: { type },
      create: { type, exerciseIds: TEMPLATES[type] },
      update: {},
    });
  }
  await prisma.scheduleConfig.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  console.log(`Seed fertig: ${created} neue Übungen angelegt.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

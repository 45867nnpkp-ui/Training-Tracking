import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const patchSchema = z.object({ setupNote: z.string().max(300) });

/** Maschineneinstellung als dauerhafte Notiz pro Übung speichern. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  const result = await prisma.exercise.updateMany({ where: { id }, data: { setupNote: parsed.data.setupNote } });
  if (result.count === 0) return NextResponse.json({ error: "Übung nicht gefunden" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import type { SessionType } from "@/lib/training/catalog";
import type { Bootstrap } from "@/lib/training/types";
import { findExercise, nextSessionType } from "@/lib/training/workout";
import { TYPE_LABEL, shortSuggestion } from "./suggestion";
import { Badge, Button } from "./ui";

export default function StartScreen({
  boot,
  onStart,
}: {
  boot: Bootstrap;
  onStart: (type: SessionType, isDeload: boolean) => void;
}) {
  const suggested = nextSessionType(boot);
  const [type, setType] = useState<SessionType>(suggested);
  const [isDeload, setIsDeload] = useState(false);
  const exercises = boot.templates[type].map((id) => findExercise(boot, id)).filter((e) => e !== undefined);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-neutral-400">{formatDate(new Date().toISOString())}</p>
        <h1 className="text-3xl font-bold">Training</h1>
        <p className="mt-1 text-neutral-400">
          Laut Wechsel ist <span className="font-semibold text-neutral-100">{TYPE_LABEL[suggested]}</span> dran.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-neutral-900 p-1">
        {(["UPPER", "LOWER"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`h-14 rounded-xl text-lg font-semibold ${type === t ? "bg-neutral-700" : "text-neutral-400"}`}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <label className="flex min-h-14 items-center justify-between gap-4 rounded-2xl bg-neutral-900 px-4">
        <span>
          <span className="font-semibold">Deload-Einheit</span>
          <span className="block text-sm text-neutral-400">Halbe Satzzahl, gleiches Gewicht, zählt nicht für die Progression</span>
        </span>
        <input
          type="checkbox"
          checked={isDeload}
          onChange={(e) => setIsDeload(e.target.checked)}
          className="h-7 w-7 shrink-0 accent-sky-500"
        />
      </label>

      <div className="rounded-2xl border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-amber-200">
        Vorher: 5 Min Cardio zum Aufwärmen
      </div>

      <ol className="flex flex-col divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
        {exercises.map((ex, i) => (
          <li key={ex.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0">
              <span className="text-neutral-500">{i + 1}. </span>
              {ex.name} {ex.isBonus && <Badge>Bonus</Badge>}
              <span className="block text-sm text-neutral-500">
                {isDeload ? Math.ceil(ex.sets / 2) : ex.sets} × {ex.repMin}–{ex.repMax}
              </span>
            </span>
            <span className="shrink-0 text-right text-sm text-neutral-300">{shortSuggestion(boot, ex, isDeload)}</span>
          </li>
        ))}
      </ol>

      <Button variant="primary" className="h-16 text-xl" onClick={() => onStart(type, isDeload)}>
        {TYPE_LABEL[type]} starten
      </Button>
    </div>
  );
}

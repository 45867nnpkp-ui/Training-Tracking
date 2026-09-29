"use client";

import { formatDuration, formatKg } from "@/lib/format";
import type { Bootstrap, WorkoutPayload } from "@/lib/training/types";
import { findExercise, workingSetsByExercise } from "@/lib/training/workout";
import { TYPE_LABEL, shortSuggestion } from "./suggestion";
import { Badge, Button } from "./ui";

export interface WorkoutSummary {
  payload: WorkoutPayload;
  records: { exerciseId: string; oneRepMax: number }[];
}

/** Abschluss-Screen: Dauer, Sätze, Rekorde, Vorschau für das nächste Mal. */
export default function SummaryView({
  summary,
  boot,
  pending,
  onClose,
}: {
  summary: WorkoutSummary;
  boot: Bootstrap;
  pending: number;
  onClose: () => void;
}) {
  const { payload, records } = summary;
  const duration = payload.endedAt ? Date.parse(payload.endedAt) - Date.parse(payload.startedAt) : 0;
  const working = workingSetsByExercise(payload);
  const setCount = [...working.values()].reduce((n, s) => n + s.length, 0);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-neutral-400">Geschafft!</p>
        <h1 className="text-3xl font-bold">
          {TYPE_LABEL[payload.type]} {payload.isDeload && <Badge tone="blue">Deload</Badge>}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Dauer" value={formatDuration(duration)} />
        <Stat label="Arbeitssätze" value={String(setCount)} />
      </div>

      {records.length > 0 && (
        <section className="rounded-2xl bg-emerald-950 p-4">
          <h2 className="mb-2 font-bold text-emerald-200">Neue Rekorde 🎉</h2>
          <ul className="flex flex-col gap-1">
            {records.map((r) => (
              <li key={r.exerciseId}>
                {findExercise(boot, r.exerciseId)?.name}: geschätztes 1RM {formatKg(r.oneRepMax)} kg
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-2 font-bold">Vorschlag fürs nächste Mal</h2>
        <ul className="flex flex-col divide-y divide-neutral-800">
          {[...working.keys()].map((id) => {
            const ex = findExercise(boot, id);
            if (!ex) return null;
            return (
              <li key={id} className="flex justify-between gap-3 py-2">
                <span>{ex.name}</span>
                <span className="text-right text-neutral-300">{shortSuggestion(boot, ex, false)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-sm text-neutral-400">
        {pending > 0
          ? "Gespeichert auf dem Handy. Wird hochgeladen, sobald Internet da ist."
          : "Gespeichert und synchronisiert."}
      </p>

      <Button variant="primary" className="h-14 text-lg" onClick={onClose}>
        Fertig
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-neutral-900 p-4">
      <p className="text-sm text-neutral-400">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

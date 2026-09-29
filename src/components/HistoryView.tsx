"use client";

import { useEffect, useState } from "react";
import { formatDate, formatDuration, formatKg, formatSets, formatTime } from "@/lib/format";
import { bestOneRepMax, workingWeight } from "@/lib/training/progression";
import type { Bootstrap, ExerciseHistoryEntry, WorkoutListItem } from "@/lib/training/types";
import { findExercise } from "@/lib/training/workout";
import HistoryChart from "./HistoryChart";
import { TYPE_LABEL } from "./suggestion";
import { Badge, Button } from "./ui";

type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ok"; data: T };

function useJson<T>(url: string, reloadKey = 0): Load<T> {
  const [result, setResult] = useState<Load<T>>({ state: "loading" });
  useEffect(() => {
    let cancelled = false;
    setResult({ state: "loading" });
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 401 ? "Bitte neu einloggen." : `Fehler ${res.status}`);
        return (await res.json()) as T;
      })
      .then((data) => !cancelled && setResult({ state: "ok", data }))
      .catch((err: Error) =>
        !cancelled &&
        setResult({ state: "error", message: err.message === "Failed to fetch" ? "Offline – Verlauf gerade nicht verfügbar." : err.message }),
      );
    return () => {
      cancelled = true;
    };
  }, [url, reloadKey]);
  return result;
}

export default function HistoryView({ boot, pending, onLogout }: { boot: Bootstrap; pending: number; onLogout: () => void }) {
  const [tab, setTab] = useState<"workouts" | "exercises">("exercises");
  const [exerciseId, setExerciseId] = useState<string | null>(null);

  if (exerciseId) {
    return <ExerciseHistory boot={boot} exerciseId={exerciseId} onBack={() => setExerciseId(null)} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Verlauf</h1>
      {pending > 0 && (
        <p className="rounded-xl bg-amber-950/50 px-4 py-2 text-sm text-amber-200">
          {pending} Einheit(en) noch nicht hochgeladen – erscheinen hier nach der Synchronisierung.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-neutral-900 p-1">
        {(
          [
            ["exercises", "Übungen"],
            ["workouts", "Trainings"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`h-12 rounded-xl font-semibold ${tab === key ? "bg-neutral-700" : "text-neutral-400"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "exercises" ? <ExerciseList boot={boot} onSelect={setExerciseId} /> : <WorkoutList />}
      <Button variant="ghost" className="mt-8 text-sm text-neutral-500" onClick={onLogout}>
        Abmelden
      </Button>
    </div>
  );
}

function ExerciseList({ boot, onSelect }: { boot: Bootstrap; onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      {(["UPPER", "LOWER"] as const).map((type) => {
        const mains = boot.templates[type].map((id) => findExercise(boot, id)).filter((e) => e !== undefined);
        const alts = boot.exercises.filter((e) => e.category === type && e.mainExerciseId);
        return (
          <section key={type}>
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-neutral-400 uppercase">{TYPE_LABEL[type]}</h2>
            <ul className="flex flex-col divide-y divide-neutral-800 rounded-2xl bg-neutral-900">
              {[...mains, ...alts].map((ex) => {
                const last = boot.recent[ex.id]?.[0];
                return (
                  <li key={ex.id}>
                    <button type="button" onClick={() => onSelect(ex.id)} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left">
                      <span>
                        {ex.name} {ex.mainExerciseId && <Badge tone="amber">Ausweich</Badge>}
                      </span>
                      <span className="shrink-0 text-sm text-neutral-400">{last ? formatSets(last.sets) : "–"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function WorkoutList() {
  const [reload, setReload] = useState(0);
  const result = useJson<WorkoutListItem[]>("/api/workouts", reload);

  if (result.state === "loading") return <p className="text-neutral-500">Lädt …</p>;
  if (result.state === "error") return <p className="text-neutral-400">{result.message}</p>;
  if (result.data.length === 0) return <p className="text-neutral-500">Noch keine Trainings gespeichert.</p>;

  async function remove(w: WorkoutListItem) {
    if (!window.confirm(`Training vom ${formatDate(w.startedAt)} wirklich löschen?`)) return;
    const res = await fetch(`/api/workouts/${w.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      window.alert("Löschen hat nicht geklappt (offline?).");
      return;
    }
    setReload((r) => r + 1);
  }

  return (
    <ul className="flex flex-col gap-2">
      {result.data.map((w) => (
        <li key={w.id} className="rounded-2xl bg-neutral-900 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">
                {TYPE_LABEL[w.type]} {w.isDeload && <Badge tone="blue">Deload</Badge>}
              </p>
              <p className="text-sm text-neutral-400">
                {formatDate(w.startedAt)}, {formatTime(w.startedAt)}
                {w.endedAt && ` · ${formatDuration(Date.parse(w.endedAt) - Date.parse(w.startedAt))}`} · {w.workingSets} Sätze
              </p>
            </div>
            <button type="button" onClick={() => remove(w)} className="h-10 rounded-lg px-2 text-sm text-neutral-500" aria-label="Training löschen">
              Löschen
            </button>
          </div>
          <p className="mt-1 text-sm text-neutral-500">{w.exercises.join(", ")}</p>
        </li>
      ))}
    </ul>
  );
}

function ExerciseHistory({ boot, exerciseId, onBack }: { boot: Bootstrap; exerciseId: string; onBack: () => void }) {
  const ex = findExercise(boot, exerciseId);
  const result = useJson<ExerciseHistoryEntry[]>(`/api/history/${encodeURIComponent(exerciseId)}`);

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" className="self-start px-0" onClick={onBack}>
        ← Verlauf
      </Button>
      <div>
        <h1 className="text-2xl font-bold">{ex?.name ?? exerciseId}</h1>
        {ex && (
          <p className="text-neutral-400">
            {ex.sets} × {ex.repMin}–{ex.repMax} · Steigerung {formatKg(ex.incrementKg)} kg
          </p>
        )}
      </div>
      {result.state === "loading" && <p className="text-neutral-500">Lädt …</p>}
      {result.state === "error" && <p className="text-neutral-400">{result.message}</p>}
      {result.state === "ok" && result.data.length === 0 && <p className="text-neutral-500">Noch keine Einheiten.</p>}
      {result.state === "ok" && result.data.length > 0 && (
        <>
          <HistoryChart
            points={result.data
              .filter((e) => !e.isDeload && e.sets.length > 0)
              .map((e) => ({ date: e.date, weight: workingWeight(e.sets) ?? 0, oneRepMax: bestOneRepMax(e.sets) }))}
          />
          <table className="w-full text-left text-sm">
            <thead className="text-neutral-400">
              <tr>
                <th className="py-2 font-normal">Datum</th>
                <th className="py-2 font-normal">Sätze</th>
                <th className="py-2 text-right font-normal">1RM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {[...result.data].reverse().map((e) => (
                <tr key={e.workoutId}>
                  <td className="py-2 pr-2 whitespace-nowrap">
                    {formatDate(e.date, false)} {e.isDeload && <Badge tone="blue">D</Badge>}
                  </td>
                  <td className="py-2">
                    {formatSets(e.sets)}
                    {e.sets.some((s) => s.note) && (
                      <span className="block text-xs text-neutral-500">{e.sets.map((s) => s.note).filter(Boolean).join(" · ")}</span>
                    )}
                  </td>
                  <td className="py-2 text-right">{formatKg(Math.round(bestOneRepMax(e.sets) * 10) / 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

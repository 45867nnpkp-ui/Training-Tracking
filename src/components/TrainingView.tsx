"use client";

import { useEffect, useRef, useState } from "react";
import { formatDuration, formatKg } from "@/lib/format";
import type { Bootstrap, ExerciseDTO } from "@/lib/training/types";
import {
  alternativesFor,
  findExercise,
  hasMixedWeights,
  openSetCount,
  replaceCurrent,
  setWeight,
  suggestionFor,
  swapWithNext,
  type ActiveWorkout,
  type ExerciseEntry,
  type SetEntry,
} from "@/lib/training/workout";
import { primeSound, restFinishedAlert } from "@/client/alert";
import { TYPE_LABEL, formatRest, targetInfo } from "./suggestion";
import { Badge, Button, Stepper, useNow } from "./ui";

interface Props {
  boot: Bootstrap;
  workout: ActiveWorkout;
  onChange: (w: ActiveWorkout) => void;
  onFinish: () => void;
  onDiscard: () => void;
  onSetupNote: (exerciseId: string, note: string) => void;
}

export default function TrainingView({ boot, workout, onChange, onFinish, onDiscard, onSetupNote }: Props) {
  const now = useNow();
  const [showAlternatives, setShowAlternatives] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const exId = workout.order[workout.currentIndex];
  const ex = findExercise(boot, exId);
  const entry = workout.entries[exId];
  const isLastExercise = workout.currentIndex === workout.order.length - 1;

  function goTo(index: number) {
    if (index < 0 || index >= workout.order.length) return;
    onChange({ ...workout, currentIndex: index });
    window.scrollTo({ top: 0 });
  }

  function updateEntry(fn: (e: ExerciseEntry) => ExerciseEntry) {
    onChange({ ...workout, entries: { ...workout.entries, [exId]: fn(entry) } });
  }

  function finish() {
    const open = openSetCount(workout);
    const msg =
      open > 0
        ? `Noch ${open} offene ${open === 1 ? "Satz" : "Sätze"}. Einheit trotzdem beenden? Gespeichert werden nur abgehakte Sätze.`
        : "Einheit beenden und speichern?";
    if (window.confirm(msg)) onFinish();
  }

  if (!ex || !entry) {
    return (
      <div className="flex flex-col gap-4">
        <p>Diese Übung ist nicht mehr vorhanden.</p>
        <Button onClick={() => goTo(workout.currentIndex + 1)}>Weiter</Button>
      </div>
    );
  }

  const target = targetInfo(boot, ex, workout.isDeload);
  const lastSets = suggestionFor(boot, ex).last?.sets ?? [];
  const alternatives = alternativesFor(boot, exId);
  const allDone = entry.sets.every((s) => s.done);

  function toggleSet(kind: "warmups" | "sets", index: number) {
    primeSound();
    const list = entry[kind];
    const s = list[index];
    let updated: SetEntry;
    if (s.done) {
      updated = { ...s, done: false, completedAt: null };
    } else {
      const reps = s.reps ?? (kind === "sets" ? lastSets[index]?.reps ?? null : null);
      if (s.weightKg === null || reps === null) return;
      updated = { ...s, reps, done: true, completedAt: new Date().toISOString() };
    }
    const nextList = list.map((x, i) => (i === index ? updated : x));
    const nextEntry = { ...entry, [kind]: nextList };
    const next: ActiveWorkout = { ...workout, entries: { ...workout.entries, [exId]: nextEntry } };
    // Pausentimer nach jedem abgehakten Arbeitssatz, außer ganz am Ende.
    if (kind === "sets" && updated.done && openSetCount(next) > 0) {
      next.rest = { startedAt: new Date().toISOString(), exerciseId: exId, minSec: ex!.restMinSec, maxSec: ex!.restMaxSec };
    }
    onChange(next);
  }

  function patchSet(kind: "warmups" | "sets", index: number, patch: Partial<SetEntry>) {
    updateEntry((e) => ({ ...e, [kind]: e[kind].map((s, i) => (i === index ? { ...s, ...patch } : s)) }));
  }

  return (
    <div
      className="flex flex-col gap-4 pb-40"
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const dx = e.changedTouches[0].clientX - start.x;
        const dy = e.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) goTo(workout.currentIndex + (dx < 0 ? 1 : -1));
      }}
    >
      {/* Kopfzeile */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{TYPE_LABEL[workout.type]}</span>
            {workout.isDeload && <Badge tone="blue">Deload</Badge>}
          </div>
          <span className="text-sm text-neutral-400">{formatDuration(now - Date.parse(workout.startedAt))}</span>
        </div>
        <Button variant="primary" onClick={finish}>
          Beenden
        </Button>
      </div>

      {/* Übungsnavigation */}
      <div className="flex gap-1.5" role="tablist" aria-label="Übungen">
        {workout.order.map((id, i) => {
          const e = workout.entries[id];
          const done = e.sets.length > 0 && e.sets.every((s) => s.done);
          const color = i === workout.currentIndex ? "bg-neutral-100" : e.skipped ? "bg-neutral-700" : done ? "bg-emerald-500" : "bg-neutral-600";
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={i === workout.currentIndex}
              aria-label={findExercise(boot, id)?.name ?? id}
              onClick={() => goTo(i)}
              className="flex h-8 flex-1 items-center"
            >
              <span className={`h-2 w-full rounded-full ${color}`} />
            </button>
          );
        })}
      </div>

      {/* Übung */}
      <section className="flex flex-col gap-3">
        <div>
          <p className="text-sm text-neutral-400">
            Übung {workout.currentIndex + 1} von {workout.order.length}
          </p>
          <h2 className="text-2xl leading-tight font-bold">
            {ex.name} {ex.isBonus && <Badge>Bonus</Badge>} {ex.mainExerciseId && <Badge tone="amber">Ausweichübung</Badge>}{" "}
            {entry.skipped && <Badge tone="red">übersprungen</Badge>}
          </h2>
          <p className="text-neutral-400">
            {entry.sets.length} × {ex.repMin}–{ex.repMax} Wdh. · Pause {formatRest(ex)}
          </p>
          {ex.hint && <p className="text-sm text-neutral-400">{ex.hint}</p>}
        </div>

        <SetupNote exercise={ex} onSave={(note) => onSetupNote(ex.id, note)} />

        <div
          className={`rounded-2xl px-4 py-3 ${
            { green: "bg-emerald-950 text-emerald-200", blue: "bg-sky-950 text-sky-200", amber: "bg-amber-950/60 text-amber-200", neutral: "bg-neutral-900" }[target.tone]
          }`}
        >
          <p className="text-lg font-semibold">{target.headline}</p>
          {target.lastTime && <p className="text-sm opacity-80">{target.lastTime}</p>}
        </div>

        {entry.warmups.length > 0 && (
          <div className="flex flex-col gap-2">
            {entry.warmups.map((s, i) => (
              <div key={i} className={`flex items-center gap-3 rounded-2xl px-4 py-2 ${s.done ? "bg-emerald-950/50" : "bg-neutral-900"}`}>
                <Badge>Aufwärmen</Badge>
                <span className="flex-1 text-lg font-semibold">
                  {formatKg(s.weightKg)} kg × {s.reps}
                </span>
                <CheckButton done={s.done} onClick={() => toggleSet("warmups", i)} label={`Aufwärmsatz ${i + 1} abhaken`} />
              </div>
            ))}
          </div>
        )}

        {entry.sets.map((s, i) => (
          <SetRow
            key={i}
            index={i}
            set={s}
            exercise={ex}
            isLast={i === entry.sets.length - 1}
            isDeload={workout.isDeload}
            placeholderReps={lastSets[i]?.reps ?? null}
            onWeight={(w) => updateEntry((e) => setWeight(e, i, w))}
            onPatch={(p) => patchSet("sets", i, p)}
            onToggle={() => toggleSet("sets", i)}
          />
        ))}

        {hasMixedWeights(entry) && (
          <p className="text-sm text-amber-300/90">Tipp: Gewicht innerhalb der Übung konstant halten.</p>
        )}

        {allDone && !isLastExercise && (
          <Button variant="primary" className="h-14 text-lg" onClick={() => goTo(workout.currentIndex + 1)}>
            Nächste Übung →
          </Button>
        )}

        <div className="grid grid-cols-3 gap-2">
          <Button
            className="text-sm"
            disabled={isLastExercise}
            onClick={() => onChange(swapWithNext(workout))}
          >
            Maschine besetzt
          </Button>
          <Button className="text-sm" disabled={alternatives.length === 0} onClick={() => setShowAlternatives(true)}>
            Ausweich&shy;übung
          </Button>
          <Button
            className="text-sm"
            onClick={() => {
              const skipped = !entry.skipped;
              const next = { ...workout, entries: { ...workout.entries, [exId]: { ...entry, skipped } } };
              onChange(skipped && !isLastExercise ? { ...next, currentIndex: workout.currentIndex + 1 } : next);
            }}
          >
            {entry.skipped ? "Doch machen" : "Über\u00adspringen"}
          </Button>
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" disabled={workout.currentIndex === 0} onClick={() => goTo(workout.currentIndex - 1)}>
            ← Zurück
          </Button>
          <Button variant="ghost" disabled={isLastExercise} onClick={() => goTo(workout.currentIndex + 1)}>
            Weiter →
          </Button>
        </div>

        <Button
          variant="ghost"
          className="mt-6 text-sm text-neutral-500"
          onClick={() => {
            if (window.confirm("Einheit wirklich verwerfen? Nichts davon wird gespeichert.")) onDiscard();
          }}
        >
          Einheit verwerfen
        </Button>
      </section>

      {showAlternatives && (
        <div className="fixed inset-0 z-20 flex items-end bg-black/70" onClick={() => setShowAlternatives(false)}>
          <div className="pb-safe w-full rounded-t-3xl bg-neutral-900 p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-lg font-bold">Statt {ex.name}:</h3>
            <div className="flex flex-col gap-2">
              {alternatives.map((alt) => (
                <Button
                  key={alt.id}
                  className="h-14 text-left"
                  onClick={() => {
                    onChange(replaceCurrent(boot, workout, alt.id));
                    setShowAlternatives(false);
                  }}
                >
                  {alt.name}
                  {alt.hint && <span className="block text-xs font-normal text-neutral-400">{alt.hint}</span>}
                </Button>
              ))}
              <Button variant="ghost" onClick={() => setShowAlternatives(false)}>
                Abbrechen
              </Button>
            </div>
          </div>
        </div>
      )}

      {workout.rest && (
        <RestBanner
          workout={workout}
          boot={boot}
          now={now}
          onAdjust={(sec) =>
            onChange({ ...workout, rest: { ...workout.rest!, minSec: Math.max(0, workout.rest!.minSec + sec), maxSec: Math.max(0, workout.rest!.maxSec + sec) } })
          }
          onClose={() => onChange({ ...workout, rest: null })}
        />
      )}
    </div>
  );
}

function CheckButton({ done, onClick, label, disabled }: { done: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={done}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl font-bold disabled:opacity-30 ${
        done ? "bg-emerald-600 text-white" : "border-2 border-neutral-600 text-neutral-500"
      }`}
    >
      ✓
    </button>
  );
}

function SetRow({
  index,
  set,
  exercise,
  isLast,
  isDeload,
  placeholderReps,
  onWeight,
  onPatch,
  onToggle,
}: {
  index: number;
  set: SetEntry;
  exercise: ExerciseDTO;
  isLast: boolean;
  isDeload: boolean;
  placeholderReps: number | null;
  onWeight: (w: number | null) => void;
  onPatch: (p: Partial<SetEntry>) => void;
  onToggle: () => void;
}) {
  const [noteOpen, setNoteOpen] = useState(set.note !== "");
  const canComplete = set.weightKg !== null && (set.reps !== null || placeholderReps !== null);

  return (
    <div className={`flex flex-col gap-2 rounded-2xl p-3 ${set.done ? "bg-emerald-950/50" : "bg-neutral-900"}`}>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-neutral-300">Satz {index + 1}</span>
        {isLast && !isDeload && <Badge tone="red">bis Versagen</Badge>}
        {isDeload && <Badge tone="blue">nicht bis Versagen</Badge>}
        <button type="button" onClick={() => setNoteOpen(!noteOpen)} className="ml-auto h-9 rounded-lg px-2 text-sm text-neutral-400">
          Notiz
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stepper label={`Gewicht Satz ${index + 1}`} value={set.weightKg} step={exercise.incrementKg} unit="kg" decimals onChange={onWeight} />
        <Stepper
          label={`Wiederholungen Satz ${index + 1}`}
          value={set.reps}
          placeholder={placeholderReps}
          step={1}
          unit="Wdh."
          decimals={false}
          onChange={(reps) => onPatch({ reps })}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="mr-0.5 text-sm text-neutral-500">RIR</span>
        {[0, 1, 2, 3].map((r) => (
          <button
            key={r}
            type="button"
            aria-label={`RIR ${r}`}
            aria-pressed={set.rir === r}
            onClick={() => onPatch({ rir: set.rir === r ? null : r })}
            className={`h-11 w-9 rounded-lg text-sm font-semibold ${set.rir === r ? "bg-neutral-100 text-neutral-900" : "bg-neutral-800"}`}
          >
            {r}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={set.failure}
          onClick={() => onPatch({ failure: !set.failure, rir: !set.failure ? 0 : set.rir })}
          className={`h-11 rounded-lg px-2 text-sm font-semibold ${set.failure ? "bg-red-700 text-white" : "bg-neutral-800"}`}
        >
          Versagen
        </button>
        <span className="ml-auto" />
        <CheckButton done={set.done} disabled={!canComplete && !set.done} onClick={onToggle} label={`Satz ${index + 1} abhaken`} />
      </div>
      {noteOpen && (
        <input
          type="text"
          value={set.note}
          placeholder="Notiz zum Satz"
          onChange={(e) => onPatch({ note: e.target.value })}
          className="h-11 rounded-lg bg-neutral-800 px-3 text-base outline-none focus:ring-2 focus:ring-emerald-500"
        />
      )}
    </div>
  );
}

function SetupNote({ exercise, onSave }: { exercise: ExerciseDTO; onSave: (note: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(exercise.setupNote);

  useEffect(() => setDraft(exercise.setupNote), [exercise.setupNote]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex min-h-11 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-left text-neutral-300"
      >
        <span aria-hidden>⚙</span>
        <span className="flex-1">{exercise.setupNote || <span className="text-neutral-500">Einstellung notieren (z. B. Sitzhöhe)</span>}</span>
        <span className="text-sm text-neutral-500">ändern</span>
      </button>
    );
  }
  return (
    <div className="flex gap-2">
      <input
        type="text"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="z. B. Stufe 2, Sitz auf 4"
        className="h-12 min-w-0 flex-1 rounded-xl bg-neutral-800 px-3 text-base outline-none focus:ring-2 focus:ring-emerald-500"
      />
      <Button
        variant="primary"
        onClick={() => {
          onSave(draft.trim());
          setEditing(false);
        }}
      >
        OK
      </Button>
    </div>
  );
}

function RestBanner({
  workout,
  boot,
  now,
  onAdjust,
  onClose,
}: {
  workout: ActiveWorkout;
  boot: Bootstrap;
  now: number;
  onAdjust: (sec: number) => void;
  onClose: () => void;
}) {
  const rest = workout.rest!;
  const elapsed = (now - Date.parse(rest.startedAt)) / 1000;
  const toMin = rest.minSec - elapsed;
  const toMax = rest.maxSec - elapsed;
  const alerted = useRef<string | null>(null);

  useEffect(() => {
    const key = `${rest.startedAt}-${rest.minSec}`;
    if (toMin <= 0 && alerted.current !== key && toMin > -5) {
      alerted.current = key;
      restFinishedAlert();
    }
  }, [toMin, rest.startedAt, rest.minSec]);

  // Nächster offener Satz: zuerst in der aktuellen Reihenfolge ab hier suchen.
  const order = [...workout.order.slice(workout.currentIndex), ...workout.order.slice(0, workout.currentIndex)];
  const nextId = order.find((id) => !workout.entries[id].skipped && workout.entries[id].sets.some((s) => !s.done));
  const nextName = findExercise(boot, nextId ?? rest.exerciseId)?.name ?? "";
  let text: string;
  let tone: string;
  if (toMin > 0) {
    text = formatDuration(toMin * 1000);
    tone = "bg-neutral-800";
  } else if (toMax > 0) {
    text = `Los geht's · max. noch ${formatDuration(toMax * 1000)}`;
    tone = "bg-emerald-700";
  } else {
    text = "Pause vorbei";
    tone = "bg-amber-700";
  }

  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-10 px-3">
      <div className={`mx-auto flex max-w-lg items-center gap-2 rounded-2xl p-3 shadow-2xl ${tone}`}>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-neutral-300">Pause · nächster Satz: {nextName}</p>
          <p className="text-3xl font-bold tabular-nums">{text}</p>
        </div>
        <Button className="px-3" onClick={() => onAdjust(-15)} aria-label="Pause 15 Sekunden kürzer">
          −15
        </Button>
        <Button className="px-3" onClick={() => onAdjust(30)} aria-label="Pause 30 Sekunden länger">
          +30
        </Button>
        <Button className="px-3" onClick={onClose} aria-label="Pause schließen">
          ✕
        </Button>
      </div>
    </div>
  );
}

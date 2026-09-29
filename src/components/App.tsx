"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { idbDelete, idbGet, idbSet } from "@/client/idb";
import { enqueue, flushOutbox, getOutbox } from "@/client/outbox";
import { registerServiceWorker } from "@/client/sw-register";
import type { SessionType } from "@/lib/training/catalog";
import type { Bootstrap } from "@/lib/training/types";
import {
  applyWorkoutToBootstrap,
  buildPayload,
  createWorkout,
  personalRecords,
  type ActiveWorkout,
} from "@/lib/training/workout";
import HistoryView from "./HistoryView";
import StartScreen from "./StartScreen";
import SummaryView, { type WorkoutSummary } from "./SummaryView";
import TrainingView from "./TrainingView";

type Tab = "training" | "history";
type SyncState = "idle" | "syncing" | "offline" | "unauthorized" | "error";

const BOOT_KEY = "bootstrap";
const ACTIVE_KEY = "activeWorkout";

function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [active, setActive] = useState<ActiveWorkout | null>(null);
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [tab, setTab] = useState<Tab>("training");
  const [pending, setPending] = useState(0);
  const [sync, setSync] = useState<SyncState>("idle");
  const [storageError, setStorageError] = useState(false);
  const bootRef = useRef<Bootstrap | null>(null);
  bootRef.current = boot;

  const saveBoot = useCallback((b: Bootstrap) => {
    setBoot(b);
    idbSet(BOOT_KEY, b).catch(() => setStorageError(true));
  }, []);

  /** Warteschlange hochladen, danach den aktuellen Stand vom Server holen. */
  const refresh = useCallback(async () => {
    setSync("syncing");
    const result = await flushOutbox();
    setPending(result.pending);
    if (result.unauthorized) return setSync("unauthorized");
    if (result.error) return setSync(result.error === "offline" ? "offline" : "error");

    try {
      const res = await fetch("/api/bootstrap", { cache: "no-store" });
      if (res.status === 401) return setSync("unauthorized");
      if (!res.ok) return setSync("error");
      const fresh = (await res.json()) as Bootstrap;
      // Nur übernehmen, wenn inzwischen nichts Neues lokal gespeichert wurde.
      if ((await getOutbox()).length === 0) saveBoot(fresh);
      setSync("idle");
    } catch {
      setSync("offline");
    }
  }, [saveBoot]);

  useEffect(() => {
    registerServiceWorker();
    (async () => {
      try {
        const [b, a, outbox] = await Promise.all([idbGet<Bootstrap>(BOOT_KEY), idbGet<ActiveWorkout>(ACTIVE_KEY), getOutbox()]);
        if (b) setBoot(b);
        if (a) setActive(a);
        setPending(outbox.length);
      } catch {
        setStorageError(true);
      }
      setLoaded(true);
      void refresh();
    })();

    const onOnline = () => void refresh();
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  /** Jede Änderung an der laufenden Einheit sofort lokal sichern. */
  const updateActive = useCallback((w: ActiveWorkout | null) => {
    setActive(w);
    const op = w ? idbSet(ACTIVE_KEY, w) : idbDelete(ACTIVE_KEY);
    op.catch(() => setStorageError(true));
  }, []);

  function start(type: SessionType, isDeload: boolean) {
    if (!boot) return;
    updateActive(createWorkout(boot, type, isDeload, uuid(), new Date()));
    window.scrollTo({ top: 0 });
  }

  async function finish() {
    if (!active || !boot) return;
    const payload = buildPayload(active, new Date());
    if (payload.sets.length === 0) {
      // Eine leere Einheit würde den Wechsel Oberkörper/Beine verfälschen.
      if (window.confirm("Kein Satz abgehakt – die Einheit wird nicht gespeichert. Verwerfen?")) updateActive(null);
      return;
    }
    const records = personalRecords(boot, payload);
    await enqueue({ kind: "workout", id: payload.id, rev: Date.now(), payload });
    saveBoot(applyWorkoutToBootstrap(boot, payload));
    setPending((await getOutbox()).length);
    updateActive(null);
    setSummary({ payload, records });
    window.scrollTo({ top: 0 });
    void refresh();
  }

  async function saveSetupNote(exerciseId: string, setupNote: string) {
    const b = bootRef.current;
    if (!b) return;
    saveBoot({ ...b, exercises: b.exercises.map((e) => (e.id === exerciseId ? { ...e, setupNote } : e)) });
    await enqueue({ kind: "setupNote", id: `note:${exerciseId}`, rev: Date.now(), exerciseId, setupNote });
    setPending((await getOutbox()).length);
    void refresh();
  }

  async function logout() {
    if (pending > 0 && !window.confirm("Es gibt noch nicht hochgeladene Daten. Trotzdem abmelden?")) return;
    await fetch("/api/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/login";
  }

  let content: React.ReactNode;
  if (!loaded) {
    content = <p className="text-neutral-500">Lädt …</p>;
  } else if (!boot) {
    content = (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">Training</h1>
        <p className="text-neutral-400">
          {sync === "syncing" ? "Lade Trainingsplan …" : "Der Trainingsplan konnte noch nicht geladen werden. Bitte einmal mit Internet öffnen."}
        </p>
      </div>
    );
  } else if (active) {
    content = (
      <TrainingView
        boot={boot}
        workout={active}
        onChange={updateActive}
        onFinish={finish}
        onDiscard={() => updateActive(null)}
        onSetupNote={saveSetupNote}
      />
    );
  } else if (summary) {
    content = <SummaryView summary={summary} boot={boot} pending={pending} onClose={() => setSummary(null)} />;
  } else if (tab === "history") {
    content = <HistoryView boot={boot} pending={pending} onLogout={logout} />;
  } else {
    content = <StartScreen boot={boot} onStart={start} />;
  }

  const showNav = loaded && boot && !active && !summary;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <SyncBar sync={sync} pending={pending} storageError={storageError} onRetry={() => void refresh()} />
      <main className={`flex-1 px-4 pt-4 ${showNav ? "pb-28" : "pb-8"}`}>{content}</main>
      {showNav && (
        <nav className="pb-safe fixed inset-x-0 bottom-0 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur">
          <div className="mx-auto grid max-w-lg grid-cols-2">
            {(
              [
                ["training", "Training"],
                ["history", "Verlauf"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`h-16 text-base font-semibold ${tab === key ? "text-emerald-400" : "text-neutral-400"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

function SyncBar({ sync, pending, storageError, onRetry }: { sync: SyncState; pending: number; storageError: boolean; onRetry: () => void }) {
  if (storageError) {
    return (
      <div className="bg-red-900 px-4 py-2 text-sm">
        Lokaler Speicher nicht verfügbar – offline wird nichts gesichert (privater Modus?).
      </div>
    );
  }
  if (sync === "unauthorized") {
    return (
      <a href="/login" className="block bg-amber-800 px-4 py-2 text-sm">
        Sitzung abgelaufen – hier neu einloggen. {pending > 0 && `${pending} Einträge warten, sie gehen nicht verloren.`}
      </a>
    );
  }
  if (sync === "offline" || sync === "error" || pending > 0) {
    const text =
      sync === "offline"
        ? "Offline"
        : sync === "error"
          ? "Server nicht erreichbar"
          : sync === "syncing"
            ? "Synchronisiere …"
            : "Noch nicht hochgeladen";
    return (
      <button type="button" onClick={onRetry} className="w-full bg-neutral-800 px-4 py-2 text-left text-sm text-neutral-300">
        {text}
        {pending > 0 && ` · ${pending} ${pending === 1 ? "Eintrag wartet" : "Einträge warten"}`} · antippen zum Wiederholen
      </button>
    );
  }
  return null;
}

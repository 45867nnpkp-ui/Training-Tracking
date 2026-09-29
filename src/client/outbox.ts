// Warteschlange für Änderungen, die zum Server müssen. Jede Änderung wird
// zuerst lokal gespeichert und dann hochgeladen, sobald Netz da ist.
import type { WorkoutPayload } from "@/lib/training/types";
import { idbGet, idbSet } from "./idb";

export type OutboxItem = { rev: number } & (
  | { kind: "workout"; id: string; payload: WorkoutPayload }
  | { kind: "setupNote"; id: string; exerciseId: string; setupNote: string }
);

const KEY = "outbox";
/** Vom Server abgelehnte Einträge – werden aufbewahrt, nie gelöscht. */
const REJECTED_KEY = "outbox-rejected";

export interface SyncResult {
  pending: number;
  unauthorized: boolean;
  error: string | null;
}

export async function getOutbox(): Promise<OutboxItem[]> {
  return (await idbGet<OutboxItem[]>(KEY)) ?? [];
}

/** Hängt an; ein älterer Eintrag mit gleicher ID wird ersetzt. */
export async function enqueue(item: OutboxItem): Promise<void> {
  const items = (await getOutbox()).filter((i) => i.id !== item.id);
  items.push(item);
  await idbSet(KEY, items);
}

async function send(item: OutboxItem): Promise<Response> {
  if (item.kind === "workout") {
    return fetch("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item.payload),
    });
  }
  return fetch(`/api/exercises/${encodeURIComponent(item.exerciseId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setupNote: item.setupNote }),
  });
}

let running: Promise<SyncResult> | null = null;

/** Lädt alle wartenden Einträge der Reihe nach hoch. */
export function flushOutbox(): Promise<SyncResult> {
  running ??= (async () => {
    try {
      for (const item of await getOutbox()) {
        let res: Response;
        try {
          res = await send(item);
        } catch {
          return { pending: (await getOutbox()).length, unauthorized: false, error: "offline" };
        }
        if (res.status === 401) {
          return { pending: (await getOutbox()).length, unauthorized: true, error: null };
        }
        if (!res.ok && res.status !== 400 && res.status !== 404) {
          return { pending: (await getOutbox()).length, unauthorized: false, error: `Serverfehler ${res.status}` };
        }
        if (!res.ok) {
          // Dauerhaft ungültig: nicht endlos wiederholen, aber aufbewahren.
          console.error("Eintrag vom Server abgelehnt", item, await res.text());
          const rejected = (await idbGet<OutboxItem[]>(REJECTED_KEY)) ?? [];
          await idbSet(REJECTED_KEY, [...rejected, item]);
        }
        // Nur genau diese Fassung entfernen – wurde der Eintrag währenddessen
        // erneut geändert (neue rev), bleibt die neue Fassung in der Schlange.
        await idbSet(
          KEY,
          (await getOutbox()).filter((i) => !(i.id === item.id && i.rev === item.rev)),
        );
      }
      return { pending: 0, unauthorized: false, error: null };
    } finally {
      running = null;
    }
  })();
  return running;
}

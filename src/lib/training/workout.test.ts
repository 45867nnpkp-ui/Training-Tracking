import { describe, expect, it } from "vitest";
import { EXERCISES, TEMPLATES } from "./catalog";
import type { Bootstrap } from "./types";
import {
  alternativesFor,
  applyWorkoutToBootstrap,
  buildPayload,
  createWorkout,
  nextSessionType,
  personalRecords,
  replaceCurrent,
  setWeight,
  suggestionFor,
  swapWithNext,
} from "./workout";

function boot(overrides: Partial<Bootstrap> = {}): Bootstrap {
  return {
    exercises: EXERCISES,
    templates: TEMPLATES,
    recent: {},
    best1RM: {},
    lastWorkoutType: null,
    fetchedAt: "2026-09-29T10:00:00.000Z",
    ...overrides,
  };
}

const ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-09-28T09:55:00.000Z");

describe("Einheit anlegen", () => {
  it("Oberkörper: feste Reihenfolge, Startgewichte, Aufwärmsätze nur für die Brustpresse", () => {
    const w = createWorkout(boot(), "UPPER", false, ID, NOW);
    expect(w.order).toEqual(TEMPLATES.UPPER);
    const bp = w.entries["brustpresse"];
    expect(bp.sets).toHaveLength(3);
    expect(bp.sets.every((s) => s.weightKg === 65)).toBe(true);
    expect(bp.warmups.map((s) => s.weightKg)).toEqual([35, 50]); // 32,5 → 35 und 48,75 → 50
    expect(w.entries["latzug-breit"].warmups).toEqual([]);
    expect(w.entries["flys-maschine"].sets[0].weightKg).toBeNull(); // kalibrieren
  });

  it("Beine: Aufwärmsätze gehören zur Beinpresse (erste Grundübung), beim Kalibrieren gibt es keine", () => {
    const w = createWorkout(boot(), "LOWER", false, ID, NOW);
    expect(w.entries["beinbeuger-liegend"].warmups).toEqual([]);
    expect(w.entries["beinpresse"].warmups).toEqual([]);
    const w2 = createWorkout(
      boot({ recent: { beinpresse: [{ date: "x", sets: [{ weightKg: 100, reps: 8 }, { weightKg: 100, reps: 8 }, { weightKg: 100, reps: 7 }] }] } }),
      "LOWER",
      false,
      ID,
      NOW,
    );
    expect(w2.entries["beinpresse"].warmups.map((s) => s.weightKg)).toEqual([50, 80]); // 75 → 80 (Stufe 10)
  });

  it("Deload: halbe Satzzahl (aufgerundet), gleiches Gewicht", () => {
    const b = boot({ recent: { brustpresse: [{ date: "x", sets: [10, 10, 10].map((r) => ({ weightKg: 65, reps: r })) }] } });
    const w = createWorkout(b, "UPPER", true, ID, NOW);
    expect(w.entries["brustpresse"].sets).toHaveLength(2);
    expect(w.entries["brustpresse"].sets[0].weightKg).toBe(65);
    expect(w.entries["seitheben-kabel"].sets).toHaveLength(2);
    expect(w.entries["flys-maschine"].sets).toHaveLength(1);
  });

  it("Wechsel: nach Oberkörper kommt Beine und umgekehrt", () => {
    expect(nextSessionType(boot())).toBe("UPPER");
    expect(nextSessionType(boot({ lastWorkoutType: "UPPER" }))).toBe("LOWER");
    expect(nextSessionType(boot({ lastWorkoutType: "LOWER" }))).toBe("UPPER");
  });
});

describe("Während der Einheit", () => {
  it("Maschine besetzt: Flys tauschen mit der nächsten Übung", () => {
    const w = { ...createWorkout(boot(), "UPPER", false, ID, NOW), currentIndex: 3 };
    expect(swapWithNext(w).order.slice(3, 5)).toEqual(["rudern-breit", "flys-maschine"]);
  });

  it("Ausweichübungen in Priorität, eigene Übung mit eigenem Verlauf", () => {
    const b = boot();
    expect(alternativesFor(b, "flys-maschine").map((e) => e.id)).toEqual(["kabel-flys", "kh-flys-flachbank"]);
    const w = { ...createWorkout(b, "UPPER", false, ID, NOW), currentIndex: 3 };
    const replaced = replaceCurrent(b, w, "kabel-flys");
    expect(replaced.order[3]).toBe("kabel-flys");
    expect(alternativesFor(b, "kabel-flys").map((e) => e.id)).toEqual(["flys-maschine", "kh-flys-flachbank"]);
  });

  it("Gewicht ändern zieht offene Folgesätze mit", () => {
    const entry = createWorkout(boot(), "UPPER", false, ID, NOW).entries["flys-maschine"];
    const changed = setWeight(entry, 0, 40);
    expect(changed.sets.map((s) => s.weightKg)).toEqual([40, 40]);
  });
});

describe("Einheit beenden", () => {
  function finishedUpperWorkout(reps: number[]) {
    const b = boot({ best1RM: { brustpresse: 80 } });
    const w = createWorkout(b, "UPPER", false, ID, NOW);
    const bp = w.entries["brustpresse"];
    bp.warmups = bp.warmups.map((s) => ({ ...s, done: true }));
    bp.sets = bp.sets.map((s, i) => ({ ...s, reps: reps[i], done: true }));
    return { b, payload: buildPayload(w, new Date("2026-09-28T11:05:00.000Z")) };
  }

  it("nur abgehakte Sätze werden gespeichert, Aufwärmsätze markiert", () => {
    const { payload } = finishedUpperWorkout([10, 10, 10]);
    expect(payload.sets.filter((s) => s.isWarmup)).toHaveLength(2);
    expect(payload.sets.filter((s) => !s.isWarmup)).toHaveLength(3);
    expect(new Set(payload.sets.map((s) => s.exerciseId))).toEqual(new Set(["brustpresse"]));
  });

  it("lokaler Verlauf wird aktualisiert → nächster Vorschlag stimmt auch offline (70 kg)", () => {
    const { b, payload } = finishedUpperWorkout([10, 10, 10]);
    const updated = applyWorkoutToBootstrap(b, payload);
    expect(updated.lastWorkoutType).toBe("UPPER");
    const bp = updated.exercises.find((e) => e.id === "brustpresse")!;
    expect(suggestionFor(updated, bp)).toMatchObject({ kind: "increase", weightKg: 70 });
    // Aufwärmsätze zählen nicht
    expect(updated.recent["brustpresse"][0].sets).toHaveLength(3);
  });

  it("persönlicher Rekord über das geschätzte 1RM", () => {
    const { b, payload } = finishedUpperWorkout([10, 10, 10]); // 65 × 10 → 86,67 > 80
    expect(personalRecords(b, payload).map((r) => r.exerciseId)).toEqual(["brustpresse"]);
  });

  it("Deload-Einheit verändert den lokalen Verlauf nicht", () => {
    const b = boot();
    const w = createWorkout(b, "UPPER", true, ID, NOW);
    w.entries["brustpresse"].sets = w.entries["brustpresse"].sets.map((s) => ({ ...s, reps: 10, done: true }));
    const updated = applyWorkoutToBootstrap(b, buildPayload(w, NOW));
    expect(updated.recent).toEqual({});
    expect(updated.lastWorkoutType).toBe("UPPER");
  });
});

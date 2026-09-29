import { describe, expect, it } from "vitest";
import { EXERCISES } from "./catalog";
import {
  deloadPrescription,
  estimatedOneRepMax,
  plannedSetCount,
  resetWeight,
  roundToStep,
  stagnationAdvice,
  stagnationStreak,
  suggestNext,
  warmupSets,
  workingWeight,
  type ExerciseSession,
  type ProgressionConfig,
} from "./progression";

const brustpresse: ProgressionConfig = EXERCISES.find((e) => e.id === "brustpresse")!;
const rudern: ProgressionConfig = EXERCISES.find((e) => e.id === "rudern-breit")!;

function session(date: string, weightKg: number, reps: number[], isDeload = false): ExerciseSession {
  return { date, isDeload, sets: reps.map((r) => ({ weightKg, reps: r })) };
}

describe("Testfall 10: doppelte Progression (Brustpresse)", () => {
  it("65 kg mit 10/10/10 → nächster Vorschlag 70 kg", () => {
    const s = suggestNext(brustpresse, [session("2026-09-28", 65, [10, 10, 10])]);
    expect(s.kind).toBe("increase");
    expect(s.weightKg).toBe(70);
  });

  it("65 kg mit 10/9/8 → 65 kg, Ziel ≥ 28 Wdh. gesamt", () => {
    const s = suggestNext(brustpresse, [session("2026-09-28", 65, [10, 9, 8])]);
    expect(s.kind).toBe("repeat");
    expect(s.weightKg).toBe(65);
    expect(s.targetTotalReps).toBe(28);
  });

  it("nur die neueste Einheit zählt", () => {
    const s = suggestNext(brustpresse, [
      session("2026-10-02", 70, [8, 7, 7]),
      session("2026-09-28", 65, [10, 10, 10]),
    ]);
    expect(s).toMatchObject({ kind: "repeat", weightKg: 70, targetTotalReps: 23 });
  });

  it("zu wenige Sätze → keine Steigerung, auch wenn alle am oberen Ende sind", () => {
    const s = suggestNext(brustpresse, [session("2026-09-28", 65, [10, 10])]);
    expect(s).toMatchObject({ kind: "repeat", weightKg: 65 });
  });

  it("ohne Verlauf: Startgewicht, bzw. Kalibrierung wenn keins hinterlegt ist", () => {
    expect(suggestNext(brustpresse, [])).toMatchObject({ kind: "start", weightKg: 65 });
    const beinpresse = EXERCISES.find((e) => e.id === "beinpresse")!;
    expect(suggestNext(beinpresse, [])).toMatchObject({ kind: "calibrate", weightKg: null });
  });

  it("nach der Kalibrierung greift die Progression", () => {
    const beinpresse = EXERCISES.find((e) => e.id === "beinpresse")!;
    const s = suggestNext(beinpresse, [session("2026-09-29", 120, [10, 10, 10])]);
    expect(s).toMatchObject({ kind: "increase", weightKg: 130 });
  });

  it("kleine Steigerungsstufen ohne Rundungsfehler (6,25 kg + 1,25 kg)", () => {
    const seitheben = EXERCISES.find((e) => e.id === "seitheben-kabel")!;
    const s = suggestNext(seitheben, [session("2026-09-28", 6.25, [15, 15, 15])]);
    expect(s.weightKg).toBe(7.5);
  });
});

describe("Testfall 11: Stagnation", () => {
  // Ausgangseinheit + 3 Einheiten ohne Steigerung bei 75 kg
  const history = [
    session("2026-10-12", 75, [8, 7, 7]),
    session("2026-10-08", 75, [8, 7, 7]),
    session("2026-10-05", 75, [8, 7, 7]),
    session("2026-10-01", 75, [8, 7, 7]),
  ];

  it("75 kg × 0,9 = 67,5 kg → abgerundet auf die Steigerungsstufe 5 kg = 65 kg", () => {
    expect(resetWeight(75, 5)).toBe(65);
  });

  it("3× in Folge kein Fortschritt → Vorschlag 65 kg", () => {
    expect(stagnationStreak(history)).toBe(3);
    expect(stagnationAdvice(rudern, history)).toEqual({ level: "reduce", streak: 3, weightKg: 65 });
  });

  it("2× in Folge → Hinweis „Schlaf und Essen prüfen“", () => {
    expect(stagnationAdvice(rudern, history.slice(0, 3))).toEqual({ level: "check-recovery", streak: 2 });
  });

  it("mehr Gesamtwiederholungen unterbrechen die Serie", () => {
    // 21 → 22 Wdh. war Fortschritt, danach nur noch 1× gleich
    const withProgress = [
      session("2026-10-12", 75, [8, 7, 7]),
      session("2026-10-08", 75, [8, 7, 7]),
      session("2026-10-05", 75, [8, 7, 6]),
      session("2026-10-01", 75, [8, 7, 6]),
    ];
    expect(stagnationStreak(withProgress)).toBe(1);
  });

  it("Deload-Einheiten zählen nicht zur Serie", () => {
    const withDeload = [history[0], session("2026-10-10", 75, [8, 8], true), ...history.slice(1)];
    expect(stagnationStreak(withDeload)).toBe(3);
  });
});

describe("Testfall 12: Deload", () => {
  const history = [session("2026-10-05", 65, [10, 9, 8])];

  it("Brustpresse hat 2 Sätze (3 halbiert, aufgerundet) mit unverändertem Gewicht", () => {
    expect(deloadPrescription(brustpresse, history)).toEqual({ sets: 2, weightKg: 65, toFailure: false });
    expect(plannedSetCount(brustpresse, true)).toBe(2);
    expect(plannedSetCount(brustpresse, false)).toBe(3);
  });

  it("auch nach einer Einheit am oberen Ende wird im Deload nicht gesteigert", () => {
    expect(deloadPrescription(brustpresse, [session("2026-10-05", 65, [10, 10, 10])]).weightKg).toBe(65);
  });

  it("Deload-Werte beeinflussen die Progression nicht", () => {
    const before = suggestNext(brustpresse, history);
    // Im Deload viele Wiederholungen – dürfen keine Steigerung auslösen …
    const afterEasyDeload = suggestNext(brustpresse, [session("2026-10-26", 65, [10, 10], true), ...history]);
    // … und schwache Deload-Werte dürfen das Ziel nicht senken.
    const afterWeakDeload = suggestNext(brustpresse, [session("2026-10-26", 65, [5, 5], true), ...history]);
    expect(afterEasyDeload).toEqual(before);
    expect(afterWeakDeload).toEqual(before);
    expect(before).toMatchObject({ kind: "repeat", weightKg: 65, targetTotalReps: 28 });
  });
});

describe("Hilfsfunktionen", () => {
  it("Aufwärmsätze mit 50 % und 75 %, gerundet auf die Steigerungsstufe", () => {
    expect(warmupSets(70, 5)).toEqual([
      { weightKg: 35, reps: 10 },
      { weightKg: 55, reps: 6 },
    ]);
    expect(warmupSets(120, 10)).toEqual([
      { weightKg: 60, reps: 10 },
      { weightKg: 90, reps: 6 },
    ]);
    expect(warmupSets(null, 5)).toEqual([]);
  });

  it("Arbeitsgewicht = häufigstes Gewicht", () => {
    expect(workingWeight([{ weightKg: 65, reps: 10 }, { weightKg: 60, reps: 10 }, { weightKg: 65, reps: 8 }])).toBe(65);
  });

  it("Rundung auf Steigerungsstufen", () => {
    expect(roundToStep(67.5, 5, "down")).toBe(65);
    expect(roundToStep(70, 5, "down")).toBe(70);
    expect(roundToStep(8.1, 1.25, "down")).toBe(7.5);
  });

  it("Epley-1RM", () => {
    expect(estimatedOneRepMax(60, 10)).toBe(80);
    expect(estimatedOneRepMax(60, 0)).toBe(0);
  });
});

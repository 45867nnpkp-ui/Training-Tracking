// Übungen und Einheiten laut SPEC.md, Abschnitt 5. Wird beim Start in die
// Datenbank übernommen (prisma/seed.ts); danach gelten die Werte aus der DB.

export type SessionType = "UPPER" | "LOWER";

export interface CatalogExercise {
  id: string;
  name: string;
  category: SessionType;
  isCompound: boolean;
  sets: number;
  repMin: number;
  repMax: number;
  restMinSec: number;
  restMaxSec: number;
  incrementKg: number;
  startWeightKg: number | null;
  setupNote: string;
  hint: string;
  isBonus: boolean;
  mainExerciseId: string | null;
  alternativePriority: number | null;
}

const LONG_REST = { restMinSec: 120, restMaxSec: 180 }; // 2–3 min
const SHORT_REST = { restMinSec: 60, restMaxSec: 90 }; // 60–90 s

function ex(e: Partial<CatalogExercise> & Pick<CatalogExercise, "id" | "name" | "category" | "sets" | "repMin" | "repMax" | "restMinSec" | "restMaxSec" | "incrementKg">): CatalogExercise {
  return {
    isCompound: false,
    startWeightKg: null,
    setupNote: "",
    hint: "",
    isBonus: false,
    mainExerciseId: null,
    alternativePriority: null,
    ...e,
  };
}

export const EXERCISES: CatalogExercise[] = [
  // Oberkörper (5.1)
  ex({ id: "brustpresse", name: "Brustpresse", category: "UPPER", isCompound: true, sets: 3, repMin: 6, repMax: 10, ...LONG_REST, startWeightKg: 65, incrementKg: 5, setupNote: "Stufe 2" }),
  ex({ id: "seitheben-kabel", name: "Seitheben Kabelzug", category: "UPPER", sets: 3, repMin: 12, repMax: 15, ...SHORT_REST, startWeightKg: 6.25, incrementKg: 1.25, setupNote: "Stufe 16, Bandage" }),
  ex({ id: "latzug-breit", name: "Latzug breit", category: "UPPER", isCompound: true, sets: 3, repMin: 8, repMax: 12, ...LONG_REST, startWeightKg: 50, incrementKg: 5, setupNote: "breiter Griff", hint: "Startgewicht ist ein Schätzwert" }),
  ex({ id: "flys-maschine", name: "Flys (Butterfly-Maschine)", category: "UPPER", sets: 2, repMin: 12, repMax: 15, ...SHORT_REST, incrementKg: 5 }),
  ex({ id: "rudern-breit", name: "Breites Rudern Maschine", category: "UPPER", isCompound: true, sets: 3, repMin: 6, repMax: 10, ...LONG_REST, startWeightKg: 75, incrementKg: 5 }),
  ex({ id: "trizeps-seil", name: "Trizepsdrücken Kabel (Seil)", category: "UPPER", sets: 2, repMin: 10, repMax: 15, ...SHORT_REST, startWeightKg: 12.5, incrementKg: 1.25, setupNote: "langes Seil" }),
  ex({ id: "preacher-curls", name: "Preacher Curls", category: "UPPER", sets: 2, repMin: 10, repMax: 15, ...SHORT_REST, startWeightKg: 27.5, incrementKg: 2.5 }),
  ex({ id: "reverse-butterfly", name: "Reverse Butterfly", category: "UPPER", sets: 2, repMin: 12, repMax: 15, ...SHORT_REST, incrementKg: 5, isBonus: true, hint: "Bonus: nur wenn Zeit & Maschine frei" }),

  // Ausweichübungen (5.3) – eigene Übungen mit eigenem Verlauf
  ex({ id: "schraegbank-multipresse", name: "Schrägbankdrücken Multipresse", category: "UPPER", isCompound: true, sets: 3, repMin: 6, repMax: 10, ...LONG_REST, incrementKg: 2.5, hint: "+10 kg Stange, pausierte Wdh.", mainExerciseId: "brustpresse", alternativePriority: 1 }),
  ex({ id: "kabel-flys", name: "Kabel-Flys", category: "UPPER", sets: 2, repMin: 12, repMax: 15, ...SHORT_REST, incrementKg: 1.25, mainExerciseId: "flys-maschine", alternativePriority: 1 }),
  ex({ id: "kh-flys-flachbank", name: "Kurzhantel-Flys Flachbank", category: "UPPER", sets: 2, repMin: 12, repMax: 15, ...SHORT_REST, incrementKg: 2, mainExerciseId: "flys-maschine", alternativePriority: 2 }),
  ex({ id: "kh-reverse-flys", name: "Kurzhantel-Reverse-Flys bäuchlings Schrägbank", category: "UPPER", sets: 2, repMin: 12, repMax: 15, ...SHORT_REST, incrementKg: 2, mainExerciseId: "reverse-butterfly", alternativePriority: 1 }),
  ex({ id: "reverse-flys-kabel", name: "Reverse Flys am Kabel", category: "UPPER", sets: 2, repMin: 12, repMax: 15, ...SHORT_REST, incrementKg: 1.25, mainExerciseId: "reverse-butterfly", alternativePriority: 2 }),

  // Beine (5.2)
  ex({ id: "beinbeuger-liegend", name: "Beinbeuger liegend", category: "LOWER", sets: 2, repMin: 10, repMax: 12, ...SHORT_REST, incrementKg: 5 }),
  ex({ id: "beinpresse", name: "Beinpresse", category: "LOWER", isCompound: true, sets: 3, repMin: 6, repMax: 10, ...LONG_REST, incrementKg: 10 }),
  ex({ id: "rumaenisches-kreuzheben", name: "Rumänisches Kreuzheben", category: "LOWER", isCompound: true, sets: 3, repMin: 6, repMax: 10, ...LONG_REST, incrementKg: 2.5 }),
  ex({ id: "beinstrecker", name: "Beinstrecker", category: "LOWER", sets: 2, repMin: 12, repMax: 15, ...SHORT_REST, incrementKg: 5 }),
  ex({ id: "wadenheben-stehend", name: "Wadenheben stehend", category: "LOWER", sets: 3, repMin: 10, repMax: 15, ...SHORT_REST, incrementKg: 5 }),
];

export const TEMPLATES: Record<SessionType, string[]> = {
  UPPER: ["brustpresse", "seitheben-kabel", "latzug-breit", "flys-maschine", "rudern-breit", "trizeps-seil", "preacher-curls", "reverse-butterfly"],
  LOWER: ["beinbeuger-liegend", "beinpresse", "rumaenisches-kreuzheben", "beinstrecker", "wadenheben-stehend"],
};

export const SESSION_LABEL: Record<SessionType, string> = {
  UPPER: "Oberkörper",
  LOWER: "Beine",
};

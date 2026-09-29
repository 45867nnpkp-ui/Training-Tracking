# Training-Tracking

Persönliche Trainings-App (PWA) nach [`Spec.md`](./Spec.md): Training im
Gym Satz für Satz loggen, auch offline, mit automatischer Progression.

**Stand: Phase 1 (Kern)**
- Login mit Passwort, 90 Tage eingeloggt bleiben
- Oberkörper- und Beine-Einheit mit allen Übungen aus der Spec
- Training loggen: Gewicht und Wiederholungen vorbefüllt, RIR/Versagen, Notizen
- Offline-fähig: Loggen ohne Netz, automatisches Hochladen danach
- Vorwerte, doppelte Progression, Aufwärmsätze, Pausentimer
- „Maschine besetzt“, Ausweichübungen (eigener Verlauf), „Übung überspringen“
- Deload-Einheit (manuell), Verlauf pro Übung mit Diagramm und 1RM

Deployment: siehe [`DEPLOY.md`](./DEPLOY.md).

Technik: Next.js, TypeScript, Tailwind CSS, Postgres mit Prisma, Vitest.
Die Progressionslogik steht in `src/lib/training/progression.ts`, die Tests in
`src/lib/training/*.test.ts` (`npm test`).

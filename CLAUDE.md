# Hinweise für Claude Code

Persönliche Trainings-App nach `Spec.md`. Der Nutzer programmiert nicht selbst:
Entscheidungen treffen, kurz auf Deutsch erklären, ihm nur Klick-Anleitungen geben.

- UI-Sprache Deutsch, Einheiten kg/cm, Zeitzone Europe/Berlin (`src/lib/format.ts`).
- Umsetzung in Phasen (Spec.md, Abschnitt 11). Nach jeder Phase: PR + Zusammenfassung,
  was er testen soll. Phase 1 (Kern) ist fertig.
- Plan-/Progressionslogik als reine Funktionen in `src/lib/training/` mit Vitest-Tests
  (`npm test`). Testfälle aus Spec.md, Abschnitt 12, müssen als Tests existieren.
- Offline-first: Die App ist eine Seite (`src/components/App.tsx`). Zustand in IndexedDB
  (`src/client/`), Änderungen über die Outbox (`src/client/outbox.ts`) zum Server.
  Server-Endpunkte müssen idempotent sein (Client-UUIDs).
- Datenbank: Prisma/Postgres (`prisma/schema.prisma`). Schemaänderungen immer als
  Migration (`npx prisma migrate dev --name ...`). `prisma/seed.ts` legt nur Fehlendes an.
- Hosting: Render (`render.yaml`, `DEPLOY.md`). Secrets nur als Umgebungsvariablen.
- Vor jedem Push: `npm run typecheck && npm test && npm run build`.

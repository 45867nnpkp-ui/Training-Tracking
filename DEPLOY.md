# Deployment auf Render

Die App läuft auf **Render**, genau wie das Alltags-Dashboard. Die Datei
`render.yaml` legt beim ersten Mal alles automatisch an: die Datenbank
(Postgres) und den Web Service.

## Einmalig einrichten (ca. 10 Minuten)

1. Auf [render.com](https://render.com) mit deinem GitHub-Account anmelden.
2. **„New +“ → „Blueprint“** wählen und das Repository `training-tracking`
   verbinden. Als Branch `main` auswählen (erst nachdem der Pull Request
   gemergt ist).
3. Render zeigt zwei Ressourcen an: `training-db` (Datenbank) und
   `training-tracking` (die App). Render fragt nach **`APP_PASSWORD`**:
   Trag hier das Passwort ein, mit dem du dich in der App einloggen willst.
4. Auf **„Apply“** klicken. Nach ein paar Minuten läuft die App unter einer
   Adresse wie `https://training-tracking.onrender.com`.

## Umgebungsvariablen

| Variable | Woher? | Musst du etwas tun? |
|---|---|---|
| `APP_PASSWORD` | dein Login-Passwort | **Ja**, einmal beim Anlegen eintragen |
| `DATABASE_URL` | kommt automatisch aus der Datenbank `training-db` | Nein |
| `SESSION_SECRET` | erzeugt Render automatisch (zufälliger Wert) | Nein |
| `NODE_VERSION` | steht in `render.yaml` (22) | Nein |

Ändern kannst du sie später im Render-Dashboard → `training-tracking` →
„Environment“. Wenn du `SESSION_SECRET` änderst, musst du dich neu einloggen.

## Aufs iPhone holen

1. Die Render-Adresse in **Safari** öffnen.
2. Teilen-Symbol → **„Zum Home-Bildschirm“**.
3. Die App **vom Home-Bildschirm aus** öffnen und dort einloggen. Die
   Home-Bildschirm-App hat ihren eigenen Speicher, getrennt von Safari, daher
   ist ein Login in Safari dort nicht gültig.
4. Die App einmal **mit Internet** öffnen. Danach funktioniert das Loggen
   im Gym auch ohne Netz, die Daten werden später automatisch hochgeladen.

Tipp: Vor dem ersten Training im Gym einmal kurz Flugmodus an und die App
öffnen, um zu sehen, dass sie offline startet.

## Wichtig: Kosten und Grenzen des kostenlosen Tarifs

- **Kostenlose Datenbank läuft nach 30 Tagen ab.** Render löscht kostenlose
  Postgres-Datenbanken nach 30 Tagen, **deine Trainingsdaten wären dann
  weg**. Vorher im Render-Dashboard bei `training-db` auf einen bezahlten
  Plan upgraden (kleinster Plan, ein paar Euro im Monat). Das Ablaufdatum
  steht im Dashboard bei der Datenbank.
- **Nur eine kostenlose Datenbank pro Account.** Falls dein Alltags-Dashboard
  schon die kostenlose Datenbank nutzt, bricht der Blueprint mit einem
  Fehler ab. Dann in `render.yaml` bei `training-db` `plan: free` durch
  `plan: basic-256mb` ersetzen (kostenpflichtig) und erneut anwenden.
- **Die App schläft ein.** Im kostenlosen Tarif schläft der Server nach 15
  Minuten ohne Nutzung. Der erste Aufruf dauert dann 30–60 Sekunden. Das
  Loggen funktioniert trotzdem sofort, weil die App auf dem Handy offline
  arbeitet und im Hintergrund synchronisiert.

## Was passiert bei jedem Deploy?

Render baut die App bei jedem neuen Commit auf `main` neu. Beim Start
laufen automatisch:

1. `prisma migrate deploy`: legt die Datenbank-Tabellen an bzw. aktualisiert sie.
2. `prisma/seed.ts`: trägt die Übungen aus SPEC.md ein, **nur wenn sie
   fehlen**. Deine Änderungen (z. B. Maschinen-Notizen) bleiben erhalten.
3. Die App startet.

## Lokal entwickeln (optional)

```bash
cp .env.example .env        # Werte anpassen, Postgres muss laufen
npm install
npx prisma migrate dev      # Tabellen anlegen
npm run db:seed             # Übungen eintragen
npm run dev                 # http://localhost:3000
npm test                    # automatische Tests
```

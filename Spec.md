# Spezifikation: Persönliche Trainings-App (PWA)

> **Anweisung an Claude Code:** Baue die hier beschriebene App vollständig nach dieser Spezifikation. Arbeite in den unter „Umsetzungsphasen“ genannten Schritten, jede Phase lauffähig und deploybar. Wenn etwas unklar ist, frag nach, bevor du größere Annahmen triffst. Die Planlogik (Wochen A/B, Slots, Umplanung, Progression) ist das Herzstück – schreibe dafür automatisierte Tests mit den Testfällen am Ende dieses Dokuments.

---

## 1. Ziel & Kontext

Ein einzelner Nutzer (Lukas, 18, Schüler, Duisburg) trainiert 4× pro Woche im Gym nach einem festen Plan: **Oberkörper** und **Beine**, jeweils 2× pro Woche, immer im Wechsel. Sein Alltag ist eng getaktet (Schule mit A/B-Wochen, Minijob, Freistunden). Die App soll:

1. jeden Tag zeigen, **ob und wann** trainiert wird und welche Einheit dran ist,
2. das Training im Gym **Satz für Satz loggen** (schnell, einhändig, auch offline),
3. die **Progression automatisch steuern** (wann Gewicht erhöhen, Stagnation, Deload),
4. per **Live-Zugriff auf seine Kalender** Konflikte erkennen und das Training **automatisch umplanen** (mit Bestätigung),
5. Körpergewicht und Bauchumfang tracken.

Sprache der gesamten UI: **Deutsch**. Einheiten: **kg, cm**. Zeitzone: **Europe/Berlin**.

---

## 2. Technik

- **Plattform:** Progressive Web App (PWA), mobile-first, auf dem iPhone über „Zum Home-Bildschirm“ installierbar. Kein App Store, kein Mac nötig.
- **Stack (Vorschlag):** Next.js (App Router) + TypeScript + Tailwind CSS, Postgres mit Prisma. Deployment auf derselben Plattform wie mein bestehendes Projekt „Alltags-Dashboard“ (Postgres, damit Daten Redeploys überleben).
- **Offline-first im Gym:** Das Loggen eines Trainings muss ohne Netz funktionieren (Service Worker + IndexedDB). Einträge werden in eine lokale Warteschlange geschrieben und automatisch synchronisiert, sobald wieder Netz da ist. Der Trainingsplan des Tages wird vorab gecacht.
- **Login:** Einzelnutzer. Passwort aus Umgebungsvariable (`APP_PASSWORD`), langlebige Session per httpOnly-Cookie (90 Tage), damit ich mich auf dem Handy nicht ständig einloggen muss.
- **Push-Benachrichtigungen:** Web Push (VAPID). Hinweis: Funktioniert auf dem iPhone nur, wenn die PWA auf dem Home-Bildschirm installiert ist (iOS 16.4+). Beim ersten Start einen kurzen Hinweis dazu anzeigen.
- **Design:** Dark Mode als Standard, große Touch-Flächen (Eingaben im Gym mit schwitzigen Händen), große Zahlen, minimale Tipperei (vorbefüllte Werte, +/- Buttons).
- **Secrets:** Kalender-URLs, Passwort, VAPID-Keys nur als Umgebungsvariablen, nie an den Client ausliefern, nie ins Repo committen.

---

## 3. Stundenplan & feste Termine

### 3.1 Stundenzeiten

| Block | Zeit |
|---|---|
| 1./2. Stunde | 08:00–09:30 |
| 3./4. Stunde | 09:55–11:25 |
| 5./6. Stunde | 11:45–13:15 |
| Mittagspause | 13:15–14:15 |
| 8./9. Stunde | 14:15–15:45 |
| 10./11. Stunde | 15:55–17:25 |

### 3.2 A/B-Wochen

- **Woche A** = KW 40/2026 (28.09.–04.10.2026), **Woche B** = KW 41/2026.
- Standardregel: gerade Kalenderwoche = A, ungerade = B.
- Es muss eine **manuelle Übersteuerung** geben („Diese Woche ist A/B“), weil die Zählung nach Ferien abweichen kann. Nach jeden Ferien fragt die App in der ersten Schulwoche einmal nach: „Ist diese Woche A oder B?“

### 3.3 Stundenplan (belegte Blöcke; „frei“ = Freistunde)

**Woche A**

| Tag | 1/2 | 3/4 | 5/6 | 8/9 | 10/11 | Schulende |
|---|---|---|---|---|---|---|
| Mo | PHY | ENG | **frei** | INF | SPO (Schulsport) | 17:25 |
| Di | **frei** | MAT | **frei** | DEU | – | 15:45 |
| Mi | GEO | INF | MUS | – | – | 13:15 → Arbeit |
| Do | DEU | MAT | SOZ | ENG | MUS | 17:25 |
| Fr | SOZ | ENG | GEO | GES | – | 15:45 |

**Woche B**

| Tag | 1/2 | 3/4 | 5/6 | 8/9 | 10/11 | Schulende |
|---|---|---|---|---|---|---|
| Mo | PHY | GEO | ENG | GES | SPO (Schulsport) | 17:25 |
| Di | **frei** | **frei** | PHY | GEO | – | 15:45 |
| Mi | MUS | INF | **frei** | SOZ | – | 15:45 |
| Do | SPO (Schulsport) | DEU | GES | – | – | 13:15 → Arbeit |
| Fr | MAT | ENG | GEO | – | – | 13:15 → Arbeit |

Der Stundenplan muss in der App **editierbar** sein (Einstellungen), weil er sich zum Halbjahr ändert.

### 3.4 Arbeit (Minijob)

- **Regel:** An jedem Schultag, an dem die Schule um 13:15 endet, arbeite ich von ca. 13:30 bis 18:00. Diese Tage sind trainingsfrei.
- **Samstag:** konfigurierbar über einen Schalter in den Einstellungen:
  - `samstagArbeitBis = 18:00` (aktueller Stand) → Samstag trainingsfrei
  - `samstagArbeitBis = 14:00` (geplant) → Samstag ab ca. 15:00 trainierbar
- Die Arbeitszeiten stehen **nicht** im Kalender; sie werden aus dieser Regel abgeleitet.

### 3.5 Ferien & Feiertage

- Ferien werden aus dem Kalender erkannt: ganztägige Termine, deren Titel „Ferien“ enthält (z. B. „Herbstferien NRW“, 17.–31.10.2026).
- Gesetzliche Feiertage (aus den Feiertags-Kalendern) gelten als schulfrei.
- In den Ferien gilt der **Ferienplan** (siehe 4.3).

---

## 4. Wochenplan (Standard-Slots)

### 4.1 Gym-Logistik (alles konfigurierbar)

- Fahrzeit Schule/Zuhause ↔ Gym: **15 Min** pro Strecke.
- **Freistunden-Slot (5./6. Stunde):** frei ab 11:25, **Abfahrt 11:35**, Ankunft ca. 11:50, Trainingsbeginn ca. 11:55.
  - **Hartes Trainingsende 13:15** an Montag und Dienstag (danach nach Hause duschen und um 14:15 zurück in der Schule).
  - **Mittwoch:** kein hartes Ende um 13:15, spätestens 13:45 fertig.
- **Nachmittags-Slot:** Schulende 15:45 → Trainingsbeginn ca. 16:05.
- **Samstag nach der Arbeit** (nur bei `samstagArbeitBis = 14:00`): Trainingsbeginn ca. 15:00.
- **Sonntag:** Standardbeginn 11:00 (frei verschiebbar).
- Öffnungszeiten des Gyms als Einstellung (Standard: täglich 06:00–22:00).

### 4.2 Standardplan

**Variante „Samstag bis 18 Uhr“ (aktuell aktiv)**

| Tag | Woche A | Woche B |
|---|---|---|
| Mo | Oberkörper (Freistunde) | Oberkörper (abends, ca. 17:45, nach Schulsport) |
| Di | Beine (Freistunde) | Beine (ab 15:45) |
| Mi | – (Arbeit) | Oberkörper (Freistunde) |
| Do | – | – (Arbeit) |
| Fr | Oberkörper (ab 15:45) | – (Arbeit) |
| Sa | – (Arbeit) | – (Arbeit) |
| So | Beine | Beine |

**Variante „Samstag bis 14 Uhr“ (Zielzustand)**

| Tag | Woche A | Woche B |
|---|---|---|
| Mo | Oberkörper (Freistunde) | – (Schulsport) |
| Di | Beine (Freistunde) | Oberkörper (ab 15:45) |
| Mi | – (Arbeit) | Beine (Freistunde) |
| Do | – | – (Arbeit) |
| Fr | Oberkörper (ab 15:45) | – (Arbeit) |
| Sa | Beine (nach der Arbeit) | Oberkörper (nach der Arbeit) |
| So | frei | Beine |

Die App wählt die Variante anhand des Schalters `samstagArbeitBis`.

### 4.3 Ferienplan

Mo Oberkörper, Di Beine, Do Oberkörper, Fr Beine (Trainingsbeginn Standard 10:00). Samstag gemäß Arbeitsregel.

### 4.4 Ausweich-Slots (nur für Umplanung)

Zusätzliche freie Zeitfenster, die nicht im Standardplan genutzt werden:

- Woche A, Di: 1./2. Stunde frei (08:00–09:55) → Slot 08:00–09:40
- Woche B, Di: 1.–4. Stunde frei (08:00–11:45) → Slot 08:15–10:15
- Woche B, Mi: nach Schulende ab 15:45
- Woche A, Do: nach Schulende ab 17:25 (Beginn ca. 17:45)
- Woche A, Mo: abends ab 17:45
- Sonntag (wenn nicht belegt)
- Alle Tage in den Ferien außer Arbeitstagen

---

## 5. Trainingsinhalte

### 5.1 Oberkörper (Reihenfolge fest)

| # | Übung | Sätze | Wdh. | Pause | Start | Steigerung | Notiz / Einstellung |
|---|---|---|---|---|---|---|---|
| 1 | Brustpresse | 3 | 6–10 | 2–3 min | 65 kg | 5 kg | Stufe 2 |
| 2 | Seitheben Kabelzug | 3 | 12–15 | 60–90 s | 6,25 kg | 1,25 kg | Stufe 16, Bandage |
| 3 | Latzug breit | 3 | 8–12 | 2–3 min | 50 kg (Schätzwert) | 5 kg | breiter Griff |
| 4 | Flys (Butterfly-Maschine) | 2 | 12–15 | 60–90 s | – (kalibrieren) | 5 kg | |
| 5 | Breites Rudern Maschine | 3 | 6–10 | 2–3 min | 75 kg | 5 kg | |
| 6 | Trizepsdrücken Kabel (Seil) | 2 | 10–15 | 60–90 s | 12,5 kg | 1,25 kg | langes Seil |
| 7 | Preacher Curls | 2 | 10–15 | 60–90 s | 27,5 kg | 2,5 kg | |
| Bonus | Reverse Butterfly | 2 | 12–15 | 60–90 s | – | 5 kg | nur wenn Zeit & Maschine frei |

**Hinweise für die Logik:**
- Übung 4 (Flys) steht bewusst zwischen den beiden Rückenübungen (Erholung für den Rücken).
- Übung 2 (Seitheben) steht bewusst früh (Priorität: seitliche Schulter).
- Ist die Butterfly-Maschine besetzt, darf die App per Button „Maschine besetzt“ die Reihenfolge tauschen (Flys nach hinten, nächste Übung vor).

### 5.2 Beine (Reihenfolge fest)

| # | Übung | Sätze | Wdh. | Pause | Start | Steigerung |
|---|---|---|---|---|---|---|
| 1 | Beinbeuger liegend | 2 | 10–12 | 60–90 s | – (kalibrieren) | 5 kg |
| 2 | Beinpresse | 3 | 6–10 | 2–3 min | – (kalibrieren) | 10 kg |
| 3 | Rumänisches Kreuzheben | 3 | 6–10 | 2–3 min | – (kalibrieren) | 2,5 kg |
| 4 | Beinstrecker | 2 | 12–15 | 60–90 s | – (kalibrieren) | 5 kg |
| 5 | Wadenheben stehend | 3 | 10–15 | 60–90 s | – (kalibrieren) | 5 kg |

„Kalibrieren“: Bei der ersten Einheit gibt es keinen Gewichtsvorschlag, ich trage das Gewicht selbst ein; ab der zweiten Einheit greift die Progressionslogik.

### 5.3 Ausweichübungen

Jede Ausweichübung wird als **eigene Übung mit eigenem Verlauf** geloggt (damit die Progression sauber bleibt), ist aber mit der Hauptübung verknüpft.

| Hauptübung | Ausweichübung(en) in Priorität |
|---|---|
| Brustpresse | Schrägbankdrücken Multipresse (+10 kg Stange, pausierte Wdh.) |
| Flys (Maschine) | 1. Kabel-Flys, 2. Kurzhantel-Flys Flachbank |
| Reverse Butterfly | 1. Kurzhantel-Reverse-Flys bäuchlings Schrägbank, 2. Reverse Flys am Kabel |

**Ausschluss:** Keine Übungen mit Drücken über Kopf (Schulterproblem). Übungsbibliothek darf solche Übungen nicht vorschlagen.

### 5.4 Aufwärmen

- Vor jeder Einheit: Hinweis „5 Min Cardio“.
- Erste Grundübung der Einheit (Oberkörper: Brustpresse; Beine: Beinpresse): 2 automatisch berechnete Aufwärmsätze mit ca. 50 % und 75 % des Arbeitsgewichts (gerundet auf die Steigerungsstufe). Aufwärmsätze werden markiert und zählen nicht für die Progression.

---

## 6. Trainingsregeln & Progressionslogik

### 6.1 Intensität
- Alle Arbeitssätze mit 1–2 Wiederholungen Reserve (RIR), **der letzte Satz jeder Übung bis zum Muskelversagen**.
- Pro Satz optional eingeben: „Versagen erreicht“ (Checkbox) bzw. RIR 0/1/2/3.

### 6.2 Gleiches Gewicht
- Innerhalb einer Übung wird für alle Arbeitssätze **dasselbe Gewicht** vorgeschlagen. Wenn ich das Gewicht zwischen Sätzen ändere, zeigt die App einen dezenten Hinweis („Gewicht innerhalb der Übung konstant halten“), erlaubt es aber.

### 6.3 Doppelte Progression
- Wenn in der letzten Einheit einer Übung **alle Arbeitssätze** das **obere Ende** des Wiederholungsbereichs erreicht haben → nächstes Mal Gewicht + Steigerungsstufe.
- Sonst: gleiches Gewicht, Ziel = insgesamt mindestens eine Wiederholung mehr als letztes Mal. Die App zeigt pro Satz die Vorwerte als Zielmarke („Letztes Mal: 65 × 8 / 6 / 6“).

### 6.4 Stagnation
- Eine Einheit gilt als „kein Fortschritt“, wenn weder Gewicht noch Gesamtwiederholungen der Arbeitssätze gegenüber der vorherigen Einheit dieser Übung gestiegen sind.
- **2× in Folge kein Fortschritt:** Hinweis „Schlaf und Essen prüfen“.
- **3× in Folge:** Vorschlag, das Gewicht um 10 % zu reduzieren (abgerundet auf ein Vielfaches der Steigerungsstufe) und neu aufzubauen. Ich muss bestätigen.

### 6.5 Deload
- Standard alle **7 Wochen** (einstellbar 6–8) oder manuell auslösbar.
- Deload-Woche: Satzzahl halbiert (aufgerundet), gleiches Gewicht, kein Satz bis Versagen. Deload-Sätze zählen nicht für die Progression.
- Die App schlägt vor, einen Deload in die Ferien zu legen, wenn dieser zeitlich passt.

### 6.6 Zeitbudget im Training
- Die App schätzt die Restdauer der Einheit: offene Sätze × (Pausenzeit + 45 s).
- Bei Slots mit hartem Ende (Freistunde Mo/Di, Ende 13:15): Wenn die geschätzte Restdauer das Ende überschreitet, erscheint ein Hinweis: „Letzte Übung weglassen“. Gestrichen wird immer von hinten, nie die erste Übung.
- Push-Benachrichtigung um 12:55 an Freistunden-Trainingstagen: „Noch 20 Minuten“.

### 6.7 Testphase
- Plan-Startdatum wird gespeichert. Nach **10 Wochen** erscheint ein Auswertungsbildschirm: Verlauf aller Übungen (Gewicht/Wdh.), Körpergewichtsverlauf, Anzahl absolvierter vs. geplanter Einheiten.

---

## 7. Kalender-Integration (Live-Zugriff) & automatische Umplanung

### 7.1 Kalenderquellen
Nur lesender Zugriff über **iCal/ICS-Abonnement-URLs** (einfach, ohne OAuth):

1. Google Kalender (`kellerlukas144@gmail.com`) über die **„Privatadresse im iCal-Format“** → Umgebungsvariable `CAL_GOOGLE_ICS_URL`
2. iCloud-Kalender „Privat“ über einen **öffentlichen Freigabe-Link** (webcal → https) → `CAL_ICLOUD_ICS_URL`
3. Beliebig weitere URLs über `CAL_EXTRA_ICS_URLS` (kommagetrennt)

- Der Server lädt alle Quellen **alle 15 Minuten** neu (plus manueller „Jetzt aktualisieren“-Button) und cacht sie. Wiederkehrende Termine (RRULE) und Zeitzonen müssen korrekt aufgelöst werden (z. B. mit `node-ical` oder `ical.js`).
- Duplikate (derselbe Termin in mehreren Kalendern, z. B. DB-Telefonat) werden anhand Titel + Startzeit zusammengeführt.
- Die Kalender-URLs sind geheim: nur serverseitig verwenden.

### 7.2 Was blockiert
- Termine mit Status „busy“ blockieren den Zeitraum **inklusive 15 Min Fahrpuffer davor und danach**.
- Termine mit Status „free“ (z. B. Feiertage, Ferien-Hinweise) blockieren nicht, werden aber für Ferien/Feiertags-Erkennung ausgewertet.
- Ganztägige „busy“-Termine blockieren den ganzen Tag.
- Zusätzlich blockieren die abgeleiteten Schul- und Arbeitszeiten (Abschnitt 3).

### 7.3 Umplanungsregeln (Kern der Logik)
Die App plant jeweils die **laufende und die nächste Woche**. Grundlage ist der Standardplan (4.2 bzw. 4.3). Kollidiert ein geplanter Slot mit einem blockierenden Termin, sucht die App einen Ersatz nach diesen harten Regeln:

1. **Wechsel bleibt erhalten:** Einheiten laufen immer abwechselnd Oberkörper → Beine → Oberkörper → Beine (fortgesetzt ab der zuletzt **absolvierten** Einheit).
2. **Mindestabstand:** Zwischen zwei Einheiten desselben Typs liegen mindestens 2 Kalendertage (z. B. Oberkörper Mo → frühestens wieder Mi).
3. **Max. 1 Einheit pro Tag**, **max. 4 pro Woche**.
4. **Keine Beineinheit an Tagen mit Schulsport** (Mo in A und B, Do in B).
5. **Keine Einheit an Arbeitstagen.**
6. **Nicht nachholen:** Eine ausgefallene Einheit wird nie zusätzlich an einem Tag mit einer anderen Einheit nachgeholt.
7. Kandidaten-Slots: zuerst **Standard-Slots anderer Tage**, dann **Ausweich-Slots** (4.4). Bevorzugt wird der Slot, der dem ursprünglichen Termin zeitlich am nächsten liegt.
8. Findet sich kein gültiger Slot → Einheit entfällt; die nächste Einheit ist dann die ausgefallene (Wechsel bleibt korrekt). Die Woche hat dann 3 Einheiten, das ist ausdrücklich okay.

**Wichtig:** Umplanungen werden **nicht still** durchgeführt. Die App zeigt einen Vorschlag („Termin X kollidiert mit Beine am Di. Vorschlag: Mi 15:45“) mit den Buttons **Übernehmen** / **Anderen Slot wählen** / **Ausfallen lassen**, und schickt dazu eine Push-Benachrichtigung.

### 7.4 Klausurphasen
- Manueller Schalter „Klausurphase“ (mit Enddatum): Die App plant dann max. 3 Einheiten pro Woche und lässt bevorzugt die Sonntagseinheit weg.

### 7.5 Training in den eigenen Kalender (Export)
- Die App stellt einen **eigenen ICS-Feed** mit allen geplanten Trainings bereit (geheime URL mit Token), den ich im iPhone-Kalender abonnieren kann. So sehe ich Trainings direkt neben meinen anderen Terminen. Umplanungen erscheinen dort automatisch.

---

## 8. Bildschirme

1. **Heute**
   - Welche Einheit heute (oder „Ruhetag“ / „Arbeitstag“ / „Schulsport“), Uhrzeit, Slot-Typ.
   - An Freistunden-Tagen: „Abfahrt 11:35 – Training bis spätestens 13:15“.
   - Hinweis auf offene Umplanungsvorschläge.
   - Button „Training starten“.
2. **Training (aktive Einheit)**
   - Eine Übung pro Ansicht, wischbar. Sätze als Liste: Gewicht (vorbefüllt), Wdh. (vorbefüllt mit Vorwerten als Platzhalter), RIR/Versagen, Notiz.
   - Vorwerte der letzten Einheit sichtbar, Ziel für heute hervorgehoben (z. B. „+2,5 kg!“ oder „Ziel: 9 / 7 / 7“).
   - Maschineneinstellungen als dauerhafte Notiz pro Übung (z. B. „Stufe 2“), bei jeder Einheit angezeigt.
   - **Pausentimer** startet automatisch nach Abhaken eines Satzes (Dauer je nach Übung), mit Vibration und Push, wenn die App im Hintergrund ist.
   - Buttons: „Maschine besetzt“ (Reihenfolge tauschen), „Ausweichübung“, „Übung überspringen“.
   - Zeitbudget-Anzeige mit Warnung (6.6).
   - Abschluss-Screen: Dauer, Sätze, persönliche Rekorde, Vorschau der Vorschläge für die nächste Einheit.
3. **Wochenplan**
   - Laufende und nächste Woche mit A/B-Kennzeichnung, geplanten Einheiten, Kalenderkonflikten, Arbeit/Schulsport.
   - Einheiten manuell verschiebbar; die App prüft die Regeln aus 7.3 und warnt bei Verstößen.
4. **Verlauf & Statistik**
   - Pro Übung: Diagramm Gewicht × Wdh. sowie geschätztes 1RM (Epley) über die Zeit, Tabelle aller Einheiten.
   - Liste aller vergangenen Trainings.
5. **Körper**
   - Tägliches Gewicht eintragen, Anzeige des 7-Tage-Durchschnitts und der Wochenveränderung in % (Zielkorridor −0,5 % bis −1 % pro Woche während der Diät; Phase umschaltbar auf „Aufbau“ mit Zielkorridor +0,25 % bis +0,5 %).
   - Bauchumfang alle 2 Wochen (Erinnerung).
   - Erinnerung an Fortschrittsfotos alle 4 Wochen (Fotos **nicht** in der App speichern, nur Erinnerung).
6. **Einstellungen**
   - Stundenplan A/B editieren, A/B-Übersteuerung, `samstagArbeitBis`, Fahrzeit, Gym-Öffnungszeiten, Kalender-Status (letzte Aktualisierung, Fehler), Deload-Intervall, Steigerungsstufen pro Übung, Übungen/Reihenfolge bearbeiten, Push an/aus, Datenexport als CSV/JSON.

---

## 9. Benachrichtigungen (Web Push)

| Wann | Text |
|---|---|
| Vorabend eines Freistunden-Trainings, 20:00 | „Morgen Training in der Freistunde – Tasche packen.“ |
| Am Freistunden-Tag, 11:20 | „In 15 Min losfahren (Beine/Oberkörper).“ |
| 12:55 während Freistunden-Training | „Noch 20 Minuten – ggf. letzte Übung weglassen.“ |
| Kalenderkonflikt erkannt | „Konflikt mit [Termin] – Umplanung ansehen.“ |
| Pausentimer abgelaufen (App im Hintergrund) | „Nächster Satz: [Übung]“ |
| Deload fällig / Stagnation 3× | entsprechender Hinweis |

Alle Benachrichtigungstypen einzeln abschaltbar.

---

## 10. Datenmodell (Vorschlag)

- `Exercise` (id, name, kategorie [oberkörper/beine], istGrundübung, sätze, wdhMin, wdhMax, pauseSek, steigerungKg, startgewichtKg?, einstellungsNotiz, hauptübungId? [für Ausweichübungen], aktiv, reihenfolge)
- `SessionTemplate` (typ [OBERKÖRPER/BEINE], geordnete Liste von Exercise-IDs)
- `PlannedSession` (datum, typ, slotStart, slotEnde, hartesEnde?, quelle [standard/ferien/umgeplant/manuell], status [geplant/verschoben/ausgefallen/erledigt], ursprünglichesDatum?)
- `Workout` (id, plannedSessionId?, typ, start, ende, istDeload)
- `SetLog` (workoutId, exerciseId, satzNr, gewichtKg, wdh, rir?, versagen?, istAufwärmen, notiz)
- `BodyMetric` (datum, gewichtKg?, bauchumfangCm?)
- `ScheduleConfig` (stundenplanA/B als JSON, abOverride pro KW, samstagArbeitBis, fahrzeitMin, gymÖffnungszeiten, deloadIntervallWochen, planStartdatum, phase [diät/aufbau], klausurphaseBis?)
- `CalendarCache` (quelle, abgerufenAm, events als JSON)
- `PushSubscription`

---

## 11. Umsetzungsphasen

1. **Phase 1 – Kern:** Datenmodell, Login, Übungen & Einheiten wie oben, Training loggen (offline-fähig), Vorwerte, doppelte Progression, Pausentimer, Aufwärmsätze, Verlauf pro Übung.
2. **Phase 2 – Plan:** Stundenplan A/B, Arbeitsregel, Standardplan (beide Samstags-Varianten), Ferienplan, Heute-Screen, Wochenplan-Screen.
3. **Phase 3 – Kalender:** ICS-Import, Konflikterkennung, Umplanungslogik mit Bestätigung, ICS-Export der Trainings.
4. **Phase 4 – Extras:** Push-Benachrichtigungen, Körper-Tracking, Stagnation/Deload, Zeitbudget-Warnungen, Auswertung nach 10 Wochen, Datenexport.

Nach jeder Phase: kurz zusammenfassen, was fertig ist und was ich testen soll.

---

## 12. Testfälle für die Planlogik (müssen als automatisierte Tests existieren)

1. **Standardwoche A, Samstag bis 18 Uhr:** Mo 28.09.2026 Oberkörper (Freistunde, Ende 13:15), Di Beine (Freistunde), Fr Oberkörper (16:05), So Beine. Mi = Arbeitstag, keine Einheit.
2. **A/B-Erkennung:** 05.10.2026 → Woche B. Manuelle Übersteuerung auf A wird respektiert.
3. **Ferien:** 19.10.2026 (Herbstferien laut Kalender) → Ferienplan Mo Oberkörper, Di Beine, Do Oberkörper, Fr Beine.
4. **Konflikt mit Ausweich-Slot:** Woche B mit Samstag bis 14 Uhr, Termin am Mi 12:00–13:00 → Beine (Freistunde Mi) kollidiert. Erwartung: Vorschlag Mi ab 15:45 (Ausweich-Slot, gleicher Tag), da alle Regeln erfüllt sind.
5. **Mindestabstand:** Oberkörper am Mo erledigt. Ein Umplanungsvorschlag für Oberkörper am Di oder Mi derselben Woche darf nie auf Di fallen.
6. **Schulsport-Regel:** Beine dürfen nie auf einen Montag oder auf einen Donnerstag in Woche B gelegt werden.
7. **Kein Slot möglich:** Woche A (Samstag bis 18 Uhr), Oberkörper am Fr erledigt, ganztägiger busy-Termin am So, kein anderer gültiger Slot → Beine am So fällt aus. Nächste Einheit laut Wechsel ist Beine. Montag in Woche B ist Schulsport-Tag (keine Beine) → Mo bleibt frei, Di Beine, Mi Oberkörper, So Beine. Die Woche hat 3 Einheiten. Die App zeigt die Anpassung als Vorschlag.
8. **Duplikate:** Derselbe Termin in zwei Kalendern erzeugt nur einen Konflikt.
9. **Fahrpuffer:** Ein Termin um 16:15 blockiert den Nachmittags-Slot ab 16:05 (Puffer 15 Min).
10. **Progression:** Brustpresse 65 kg mit 10/10/10 → nächster Vorschlag 70 kg. Mit 10/9/8 → 65 kg, Ziel ≥ 28 Wdh. gesamt.
11. **Stagnation:** 3 Einheiten ohne Steigerung bei 75 kg und Steigerung 5 kg → 75 × 0,9 = 67,5 kg → abgerundet auf die Steigerungsstufe = **65 kg**.
12. **Deload:** In der Deload-Woche hat die Brustpresse 2 Sätze (3 halbiert, aufgerundet) mit unverändertem Gewicht; die Werte beeinflussen die Progression nicht.

> **Korrektur Historie (09.10.2026):** Die erste kuratierte Turnierliste war unvollständig. Nachträge: **Gold U11-Einzel, Gärtringen (BWBV-Ergebnis bestätigt)**; **1. Platz Bezirksmeisterschaft Südwürttemberg, 11.07.2026 (Familienbestätigung, Disziplin offen)**; **Bronze Landesmeisterschaft Friedrichshafen, 03./04.10.2026, JE U11 (Familienbestätigung, offizieller Einzelnachweis noch zu prüfen)**. Der Trophäenschrank zählt diese mit einer klaren Kennzeichnung. Aktuell erfasste Philipp-Medaillen: 2× Gold, 1× Silber, 2× Bronze, 2× 4. Platz. Die Historie bleibt unvollständig und sollte nicht als automatisiert vollständige DBV-Datenbank beschrieben werden.

## Trophäenschrank

Die Registerkarte **Historie** zeigt jetzt einen virtuellen Trophäenschrank mit vier Auszeichnungen:

- **Gold:** 1. Platz – Turniersieg
- **Silber:** 2. Platz – Finalteilnahme
- **Bronze:** 3. Platz – Podestplatz
- **Blauer Ehrenorden:** 4. Platz – Top-4-Ergebnis (bewusst nicht als Podestmedaille dargestellt)

Die Pokale lassen sich antippen; darunter erscheinen die belegten Turnierleistungen mit Datum, Disziplin, Altersklasse und Link zum Originalbericht. Der Schrank reagiert auf den Spielerfilter, den Jahresfilter und die Disziplin-Auswahl der historischen Ansicht. Die vollständige Turnierchronik bleibt darunter erhalten.

**Datenregel:** Ausschließlich verifizierte Datensätze mit Platz 1 bis 4 zählen. Gleiche Ergebnis-IDs werden nicht doppelt gezählt. Platz 5 oder schlechter wird weiterhin in der Chronik gezeigt, erzeugt aber keine Trophäe. Solange die DBV-Ergebnisdaten nicht vollständig verfügbar sind, ist auch die Sammlung ausdrücklich **nicht vollständig**. Die reine Statistik steckt in `scripts/trophy-stats.mjs`, Regressionstests in `tests/trophies.mjs`.

## Historische Ergebnisse (seit Oktober 2026)

Die App hat jetzt eine eigene Registerkarte **Historie** mit nachgewiesenen Platzierungen 2025–2026 aus öffentlichen Turnierberichten der SpVgg Mössingen. Die Datenbasis `data/history.json` enthält zurzeit zehn belegte Platzierungen von Philipp Metzger und Charlottes erstes dokumentiertes Turnierergebnis. Es gibt Jahres-, Disziplin- und Spielerfilter sowie einen Platzierungsverlauf, der Altersklassen getrennt vergleicht. Jede Turnierkarte führt zum zugehörigen Originalbericht.

**Achtung:** Das ist eine kuratierte **Auswahl**, keine vollständige individuelle DBV-Spielhistorie. Satzergebnisse, die nicht belegt sind, werden nicht ergänzt. Eine mehrjährige Ranglistenentwicklung kann erst aus mehreren datierten DBV-Ranglistenständen erstellt werden. Die direkte automatische DBV-Abfrage steht unabhängig davon noch aus.

> **DBV-Live-Status (09.10.2026):** Die App ist veröffentlicht und unterstützt jetzt autorisierte JSON-/CSV-Imports und offizielle Turnierlinks pro Spieler. **Direktes DBV-Live ist mangels freigegebenem Datenzugang noch nicht angeschlossen.** Einrichtung und Datenanforderung: [docs/DBV_LIVE.md](docs/DBV_LIVE.md).

# Shuttleboard – Badminton für die Familie

Mobile, installierbare Web-App (PWA) für Badminton-Turniertage. **Startprofil: Philipp Metzger, DBV-Spieler-ID `05-070879`**.

## Aktueller Funktionsumfang

- Spielerfavoriten lokal speichern, zwischen Kindern wechseln
- Anstehende, laufende, aufgerufene und abgeschlossene Matches, inklusive Uhrzeit, Feld, Gegnern und Satzergebnis
- Persönliche nächste Begegnung und Turnierübersicht
- Automatische Aktualisierung alle 60 Sekunden, solange die App geöffnet ist
- Hinweise bei Statusänderungen **nur während die App geöffnet ist** (keine Hintergrund-Push-Nachrichten)
- Ein ausdrücklich gekennzeichneter Beispielmodus
- Offizielle Spielerprofile direkt auf dbv.turnier.de öffnen
- Installation über iPhone Safari → Teilen → Zum Home-Bildschirm

**WICHTIG:** Der DBV-Turnierdatenfeed ist **noch nicht verbunden**. Die öffentliche DBV-Seite beweist nicht, dass automatisierte Datenentnahme zulässig oder zuverlässig ist. Diese App greift **nicht** automatisiert/scrapend auf dbv.turnier.de zu. Die Startansicht zeigt daher keine erfundenen Live-Spiele.

## Veröffentlichung

GitHub Pages wird über `.github/workflows/pages.yml` veröffentlicht. Falls die automatische Einrichtung des neuen Repositories nicht gelingt: Repository **Settings → Pages → Build and deployment → Source: GitHub Actions** auswählen und Workflow erneut starten.

Danach: `https://metzgerhannes-oss.github.io/Badminton/`.

## Echte Ergebnisse anbinden

Repository-Variable **`BADMINTON_FEED_URL`** **zusammen mit** `BADMINTON_FEED_AUTHORIZED=true` (nur nach Freigabe) und optional `BADMINTON_FEED_FORMAT=csv` (unter Settings → Secrets and variables → Actions → Variables) auf eine **erlaubt verwendbare HTTPS-URL** setzen, die ein JSON-Dokument im untenstehenden Format zurückgibt. Optional ist das Secret `BADMINTON_FEED_TOKEN` als Bearer-Token möglich. Der GitHub-Workflow holt freigegebene Daten planmäßig ca. alle fünf Minuten und stellt den öffentlichen Snapshot unter `data/live.json` bereit. GitHub Actions kann geplante Läufe verzögern. Der Browser lädt den Snapshot alle 60 Sekunden. **Es ist somit keine garantierte Echtzeitübertragung.**

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-10-09T14:45:00Z",
  "source": {"name":"Autorisierter Turnierfeed","url":"https://example.org/event"},
  "tournaments": [
    {"id":"turnier-123","name":"Jugendturnier","location":"Mössingen","startDate":"2026-10-10T08:00:00Z","url":"https://example.org/event"}
  ],
  "matches": [
    {
      "id":"match-456",
      "tournamentId":"turnier-123",
      "discipline":"Jungeneinzel U11",
      "scheduledAt":"2026-10-10T12:30:00Z",
      "court":"4",
      "status":"scheduled",
      "players":["Philipp Metzger","Gegner"],
      "playerIds":["05-070879"],
      "score":"",
      "url":"https://example.org/event/match"
    }
  ]
}
```

Erlaubte Statuswerte: `scheduled`, `ready`, `called`, `live`, `finished`, `delayed`, `cancelled`. Status `called` nur liefern, wenn der offizielle Aufruf explizit verfügbar ist; `scheduledAt` ist eine **geplante** Spielzeit, keine Aufrufbestätigung.

**Datenqualität:** Die Quelle muss eindeutige Match-IDs, DBV-Spieler-IDs und korrekte Zeitstempel mit UTC-Offset liefern. Der Workflow prüft das Datenformat und verwirft unpassende Daten.

## Lokal testen

```sh
python3 -m http.server 8080
# http://localhost:8080
node --check app.js
node tests/validate.mjs
```

Es gibt keine Benutzeranmeldung, keine personenbezogene Cloud-Datenbank und keine eingebetteten Trackingdienste. Kinderprofile werden ausschließlich im Browser auf dem jeweiligen Gerät gespeichert. Wird GitHub Pages verwendet, sind die Dateien und der öffentliche Turnierfeed frei zugänglich. Keine personenbezogenen privaten Details im Feed speichern.

## Nicht vorhanden (bewusst)

- Keine garantierte DBV-Live-Anbindung ohne eine zulässige strukturierte Datenquelle.
- Keine Push-Nachrichten bei geschlossener App.
- Keine direkten Änderungen von Turnier-Ergebnissen oder Match-Aufrufen.

## Schmetterlinge-Vereinsdesign

Visuelle Grundlage ist **ausschließlich das am 09.10.2026 im Chat erneut hochgeladene Original-Logo** (`D82E3047-8BF8-494D-B80E-5D074FCB9653.jpeg`), nicht die ältere weißliche Variante aus der Bibliothek. Für die Website wurde das Bild seitenverhältnistreu auf 192 × 192 Pixel verkleinert und als WebP in `assets/spvgg-schmetterlinge.svg` eingebettet; das Originalmotiv bleibt erhalten. Ein SHA-256-Test verhindert künftig das versehentliche Ersetzen durch das falsche Logo. Farben: Dunkelblau, Hellblau und Weiß. Keine Verwechslung mit offiziellen DBV-Angeboten.

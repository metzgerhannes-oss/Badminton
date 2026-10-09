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

Repository-Variable **`BADMINTON_FEED_URL`** (unter Settings → Secrets and variables → Actions → Variables) auf eine **erlaubt verwendbare HTTPS-URL** setzen, die ein JSON-Dokument im untenstehenden Format zurückgibt. Optional ist das Secret `BADMINTON_FEED_TOKEN` als Bearer-Token möglich. Der GitHub-Workflow holt die Daten planmäßig ca. alle fünf Minuten und stellt den öffentlichen Snapshot unter `data/live.json` bereit. GitHub Actions kann geplante Läufe verzögern. Der Browser lädt den Snapshot alle 60 Sekunden. **Es ist somit keine garantierte Echtzeitübertragung.**

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

Visuelle Grundlage ist das ursprünglich erstellte und in der ChatGPT-Bibliothek unter `/Badminton/Spvgg_Moessingen_Badminton_Jugend_Logo.png` aufbewahrte Schmetterlingslogo der SpVgg Mössingen Badminton Jugend. Für die PWA wurde dieses Motiv ohne Änderung seiner Bildbestandteile als kompaktes, eingebettetes WebP in `assets/spvgg-schmetterlinge.svg` übernommen. Das Quelloriginal bleibt unverändert in der Bibliothek; die App nutzt Vereinsfarben Dunkelblau, Hellblau und Weiß. Logo als Markenzeichen der Vereinsjugend verwenden, nicht mit offiziellen DBV-Angeboten verwechseln.

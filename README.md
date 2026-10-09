## Startseite: KPI-Dashboard

Die App startet unter [Start](https://metzgerhannes-oss.github.io/Badminton/#start) mit kompakten Kacheln für **DBV-Jahrgangsrang im Einzel, Doppel und Mixed**, **Trophäenschrank**, **erfasste Turniere** und **nächstes selbst angelegtes Turnier**. Der Spielerfilter gilt für alle Kacheln.

### DBV-Jahrgangsplatz und Vorwochenvergleich

Die öffentlich herunterladbaren wöchentlichen Excel-Archive der [DBV-Rangliste](https://turniere.badminton.de/ranking/history) werden in einem eigenen GitHub-Workflow unter `.github/workflows/ranking.yml` **jeden Donnerstag 15:00 UTC** geprüft (17:00 MESZ / 16:00 MEZ). GitHub-Schedules können verzögert laufen. Das heißt nicht, dass die DBV jeweils donnerstags veröffentlicht. Es werden die letzten beiden tatsächlich vorhandenen Kalenderwochen verwendet.

Die Kacheln zeigen den **Rang innerhalb desselben Geburtsjahres, Geschlechts und derselben Disziplin**, berechnet aus den offiziell veröffentlichten Punkten: Rang = 1 + Anzahl höher bewerteter Spieler derselben Gruppe. Punktegleichstand = gleicher Rang. Das ist ein **berechneter Jahrgangsrang**, ausdrücklich **nicht** der bundesweite DBV-Gesamtrang.

Mit zwei echten Kalenderwochenständen zeigt die App `↑` bei besserem Jahrgangsrang, `↓` bei schlechterem und `→` bei Gleichstand. Ohne verlässlichen Vergleich wird **kein** Pfeil behauptet. Der Altersklassenwechsel zum neuen Jahr und unbekannte Werte werden neutral dargestellt.

Philipp hat die DBV-Spieler-ID `05-070879` und Jahrgang **2016 / U11 (2026)**. Charlotte hat noch keine gesicherte DBV-Spieler-ID; es werden keine Werte erfunden. Nur Ranglisten-Kennzahlen hinterlegter IDs werden in `data/ranking.json` veröffentlicht, nicht die vollständige Ranglistendatei. Bei Quellefehlern bleibt die letzte erfolgreiche Datei bestehen, vor dem ersten erfolgreichen Abruf steht „Noch keine Daten“. Öffentliche Download-Verfügbarkeit garantiert weder eine API noch den rechtlich uneingeschränkten automatischen Betrieb.

# Schmetterlinge · Badminton Jugend Mössingen

Die mobile Web-App für die Familie mit **historischen Turnierergebnissen**, **Trophäenschrank** und **gespeicherten offiziellen DBV-Turnierlinks**.

**App:** https://metzgerhannes-oss.github.io/Badminton/

## Turnier selbst anlegen

Nach der Anmeldung zu einem Badmintonturnier kannst du dessen offizielle URL selbst speichern:

1. Unter **Turniere** auf **+ Turnier anlegen** tippen.
2. Einen Link im Format `https://dbv.turnier.de/tournament/E24DC6EE-152A-454D-B00C-E625B751D7D5` einfügen.
3. **Alle Spieler**, **Philipp** oder **Charlotte** zuordnen.
4. Falls bekannt, **Turniername**, **Beginn** und **Ende** ergänzen. Alle drei Angaben sind optional.
5. Speichern. Die App liest die eindeutige UUID aus der URL und behält den Bookmark lokal.

Ergebnis: Das Turnier erscheint unter **Meine Turnierlinks**, bei eingetragenem Termin gruppiert als **Bevorstehend**, **Turniertag** oder **Vergangen**. Dies beschreibt nur das manuell hinterlegte Datum und **keinen Live-Spielstatus**. Den Turnierlink öffnen, später bearbeiten oder entfernen ist jederzeit möglich. Ohne Namen zeigt die App als Platzhalter „DBV-Turnier“ und die ersten acht Zeichen der UUID.

Der Link ist ein dauerhafter Zuordnungsschlüssel. Sollten später zulässig nutzbare Ergebnissätze importiert werden, lassen sie sich anhand derselben Turnier-ID verknüpfen. **Es werden derzeit keine automatischen Daten aus DBV/Tournament Software abgerufen.**

## Historie und Trophäenschrank

Die Registerkarte **Historie** enthält eine kuratierte Auswahl aus dem öffentlichen Vereins- und Verbandsberichtswesen in `data/history.json`. Die Ergebnisse sind **nicht vollständig**. Es gibt Spieler-, Jahres- und Disziplinfilter, chronologische Turnierkarten, Links zu Originalquellen und separate Platzierungsverläufe.

Der Trophäenschrank zählt Ergebnisse mit Platzierungen **1, 2, 3 und 4**. Einträge mit Platz 5 oder schlechter bleiben ausschließlich in der Chronik. Doppelungen anhand derselben Ergebnis-ID werden nicht doppelt gewertet. Anklickbare Auszeichnungen verlinken ihren Quellbericht. Familienbestätigte, noch nicht unabhängig geprüfte Meisterschaftsdetails sind entsprechend gekennzeichnet; der nur vermutete dritte Platz im Doppel bei der Bezirksmeisterschaft ist ein offener Prüfeintrag und **keine Bronzetrophäe**.

Für Philipp sind derzeit **2× Gold, 1× Silber, 2× Bronze und 2× Platz 4** erfasst. Diese Zahlen stellen **keine vollständige DBV-Karrierestatistik** dar.

## Spieler

Philipp Metzger, Spieler-ID `05-070879`, und Charlotte Metzger (noch ohne bestätigte DBV-ID) sind voreingestellt. Du kannst Spieler lokal hinzufügen und den Familienfilter umschalten. **Spielerfavoriten und gespeicherte Turnierlinks liegen ausschließlich im lokalen Speicher des jeweiligen Browsers.** Sie werden nicht über mehrere Geräte synchronisiert; nach Löschen der Browserdaten gehen sie verloren.

## Bewusste Grenze: keine Live-Funktion

Ohne freigegebene DBV-Datenschnittstelle waren minutengenaue Matchzeiten, echte Aufrufe, Felder und Benachrichtigungen nicht zuverlässig automatisierbar. Die zuvor nur demonstrativen Live-Widgets sowie der geplante periodische Import wurden entfernt. Der offizielle Spielplan bleibt über den gespeicherten Link direkt erreichbar. Dadurch macht die App keine unbelegten Versprechen zum Stand eines Turniers.

## Technisch

- Statische PWA, HTML/CSS/JavaScript; GitHub Pages und GitHub Actions
- Smartphoneoptimiert, installierbar über Safari → Teilen → Zum Home-Bildschirm
- Keine Backend-API, keine DBV-Scraper und kein Tracking
- Servicworker für Offline-Verfügbarkeit der Oberfläche und kuratierter historischer Daten
- Tests: `node tests/validate.mjs && node tests/history.mjs && node tests/trophies.mjs && node tests/bookmarks.mjs`
- Veröffentlichung über `.github/workflows/pages.yml`, bei Änderungen an `main`

## Vereinslogo

Das im Chat am 9. Oktober 2026 freigegebene Original-Schmetterlingslogo der **SpVgg Mössingen Badminton Jugend** ist als optimierte Webgrafik unter `assets/spvgg-schmetterlinge.svg` eingebaut. Ein Test prüft den Hash der Datei gegen die freigegebene Vorlage.

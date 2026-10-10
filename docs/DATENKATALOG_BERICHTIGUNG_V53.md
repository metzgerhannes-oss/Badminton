# Schmetterlinge – Datenkatalog und Korrekturverfahren (v53)

**Audit:** 10.10.2026, produktives Badminton-Supabase-Projekt `yadexibmjmnjfmfabrug`. Technisches Arbeitsdokument, **keine vollständige Datenschutzerklärung oder Lizenzfreigabe**. Die ursprünglichen DBV-/Drittanbieterquellen bleiben maßgeblich.

## Datenkategorien und Lebenszyklus

| Datengruppe | Ablage | Herkunft / Identifizierbarkeit | Automatische Aktualisierung | Aufbewahrung |
| --- | --- | --- | --- | --- |
| Eigene Spielerprofile, Followlisten und Turnierfavoriten | `localStorage shuttleboard-v1`, optional vom Nutzer exportiertes JSON | Auf dem privaten Gerät, Namen/DBV-IDs identifizierbar | Keine automatische zentrale Synchronisierung | Bis zur lokalen Löschung; optionales Exportfile unter Verantwortung des Geräteeigentümers |
| Spieler-Verzeichnis: `players` | Supabase `public` | DBV-Spieler-ID, Name, Verein, Geburtsjahr, Altersklasse, Quelllink; enthält potenziell Minderjährige | Verzeichnis-Cron Do/Fr | **Noch rechtlich/organisatorisch festzulegen**, nicht 14 Tage |
| Vereine: `clubs` | Supabase `public` | Name, Ort, Website, Verbandsdaten, Quelllink | Verzeichnis-Cron | Offen |
| Platzierungen, Berichte, Quellenbezüge | Supabase `public`, GitHub-Datenquellen | Nachweisgebundene öffentliche Turnier- oder Vereinsergebnisse/Artikel | Quellenbezogene geprüfte Importe | Offen; Quellenkorrekturen berücksichtigen |
| Aggregierte Historie: `player_history_overviews` | Supabase `public` | DBV-ID, Badhub-Quelllink, externe Jahres-/Karrieresumme; **keine** belegten Einzelmatches | Nur bei tatsächlich fälligem und kürzlich nachgefragtem Spieler | Offen |
| Historienaufträge: `player_history_imports` | Supabase `public` | Öffentliche DBV-ID, Auftragsstatus, letzte Nachfrage | Geöffnete Historie aktiviert Nachfrage höchstens täglich/ID; global max. 60 neu/erneut aktivierte IDs in 24 h; 15-min-Worker | Auftrag verbleibt bis gesondert geregeltem Lebenszyklus. **14 Tage nur Aktivitätsfenster für Wiederprüfungen** |
| Externe Einzelmatchbelege: `player_external_match_facts` | Supabase `public` | Quelle, Matchdatum/-jahr, Turnier, Gegner/Partner, Sätze, Ergebnis, Quell-URL | Abgesicherter Badhub-Quellenimport, kontrolliert über `claim_external_match_import` | Noch zu bestimmen; keine pauschale Löschung geteilter Belege |
| Externe Matchaufträge: `player_external_match_imports` | Supabase `public` | DBV-ID, Importstatus, Cursor, Zeiten | 30-min-Cron nur für vor kurzem nachgefragte IDs und bestehende Quell-/Rategrenzen | Offen |
| Live-Cache: `player_live_snapshots` | Supabase `public` | DBV-ID, Prüftimestamp, Quellen-URL, Payload | Live-Radar-Cron; „live“ nur mit tatsächlich bestätigter Aktualität | Eigene kurze Cache-/Logfristen **noch festzulegen** |
| Offizielle Matches: `matches`, `match_participants` | Supabase `public` | Bestätigte Turnier-, Spieler-, Spiel-IDs und Quelllink | Nur validierte offizielle Resultate; keine Ableitung aus aggregierten Drittanbieterzahlen | Offen; Stand Audit **0 offizielle Matchzeilen** |
| Zugriffs-, CDN-, Edge- und DB-Protokolle | Infrastruktur GitHub Pages / Supabase | IP-/Requestdaten können personenbezogen sein | Durch Hostingdienst | Tatsächliche Anbieter-Fristen und Empfänger prüfen, nicht aus DB-Schema ableitbar |

Zum Auditzeitpunkt: 9.246 verifizierte Spieler, 819 externe einzeln belegte Matchdatensätze, vier Historienaufträge und vier externe Matchaufträge. Zahlen sind Momentaufnahmen und ersetzen keine Evidenzprüfung.

## Korrektur-/Löschprozess als sicherer Betriebsablauf

1. **Nicht öffentlich erfassen:** Keine minderjährigen Spielerprofile, DBV-IDs mit Beschwerdebezug, Ausweiskopien oder sonstige Antragsdaten in öffentliche GitHub-Issues oder App-Telemetrie schreiben.
2. **Verantwortlicher & Kontakt fehlen noch:** Bevor ein Rechte-Kanal angekündigt werden kann, muss der tatsächliche Betreiber einen öffentlich erreichbaren, nicht öffentlichen Kontaktweg, Identitätsprüfung mit Datensparsamkeit, Zuständigkeit und interne Bearbeitung festlegen. **Release-Blocker #56.**
3. **Nachweis trennen:** Quelle, konkrete Spieler-ID, Datensatz, behaupteter Fehler, Veröffentlichungsdatum und Herkunft mit internem Vorgang abgleichen. Öffentliche Quelle zunächst unabhängig nachprüfen; keine falsche Gleichsetzung zwischen offiziellen DBV-Matches und Badhub-Drittbelegen.
4. **Bezug und Folgen prüfen:** Tabellen `player_history_imports`, `player_history_overviews`, `player_external_match_imports`, `player_external_match_facts` sind über DBV-ID mit `players` verknüpft. `ON DELETE CASCADE` kann gemeinsam genutzte Nachweise vernichten. Deshalb **niemals unbesehen einen Spieler global löschen**. Bei belegter Falschzuordnung zuerst Quellnachweis korrigieren bzw. strittige Datensätze gezielt sperren, dann Cache-/UI-Abgleich.
5. **Rechtliche Entscheidung:** Berechtigtes Auskunfts-, Berichtigungs-, Widerspruchs- oder Löschersuchen nach konkreter Rechtsgrundlage und Interessenabwägung (bei Minderjährigen besonders sorgfältig) prüfen; keine automatische Ablehnung und kein pauschales Löschversprechen. Betreiber dokumentiert Frist, Entscheidung und Ergebnis.
6. **Technische Umsetzung erst nach Freigabe:** Gezielt nur die betroffenen Nachweise ändern/sperren; Importquellen und Wiederaufnahme gegen sofortige Rückkehr des falschen Datums sichern, Nutzeroberfläche verifizieren, notwendige Auditbelege datensparsam intern dokumentieren.
7. **Fristen:** Für alle gemeinsamen Tabellen Quellen-, Cache-, Korrektur- und endgültige Löschregeln nach tatsächlichen Zwecken und Rechten schriftlich festlegen; erst dann einen sicheren Purge-Job mit Referenzschutz und Testdatensätzen entwickeln.

## Technische Schutzregeln nach v52

- 21 von 21 `public`-Tabellen mit aktivem RLS (bei Audit).
- `anon` hat kein `SELECT` auf der gesamten Tabelle `player_history_imports` und kein Leserecht auf `last_demand_at`, aber lesbaren Status einzelner verifizierter öffentlicher Spieler.
- `request_player_history_demand` validiert die öffentliche DBV-ID; interne Schreibfunktion liegt außerhalb des öffentlichen Data-API-Schemas.
- `last_demand_at` definiert nur **14 Tage** automatische Quellenaktualisierung; bestehende Ergebnisse bleiben. Der separate externe Matchworker wurde in v52 ebenfalls an aktuelle Nachfrage gebunden.
- Offene Admin-Sonderberechtigung für zukünftig von `supabase_admin` erstellte Tabellen: #54.
- Offene Betreiberinformationen, Rechtsgrundlagen, Nutzungsrechte, Empfänger und reale Retention: #56 / #53.

## Verbindliche Prüfpunkte vor Schließen von #53 / #56

Dokumentierte Betreiberidentität und Kontakt, rechtliche Prüfung der konkreten Quellen (auch Minderjährige), Fristen je Datenklasse inklusive Infrastruktur-Logs, geschützter Rechtekanal, überprüfter Korrektur-/Sperrpfad und kontrollierte Aufbewahrungs-/Lösch-Automation. Bis dahin beide Issues offen halten.

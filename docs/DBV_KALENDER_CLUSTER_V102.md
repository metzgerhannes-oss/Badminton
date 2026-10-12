# Zentraler DBV-Turnierkalender in Schmetterlinge (v102)

## Datenquelle und Abdeckung

Offizieller öffentlicher Turnierkalender: https://turniere.badminton.de/

- Tabellenzeilen sind öffentlich. Einmal täglich höchstens zwei abgegrenzte Kalenderabfragen per GitHub Actions (Workflow `.github/workflows/dbv-calendar-source.yml`).
- Vollständigkeit wird gegen die Zahl „Turniere gefunden“ geprüft. Bei Abweichungen **kein Import**, statt unvollständige Listen als vollständig zu kennzeichnen.
- Aktueller initialer Nachweis am 12.10.2026: **109 eindeutige Turniere**, Zeitraum 14.10.–19.12.2026. Kein Anspruch auf historische Vollständigkeit. Die Quelle kann sich ändern.
- Detaillierte Altersklassen/Disziplinen werden aus den veröffentlichten Spalten übernommen, nicht aus Titelwörtern rekonstruiert.
- Kategorie wird roh gespeichert (z. B. C1-Level oder D2-Level), zusätzlich die Facette A/B/C/D/E.
- Mehrere Altersklassen sind pro Turnier möglich; Ansicht gruppiert solche Turniere gegebenenfalls mehrfach.
- **Bundesland/Verband:** Baden-Württemberg ist ein eindeutig genannter Landesverband. „Gruppe Nord“, „Rheinland“, „Rheinhessen-Pfalz“ oder „Berlin-Brandenburg“ werden nicht willkürlich einem einzelnen Austragungs-Bundesland zugeordnet. Das Feld `bundesland` bleibt dann leer, `organizer` und `region_scope` erhalten den veröffentlichten Namen.
- Öffentlicher Kalender enthält teilweise nur die Ausschreibung als PDF, nicht immer einen verifizierten DBV-Turnier.de-Link. In diesem Fall wird **nur der offizielle Kalender geöffnet**, kein künstlicher Deep-Link erzeugt.
- Ein Turniertermin bedeutet **keine** bestätigte Meldung, Zulassung, Teilnahme, Paarung oder Wertung.

## Speicherung und Sicherheit

- Initialer Import direkt in das **Badminton-Supabase-Projekt** `yadexibmjmnjfmfabrug` (Frankfurt), Tabelle `public.dbv_calendar_entries`.
- RLS aktiv, nur SELECT für `anon` und `authenticated`. Benutzer dürfen offizielle Kalenderdatensätze nicht direkt verändern.
- `source_key=dbv-calendar-<öffentliche Quellkennung>` für idempotente Upserts.
- Quelle `https://turniere.badminton.de/`, öffentliches Datum `last_seen_at`, keine personenbezogenen privaten Kalenderdaten.
- Separater öffentlicher, lokaler JSON-Fallback `data/dbv-calendar.json`, damit die PWA bei einer Supabase-Störung nicht gänzlich leer ist.
- Veröffentlichte Kalendereinträge werden **nicht** als persönliche `user_tournament_links` oder Spond-Veranstaltungen ausgegeben.

## Aktualisierung

GitHub Actions prüft täglich und aktualisiert den öffentlichen Snapshot bei inhaltlicher Änderung oder nach sieben Tagen. Für automatisches Upsert **auch nach Supabase** wird ein einmalig im Repository hinterlegtes GitHub-Actions-Secret `BADMINTON_SUPABASE_SERVICE_ROLE_KEY` benötigt. Fehlt es, wird weiterhin der JSON-Snapshot aktualisiert, aber **kein** Datenbank-Sync behauptet. Ein Service-Role-Schlüssel wird niemals ins Frontend oder in die Repository-Dateien geschrieben.

Das Source-Coverage-Signal ist der geprüfte Veröffentlichungsstand; fehlende Turniere können an fehlenden offiziellen Bekanntmachungen, Quelleinschränkungen oder einem nicht erfolgreichen Import liegen. Fehlende Daten sind keine bestätigte Absage.

## Ausblick

Für eine echte Ausweitung über aktuell veröffentlichte Kalenderereignisse: Jahre und weitere Kalenderfenster getrennt vollständig abrufen und die jeweiligen angekündigten Trefferzahlen kontrollieren. Alte bestätigte Datensätze nicht blind löschen. Der Nutzer kann die DBV-Quelle jederzeit öffnen und vergleichen.

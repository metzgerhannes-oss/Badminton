# Zentraler DBV-Turnierkalender in Schmetterlinge (v103)

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

GitHub Actions prüft täglich und aktualisiert den öffentlichen Snapshot bei inhaltlicher Änderung oder nach sieben Tagen. Automatische Datenbankschreibzugriffe verwenden jetzt **GitHub OIDC**: Der Publisher-Job darf ein wenige Minuten gültiges signiertes Token für das Publikum `schmetterlinge-dbv-calendar-yadexibmjmnjfmfabrug` anfordern. Die Supabase Edge Function `dbv-calendar-publish` prüft Signatur, Aussteller, Ablaufzeit, Publikum, Repository-ID, Eigentümer-ID, `refs/heads/main` sowie den exakten Workflow-Pfad. Erst danach werden validierte DBV-Kalenderzeilen in Batches von höchstens 40 in die zentrale Tabelle geschrieben. **Kein GitHub-Service-Role-Secret** ist nötig. Die Supabase-eigene Schreibberechtigung verbleibt ausschließlich im Edge-Runtime-Kontext. Fehler beim Datenbank-Import lassen den GitHub-Workflow sichtbar fehlschlagen; sie werden nicht als erfolgreiche Synchronisation gemeldet.

Das Source-Coverage-Signal ist der geprüfte Veröffentlichungsstand; fehlende Turniere können an fehlenden offiziellen Bekanntmachungen, Quelleinschränkungen oder einem nicht erfolgreichen Import liegen. Fehlende Daten sind keine bestätigte Absage.

## Ausblick

Für eine echte Ausweitung über aktuell veröffentlichte Kalenderereignisse: Jahre und weitere Kalenderfenster getrennt vollständig abrufen und die jeweiligen angekündigten Trefferzahlen kontrollieren. Alte bestätigte Datensätze nicht blind löschen. Der Nutzer kann die DBV-Quelle jederzeit öffnen und vergleichen.


## OIDC-Livebetrieb

- Quellcode: `supabase/functions/dbv-calendar-publish/index.ts`, Konfiguration `supabase/config.toml` (`verify_jwt=false` ausschließlich wegen eigener, zwingender GitHub-JWT-Prüfung).
- Deploy nur in das Badminton-Projekt `yadexibmjmnjfmfabrug`.
- Zulässig sind signierte GitHub-Identitäten des Workflows `.github/workflows/dbv-calendar-source.yml` auf `main`. Kein anonymer Datenbank-Schreibzugriff.
- Die Aktion `publish` benötigt `id-token: write` und `contents: write`. Kein API-Key als GitHub Secret.
- Die öffentliche DBV-Datenbanktabelle behält RLS, der Browser ausschließlich SELECT; private Benutzer- oder Spond-Daten bleiben unberührt.
- Kontrollprüfung: GitHub Actions Workflow `DBV-Kalender Import` manuell starten, Erfolg des OIDC-Upserts im Protokoll sowie Datenbank-`last_seen_at` und Anzahl kontrollieren. Anonyme Anfragen an die Edge Function müssen scheitern.

# v215 / P1 #386 – DBV-Turnierdaten: belastbare Ort- und Datumszuordnung

## Stand 25.10.2026
Entwicklungsbranch nach v214 `main` (`79fb6913`). **Noch kein PR, nicht live, CI noch nicht gestartet.**
Das Main-/Pages-Deploy für v214 ist über die verfügbaren GitHub-API-Aktionen hier nicht vollständig verifizierbar; das bisherige Ein-PR-/Release-Gate bleibt bestehen.

## Änderungen
- Private Turnierlinks: optionaler **Austragungsort / Hallenadresse** und separater **Meldeschluss**; bestehende Angaben bleiben beim Bearbeiten, Speichern, Laden und Offline-Backup erhalten.
- Fehlender lokaler Ort heißt **„Austragungsort nicht erfasst“**, nicht unbewiesen „noch nicht veröffentlicht“.
- Beim bereits vorhandenen DBV-Kalenderladen: exakt **eine** zugehörige Quelle erforderlich – bei gespeicherten Kalenderfavoriten dieselbe `source_key`, bei externen Turnierlinks eine bestätigte direkte `turnier.de/tournament/<UUID>`-URL. Gleiche Ortsnamen oder ähnliche Titel allein sind verboten.
- Bestehende leere Orts- und Meldeschlussfelder werden **nur bei übereinstimmenden Turniertagen und ohne erkennbaren A/B/C/D/E-RLT-Konflikt** rein lokal ergänzt. Benutzerdefinierte Namen, erfasste Daten, Spielerzuordnung und Einladungen werden nicht überschrieben. Bei Konflikten nur Warnung mit DBV-Turniertag/Meldeschluss – **keine automatische Korrektur**.
- Nur ohnehin eingelesene Kalendereinträge; **keine neue Supabase-/DBV-Abfrage, kein Scraping, Cron, Tracking, Backend-Schema oder Token**.
- Separater Offline-Test für UUID-/Kalender-ID-Matches, falsche E-/D-Kategorie, die 15.11./22.11.-Verwechslung, Dubletten und Backup-Roundtrip. Version v215 ist im Branch vorbereitet.

## Quellen-/Abnahmegrenze
Die öffentliche DBV-Kalendertabelle hat bei bestimmten Einträgen, einschließlich des benannten Gomaringen-Falls, aktuell **keine verifizierbare `event_url`-UUID-Zuordnung**. Ohne diese darf die App eine extern gespeicherte UUID nicht automatisch anhand `Gomaringen` oder `15.11.` mit dem **3. D-RLT vom 22.11.** verbinden. In diesem Fall bleibt die **manuelle Ortsergänzung** möglich und die falsche Zuordnung wird nicht erzwungen.

Vor Release erforderlich:
1. Geprüfter v214 Main-/Pages-Build für exakt `79fb6913`.
2. Ein PR für v215 mit grünen Unit-, Navigations-, Chromium-/WebKit- und Pages-Prüfungen; keine CI-Verbindung zur produktiven Supabase.
3. Prüfung, ob sich offiziell **autorisiert** eine eindeutige event_url/UUID-Zuordnung für den Gomaringen-Fall beschaffen lässt. Ohne gesicherten Join bleibt dieser Teil als Datenquellen-Blocker offen, während der sichere Fallback nutzbar ist.
4. F11 bleibt eine einzige gesammelte physische Schlussabnahme.

Refs #386 #389 #56 #348.

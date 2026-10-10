# v58 – Live-Radar und Home-Vorschau mit gemeinsamem GET-Client

Der Live-Radar (`live-radar.js`) und die kleine Home-Live-Vorschau (`live-hub.js`) lesen denselben, quellengebundenen Supabase-Snapshot über `scripts/supabase-read.mjs`. Der Server ist allein für die Abfrage der öffentlichen Badhub-Live-Seite verantwortlich; Browser laden Badhub nicht direkt als automatischen Feed.

- Neue `snapshotPath(dbvId)`-Funktion in `scripts/live-radar.mjs`: nur validierte öffentliche DBV-IDs, schreibgeschützter REST-Pfad. Bestehende absolute `snapshotUrl` bleibt erhalten.
- Keine doppelten API-Schlüssel/GET-Handler mehr in `live-radar.js` und `live-hub.js`; 6,5-Sekunden-Timeout je Versuch und maximal ein Retry bei einem temporären GET-Fehler.
- Der Live-Radar verwendet unverändert den gesonderten, begrenzten `POST`-Watch-Auftrag. Die Home-Vorschau erstellt **keinen** Watch- oder Badhub-Auftrag.
- Auf der Home-Vorschau verhindert eine Token-/Abort-Prüfung, dass eine alte, abgebrochene Spieleranfrage die neuere Anzeige versteckt.
- Anzeige „läuft“/Spielstand bleibt an **wirklich frische, geprüfte** Matchquellen gebunden (bestehende 2-Minuten-Regel); veraltete Live-Scores werden nicht als aktuell ausgegeben.
- Keine Datenbankmigration, kein Anbieterzugang vorgetäuscht und keine Änderung privater Profile oder gemeinsamer Matchnachweise.

Prüfungen: `tests/live-radar.mjs`, `tests/live-hub.mjs`, GitHub-Browser-QA und Quellprovenienz-Tests. Für die wirkliche Live-Vollständigkeit ist der gesonderte Datenzugang #17 erforderlich, und die echte iPhone-Abnahme #28 bleibt offen.

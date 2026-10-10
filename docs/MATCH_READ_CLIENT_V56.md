# v56 – Einheitlicher Leseclient für Spielstatistik und Einzelmatches

Die Home-Statistik (`stats.js`) und die Einzelmatch-Historie (`external-matches.js`) führen ihre `SELECT`-Abfragen nun über `scripts/supabase-read.mjs` aus, analog zur Spielerbibliothek ab v55.

## Regeln
- Ausschließlich schreibgeschützte, validierte PostgREST-`GET`-Anfragen; es werden keine Followlisten oder Familiendaten übertragen.
- Vorhandene AbortController-Ketten bleiben wirksam, sodass Profilwechsel bereits gestartete Seitenladungen abbrechen können.
- Zeitbegrenzung je Abfrage und höchstens ein Retry für temporäre Transportfehler oder 429/502/503/504; keine Wiederholung von 403/404 oder ungültigen Antworten.
- `count:false` vermeidet unnötige exakte Gesamtsummen bei den paginierten Matchabfragen (bis 400 Einträge je Seite, höchstens 10.000).
- Eine Netzwerkstörung wird weiterhin als **unvollständige/nicht erreichbare Quelle**, niemals als „Spieler hat keine Spiele“, angezeigt; vorhandene Re-try-Schaltfläche bleibt.
- Offizielle `player_match_observations` und belegte `player_external_match_facts` bleiben getrennt. Matchdubletten, Satzlogik und Altersklassenauswertung werden **nicht** verändert.
- Keine neue SQL-Migration; zentrale Supabase-Privilegien bleiben auf v54-Niveau.

Abnahme: `tests/supabase-read.mjs`, `tests/external-match-consistency.mjs`, `tests/source-stats-home.mjs`, GitHub-Mobile-Browser-QA und Pages. Echte iPhone-/VoiceOver-Praxisabnahme #28 bleibt gesondert offen.

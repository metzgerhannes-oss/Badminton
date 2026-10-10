# v59 – Öffentliche Berichte über gemeinsamen Leseclient

Der Bereich **Berichte** nutzt für Supabase-Abfragen nun `scripts/supabase-read.mjs`. Die App lädt `reports.js` als ES-Modul; das bestehende Ereignis- und Renderingmodell sowie die Quellenfilter bleiben gleich.

- REST-`GET` für redaktionell bestätigte Artikel, Reportquellen, Vereine und konkrete Spieler-Namensnennungen nutzt denselben validierten, zeitlich begrenzten Client wie Verzeichnis, Historie, Statistik und Live. Maximal ein Wiederholungsversuch bei temporären Störungen, keine schreibenden Requests.
- Die redaktionell geprüften lokalen Dateien `data/report-articles.json` und `data/report-sources.json` bleiben als kostenfreie **Ausfallreserve** erhalten. `Promise.allSettled` verhindert, dass eine nicht erreichbare Datenbank diese geprüften Belege ausblendet.
- Es werden nur nachgewiesene Veröffentlichungen verlinkt. Eine Erwähnung eines Spielers ist **keine** bestätigte Turnierteilnahme, kein Einzelmatch und kein Beleg für einen Sieg.
- Persönliche Followlisten und lokale Profile bleiben auf dem Gerät. Für eine Namensabfrage wird nur die bereits öffentliche DBV-ID der aktiven Person verarbeitet.
- Regression `tests/report-read-client.mjs` prüft das tatsächliche Fallback-Rendering mit simulierter nicht erreichbarer Supabase-Datenbank. Keine SQL-Migration oder Datenlöschung.

Die allgemeine Komponenten-/CSS-Modularisierung bleibt #29, die fehlende Betreiberdatenschutzerklärung #56 und die reale iPhone-/VoiceOver-Abnahme #28 weiterhin offen.

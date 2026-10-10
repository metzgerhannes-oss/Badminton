# v57 – Historienstatus und Karriereübersichten ohne doppelte REST-Clients

## Was sich ändert
- `history-demand.js` fragt den Importstatus einer **gezielt aufgerufenen** öffentlichen DBV-Spieler-ID über den ab v55 validierten und abortfähigen `readPublicRows`-Client ab. Die bestehende auf 24 Stunden / ID begrenzte **POST-Nachfrage** und die Badhub-Matchimporte bleiben getrennt und unverändert.
- `career-history.js` liest vorhandene externe Karriereaggregate über denselben **GET-only**-Client und verwendet bei fehlender/verzögerter Supabase-Antwort weiterhin die geprüfte lokale GitHub-Quelle.
- `scripts/history-demand.mjs` bietet relative, validierte `importStatusPath`- und `overviewPath`-Funktionen; die bestehenden absoluten URL-Funktionen bleiben rückwärtskompatibel.
- Der Browsercache von Karriereübersichten ist auf **maximal 60 Sekunden** begrenzt; ein Quellmatch-Update verwirft den Eintrag des betroffenen Spielers. Bereits geladene Matchbelege werden nicht verändert.
- Jahreszahlen in der historischen Quellenbemerkung stammen aus den **tatsächlich vorhandenen `years` des ausgewählten Spielers** statt der für einen einzelnen Quellbeleg zutreffenden festen Angabe 2019–2026.
- PWA-Cache v57, passende Node- und Mobile-Regressionsprüfungen.

## Unveränderte Sicherheitsregeln
- Keine private Followliste, kein Familienprofil oder anderes privates Benutzerkonto wird zum Server hochgeladen.
- Quellaggregate zählen **nicht** als einzelne offiziell verifizierte DBV-Matches.
- Die 14 Tage aus v52 sind nur der Zeitraum für erneute serverseitige Quellenprüfungen, keine Löschfrist.
- Keine Änderung an Supabase-SQL, RLS, importierten Fakten oder Cron-Aufträgen.
- Praktische echte iPhone-/VoiceOver-Abnahme bleibt gesondert offen (#28).

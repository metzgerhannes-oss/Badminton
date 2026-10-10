# Lesende Live-Bestandsprüfung: Spielerhistorie und Einzelmatches

Ausführung: GitHub Actions **Badminton Importbestand lesen**, beim ersten Merge sowie manuell über `workflow_dispatch`. Keine Import- oder Drittanbieteraufrufe, keine Datenbankänderungen; Zugriff ausschließlich auf die bereits anonym lesbaren Supabase-REST-Ansichten der eigenen App. Der öffentliche publishable API-Key ist der bereits im Frontend verfügbare, **kein** Admin-/Service-Key.

Abgleich pro DBV-ID:
- `player_history_imports`: per Gerät registrierte öffentliche Spieler-IDs, soweit lokal gespeicherte Follows jemals mit der Queue synchronisiert wurden
- `player_external_match_imports`: Status, Cursor (verarbeitet), `verified_count` (vom Quellenparser als importierbar erkannt), Leasing und letzter Versuch
- `player_external_match_facts`: tatsächlich abrufbare Belege und mit `computeExternalStats` zählbare W/L. Der Validator ist identisch mit Home/Historie

**Niemals** Schlussfolgerung „vollständige Karriere“ aus `status=complete`. `complete` bezieht sich nur auf die aktuell vom Importer erkannten und verarbeiteten Quellkarten. Typische Befunde: Quelle derzeit nicht verfügbar, abgelaufene Lease, Importfehler, verzögertes Folgepaket, verarbeitete aber nicht gespeicherte Karten, ausschließlich lokal gefolgte Personen ohne Serverregistrierung.

Grenzen: Die API wurde auf maximal 4.000 Queueeinträge und 10.000 Facts begrenzt; bei Überschreitung werden Zahlen als Teilbestand markiert. Keine privaten Followlisten und keine Namen in Berichten. Öffentliche DBV-IDs erscheinen in GitHub Actions und JSON-Prüfartefakt, weil sie für die Zuordnung der offenen Importprobleme nötig sind. Nicht zum Veröffentlichen personenbezogener Auswertungen außerhalb dieses Projekts verwenden.

Priorisierte Folgearbeit: echte Fehlerursachen anhand Live-Befund bearbeiten, nur rechtlich geklärte Datenanbieter nutzen; für vollständige, aktuelle offizielle Matches weiterhin #17, reale iPhone-/VoiceOver-Abnahme #28.

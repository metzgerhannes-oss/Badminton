# P0 Fix: Badhub-Teilquellen dürfen komplette Spielerhistorie nicht blockieren

Der ursprünglich am 10.10.2026 um 13:10 UTC fehlgeschlagene Import für DBV-ID `05-071969` lieferte in Supabase Edge Logs `Source unavailable` (HTTP 502); Spieler-Lookup und Queue-Claim waren erfolgreich. Der genaue Status des externen Anbieters ist noch nicht gesichert. Die zu dem Zeitpunkt verwendete Edge Function war älter als die danach deployte Version 2.

## Fachliche Korrektur
- Derselbe bestehende Anbieter wird weiterhin ausschließlich über `?src=turnier&saison=all` und `?src=liga&saison=all` abgefragt – **keine neuen Scraper- oder Zugriffstechniken**.
- Der Ausfall **einer** dieser Quellen vernichtet nicht länger die zuverlässig validierbaren Matches der anderen Quelle.
- Bei Teilquellenausfall muss der Importstatus `partial` bleiben; die fehlende Quelle wird ausdrücklich genannt, niemals `complete`.
- Bei Ausfall beider Quellen wird `awaiting_source` gespeichert, nicht „0 Karriere-Matches“ behauptet.
- Das Abrufcursor wird beim Zugriff auf nur eine Quelle auf null gesetzt, damit Sortierungsänderungen keine belegten Quellenmatches überspringen.
- Parser und Ergebnisvalidierung bleiben unverändert; keine Fiktionen, keine automatischen Lückenfüllungen.
- Die im Edge Deployment benötigte Parser-Datei ist nun versioniert und mit der im Repository getesteten Version bytegleich.
- Kein Schema-/RLS-/Cronjob-Wechsel. Bestehende bereinigte Matchbelege bleiben erhalten.
- Live-Abnahme: Supabase Edge-Version und direkter SQL-Importstatus kontrollieren; einen konkreten fremden Anbieter-Rücklauf nur als `available` darstellen, wenn tatsächlich gesichert.

## Weiterhin offen
Autorisiert dokumentierte Anbieter-APIs und vollständige historische Matchdaten (#17), physische iPhone-Abnahme (#28). Quelle derzeit nicht erreichbar ≠ Spieler ohne Matches.

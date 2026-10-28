# #414 – Privater DBV-Wochenimport: Freigabe- und Betriebsplan

Stand 27.10.2026. Diese Implementierung ist zunächst ausschließlich Quellcode und synthetische Offline-Prüfung. Es gibt keinen produktiv aktiven neuen Scheduler. Der bestehende GitHub-Workflow bleibt ein reiner Offline-Verify-Job. Ein grüner Test ist kein amtlicher Wochenimport.

## Nachgewiesene Ausgangslage

- Projekt: ausschließlich Badminton-Supabase yadexibmjmnjfmfabrug (Backup-Verbindung). KW42/2026: 17.790 amtliche Disziplineinträge, 9.310 Spieler; source_published_at 14.10.2026 08:30 UTC. Kein belegter KW43-Import.
- Vorhandene Edge private-dbv-directory v2 nimmt nur GitHub-OIDC an. Nicht wieder aktivieren oder den alten GitHub-Publish-Job zurückbringen.
- Zwei alte pg_cron-Jobs für private.refresh_dbv_directory sind deaktiviert. Die vorhandene 4-Parameter-RPC ist atomar und service_role-geschützt, hat aber keinen verbindlichen amtlichen Veröffentlichungsstempel.
- Supabase Free Edge: 256 MB RAM, 150 s Laufzeit, 2 s CPU pro Anfrage. Deshalb vor Aktivierung einen autorisierten privaten Lauf mit Ressourcenmessung und belastbarem Fehler-/Rollback-Nachweis durchführen. Das CPU-Budget ist ein echtes technisches Freigabegate, nicht aus Offline-Green abzuleiten.
- Dokumentation: https://supabase.com/docs/guides/functions/schedule-functions und https://supabase.com/docs/guides/functions/limits.

## Technischer Pfad (nicht aktiv)

1. **Quellrechte #17/#56:** Schriftlich belastbare Befugnis für regelmäßigen automatisierten Abruf und private Verarbeitung des vollständigen offiziellen XLSX einschließlich Minderjährigendaten, zulässige Abruffrequenz, technische Nutzungsbedingungen, Betreiber und Rechtekontakt. Eine öffentlich abrufbare Datei genügt nicht. Bis dahin: keine Quellenabfrage, auch kein Test gegen produktive Quelle.
2. **SQL-Migration:** 20261027141000_private_dbv_weekly_scheduler_guard.sql nach Review im Badminton-Projekt: private Tabellen, standardmäßig enabled=false, service-role-only Claim/Finish/Ingest. Der neue Ingest ruft die vorhandene atomare RPC in derselben Transaktion auf und speichert amtlichen Zeitstempel und privaten Payload-Fingerprint. Alte direkte RPC-Ausführung für service_role wird entzogen. Kein Cron-Job und kein pg_net werden dabei installiert.
3. **Private Edge:** private-dbv-weekly, eigene Funktion mit verify_jwt=false nur wegen eines eigenen zufälligen Scheduler-Headers (nicht wegen anonymer Freigabe); konstante SHA-256-Tokenprüfung. Ohne PRIVATE_DBV_CRON_TOKEN (mindestens 32 zufällige Zeichen) und DBV_SOURCE_RIGHTS_APPROVED=true wird vor jedem DB- und Quellenkontakt abgebrochen. Ein zweites Gate ist private_content.dbv_weekly_state.enabled=false. Keine Service-Keys in GitHub oder im Client.
4. **Quellenverarbeitung:** Ausschließlich in privater Edge: festes offizielles /ranking und /ranking/download, keine dynamischen URL-Parameter, keine Archiv-KW-Fallbacks, Größen-/XML-/ZIP-Grenzen, amtlicher Berlin-Veröffentlichungszeitstempel, ISO-KW, 5.000–20.000 eindeutige Spieler, mindestens 4.000 Disziplinränge, doppelte IDs und Quellkonflikte prüfen. Ein 401/403/429 ist ein Stopp-/Backoff-Signal, niemals ein Anlass zum Umgehen.
5. **Datenbank:** Transaktion plus advisory locks, keine älteren Wochen, dieselbe Woche nur bei identischem Hash/Veröffentlichungsdatum, maximal acht Wochen, unveränderte Familien-/Match-/Trophäen-/RLS-Daten. Bei Fehlern bleibt der letzte belegte Snapshot erhalten.
6. **Betrieb:** Nur aggregierte Versuchsprotokolle im privaten Schema, ohne Namen/IDs/Quellzeilen; 90 Tage Betriebsversuche. Lease 130 s; bei 401/403 sieben Tage, bei 429 drei Tage, bei anderen Fehlern ein Tag Backoff. Bei 250 MB DB oder über 20 MB Zuwachs/7 Tage Warnung; ab 350 MB kein Import. Ein separater read-only Betriebswächter meldet 7/14 Tage Alter, nicht ein grüner CI-Test.
7. **Aktivierung erst nach allen Gates:** Edge mit korrekt gebundenen Secrets deployen; pg_net nur im Badminton-Projekt installieren; in Supabase Vault private_dbv_weekly_url auf den exakten Badminton-Edge-Endpunkt und private_dbv_weekly_token auf denselben privaten Zufallstoken wie Edge setzen. Nie Token in GitHub, SQL-Logs, Issues oder öffentliche Cron-Kommandos schreiben. Erst danach private_content.dbv_weekly_state.enabled=true und einen privaten Cron-Dispatch mit festen Freitag-/Sonntag-Zeiten einrichten. Der gespeicherte Cron-Befehl darf ausschließlich SELECT private_content.dispatch_private_dbv_weekly() enthalten, nicht die Headerwerte. Keine Ausführung vor Quellfreigabe.
8. **Echter Erfolg:** Nach einer neuen offiziellen Veröffentlichung SELECT über public.ranking_weeks (neues Jahr/KW und echtes source_published_at), public.ranking_entries (Tausende Ränge), private aggregierte Club-Abdeckung (13 Vereinsspieler, keine Namen/IDs im Bericht), Status ok, 8-Wochen-Retention und Idempotenz belegen. Ohne diese Belege #414 offen lassen.

## Abnahme / Rollback

- Offline: node --test tests/private-dbv-weekly-model.test.mjs und bestehende Python-Fixtures, alle PR/Main/Pages-Gates. Kein GitHub-Request an Supabase oder DBV.
- Vor produktivem Scheduler: Syntax/SQL-RLS-/Rollen-Audit, autorisierter isolierter XLSX-Test, Edge 2-s-CPU-/256-MB-/150-s-Budget, Zeitstempel/Datum, Datenbank-Rollback und 401/403/429-Negativfälle. Nicht anhand eines simulierten KW43-Datensatzes produktive Aktualität behaupten.
- Stopp: enabled=false und Cron-Job deaktivieren, Vault-Token rotieren, Edge-Sekret deaktivieren. Vorheriger Ranking-Snapshot bleibt unverändert; die ursprüngliche GitHub-Publish-Sperre bleibt bestehen.
- Bis zur externen Quellenfreigabe #17/#56: #414 technisch bearbeiten, nicht aktivieren. Anschließend #370 gezielt abschließen, ohne #414 fälschlich zu schließen.

Keine manuellen Zwischenabnahmen. Die einmalige finale iPhone-/Desktop-Abnahme #28 bleibt separat.


## Konkrete manuelle Aktivierung – NICHT vor #17/#56 und Runtime-Nachweis ausführen

Diese Befehle sind ausschließlich ein Betriebsrunbook. Keine GitHub-Action darf sie ausführen. Der Freigabeverantwortliche muss vorher die Quellen-/Verarbeitungsrechte und die private Authentifizierung dokumentiert prüfen.

1. Im Badminton-Supabase-Projekt die neue SQL-Migration nach Audit anwenden; Funktion in einem isolierten, synthetischen Transaktions-/Rollback-Test prüfen. Keine neuen RLS- oder öffentlichen Grants.
2. Edge-Funktion private-dbv-weekly mit verify_jwt=false und den beiden ausschließlich serverseitigen Secrets PRIVATE_DBV_CRON_TOKEN und DBV_SOURCE_RIGHTS_APPROVED=true ausrollen. Die Quellrechtsfreigabe ist Voraussetzung für dieses Flag. Token per CSPRNG erzeugen (mindestens 32 zufällige Zeichen), nicht im Repository ablegen.
3. Im selben Badminton-Projekt pg_net installieren und über Supabase Vault die Namen private_dbv_weekly_url und private_dbv_weekly_token hinterlegen. URL muss exakt https://yadexibmjmnjfmfabrug.supabase.co/functions/v1/private-dbv-weekly sein; Token muss identisch mit dem Edge-Secret sein. Token nicht in SQL-Abfragen, Cron-Kommandos oder Logs ausgeben.
4. Nach erfolgreichem synthetischem Auth-/DB-/Rollback-Test und CPU-/RAM-Budgetprüfung den Datenbank-Schalter enabled=true setzen und ausschließlich die folgenden festen, in GitHub nicht vorhandenen Cron-Kommandos als postgres einrichten:

    SELECT cron.schedule('badminton-private-dbv-friday', '15 9 * * 5',
      'SELECT private_content.dispatch_private_dbv_weekly()');
    SELECT cron.schedule('badminton-private-dbv-sunday', '15 9 * * 0',
      'SELECT private_content.dispatch_private_dbv_weekly()');

5. Erst nach einer tatsächlich neu veröffentlichten offiziellen KW in der privaten DB über die service-role-only Health-RPC und einen aggregierten SELECT die neue KW, amtlichen Zeitstempel, Tausende Ranking-Einträge, max. acht Wochen, 13er Vereinsstichprobe und Erfolgscode belegen. Kein Statuswechsel allein wegen erfolgreichem Cron-Dispatch.

**Not-Aus:** Zuerst enabled=false, anschließend beide Cron-Jobs per cron.unschedule mit ihren Jobnamen deaktivieren, dann Vault-Token und Edge-Secret rotieren. Kein Re-Enable der alten GitHub-OIDC-Publish-Strecke.

## Stand 28.10.2026 – privater Betrieb nach Aktivierung

Die oben dokumentierte ursprüngliche Aktivierungssperre beschreibt den Planstand vom 27.10. und ist **nicht mehr der aktuelle Ist-Stand**. Nach vom Betreiber bestätigter familiärer Freigabe einschließlich Gesamt-XLSX ist der private Scheduler im ausschließlich richtigen Badminton-Projekt aktiv: Edge `private-dbv-weekly`, private Vault-Authentifizierung, `pg_cron`/ `pg_net`, service-only DB-Zugriff, weiterhin kein öffentlicher App-Release.

**Reale Quellprobleme:** Offizielle DBV-KW43/2026 ist im Archiv genannt. Aus dem Supabase-Edge-Netz kamen dagegen bei offiziellen XLSX-URLs bislang HTTP-200-Antworten ohne Nutzdaten bzw. `source_unavailable`. Ein Produktiv-Snapshot für KW43 ist **nicht** vorhanden; letzter belegter Snapshot bleibt KW42/2026 (17.790 Einträge). Kein Quellenwiderstand durch alte Woche kaschieren, keine Dubletten/erfundene KW.

**Backoff-Scheduler-Fix 28.10.:** Migration `20261028193000_private_dbv_backoff_schedule.sql` ist produktiv wirksam: derselbe private Cron-Job ID 16, vorher `15 12 * * *`, nun `15 0,6,12,18 * * *` UTC. Der Datenbank-Claim bleibt eine zwingende Schranke: Aufrufe vor `next_allowed_at` lösen **keinen externen Download** aus. Maximal vier kurze private Dispatches pro Tag, bei 24h-Backoff höchstens ein tatsächlicher Quellenversuch pro Zeitraum. Backoff wurde **nicht** zurückgesetzt. Beim Stand 28.10. 17:55 UTC: `next_allowed_at=2026-10-29T17:55:15Z`; der nächste zulässige Slot ist 29.10. 18:15 UTC.

**Source-Reliability-Code im privaten Backend-Branch (kein öffentlicher PR/Release):** Nach unabhängig überprüfter Berliner Quellenveröffentlichung und aktuellem Jahr/KW wird erst der direkte offizielle XLSX-Archivpfad und bei transienten Lieferfehlern maximal einmal der bestehende offizielle `/ranking/download`-Weg versucht. Keine Fremdhosts/Umleitungen, keine alten Wochen. 401/403/429 bleiben harte Stoppgrenzen; beide XLSX-Versionen müssen sämtliche ZIP/XML-/Identitäts-/Mengenkontrollen bestehen. Offline-Regressionen im Modelltest dokumentiert.

**Abnahme bleibt offen:** Erst nach einem echten `imported`-Status, einer neuen Woche in `public.ranking_weeks` mit amtlichem `source_published_at`, plausibler Zahl in `public.ranking_entries`, unveränderten privaten Zugriffen und einem zweiten unveränderten Lauf darf #414 geschlossen werden. Bis dahin bloß `source_unavailable` dokumentieren. Aktive App-Publikationssperre bleibt bestehen.

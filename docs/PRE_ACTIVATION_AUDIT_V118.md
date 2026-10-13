# Schmetterlinge – Vorab-Audit vor erster Eigentümeraktivierung

**13. Oktober 2026 · ausschließlich GitHub `metzgerhannes-oss/Badminton` / Supabase `yadexibmjmnjfmfabrug`.**

## Geprüfter Ist-Stand
- `main` bei Beginn: v117, Merge-Commit `73a0a8d7e4a037774aaaeb8a8dc1a9e8b9e9a6ad`, alle regulären Tests, Mobile-QA und Pages-Deployment erfolgreich. Aktueller DBV-Kalender: **283** Einträge; öffentlicher Abruf bleibt möglich.
- **29/29** öffentliche Tabellen mit aktivierter RLS. `anon` und `authenticated` haben **kein direktes SELECT** auf `players`, `matches`, `player_external_match_facts`, `ranking_entries`, `player_publication_grants` und andere Personenbelege. Die öffentlichen Lese-Tabellen enthalten hauptsächlich Kalender-, Turnier-, Vereins- und Ligadaten.
- Alle vier privaten `private_content`-Tabellen (`owner_bootstrap`, `site_owners`, `player_access_invites`, `source_snapshots`) besitzen RLS und **keine direkten SELECT-Rechte für Clientrollen**. Privilegierte Funktionen sind im nicht exponierten Schema und haben genau definierte Execute-Grenzen.
- **0** Auth-Benutzer, **0** Eigentümer, **0** Bootstrap-Codes, **0** aktive Player-Grants und **0** persönliche Einladungen. Keine Berechtigungen simuliert oder künstlich erstellt.
- Die statischen Dateien `data/history.json`, `data/ranking.json`, `data/report-articles.json`, `data/player-history/index.json` sowie `data/player-library/*.json` sind leere Privatmodus-Platzhalter. **Wichtig:** Historische Git-Commits und bereits externe Kopien sind damit nicht nachträglich gelöscht.

## Korrektur im PR #175 / Datenbank v118
Das ursprüngliche Ergebnis „Freigaberichtlinien könnten umgangen werden“ wurde anhand von `pg_policies` präzisiert: Die betroffenen Policies sind bereits **RESTRICTIVE**. Kein Bypass nachgewiesen. Es besteht stattdessen ein Funktions-/Rechteproblem: Restriktive Policies für `public.user_tournament_links` verweisen unmittelbar auf `players` und `player_publication_grants`, obwohl `authenticated` dort bewusst kein `SELECT` hat.

Fix in `database/fix_verified_tournament_publishing_v118.sql`:
1. Ein einziger eng begrenzter `private_content.can_publish_player_tournament(owner,player)`-Check prüft ausschließlich gegen `auth.uid()`, aktiven verifizierten Grant und verifizierte DBV-Quelle.
2. `INSERT` / `UPDATE` behalten **RESTRICTIVE** RLS und zusätzliche Owner-Prüfung. Die bisher vier veralteten Restriktiv-Policies werden ersetzt, nicht in permissive umgewandelt.
3. **Keine neuen Browser-SELECT-Rechte** auf Personen-Tabellen. Kein erzwungener Login für die öffentliche Nutzung.
4. Eine separate Datenminimierung `database/minimize_private_player_payload_v118.sql` entfernt das von Empfänger-UI nicht benötigte Geburtsjahr aus den 30 maximal zugelassenen Matchkarten-Ansichten; Berechtigungs-, Widerrufs- und Quellenprüfungen bleiben.

Beide vollständigen SQL-Probeläufe wurden mit **Rollback erfolgreich** ausgeführt. Vertrags-/CI-Test `tests/verified-share-policy.mjs` wurde ergänzt. Echte Positivtests mit einem berechtigten Eltern-/Eigentümerkonto bleiben vor dessen Aktivierung **nicht möglich**; keine künstlichen Grants erzeugen.

## Aufräumen der alten GitHub-PRs
- **#154 geschlossen:** alte Turnierlink-Variante; v108/109/v116 ersetzt, nicht zurückmergen.
- **#102 geschlossen:** v87-Version öffentlicher Follower-Veröffentlichungen, durch v88–v117/Privatmodus überholt.
- **#151 offen belassen:** gesicherte DBV-Kalender-Vormerkungen bei Gerätewechsel; fehlende Funktionalität in aktueller Backup-Implementierung sorgfältig rebasen.
- **#121 offen belassen:** Desktop-Dashboard; der zugehörige `desktop-dashboard.css`-Baustein ist auf `main` nicht vorhanden.
- **#92 offen belassen:** vollständige Übersetzungspakete; lokale JSON-Kataloge auf `main` sind noch nicht durchgängig auf dem Niveau des PR.

Keine Daten-, Branch- oder Git-Historien-Löschungen durchgeführt. Das Schließen von PRs ersetzt nicht das Bearbeiten zugehöriger Issues.

## Noch offen und nicht als erledigt deklarieren
- **P0 Datenschutz – #56:** tatsächliche Betreiberinformationen, Kontakt für Betroffenenrechte, Rechtsgrundlagen und Quellenbewertung sowie vollständiges Löschkonzept fehlen.
- **P1 – #53:** tatsächliche Aufbewahrungs-/Bereinigungsfristen für personenbeziehbare Daten, Serverlogs und historische Quellen; sichere Berichtigung/Löschung.
- **P1 – #173:** Erstaktivierung des berechtigten Eigentümers. Einmaliger 256-Bit-Code wird **nicht öffentlich erzeugt** und muss auf dem Eigentümer-iPhone eingelöst werden. Das Konto ist noch **nicht** aktiv.
- **Auth-Anonymmodus:** Das Projekt hat noch 0 Auth-Benutzer. Die Einstellung für anonyme Supabase-Registrierungen konnte nicht über den verbundenen Projektzugang ausgelesen werden; ein echter positiver `signInAnonymously`-/`/signup`-Test und iPhone-Sitzungspersistenz sind vor der Eigentümeraktivierung weiter offen. CI-Mocks belegen nur den Frontendablauf, nicht die reale Auth-Providerkonfiguration.
- **Echter Ende-zu-Ende-Test auf zwei iPhones** (Eigentümer aktivieren, eigenen DBV-Spieler nach bewusstem Berechtigungsnachweis freigeben, Freundeslink sieben Tage zur Annahme, Wiederaufruf, Widerruf) noch nicht erfolgt.
- **Alte öffentliche Git-Historie:** eine technische Auslieferungssperre bereinigt keine historischen Commits; separate, sorgfältig geplante Historien- und Kopienbewertung nötig.
- **Supabase Advisor:** 17 INFO zu Tabellen mit RLS ohne Policy (bei absichtlichen Privat-Tabellen erwartbar); weitere Index- und Primary-Key-Hinweise sind zunächst Performance-/Wartungsthemen, keine bestätigten Sicherheitslecks.
- **P1 Default-Rechte für `supabase_admin` – #177:** Im Schema `public` bestehen zu breite Standard-ACLs für künftige, durch `supabase_admin` angelegte Objekte. Das ist **kein nachgewiesener aktueller Zugriff**. Der verbundene Projektzugang darf die interne Rolle weder übernehmen noch ihre Default Privileges ändern (beide Versuche endeten mit `42501`). Keine Eskalation von Rollenrechten, keine globalen Supabase-Änderungen. Bis zur plattformseitigen Klärung jede neue eigene Tabelle per RLS/REVOKE gesondert testen.
- **Kosten:** Die v118-Änderung benötigt weder neues Hosting noch Premiumdienste. Eine tatsächliche Abrechnungsbestätigung für den aktuellen Supabase-/Cloudflare-Account ist aus diesem Code-/Datenbankaudit nicht ableitbar.

## Aktivierungsgrenze
Die App ist weiterhin ohne Anmeldung nutzbar; Eigentümer- und Spielerfreigaben sind vor dem ersten gültigen Claim bewusst **fail closed**. Vor erfolgreicher CI und Merge von #175 keine Änderung der v118-Datenbankrechte. Freigabecode ausschließlich aus dem geschützten Badminton-Supabase-Admin-Weg erstellen und auf dem **richtigen Homescreen-Gerät** eingeben. Weder Code noch Hash in Git oder Issues veröffentlichen.

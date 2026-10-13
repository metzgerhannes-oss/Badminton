# Schmetterlinge · Zugriffsmodell ohne Pflichtanmeldung (v105)
**Entscheidung 12.10.2026 · GitHub metzgerhannes-oss/Badminton · Supabase yadexibmjmnjfmfabrug**

## Drei getrennte Berechtigungsräume

| Nutzung | Konto | Speicherung | Berechtigung |
| --- | --- | --- | --- |
| Öffentliche Spieler, Teams, DBV-/Badhub-Spiele, Ranglisten und Turniere ansehen | **keins** | öffentliche lesbare Datenbank / Quellen | öffentliche, validierte SELECT-Pfade |
| Eigene Spielerprofile, Followlisten, Spond-Termine, Turnierfavoriten | **keins** | lokal im Browser und optional offline JSON-Backup | Gerät |
| Persönlichen Termin gezielt per **privatem Einladungstoken** teilen | technisches anonymes Konto **erst beim Erstellen** des Links; Leser ohne Konto | zukünftiger isolierter privater Serverdatensatz | nicht erratbares Lesetoken, widerrufbar |
| Konto sichern und über mehrere Geräte nutzen | **optional** mit verifizierter E-Mail/geeignetem Provider | nur eigene Auswahlen; private RLS | authenticated user ID und Eigentümerprüfung |
| Für alle DBV-Follower im Namen eines Spielers veröffentlichen | technischer Auth-User **plus unabhängiger gültiger Veröffentlichungsnachweis** | vorhandene `user_tournament_links` / `shared_tournament_hints` | **v90-Grant**, RLS und Widerruf |

Die DBV-Spieler-ID weist nur auf eine öffentliche Sportidentität hin. Sie beweist **keine** Sorgeberechtigung. Eine anonyme Supabase-Sitzung wird in PostgreSQL technisch als `authenticated` behandelt, ist aber deshalb **nicht** identitätsgeprüft. Private Empfängerlinks verleihen kein Veröffentlichungsrecht.

## Bereits produktiv / v105

- Öffentliche Lesefunktionen ohne Login und lokale Profile, Freunde, Favoriten ohne Cloud-Pflicht.
- Bisherige Veröffentlichung mit ausdrücklichem Häkchen und v90-Grant bleibt unverändert abgesichert.
- **v105 nur Nutzertext:** Das Häkchen wird ausdrücklich als **öffentliche** Meldung bezeichnet; ohne Häkchen bleibt das eigene Turnier lokal. Das Frontend fordert keine manuelle Account-Anlage an.
- Für öffentliches Lesen und lokale Favoriten entsteht keine Auth-Sitzung. Seit v107 erzeugt auch ein gesperrter öffentlicher Veröffentlichungsversuch **kein** anonymes Konto. Nur die ausdrücklich angeforderte private Linkerstellung kann eine anonyme Sitzung erzeugen.
- v109 ergänzt die **ausdrücklich ausgelöste private Einzelturnier-Einladung** (sieben Tage, Widerruf, Empfänger ohne Konto). Eine freiwillige dauerhafte Kontosicherung oder Mehrgeräte-Synchronisierung bleibt #140 und darf nicht als fertig bezeichnet werden.

## Reihenfolge der noch offenen Umsetzung

1. **#139 (P1): v109 technisch implementiert, echte Geräteabnahme noch offen.** Privater Einzelturnier-Link ohne Empfängerkonto, 256-Bit-Token als Fragment, serverseitiger Hash, sieben Tage, Widerruf und Quoten 12 pro Tag / 8 aktiv je technischer Identität. Keine DBV-Teilnahmebehauptung. Der Empfänger kann den Link weitergeben oder Inhalte kopieren.
2. **#140 (P2)** Freiwilliges dauerhaftes Konto (z.B. verifizierte E-Mail), sichere Übernahme vorhandener lokaler Daten, Zwei-Geräte-Synchronisation und Konfliktauflösung. Ohne optionales Konto bleibt lokale Nutzung vollständig erhalten. SMTP-/Free-Tarif-Kontingente vor Aktivierung bewerten.
3. **#101 (P0)** Nur wer öffentlich für einen konkreten Spieler handeln darf, erhält nach unabhängiger Prüfung einen v90-Grant; kein automatischer Grant aus DBV-ID, Einladung oder technischem Account. Reale A/B-Geräteprüfung vor Pilot.
4. **#53, #56 (P1)** Datenschutzinformationen, Nutzungsgrundlagen, Aufbewahrung für Einladungen/anonyme Auth-Benutzer, Korrektur/Löschung und Schutz von Minderjährigen.
5. **#28 (P0)** iPhone-PWA, kleine Bildschirme, Offline, App-Rückkehr, URL-/Token-Leckage, RLS- und Widerrufstests.

## Sicherheits- und Kostengrenzen

- Keine Service-Role-Schlüssel im Browser, kein unauthentifiziertes öffentliches Schreiben, kein Admin-onboarding aller Besucher.
- Anonyme Auth-Nutzer nur bei tatsächlicher Cloud-Aktion erstellen; Rate-Limits und Cleanup der verwaisten Nutzer nach rechtlich bestätigter Frist, nicht bei jedem Seitenaufruf.
- Nutzerbezogene RLS-Policies stets an `auth.uid()` binden. Bei sensiblen Funktionen zusätzlich geprüfte Berechtigung; `authenticated` allein genügt nicht.
- Standardmäßig keine private Termin- oder Kinderprofilveröffentlichung an alle Follower.
- Der bisherige offline Backup-/Restore-Weg darf nicht entfernt werden. Kein zusätzlicher kostenpflichtiger Anbieter.

## Release-Abnahme

- Neugerät: DBV-Suche, Folgen, Turniere und lokale Favoriten ohne Auth-Request, kein blockierender Accountdialog.
- Ohne veröffentlichtes Grant: öffentlicher Share-Schreibversuch bleibt **serverseitig** blockiert, Originalbookmark bleibt lokal.
- Bestehende v90-RLS und Triggerprojektion unangetastet.
- Für die späteren privaten Links gesonderter positiver/negativer Endgerätetest und Quoten-/Revocation-Prüfung.

Das Zugriffsmodell wird stufenweise umgesetzt; v109 private Einladungen sind von optionalen dauerhaften Konten (#140) strikt getrennt. Die DSGVO- und Geräteabnahmen bleiben offen.

## v109 · Betreiberabnahme, keine automatische Kontopflicht

Die Migrationen `private_tournament_invites_v108` und `private_tournament_invites_rpc_hardening_v108` sind bereits produktiv im korrekten Badminton-Supabase-Projekt `yadexibmjmnjfmfabrug`. Die v109-Oberfläche nutzt diese bestehenden, eigentümergebundenen RPCs; sie ändert keine RLS-Regel. Lesen funktioniert ohne Login. Der Ersteller fordert erst beim bewussten Tippen auf „Link erstellen“ ein anonymes Konto an. Bei deaktivierter Anonymous-Auth bleibt der lokal gespeicherte Termin unverändert und der Link kann nicht erstellt werden.

Im Einladungssatz stehen lediglich Turniername, Beginn, Ende und offizielle DBV-Quelle. Der Link überträgt keine Spieler-ID, Familienliste, Geburtsdaten, Spond-Privattermine oder angebliche Turnierteilnahme. Das 256-Bit-Token wird nur im URL-Fragment weitergegeben und vor einem Netzabruf aus der Browseradresszeile entfernt. Die Empfängerseite erstellt kein Auth-Konto und gibt bei ungültigen, abgelaufenen oder widerrufenen Tokens dieselbe Rückmeldung. Der Ersteller kann ihn widerrufen, solange die ursprüngliche anonyme Sitzung verfügbar ist. Bei Geräteverlust gilt die serverseitige Ablaufgrenze von maximal sieben Tagen.

**Offen vor endgültiger Betreiberfreigabe:** Produktive Endgerätabnahme der Anonymous-Auth-Aktivierung, tatsächliche Fristen für Einladungsmetadaten und anonyme Auth-Konten, Missbrauchsmuster bei wiederholten neuen anonymen Accounts, Datenschutz-/Quellenrechte (#53/#56) und Wiederherstellung auf zwei realen Geräten. Der Besitz eines Einladungstokens berechtigt nicht zu öffentlichen Einträgen im Namen eines Kindes.

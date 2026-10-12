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
- Die Auth-Sitzung wird nicht auf dem Willkommensbildschirm oder beim App-Start erzeugt. Seit v107 fordert auch ein öffentlicher Veröffentlichungsversuch nur eine **bereits bestehende Sitzung** über `getSession(false)` an. Ein neues anonymes Konto wird nicht für voraussichtlich unberechtigte öffentliche Meldungen erzeugt. Der Versuch bleibt lokal.
- V105 stellt **noch keinen** privaten Einladungslink und keine freiwillige persistente Kontosicherung bereit; entsprechende Buttons oder Zusagen dürfen nicht erscheinen.

## Reihenfolge der noch offenen Umsetzung

1. **#139 (P1)** Privater Einladungstoken: einzelne Turnierdaten, read-only ohne Empfängerkonto, serverseitig beschränkte TTL, Widerruf und Missbrauchsschutz. Ein Link kann weitergegeben und Inhalt kopiert werden; keine falsche Vertraulichkeitsgarantie. Keine DBV-Teilnahmebehauptung.
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

Das ist eine schrittweise Produktentscheidung. Die v105-Textkorrektur ist keine Behauptung, dass #139 oder #140 bereits verfügbar sind.

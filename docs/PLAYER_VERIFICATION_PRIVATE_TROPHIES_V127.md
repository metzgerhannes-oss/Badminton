# Schmetterlinge v127: unabhängige Spielerprüfung und private Trophäen

**Status: Review-Entwurf. Nicht produktiv migriert, kein öffentlicher Release.**
Datenbank: ausschließlich `Badminton` (`yadexibmjmnjfmfabrug`).
Abhängigkeiten: #173, #187, #188, #53/#56, v126-Archiv.

## Nutzerweg ohne Pflichtkonto

1. Jede Person kann weiterhin ohne Registrierung öffentliche, rechtmäßig verfügbare Turniere lesen und Spieler lokal folgen.
2. In **Einstellungen → Profile & Familie**: Spieler per bereits vorhandener DBV-Suche finden, DBV-ID auswählen und ausdrücklich **Prüfung beantragen**.
3. Erst dieser Klick erstellt bei Bedarf eine technische anonyme Auth-Sitzung. Gespeichert wird eine einzelne Spieler-ID, gewünschter Bestätigungskanal, Antragsteller-Sitzung und Zeitstempel, **keine Ausweiskopie oder Elternnachricht**.
4. Eine **unabhängig etablierte** Vereins-/Verbands- oder legitimierte Eltern-Prüfstelle gleicht den Antrag **außerhalb der App** ab. Die Anfrage allein und der Besitz einer DBV-ID sind kein Nachweis. Der technische Prüferaccount muss zuvor über eine separate verifizierte organisatorische Kontaktstrecke eingeschrieben sein; hierfür dürfen **nicht** nur Eigentümerrolle/Checkbox oder ein selbst erzeugtes Token genügen. Es werden **keine normalen Besucheraccounts manuell angelegt**.
5. Ein **anderer** Prüfer als der Antragsteller bestätigt den konkreten Spieler mit einem knappen internen Beleg-Referenzcode, Zeitpunkt und Prüfermethode. Nur dann wird ein spielergebundenes `player_publication_grants`-Recht erzeugt. Prüfer müssen den tatsächlichen Nachweis eigenverantwortlich außerhalb der App dokumentieren. Die technische Prüfung bestätigt nicht eigenständig eine Sorgeberechtigung.
6. Danach können **neue** Links mit 256-Bit-Fragmenttoken erzeugt werden. Sie enthalten **Profil, belegte Plätze 1–4, vorhandene Matchstatistiken** für genau einen Spieler; einmalige Annahme innerhalb 7 Tagen, Zugriff danach bis Widerruf.
7. Bestehende Einladungen behalten Version 1: **Profil und bisherige höchstens 30 Matchkarten, keine Trophäen**. Es gibt keine automatische Erweiterung von Bestandslinks oder den derzeitigen zwei `guardian_review`-Grants.

## Sicherheit und Datenhaltung

- `private_content.player_management_reviewers`: wenige separat legitimierte Prüfer, kein öffentlicher Registrierungs-Endpunkt.
- `private_content.player_management_requests`: pro Spieler und technischer Sitzung, höchstens fünf Anfragen am Tag pro Sitzung und genau ein offener Antrag pro Spieler. RLS aktiv, **keine direkten Browser-Tabellenrechte**.
- `private_content.has_independent_player_grant`: prüft aktiven Spielergrant, genehmigte Einzelanfrage, anderen aktiven Prüfer und gültige Referenz. Widerruf von Grant, unabhängiger Prüfung oder Prüfer blockiert neue Rechte.
- `private_content.player_access_invites`: `scope_version` und `granted_sections` werden serverseitig gespeichert, alte Zeilen erhalten Version 1.
- `public.private_player_trophies_read`: nur für akzeptierte, nicht widerrufene Version-2-Einladungen in der Empfängersitzung. `public.private_owner_trophies_read`: nur mit nachweisbar unabhängig verifiziertem Recht für den *konkreten* Spieler.
- Trophäen werden nur aus dem geschützten v126-Archiv und den übereinstimmenden `verified=true`-Belegen des geschützten `data/history.json`-Snapshots projiziert. Der Read-only-Vorabgleich fand **24/24** Top-4-Einträge anhand DBV-ID, Datum, Disziplin, Platz und Originalquelle; keine 5.-Plätze, Doppelzählung, ersetzten Belege oder erfundenen Erfolge.
- Startseite/Historie benutzen dieselbe kurzlebige Speicher-Projektion; **keine** personenbezogenen Archive in GitHub Pages, JSON, lokales Backup, Service-Worker-Cache oder Actions-Logs. Ein fehlendes Recht oder ein Timeout ist **kein Ergebnis von 0**.
- Die 839 bereits archivierten externen Matchkarten sind **keine vollständige Sportkarriere**. Bis zu 30 abrufbare Matches pro bisherigem Einladungs-Leseweg dürfen nicht als lebenslange Statistik bezeichnet werden.

## Produktiv-Gates

- [ ] Datenschutzhinweis, Quellenrechte, Kontakt und Löschfristen für Minderjährige nach #53/#56 fachlich geprüft.
- [ ] Mindestens ein unabhängiger Reviewer **real geprüft** und sicher eingebunden; kein Betreiber-Selbstnachweis.
- [ ] SQL-Migration gegen einen isolierten Teststand getestet; Tabellenprivilegien/RLS und RPC-Execute-Grants kontrolliert.
- [ ] Negativtests: unbekannter Prüfer, Selbstbestätigung, fremde DBV-ID, fremder Empfänger, alte Version-1-Einladung, Link nach Widerruf, Prüfer-Revoke, abgelaufener offener Link, Sessionverlust und Netzfehler.
- [ ] 49 Archivplätze/24 belegte Top-4 ohne Doppelzählung, 13 Club-Profile, 839 vorhandene Matchkarten nach Migration unverändert.
- [ ] Chromium, WebKit und echtes iPhone (QR-/Homescreen-Aufruf, Zurücknavigation, Profilwechsel); offline keine falschen sportlichen Nullen.
- [ ] Erst **Migration nach Review**, dann App-Release mit abgestimmter Versionsnummer, PWA-Cache, Mehrsprachigkeit #180; ungetestete Draft-PRs #191/#193 koordinieren. Keine neue kostenpflichtige Plattform.

**Wichtige verbleibende Lücke:** Ohne tatsächlich geprüfte organisatorische Bestätigung kann und soll die neue Berechtigung nicht aktiv werden. Auch nach technischer Freigabe ist eine personelle Nachweisentscheidung notwendig; das ist keine manuelle Benutzerkontenpflege. Die echten neuen Trophäen- und Matchfreigaben werden erst nach bestätigtem E2E-Test als live bezeichnet.

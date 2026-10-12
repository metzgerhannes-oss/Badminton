# Private Turnierlinks · v108 · technische und fachliche Abnahme

**Ausschließlich Badminton:** GitHub `metzgerhannes-oss/Badminton`, Supabase `yadexibmjmnjfmfabrug`.

## Verhalten
- Normaler Besuch, Spielersuche, Turnierlesen, Vormerken und Folgen: **ohne Login und ohne neues Auth-Konto**.
- In einer eigenen gespeicherten Turnierkarte wird „Privat teilen“ angeboten. Nur wenn der Nutzer anschließend **„Link erstellen (7 Tage)“** drückt, darf Supabase bei Bedarf ein anonymes Geräte-Auth-Konto erzeugen. Das setzt aktivierte anonyme Anmeldungen im Projekt voraus und funktioniert nicht, wenn der Provider deaktiviert ist.
- Der Link enthält im URL-Fragment einen kryptografisch zufälligen 256-Bit-Schlüssel. GitHub Pages sieht den Fragmentwert nicht bei der Seitenauslieferung. Das Empfängerfenster überträgt den Schlüssel in einem HTTPS-POST an `private_tournament_invite_read`; danach wird das Fragment aus der Adresszeile entfernt.
- Empfänger braucht kein Konto und sieht **nur Name, Datum, offiziellen DBV-Link, Ablaufdatum**, nicht Spieler, Freunde, DBV-Spieler-ID, Profil oder behauptete Teilnahme. Nur gültige, nicht widerrufene Einzellinks werden gelesen.
- Ersteller kann auf dem ursprünglichen Gerät widerrufen. Server prüft den Auth-Eigentümer. Verlorenes anonymes Gerät kann bis zum Ablauf des 7-Tage-Links **nicht** zuverlässig wiederhergestellt/widerrufen werden. Das ist sichtbar zu erklären. Links und kopierte Inhalte lassen sich vom Empfänger weitergeben; ein Widerruf löscht keine bereits kopierten Inhalte.

## Datenbank und Grenzen
- Migration: `database/private-tournament-invites-v108.sql`. RLS **aktiv**, keinerlei direkte Leserechte oder Schreibrechte für `anon` und `authenticated` auf die Tabelle. Nur drei gezielt freigegebene RPCs.
- Der Server speichert Token **nur als SHA-256-Digest**, sowie technische Owner-UID, Turniername, Datum, Quelllink und Fristen. Keine Profile, E-Mail, Spieler-ID, Teilnehmerlisten oder privaten Spond-Daten.
- Serverseitige Quoten: maximal 12 Erstellungen in 24 Stunden und 8 parallel aktive Links pro technischer Identität; Erstellung pro Owner serialisiert. Die Quoten ersetzen keinen IP-basierten Bot-Schutz. Keine externen Anbieter oder Bezahldienste werden eingeführt.
- Gültigkeit 7 Tage; Widerruf wirkt sofort. Täglicher pg_cron entfernt widerrufene oder abgelaufene Daten nach weiterer maximal eintägiger Frist. Supabase Auth-Nutzer und Providerlogs haben **separate** noch rechtlich zu bestimmende Aufbewahrungsregeln (#53/#56).
- Status „privat“ bedeutet einen nicht erratbaren, weiterleitbaren Link, **keinen** Nachweis der Sorgeberechtigung. Das öffentliches Followermeldesystem mit geprüftem v90-Grant bleibt unverändert gesperrt, wenn die Berechtigung fehlt.

## Abnahme vor Live
1. Auth-Konfiguration: Anonyme Anmeldung in Supabase Auth aktiviert? Andernfalls nur bedingte Funktion, Hinweis ohne Datenänderung; keine Aktivierung eines kostenpflichtigen Providers.
2. Produktiver SQL-Audit: Direct-table grants=0, RLS, RPC-EXECUTE exakt, Besitzer-/Nichtbesitzer-Widerruf; ungültiger Token liefert 0 Treffer, kein Enumerations-Endpunkt.
3. Nutzerfluss mit zwei getrennten Geräten: keine Anmeldung beim Empfänger, kein Konto bei bloßem Öffnen, ein Konto erst bei **Link erstellen**, echte Quelle ohne Spielerzuordnung, Fremdzugriff nur auf exakt einen Termin, Widerruf und Ablauf.
4. Chrome/Android, kleines iPhone/WebKit, installierte PWA, Offline-Fehler, Safari-Neustart, Geräteverlust und Weiterleitung von Links prüfen. Kein stilles öffentliches Teilen.
5. Integration in lokale Turnierliste des Empfängers durch explizite Auswahl **noch offen**. Aktuell zeigt der Link ausschließlich die Terminquelle und kann manuell als Link weitergegeben werden.
6. Rechtliche Prüfung der Quellen, Speicherfristen und Minderjährigeninformation bleibt unabhängig offen (#53/#56). Das vollständige Datenschutzkonzept darf nicht als erledigt markiert werden.

Die Migration wird ausschließlich über den Supabase-Migrationsmechanismus für `yadexibmjmnjfmfabrug` angewandt. Solange Migration, Auth-Konfiguration oder Live-Abnahme fehlen, nicht als vollständig produktiv bestätigen.

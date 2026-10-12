# Schmetterlinge · Offline-Datensicherung und Wiederherstellung (v108)

**Produktionsprojekt:** Badminton / Schmetterlinge, GitHub `metzgerhannes-oss/Badminton`. Die Sicherungsdatei bleibt vollständig lokal; kein Upload an GitHub, Supabase oder Cloudflare. Nur ausdrücklich vom Nutzer gewählte Download-/Dateifreigabe findet statt.

## Geänderter Umfang
- Das bislang unterstützte lokale Benutzerprofil (`shuttleboard-v1`) enthält eigene Spieler, gefolgte Spieler und offizielle DBV-Turnierfavoriten.
- **Ab v108 zusätzlich** das getrennte private Spond-Kalenderarchiv `schmetterlinge.calendarEvents.v1`: maximal 120 importierte Termine mit Titel, Datum, optionalem Ort, lokaler UID, zugeordnetem *eigenem* Spielerprofil und lokalem Importzeitpunkt.
- Es werden keine Supabase-Tokens, API-Keys, Cloud-Protokolle, Fremdprofile als Eigentum oder zentralen DBV/Badhub-Matchbelege in die Sicherungsdatei aufgenommen.
- Spond-Termine werden **nicht** zentral veröffentlicht, nicht als bestätigte Teilnahme bezeichnet und nicht automatisch an Follower weitergegeben.

## Dateiformate und rückwärtskompatibler Import

| Format | Erstellen | Einlesen | Spond-Verhalten |
| --- | --- | --- | --- |
| v1 | ältere App-Version | weiterhin unterstützt | Die Datei hatte keine Spond-Termine; vorhandene lokale Spond-Termine des Zielgeräts bleiben erhalten |
| v2 | ab v108 | unterstützt | Eigentümergebundene private Spond-Termine werden nach ausdrücklicher Bestätigung vollständig ersetzt |

Die Importvorschau zeigt Profil-, Freundes-, DBV-Favoriten- und Spond-Terminzahlen. Vor jedem Ersatz muss der Nutzer bestätigen; aktuelle Daten können zuvor offline exportiert werden. Ungültige Daten, unzulässige Links, fremden Spielern zugeordnete Termine, Dubletten, ungültige Kalenderdaten und übergroße Dateien werden abgewiesen. Die App erneuert nach Erfolg die Ansicht.

**Hinweis:** Bei einer v2-Rücksicherung werden bereits auf dem Zielgerät gespeicherte private Spond-Termine überschrieben; es findet **keine automatische Zusammenführung** statt. Das ist im Bestätigungsdialog angegeben. Beschädigte oder ältere Dateien dürfen nicht stillschweigend gespeicherte private Kalendertermine löschen.

## Technische Abnahme

- `tests/local-backup.mjs`: v2-Roundtrip und v1-Import; ungültige Referenzen, Doppeltermine und korrupte Dateien; kein Versand privater Daten.
- `tests/e2e/backup-transfer.spec.mjs`: zwei unabhängige Browser-/Gerätekontexte; echte vom Browser heruntergeladene JSON-Datei wird im anderen Browser wieder eingelesen; Abbruch erhält Altbestand; bestätigte Wiederherstellung lädt Profile und Spond-Termine; Einstellungen außerhalb der Sicherung bleiben erhalten.
- Dieses E2E-Verfahren ist ein **automatisierter Mehrbrowser-Test**, kein echter physischen iPhone-zu-iPhone-Transfer. Ein realer Safari-Dateien-App-/Homescreen-Test bleibt separat erforderlich.
- Die produktive Supabase-Datenbank ist **nicht** Bestandteil der Geräte-Sicherung. Ein authentifizierter Datenbank-Disaster-Recovery-Test auf getrennter Umgebung bleibt eine eigenständige offene Aufgabe; keine personenbezogenen Exporte in ein öffentliches Repository.

## Datenschutz und Kosten

Der Export ist freiwillig und beinhaltet persönliche Spieler- und Kalenderdaten. Nutzer sollten die Datei in einer geschützten lokalen/iCloud-Dateiablage speichern; wenn sie sie über andere Apps versenden, liegt die Verantwortung für diese Weitergabe beim Nutzer. Die App erhebt für diesen Vorgang weder eine E-Mail-Adresse noch ein neues Konto. Keine Abhängigkeit von kostenpflichtigen Backupdiensten.

## Betreiber-Abnahme

- [x] Datenumfang und Sicherheitsvalidierung des offline Dateiformats implementiert
- [x] Automatisierter Zwei-Browser-Wiederherstellungstest im Release-CI
- [ ] Praktischer iPhone-zu-iPhone-Transfer mit Dateien-App, PWA und Gerätewechsel dokumentiert
- [ ] Berechtigter Datenbank-Backup- und Wiederherstellungstest auf getrennter Testumgebung dokumentiert
- [ ] Verbindliche Fristen/Kontakt für zentral gespeicherte öffentliche personenbezogene Sportdaten (separat #53/#56)

**Keine Aussage über eine vollumfängliche Datensicherung der gesamten Plattform oder vollständig abgeschlossene DSGVO-Pflichten.**

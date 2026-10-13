# Wiederherstellung ohne kostenpflichtigen Backupdienst – Schmetterlinge

Stand 13.10.2026 · **Arbeitsanweisung, noch KEINE erfolgreich getestete vollständige Datenbankwiederherstellung.**
Nur für Badminton-Supabase `yadexibmjmnjfmfabrug`. Die andere Supabase-Organisation bzw. Gartenwelt niemals als Backup-Ziel verwenden.

## 1. Zwei strikt getrennte Sicherungen

| Bereich | Wo gespeichert? | Sicherungsmethode | Wiederherstellungsstatus |
| --- | --- | --- | --- |
| Eigene Profile, Freunde, persönliche Favoriten, private Spond-Termine | Browser / iPhone (localStorage) | In der App **Einstellungen → Meine Daten sichern** (lokale JSON-Datei) | Zwei-Browser-Tests mit Chromium/WebKit grün; echte iPhone-zu-iPhone-Abnahme noch offen (#153) |
| Gemeinsame DBV-/Badhub-Sportdaten, Imports, RLS, Datenbankjobs | Badminton-Projekt in Supabase | Manuell gesicherter, zugriffsgeschützter Supabase-CLI-Export | Schema/Quelle geprüft; echter Wiederherstellungstest auf isolierter Umgebung noch offen |

Es gibt **keine** bestätigte automatische Wiederherstellung aus einem Supabase-Free-Plan-Backup. Laut Supabase-Dokumentation sind tägliche verwaltete Backups für Pro/Team/Enterprise vorgesehen; Free-Projekte sollten ihre Daten selbst regelmäßig exportieren.

Quellen: https://supabase.com/docs/guides/platform/backups · https://supabase.com/docs/guides/self-hosting/restore-from-platform

## 2. Echtes iPhone → iPhone: praktische Abnahme

1. Auf iPhone A Schmetterlinge öffnen, **Einstellungen → Meine Daten sichern**, die `schmetterlinge-sicherung-YYYY-MM-DD.json` über das lokale iOS-Dateimenü in einem geschützten privaten Ort speichern. **Keine öffentliche iCloud-Freigabe, kein GitHub-Issue/Actions-Artefakt.** Die JSON enthält Namen, DBV-IDs und ggf. private Termine im Klartext (nicht verschlüsselt).
2. Dateigröße/Erstellungstag notieren, anschließend iPhone B im Safari-/Homescreen-Modus ohne Anmeldung aufrufen. Dort vor dem Ersetzen der vorhandenen Profile ebenfalls eine eigene lokale Sicherung erstellen.
3. Datei **nur aus einer vertrauenswürdigen Quelle** auf B öffnen; Importvorschau prüfen und den Ersetzungsdialog bestätigen. Danach App schließen/neu öffnen, aktive Profile, Freundesliste, Turnierfavoriten und private Spond-Termine abgleichen.
4. Negativtest: importieren abbrechen und ungültige Datei auswählen. Bestehende Daten auf B dürfen nicht gelöscht sein; auf A darf nichts verändert worden sein.
5. Getrennt prüfen: alte Backup-Version v1 darf private Spond-Termine auf dem Zielgerät **nicht** löschen. Aktuelle v2 sichert Spond-Termine ausdrücklich mit.
6. Testprotokoll **nur mit anonymen Zählergebnissen** (z. B. `2 Profile / 3 Favoriten / 1 privater Termin`) und Gerät/Browser-Version dokumentieren. Keine Identifikatoren, Screenshots von Kinderprofilen oder JSON-Dateien in öffentliche Issues.

**Abnahmebedingung:** Auf zwei physischen iPhones durchgeführt, nicht lediglich Playwright. Ohne Geräteprüfung bleibt #153 offen. Browser-Tests sind kein Nachweis erfolgreicher Wiederherstellung im tatsächlichen Safari-/PWA-Dateidialog.

## 3. Manuelle Datenbanksicherung (nur berechtigtes lokales Admin-Gerät)

Voraussetzungen: Zugriff auf das **richtige** Badminton-Projekt, lokale Supabase CLI und Docker, genügend Speicher und ein privat verwahrter Datenbank-Verbindungsstring aus `Supabase → Badminton → Connect`. **Niemals Zugangsdaten in GitHub, Browser-JavaScript, CI-Logs oder den Chat kopieren.** Keine neue Supabase-Organisation und keinen kostenpflichtigen Dienst anlegen.

Laut offizieller Supabase-Anleitung können Rollen, Schema und Daten jeweils separat exportiert werden. Die folgenden Befehle sind **Vorlagen, nicht von uns ausgeführt**:

```sh
umask 077
# SUPABASE_DB_URL nur auf dem lokalen Admin-Gerät sicher als Umgebungsvariable bereitstellen.
supabase db dump --db-url "$SUPABASE_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f schema.sql
supabase db dump --db-url "$SUPABASE_DB_URL" -f data.sql --use-copy --data-only
```

- `roles.sql`, `schema.sql`, `data.sql` geschützt und verschlüsselt **außerhalb** öffentlicher Repositories aufbewahren; Aufbewahrungszeit, berechtigte Personen und sichere Löschung mit #53/#56 verbindlich festlegen.
- `data.sql` kann Daten zu Minderjährigen enthalten. **Nicht** für automatisierte GitHub-Tests verwenden. Keine Produktionsdaten auf offen erreichbare Entwicklungsserver kopieren.
- Der CLI-Dump filtert Supabase-spezifische interne Daten; deshalb **kein** Versprechen, dass Auth-/Cron-/Storage-/Edge-Konfiguration allein durch `schema.sql` rekonstruiert wird.
- Edge-Quellcode separat aus `supabase/functions` im GitHub-Repo vorhalten. Deployed-Versionen mit Supabase direkt gegenprüfen. Insbesondere `dbv-calendar-publish` benötigt weiterhin restriktive GitHub-OIDC-Verifikation; `history-match-import` benötigt weiterhin serverseitige Quoten und Größenlimits.
- Bei Passwort-/Tokenkompromittierung Berechtigungen separat widerrufen/rotieren; ein Datenbankdump ersetzt keine Schlüsselverwaltung.

## 4. Restore-Probe ohne personenbezogene Produktionsdaten

**Nicht auf der Live-Datenbank testen.** Lokal eine isolierte Supabase-Umgebung vorbereiten (gemäß offizieller CLI/Docker-Anleitung, kompatible Postgres-Version – produktiv derzeit PostgreSQL 17). Für den ersten Techniktest **nur Schema** und synthetische Datensätze verwenden; echte Datenkopien erst nach gesonderter Datenschutz-/Zugriffsentscheidung in entsprechend geschützter Umgebung.

1. Lokales Testziel neu und leer aufsetzen. Keine produktiven Auth-Konten/Token übernehmen.
2. Versionskompatibilität, Erweiterungen und Schema aus der Sicherung beziehungsweise aus den vorhandenen Migrationen abgleichen. Rollen/Schema mit der offiziellen Supabase-Anleitung wiederherstellen; unterschiedliche Supabase-Versionen können manuelle Korrekturen erfordern.
3. Mit **rein synthetischen** Sport-/Turnierdatensätzen eine isolierte Schreib-/Leserunde durchführen. RLS und effektive `anon`-/`authenticated`-Grants kontrollieren, **keine** realen Spieler oder Einladungen als Test verwenden.
4. `database/public-security-audit-v54.sql` und `database/operational-health-readonly.sql` gegen das Testziel ausführen; alle unerwünschten Browserrechte und RLS-Deaktivierungen müssen 0 sein. `supabase_admin`-Default ACL (#54) separat mit berechtigter Administration lösen, nicht über Rollenübernahme.
5. Cron-Schedules, DB-Funktionen, Indexe, Extensions und Auth/Realtime/Storage-Einstellungen abgleichen; periodische externe Quellenjobs **im Testziel deaktiviert lassen**, damit keine Doppelimporte/unnötigen Netzabfragen stattfinden.
6. Edge Functions nur mit korrekter Ziel-URL und sicherem Auth-Modell bereitstellen; keine `service_role`-Secrets in die PWA. GitHub Pages/PWA separat veröffentlichen, niemals gegen das Testziel mit produktiven Zugangsdaten.
7. Ergebnis protokollieren: geprüfte Migrationen, RLS/ACL-Zählwerte, synthetische Wiederherstellung, bekannte Lücken. Erst danach reale Disaster-Recovery-Fähigkeit behaupten.

## 5. Betreiberpflichten und offene Grenzen

- Backup verschafft dem Betreiber noch **kein** abgeschlossenes DSGVO-Lösch- und Berichtigungsverfahren. Betroffenenkontakt, Quellenrechte und Aufbewahrungsfristen bleiben #53/#56.
- Für tatsächliche Datenbankwiederherstellung muss die private Sicherung samt Wiederherstellungsziel kontrolliert sein. Ein grüner GitHub-CI-Test ist dafür kein Ersatz.
- Vor einer Wiederherstellung bestehende Nutzer-/Importänderungen und Datenverlustrisiko bestimmen. Keine direkte Überschreibung der Live-Datenbank auf Basis dieser Anleitung.
- Cloudflare-Tarif/Zahlungsmethoden können nicht aus Supabase-Backups abgeleitet werden (#161).

**Abnahme dieser Datei:** Dokumentation und strukturierter Plan, **keine** ausgeführte Datenbanksicherung oder vollständige Wiederherstellungsprobe.

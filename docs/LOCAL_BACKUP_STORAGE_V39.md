# Schmetterlinge v39 – Lokale Datensicherung / Storage-Vertrag

Stand: 10.10.2026. Priorisierung: `UX-19` und `UX-10` aus `docs/ARCHITEKTUR_UX_ROADMAP_V38.md`. Ziel ist eine sichere Migrationsgrundlage, bevor das bisherige zentrale `app.js` weiter aufgeteilt oder eine opt-in Familiensynchronisierung geplant wird.

## Ist-Zustand und Umfang

- Die App verwendet weiterhin **genau denselben** `localStorage`-Schlüssel `shuttleboard-v1`: `players`, `friends`, `officialLinks`, `activeProfileId`, `chosen`, `historyProfilesInitialized`.
- Freunde sind öffentliche, lokal gefolgte DBV-Spieler-IDs, **keine** zentral gespeicherte Familien-/Freundesbeziehung.
- Der Export enthält **nur** eigene Spielerprofile, gefolgte Spieler und gespeicherte Turniere, nicht öffentlich aus Supabase abrufbare Ranking-/Matchdaten, keine API-Schlüssel, kein Konto und keine Trackingdaten.
- Die Datei `schmetterlinge-sicherung-YYYY-MM-DD.json` enthält einen versionierten Umschlag: `kind:schmetterlinge-local-backup`, `schemaVersion:1`, `createdAt`, `data`.
- Speicherung und Wiederherstellung funktionieren offline. Der Browser erstellt lokal eine JSON-Datei; **keine Datei wird an einen Server hochgeladen**. Ein persönlicher Datenträger bzw. bewusstes Teilen der Datei ist erforderlich, um das zweite Gerät zu erreichen.

## Abläufe

1. **Einstellungen → Meine Daten sichern → Sicherungsdatei erstellen.** JSON lokal erzeugen; Inhalt vor Export validieren. Bei fehlerhafter Altdatei nicht stillschweigend falsche Daten ausgeben.
2. **Vorhandene Sicherung auswählen.** Der Browser liest die Datei nur lokal und prüft Schema, Größe (max. 200 KB), Profildaten, erlaubte URLs, Turnier-Daten, Dubletten und Bezug des aktiven eigenen Spielers. Anzahl eigener Spieler, Freunde, Turnierfavoriten und Name des aktiven Profils erscheinen als Vorschau.
3. **Ausgewählte Daten wiederherstellen.** Der Knopf ist bis zum erfolgreichen Prüfprozess deaktiviert. Eine zusätzliche **explizite Bestätigungsabfrage** erklärt, dass der lokale Datenbestand auf genau diesem Gerät ersetzt wird und davor eine eigene Sicherung empfohlen ist. Abbrechen lässt alle bisherigen Daten unverändert.
4. Nur nach Bestätigung wird der bestehende Speicherkey atomar per `localStorage.setItem` überschrieben und die App in Home neu geladen. Andere lokale Einstellungen und die öffentliche Supabase-Datenbank bleiben unverändert.
5. Beim App-Start meldet die vorhandene Follow-Queue alle übernommenen DBV-Spieler-IDs bei Bedarf nach, ohne personenbezogene Familienbeziehungen zu speichern.

## Datensicherheit / Grenzen

- Nur HTTPS-Profil-Links; Turnierlinks ausschließlich im bereits akzeptierten DBV-Turnierformat. Keine `javascript:`-Links, doppelten Spieler-IDs, fehlenden eigenen Profilen, überschüssigen Listen oder gebrochenen Terminen.
- Die Wiederherstellung ist bewusst **Ersetzen**, nicht unsichere automatische Zusammenführung. Die App erlaubt anschließend normale Änderungen und weitere Sicherungen.
- Geburtsjahr und Verein können Teil der Datei sein. **Die Datei kann personenbezogene Angaben von Kindern enthalten**: nicht öffentlich posten; für sicheren Versand bzw. lokales Speichern selbst sorgen.
- Die Sicherung ist **keine Cloud-Synchronisierung und kein laufender Auto-Backup**. Für Automatisierung wären Authentifizierung, Konfliktstrategie, RLS und Einwilligung nötig.
- iPhone-Safari/PWA braucht wegen Download-/Datei-Speicherverhalten einen zusätzlichen praktischen Gerätetest; Chromium/WebKit-Browser-E2E ist separat vorgesehen und ersetzt diesen nicht.

## Technische Abnahme

- `scripts/local-backup.mjs`: pure versionierte, defensiv validierende Export-/Import-Funktionen.
- `backup.js`: UI / File API / Bestätigung / Wiederladen. Kein Netzwerkanruf.
- `tests/local-backup.mjs`: Roundtrip, vorhandenes `app.js.restore()` in VM, bekannte Charlotte/Philipp/Freunde, bösartige URLs, fehlerhafte Dateien, doppelte IDs, Größenlimits.
- `tests/e2e/mobile.spec.mjs`: Mobiler Chromium/WebKit-Test für lokale Sicherung, Wiederherstellung und Ablehnung ungültiger Sicherung.
- Weiter keine neue Hauptnavigation; Einstellungskarte eingebettet; PWA-Shell v39.

## Nächster Schritt in #29

Nach stabiler Datenkompatibilität und realer Geräteabnahme: `app.js` kontrolliert in Routing, Profilkontext, Bookmarks und Persistenz trennen. Danach gemeinsamen PostgREST-Leseclient und schrittweise Design-Tokens verwenden. **Keine Big-Bang-Neuimplementierung**.

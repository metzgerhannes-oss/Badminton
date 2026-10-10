# Schmetterlinge v40 – lokaler Zustands-/Speichervertrag

Stand: 10.10.2026. Umsetzung als **erster begrenzter Teil von Issue #29**.

## Invarianten

- Persistierter Schlüssel bleibt **`shuttleboard-v1`**, Schema der bereits vorhandenen Daten bleibt kompatibel; Storage-Schema intern v1.
- Persistierte Felder: `players`, `friends`, `officialLinks`, `activeProfileId`, `chosen` (= eigenes Startprofil) und `historyProfilesInitialized:true`. **`viewingFriendId` wird nicht gespeichert.**
- Lesemigration: `local-charlotte` → `05-071969`, zugehörige Turnierfavoriten und aktives Startprofil werden übernommen. Vorhandene eigene Favoriten und Freunde gehen nicht verloren.
- Eigene Spieler und Freunde bleiben lokal. Keine Netzwerkverbindung, DB-Änderung, RLS-Migration, zusätzliche Hauptnavigation oder Anmeldung.
- Bei blockiertem/defektem LocalStorage bleibt die App im Arbeitsspeicher bedienbar; Speichern kann dann nicht garantiert werden. Der bestehende Code verschluckt den Storage-Fehler wie bisher.
- Restore/Save bleiben als `app.js`-Funktionen vorhanden und delegieren an `SchmetterlingeStorage.restore(state,normalizeBookmark)` und `SchmetterlingeStorage.save(state)`.
- Reihenfolge: `index.html` lädt das klassische Skript `state-storage.js` **vor** `app.js`. Beides wird für Offline-Starts in der v40-PWA-Shell vorgemerkt.
- Die lokale JSON-Sicherung nach `schmetterlinge-local-backup` v1 wird nicht verändert. Sie bleibt vor jedem Eingriff an Benutzergeräten nutzbar.

## Tests und Release-Gate

`tests/state-storage.mjs` prüft persistente Daten und Wiederanlauf mit isolierter Storage-VM einschließlich fehlerhafter Storage-API, zusätzlicher nicht-App-bezogener Daten und Beibehaltung der aktiven eigenen Person statt der Freundesansicht. Bestehende Migrationstests, Backup-Roundtrip, Tournament-Bookmark-Tests sowie mobile Chromium-/WebKit-QA sind weiter verpflichtend.

**Noch offen:** P0 #28 reale iPhone-Abnahme mit VoiceOver/PWA und die nächsten P1-Slices: Routing/Profilkontext, Bookmarks, gemeinsamer Supabase-GET-Client sowie CSS-Aufräumen. Keine automatische Freigabe dieser Schritte durch diesen Storage-PR.

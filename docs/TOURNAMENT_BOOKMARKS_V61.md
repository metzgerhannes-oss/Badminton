# v61 – Turnierlinks aus dem zentralen App-Controller entflechten

Stand: 11.10.2026 · Basis: `main` v60 · Bereich: P1 Frontend-Modularisierung und P1 Datenkorrektheit.

## Umsetzung

- `tournament-bookmarks.js` enthält ausschließlich lokale, testbare Funktionen für die Validierung offizieller DBV-Turnier-URLs, Bookmark-Normalisierung, Datum/Zeitzone, Filterung nach eigenem Profil, Phasen und Sortierung.
- `app.js` bleibt verantwortlich für DOM, Formulare, Bestätigungen, `save()` und sichtbare Änderungen. Bestehende Funktionsnamen bleiben als Kompatibilitätsdelegation erhalten.
- Neue und bestehende Tests prüfen nur zulässige HTTPS-Turnierpfade, echte Kalendertage (einschließlich Schaltjahren), das Berliner lokale Tagesdatum, stabile Reihenfolge und das Verbergen eigener gespeicherter Turniere während einer Freundesansicht.
- Neues Skript im bestehenden klassischen Ladepfad vor `app.js`, im Service-Worker-Shell-Cache v61 enthalten. Kein Frontend-Frameworkwechsel, keine Cloud-Persistenz, keine neuen Berechtigungen.
- `shuttleboard-v1` / `SCHEMA_VERSION=1`, Links, Geräteprofile, Offline-PWA und die vier Hauptnavigationen bleiben unverändert.

## Grenzen der Änderung

Dies ist **ein erster, bewusst kleiner Modulschritt** und nicht die vollständige Bereinigung von `app.js` oder der doppelten CSS-Schichten. Die separate CSS-Arbeit benötigt Sichtprüfung auf kleinen iPhones und bei Textvergrößerung. Ebenso sind ein autorisierter DBV-Livefeed, vollständige Matchhistorien und rechtliche Datenschutzabnahmen nicht durch dieses Refactoring gelöst.

## Release-Gates

1. `node --check tournament-bookmarks.js` und `node tests/tournament-bookmarks.mjs`.
2. Alle existierenden Node-/Python-/Sicherheitstests, insbesondere `tests/bookmarks.mjs`, `tests/charlotte-profile.mjs`, `tests/friends.mjs`, `tests/profile-switch.mjs`.
3. GitHub Playwright Mobile-Browser-QA, Seiten-Deployment nach Merge und getrennte echte iPhone-SE/VoiceOver-Abnahme.

Eine grüne CI ist keine Aussage über die Datenvollständigkeit oder über bereits erfolgte reale Geräteabnahme.

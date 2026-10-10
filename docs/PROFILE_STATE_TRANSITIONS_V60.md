# v60 – Einheitliche lokale Profil- und Navigationszustände

Vorher waren dieselben Zustandsänderungen in `app.js` an mehreren Stellen dupliziert: Profilwechsel, Freund öffnen, Entfolgen aus der Spielerbibliothek, Entfolgen aus der Freundeskarte und „Home/Zu mir“. Das erschwerte die Prüfung, ob die eigene Startauswahl beim Betrachten anderer Spieler erhalten bleibt.

## Zentraler Zustandsvertrag

Die bereits vorhandene klassische Offline-Datei `state-storage.js` bietet jetzt vier zusätzliche **synchrone lokale** Operationen:
- `selectOwn(state,id)`: nur tatsächlich lokale eigene Profile werden aktiv; eine fremde Spieler-ID kann das Startprofil nicht überschreiben
- `selectFriend(state,id)`: die Ansicht wechselt zum gefolgten Spieler; die Auswahl des eigenen Startprofils wird ausdrücklich nicht verändert
- `showOwn(state)`: Home entfernt die Freundesansicht und stellt das aktive eigene Profil wieder her, selbst wenn `#start` bereits aktiv ist
- `unfollow(state,id)`: entfernt genau diese Person. Nur wenn sie aktuell angezeigt wird, erfolgt die Rückkehr zum eigenen Profil

`app.js` ruft diese Operationen anstelle duplizierter Zuweisungen auf. Die bestehenden Rendering- und `save()`-Auslöser bleiben, es werden weder neue Menüs noch Authentifizierung eingeführt. **`shuttleboard-v1` und `SCHEMA_VERSION=1` bleiben unverändert**; alle Aktionen sind lokal und es findet kein Cloud-Upload persönlicher Listen statt.

## Technische Abnahme
- `tests/profile-transitions.mjs`: mit mehreren eigenen Profilen und Freunden werden Fremdansicht, Home, eigenes Profil, ungültige IDs, Entfolgen anderer/angezeigter Personen und lokale Persistenz geprüft
- Bestehende `tests/profile-switch.mjs`, `tests/friends.mjs`, `tests/state-storage.mjs`, `tests/local-backup.mjs` und Router-/Browser-Szenarien bleiben Release-Gates
- `sw.js` rotiert auf v60. Es wird keine neue API-Ressource oder Datenbankschemaänderung eingeführt

Offen bleiben CSS-Entflechtung, unnötige verschachtelte Wege und die reale iPhone-/VoiceOver-Praxisabnahme (#13, #29, #28). Nicht als gesamte Modularisierung abgeschlossen bewerten.

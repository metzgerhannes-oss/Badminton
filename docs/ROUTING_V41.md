# Schmetterlinge v41 – Routing-Controller und Barrierefreiheit

Stand: 10.10.2026. Begrenzter Teilschritt 2 von #29 nach der getrennten localStorage-Extraktion v40.

- `router.js` ist vor `app.js` als klassisches Defer-Skript geladen und für Offline-Starts im Service-Worker-Precache.
- Exakt vier Hauptziele: `start` (Home), `turniere`, `spieler`, `berichte`. Unterrouten: `historie` (im Menü unter Turniere aktiv) und `einstellungen` (oben).
- Kein Verlust des eigenen Profilkontexts durch Ansehen eines gefolgten Spielers. `navigateHome()` bleibt in `app.js` und setzt den Freundekontext vor jeder Navigation zu Home zurück, auch bei erneutem Tippen auf denselben Hash.
- `routeTo` aktualisiert den Hash; bei bereits aktivem Hash wird direkt gerendert und der Fokus versetzt. `hashchange` in der UI verwendet unverändert Fokus nach Navigation.
- Der Router steuert sichtbare Seite, Titel, `aria-current`, Fokus auf die Überschrift und Zurückspringen an den Seitenanfang. Unbekannte Routen verwenden wie bisher Home als Anzeige-Fallback.
- Keine Änderung an DBV-, Badhub-/Live-Daten, localStorage-Key, Supabase, globalen Events oder Benutzer-Daten. PWA-Shell v41.
- CI: VM-Routerregression und bestehende UX-, vierteilige Menü-, Backup-/Storage- und WebKit-/Chromium-Browser-Gates.
- Offen: #28 echte iPhone-/VoiceOver-Abnahme; später #29 Modulgrenzen für Profile/Bookmarks und einen validierenden Supabase-GET-Client; CSS-Reduktion separat.

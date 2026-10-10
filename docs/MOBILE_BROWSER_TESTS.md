# Mobiler Browser-Abnahmelauf – Schmetterlinge

Stand: 10.10.2026 · P0-Qualitätspaket nach v38 · Bezug: UX-08, UX-20, Issue #28

## Warum diese Tests?

Die vorhandenen Node-Tests prüfen DOM-Struktur, Rechenregeln und Statusmeldungen. Sie können jedoch nicht bestätigen, dass **bedienbare Seiten** im wirklichen Browser entstehen oder dass bei Profilwechsel, Netzabbruch und modalen Dialogen alles zusammen funktioniert.

Die neue GitHub-Action `Schmetterlinge Mobile Browser QA` startet die **tatsächliche App** über einen lokalen statischen HTTP-Server und führt mit Playwright zwei getrennte mobile Browser-Engines aus:

- **Chromium bei 375 × 667** CSS-Pixeln, Touch-Eingabe, 2× Pixeldichte (kleines Smartphone, iPhone-SE-Größenklasse).
- **WebKit bei 390 × 844** CSS-Pixeln, Touch-Eingabe, 3× Pixeldichte (iPhone-Größenklasse, Desktop-Linux-WebKit-Engine).

**Hinweis:** WebKit auf Ubuntu mit mobilem Viewport ist **kein physisches iPhone Safari**. Native Safari, iOS-PWA-Cache, Tastatur und VoiceOver bleiben ausdrücklich Teil der offenen manuellen Geräteabnahme.

## Automatisierte Kernaufgaben

1. **Home:** vier erreichbare Haupttabs, kein horizontales Überlaufen, Touchflächen mindestens 44 × 44 Pixel; Badhub-Einzelnachweis erscheint mit Quelle und richtiger Siegquote (keine vier Striche).
2. **Freund ansehen → Home:** Ein gefolgter Spieler kann geöffnet werden; der erneute Home-Tipp bringt immer zum eigenen aktiven Profil zurück, auch wenn Home schon angezeigt wird.
3. **Turniertag und Historie:** Spielerwahl direkt unter Turniere ohne versteckten Rücksprung, korrekter leerer Badhub-Livezustand, Historie über den Turnierbereich erreichbar und richtig markierter Navigationspunkt.
4. **Spielerbibliothek:** Leere Startsuche zeigt keine 9.246 Spieler ungefragt; der Dialog für neue Profile öffnet und schließt.
5. **Offline:** Dezent sichtbarer Verbindungs-Hinweis bei Netzunterbrechung, automatische Entfernung bei Rückkehr.

Netzquellen sind **deterministisch gemockt**: Keine echten Kinderprofile oder Followerlisten werden an Drittanbieter übertragen. Die simulierten Matchkarten enthalten klar erfundene Testgegner und werden niemals nach Supabase gespeichert. Tests dürfen nicht als Prüfung eines echten DBV-Live-Turniertags missverstanden werden.

## Release-Gate

Die Workflowdatei `.github/workflows/mobile-browser.yml` läuft bei jedem PR und Push nach `main`; Tests in Chromium und WebKit müssen grün sein. Bei Fehlschlägen werden Screenshots, Videos und Traces für sieben Tage als GitHub-Actions-Artefakte hinterlegt (nicht als öffentliches Nutzerdaten-Tracking). Der Workflow enthält keine Supabase-Geheimnisse.

**Bis zur persönlichen Geräteabnahme:** Keine Aussage, dass ein reales iPhone SE oder VoiceOver vollständig geprüft worden sei. Im Backlog #28 stehen weiterhin iOS Safari/PWA-Cache, Quer-/Hochformat, reale Livebegegnung, Modal-Scroll und assistive Tests.

## Folgeschritt nach stabilem Gate

UX-10/UX-11: Aus `app.js` die Datenpersistenz und aus den API-Skripten die PostgREST-/Abort-/Fehlerlogik **schrittweise** in gemeinsam getestete Module auslagern. Navigation und 4 Haupttabs bleiben unverändert; die Browsertests verhindern Bedienregressionen.

## Erweiterung: kompaktes iPhone-Layout und lokaler Datenbestand (PR #32)

- **320 × 568 CSS-Pixel:** Zusätzlich zu den beiden Standard-Viewports prüft ein gesonderter Browserfall die vier mindestens 44 Pixel breiten/hohen Navigationsziele und den tatsächlich erreichbaren Speichern-/Schließenbereich beim Profil-Dialog. Der Test erstellt einen Screenshot als CI-Artefakt.
- **Tastatur und Fokus:** Profil-Dialog öffnen und per Escape verlassen; Rückkehr zum eigenen Home-Profil; immer genau ein aktueller Hauptreiter.
- **Offline-Datenverlustschutz:** Flugmodus simulieren, Seiten wechseln, zurück online gehen und die Seite neu laden. Die gespeicherte eigene DBV-ID und die gefolgte Spieler-ID müssen erhalten bleiben.
- Die Tests greifen nur auf synthetische lokale Familiendaten zurück und schreiben keine echten Daten in Supabase. Auch ein grüner 320-Pixel-Browsertest ist **keine VoiceOver-/reale iPhone- oder Vollzoom-Abnahme**.

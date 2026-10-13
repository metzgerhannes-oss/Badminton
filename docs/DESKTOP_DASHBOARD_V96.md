# Desktop-Dashboard Schmetterlinge · v96

Vorlage v96, auf aktuellen v117-Stand übertragen am 13.10.2026 · Desktop-Erweiterung zur existierenden mobilen Web/PWA-App.

## Ziel
Die Desktop-Version ist **keine zweite Anwendung**. Sie nutzt exakt denselben Hash-Router, dieselben DOM-IDs, die unveränderte lokale Profil-/Freundeliste sowie die vorhandenen, quellengestützten Statistik- und Turnier-Renderer. Sie importiert selbst keine zusätzlichen personenbezogenen Daten und eröffnet keine neue Schreibschnittstelle.

## Responsives Raster

| Bereich | unter 1080 px | ab 1080 px |
| --- | --- | --- |
| Navigation | vorhandene Leiste unten | vorhandene Routen als linke Seitenleiste, LIVE nur bei belegtem Turniertag |
| Startseite | vorhandene Folge der Sektionen | zweispaltiges Layout, Turniere und Spielstatistik links; Freunde und Rangliste/Trophäen rechts |
| Freunde | kompakte Übersicht, maximal vier und weitere über Spielerliste | dieselbe Anzahl in sichtbarem 2-Spalten-Raster, kein verdecktes horizontales Scrollen |
| Spieler- und Datenquellen | identisch | identisch |
| Ausgabebreite | bis 780 px | maximales Fensterlayout 1520 px, Inhaltsbreite nach Abzug der Seitenleiste |
| Mannschaft | eigener Menüpunkt und Saisonansicht | derselbe Menüpunkt in der Seitenleiste, keine simulierte Ligatabelle |

**Entscheidungen:** CSS-only-Raster statt doppeltem Desktop-HTML, keine zusätzliche JavaScript-Bildschirmgrößenlogik; bestehende Tastaturfokus-Routen und ARIA-Labels werden weiterverwendet. Styling liegt isoliert in `desktop-dashboard.css` hinter `teams.css`, sodass die bisherigen Mobile- und iPhone-Regeln unangetastet bleiben.

## Abnahmekriterien
1. Bei 1440×900 und 1080×800: Navigation links, Dashboard in zwei Spalten, Freunde nicht horizontal verborgen, kein Seitenüberlauf.
2. Bei 390×844 und 375×667: ursprüngliche mobile Bottom-Navigation und einspaltige Home-Reihenfolge unverändert.
3. LIVE ist nur bei vorhandener bestätigter Turniertag-Route sichtbar; das folgt weiterhin der bestehenden Logik.
4. Rangliste, Spielstatistik, Historie, Freunde, Turniere und Mannschaft verwenden bestehende echte Daten bzw. bisherige Leerzustände. Keine Schätzwerte oder fiktiven Ergebnisse.
5. PWA-Cache enthält das neue Stylesheet; sichtbare Release-Version, App-Shell und Worker verwenden denselben v96-Stand.

## Noch praktisch abzunehmen
Browser-Sichtprüfung unter realem Windows-/macOS-Desktop und mit 125–200 % Browserzoom. Die automatisierten Tests prüfen Layout-Relationen, nicht jeden denkbaren Inhalt oder Bildschirmleser.

## Integration mit dem aktuellen Privatmodus

Der neue Privatmodus-Hinweis auf Home beansprucht beide Desktop-Spalten und wird nicht zwischen Freunde und Turniere verschoben. Die linke Navigation berücksichtigt arabisches RTL. Es gibt keine neu lesbaren privaten Daten: Sichtbarkeit/Leerzustände bleiben von der bestehenden serverseitigen Zugriffspolitik abhängig. Release- und physische 125–200-%-Zoom-Abnahme erfolgen separat; kein alter v96-Release-Schreibzugriff.

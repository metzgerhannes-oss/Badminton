# v68 – Nicht mehr verwendete Prototyp-CSS-Regeln entfernen

## Ziel und Prüfung

Die aktuelle Schmetterlinge-App hat vier Hauptbereiche: Home, Turniere, Spieler und Berichte. Das ursprüngliche komprimierte `styles.css` enthielt dennoch Gestaltungsregeln für eine nicht mehr eingesetzte Hero-Startseite, einen horizontalen Spieler-Pill-Umschalter sowie eigene Matchkarten und Segmented-Controls des Prototyps.

Die Regeln wurden mit dem bestehenden HTML und den browserseitig geladenen JavaScript-Dateien abgeglichen. Sie werden von den aktuellen App-Ansichten nicht mehr als Klassen verwendet. Die Willkommensseite hat ein eigenes Stylesheet und ist durch diese Änderung nicht betroffen.

## Änderung

- **53** nicht mehr benötigte CSS-Deklarationsblöcke (46 unterschiedliche Selektoren) entfernt.
- `styles.css`: **56.388 → 51.622 Zeichen** (–4.766 Zeichen; ca. –8,5 %).
- Den aktiven `.icon-button:hover`-Teil einer kombinierten alten Hover-Regel erhalten; den toten `.match-card:hover`-Teil entfernt.
- Basisregeln für `.app`, `.page`, `.bottom-nav`, Dialoge, Fokus und das freigegebene Logo blieben unverändert.
- Die neueren Komponenten in `ui-components.css`, `design-v2.css` und `app-shell.css` wurden nicht umgebaut. Spielerdaten und Quellenlogik wurden nicht verändert.
- Regressionstest und mobile Chromium-/WebKit-Prüfungen sichern die vorhandene Vier-Tab-Navigation und Dialogbedienung.
- PWA-Cache auf v68 erneuert.

Nicht Gegenstand: optisches Redesign, Datenimporte, tatsächliche iPhone-/VoiceOver-Abnahme oder massenhafte Löschung anderer älterer Grundstyles.

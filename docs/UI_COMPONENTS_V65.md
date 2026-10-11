# v65 – Modulare Komponentenstile

## Ausgangspunkt

Die erste Gestaltungsschicht `styles.css` liefert noch Grundlayouts und altes Farbschema. Darüber lag bislang ein großer Block aktueller Karten- und Dialogregeln unmittelbar in `design-v2.css`. Das erschwerte weitere Änderungen, weil Varianten für Home, Spieler, Rangliste und Formulare ineinanderliegen.

## Umsetzung

- `ui-components.css` enthält jetzt die bisherigen Regeln für das fokussierte Spielerprofil, Home-Ranglisten, Trophäen, Turnier-Vorschau, Freunde, Spielstatistik, Historie, Formularkarten und Dialoge.
- Die Stylesheets stehen bewusst in dieser Reihenfolge: `styles.css` → `ui-components.css` → `design-v2.css` → `app-shell.css`. Die späteren Kontext- und Responsive-Regeln in `design-v2.css` überschreiben die Komponenten weiterhin wie vor der Auslagerung.
- Eine doppelte `color:var(--ink)`-Deklaration für KPI-Karten wurde entfernt; die gemeinsame Kartenregel enthält bereits denselben Wert.
- Die Größe von `design-v2.css` wurde um rund 11,5 KB reduziert (mit dem aktuellen main neu berechnet); Styling wurde überwiegend in ein eigenes Modul verschoben, nicht gelöscht.
- Der Service-Worker cached das neue Stylesheet mit Shell-Version v65.
- Automatische Prüfungen validieren CSS-Ladereihenfolge, Klassenverträge, Logo-/Navigationsregeln, Offline-Ladung und Dialogbedienung auf kleinen Geräten.

## Bestehende Grenzen

Das Paket ändert weder die App-Datenlogik noch Spielerdaten, Quellen oder Supabase. Noch mehrfach überschriebenes Basis-CSS in `styles.css` bleibt vorläufig erhalten, da ein Entfernen ohne vollständige visuelle Baselines potenziell das alte Grundlayout verändern würde. Browser-Tests ersetzen nicht die reale iPhone- und VoiceOver-Abnahme.

# Wiki v1 – integrierte Freigabe aller drei Blöcke (Entwurf)

Stand 14.10.2026 · GitHub Issues #217–#223.

## Produktentscheidung
**Block 1, 2 und 3 gehen nur zusammen live.** Kein "Block 2 danach" und kein "Block 3 später". Die mobile Wiki-Oberfläche darf in einem ersten Release ausschließlich geprüfte Karten enthalten.

- Block 1: Spielgrundlagen (Spielfeld, Einzel/Doppel, Aufschlag, Punkte, Fehler).
- Block 2: Regelfälle (Netz, Aufschlagstellung, Doppelschlag, Let, Schiedsrichter, Hallendecke).
- Block 3: Jugend und Turniere (U11–U19, Ranglisten-A–E, beste 5/12 Monate, Small Games, BWBV-spezifische Geltung).
- Ein gemeinsamer Browser-Suchindex. Keine kostenpflichtige API, kein Konto und keine Telemetrie.
- Jede Karte: **eine Frage, eine große erklärende Grafik, 1–2 kurze Sätze, Geltung, Quelle**.
- Detaillierte Regeltexte verbleiben auf den offiziellen DBV/BWBV-Webseiten.

## Technischer Zwischenstand
- `wiki.html`: eigenständige Smartphone-Ansicht ohne private Spielerinformationen.
- `wiki.css`: iPhone-/Safe-Area-optimierte Karten, filterbare Kategorien und mobile Detaildarstellung.
- `wiki.js`: gemeinsame indexierte Stichwortsuche über alle drei Blöcke; 48 kurze Frage-Antwort-Karten mit SVG-Visualisierungen als **erste UI-Entwürfe**.
- `index.html`: kompakter Einstieg von der Schmetterlinge-Startseite, mit v137 (#226) vor Merge abzustimmen.
- `tests/e2e/wiki.spec.mjs`: Suche, Jugendtreffer, Regeldialog, kleinste Viewports.

## Release-Gates – vor Merge verpflichtend
- [ ] **Fachlich:** Jede Kurzantwort auf aktuell gültiges DBV/BWBV-Regelwerk prüfen; insbesondere 2027-Zählweise, BWBV 2026 Small Games, Doppelrotation, Hallendecke.
- [ ] **Grafisch:** Jede technische SVG-Zeichnung/Markierung fachlich gegenprüfen. Neu angelegte Platzhalter-/Symbolbilder durch hochwertige, eindeutig passende Grafiken ersetzen oder abnehmen. Die bisherigen 25+20 Karten dienen als Vorlagen, werden **nicht automatisch als geprüft übernommen**.
- [ ] **Mobil:** 320px/iPhone SE, 375px und 390px, Zoom/Lesbarkeit, Dialogschließung und Tastatur/VoiceOver.
- [ ] **Korrektheit:** Quellenlink, Gültigkeit, Altersklasse und Turnierkontext je Jugendkarte.
- [ ] **Regression:** GitHub-CI, PWA/Service Worker, Startseiten-Änderung #226 koordinieren.
- [ ] **Erst nach Abnahme:** Zusammen mit Startseitenlink aktivieren, offline-Cache der Wiki-Dateien ergänzen und v1-Release kennzeichnen.

**Wichtig:** Diese PR ist ein **unveröffentlichter Integrationsentwurf**, keine Live-Freigabe fachlich ungeprüfter Inhalte.


## Vereinfachungs-Audit – 14.10.2026, 21:13
- [x] Suchergebnisse zeigen nur **Kategorie + Frage + kleine Grafik**; keine doppelte Antwort in der Liste.
- [x] Vier Themenfilter als übersichtliches 2×2-Raster statt horizontal zu scrollender Chips.
- [x] Abbildung des Badmintonfelds mit festen Abmessungsverhältnissen und korrekter gelber Markierung für Einzel/Doppel-Aufschlag sowie Small Games (Box / ohne Hinterfeld).
- [x] Doppel nicht mehr als irreführende Vierer-Kreisrotation dargestellt: Beispiel A1 auf anderer Aufschlagseite nach **eigenem Aufschlagpunkt**.
- [x] Punktegrenzen 21/30 bzw. 15/21 grafisch mit Geltungsbereich getrennt.
- [x] Jugend-C-RLT 2026 mit konkreten Spielformen 1./2./3. und U13-Mixed-Ausnahme.
- [x] Statt generischer Icons zweckgebundene Diagramme für Netz, Fußstellung, Aufschlaghöhe, Wertungsfenster, Altersklassen und A–E-Wettbewerbe.
- [x] Zusätzlich Aufschlaghöhe nach DBV/International aufgenommen (48 statt 47 Kurzfragen).
- [x] Redaktionelle Stichproben gegen DBV-Spielregeln (9, 11, 14), Jugend-FAQ und BWBV-Jugendordnung 2026 abgeglichen.
- [ ] Fachliche Vier-Augen-Endprüfung **aller** 48 Karten/Illustrationen (Issue #218).
- [ ] Echte iPhone-SE-/iOS-Safari-Abnahme und Browser-CI für finalen Commit.
- [ ] v137 Startseitenintegration mit PR #226 konfliktfrei abstimmen.

Dieses Audit ist **keine Veröffentlichungsgenehmigung**, keine offizielle Verbandsfreigabe und kein Nachweis für ein grünes CI, bevor GitHub das meldet.

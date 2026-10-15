# Schmetterlinge-Wiki – Abschließendes Regelkonformitäts-Audit

**Prüfdatum:** 14.10.2026  
**Branch:** `feature/wiki-v1-all-three-blocks`  
**PR:** #228 (Draft, nicht veröffentlicht)  
**Ergebnis:** Redaktioneller Regel- und SVG-Strukturcheck bestanden; Live-Freigabe **nicht** erfolgt, solange Endgeräte-/Fachabnahme und CI offen sind.

## Autoritative Quellen (nicht von früheren App-Zwischenfassungen ableiten)
- DBV-Spielregeln Stand 01.04.2026, Satzungswerk 2026/27, Seiten 367–385: https://www.badminton.de/fileadmin/dateien_upload/dateien_2026/juli_2026/dbv_satzungswerk_2026-27_stand_13.06.2026.pdf
- DBV 3×15 Beschluss vom 25.06.2026: https://www.badminton.de/news/badminton/neue-zaehlweise-dbv-praesidium-beschliesst-einfuehrung-von-3-x-15/
- DBV Jugend-Wettkampfsystem FAQ: https://www.badminton.de/der-dbv/jugend-wettkampf/faq/
- BWBV Jugendordnung, Anhang 3 Small Games 2026: https://bwbv.de/wp-content/uploads/2025/12/80-Jugendordnung.pdf
- BWBV Small Games 2026: https://bwbv.de/2025/12/25/small-games-bei-bwbv-jugendturnieren-in-2026/

## Automatisierbarer Strukturcheck – nach Korrekturen
- **53** Such-/Grafikkarten: 19 Grundregeln, 21 Spielsituationen, 13 Jugend-/Turnierkarten.
- Für **alle 53**: nichtleere Antwort, Geltungsangabe, HTTPS-Quelladresse und auswertbare SVG-Darstellung.
- Längste Kurzantwort **127 Zeichen**; keine Textwände. JavaScript über `new Function(...)` syntaktisch überprüft.
- HTML verwendet Browser-Index ohne Server-/KI-Suche, keine Personendaten/Telemetrie. `tests/e2e/wiki.spec.mjs` enthält zusätzlich 53-Karten-Quellen-/SVG-Regressionscheck.
- **Wichtig:** Syntaktische SVG-Prüfung ist keine fachliche Freigabe jeder Zeichnung und kein echter iPhone-Test.

## Inhaltlich geprüfte Regeln und korrigierte Abweichungen
| Bereich | Quellenstelle | geprüfte Aussage |
| --- | --- | --- |
| Maße, Linien, Netz | Regeln 1.1–1.10, Abb. A | 13,40 m, 6,10 m, 5,18 m, 1,98 m, 0,76 m, Netz 1,55/1,524 m |
| Ball/Schläger | 2.2 / 4.1 | Naturfederball 16 Federn, 4,74–5,50 g; Schläger maximal 680×230 mm |
| Wahl | 6 | Auf-/Rückschlag oder Feldseite; Verliererseite wählt aus Rest |
| 3×21 | 7–8 | zwei Gewinnsätze, bei 20:20 +2, 29:29 bis 30, Seitenwechsel 11 im dritten Satz |
| 3×15 | Anhang 3 / DBV-Beschluss 25.06.26 | 14:14 +2, 20:20 bis 21, im dritten Satz Seitenwechsel bei 8; ab 04.01.2027 auf DBV-Individualebene verbindlich, nicht pauschal im Landes-/Mannschaftsspielbetrieb |
| Aufschlag | 9.1–9.5, Anhang 3 | Füße, kontinuierliche Schlägerbewegung, Basis zuerst, kein Spin beim Loslassen, verfehlter Ball; national ohne Messgerät Taille/Schläger nach unten, sonst ganz unter 1,15 m |
| Einzel/Doppel | 10–11 | gerade/rechts, ungerade/links, diagonal, Doppel: selbe Person nach eigenem Aufschlagpunkt von anderer Seite |
| Positionsfehler | 12 | Position berichtigen, Punktestand bleibt bestehen |
| Fehler | 13 | Linie gilt; Netzberührung während Ballwechsel; getrennte Doppelschläge verboten, Rahmen+Saiten in einem Schlag kein Fehler |
| Im Netz hängen | 13.2 / 14.2.3 | Aufschlag hängt = Fehler; Rückschlag hängt oben oder nach Überfliegen im Netz = Wiederholung |
| Hallendecke | 13.3.3 und DBV-Hallenbestimmungen | DBV-Halle 5 bis unter 9 m: Aufschlag-Deckenberührung = Wiederholung, sonst Decke im Ballwechsel = Fehler; Hallen unter 5 m nicht wettkampftauglich |
| Wiederholung | 14 | auch Spieler ohne Schiedsrichter dürfen sie rufen; Ballwechsel und letzter Aufschlag werden wiederholt |
| Ende Ballwechsel | 15 | Bodenkontakt, Fehler, Let, Rückfall nach Netz-/Pfostenkontakt |
| Coaching | 16.5.1 | bei Ball nicht im Spiel bis beide Auf-/Rückschlagpositionen eingenommen haben |
| Jugendrangliste | JSpO Anlage I / DBV-FAQ | pro Disziplin 5 beste Ergebnisse in 12 Monaten, wöchentlich donnerstags, U11 A/C/D/E ohne B-Wertung |
| BWBV C-RLT 2026 | BWBV JO Anhang 3 | U11/U13 Einzel: 1. Box, 2. ohne Hinterfeld, 3. Standard; U13 4. Mixed statt Einzel |
| Spieloffizielle | 17 | nur einfache Erklärungen, Detailfragen über Originalregeln; keine vollständige Turnieroffiziellen-Ausbildung behaupten |

## Grafische Abnahmestandards
- Dimensionen geometrisch modelliert; Beispiel: 352 SVG-Einheiten entsprechen 13,40 m, 160 entsprechen 6,10 m; Einzel-Seitenabstände je ca. 0,46 m und Doppel-Aufschlagende je 0,76 m.
- Farbflächen für Einzel/Doppel-Aufschlag, Box und „ohne Hinterfeld“ entsprechen der jeweiligen Regel. Falsche allgemein zirkulierende KI-Court-Poster nicht übernommen.
- Bedeutungslose Icons für kritische Entscheidungen durch konkrete Fehler-/Wiederholungs-/Spielfeldillustrationen ersetzt.
- Naturfederball-Grafik zeichnet 16 Federn, nicht nur eine beliebige Ziergrafik.
- Anmerkung: Bilder sind eigene, für Handy entworfene Illustrationen, keine amtlichen Verbandsabbildungen.

## Weiterhin sperrend vor Live-Merge
1. [ ] **Unabhängige fachliche Sichtprüfung aller 53 Bilder und Texte** (Issue #218). Dieses Selbst-Audit ersetzt keinen zweiten Prüfer.
2. [ ] Vollständiger Playwright-Run auf dem abschließenden Commit, inkl. 320px/WebKit (bisher bei Audit-Erstellung noch ausstehend).
3. [ ] Echter iPhone-Safari-/PWA-Test, Kontrast, SVG-Beschriftungen, Safe Areas.
4. [ ] Koordination mit parallel laufendem v137-Startseiten-PR #226 und PWA-Cache/Link-Integrierung.
5. [ ] Erst nach den Gates PR #228 aus Draft nehmen und merge/deploy. Fachlich strittige Grafik nicht durch Abstraktion als 'fertig' ausgeben.

**Audit-Grundsatz:** Ein kurzer Satz darf nicht auf Kosten einer regelentscheidenden Ausnahme gehen. In Zweifelsfällen geteilte Karte/Verweis auf amtliche Regel statt fachlich falscher Vereinfachung.

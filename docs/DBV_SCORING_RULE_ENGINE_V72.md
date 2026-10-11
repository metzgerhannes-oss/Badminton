# Spielstatistik nach gemeldetem Satz- und Matchergebnis – v72 (11.10.2026)

## Verbindliche Importlogik

**Nicht** aus Punktgrenzen, Jahrgang oder Alter auf die Gültigkeit eines Matches schließen.
Maßgeblich ist der veröffentlichte Badhub-/DBV-Spielbericht:
1. Jeder gemeldete Satz mit zwei unterschiedlichen ganzzahligen Punktzahlen erhält genau einen Gewinner: die Seite mit mehr Punkten.
2. Normalfall: zwei gewonnene Sätze ergeben den Matchsieger (2:0, 2:1). Wenn eine Quelle ausdrücklich 5×11 meldet: drei Gewinnsätze (3:0, 3:1, 3:2). Bei drei kurzen Sätzen mit 3:0 kann die Drei-Gewinnsatz-Regel anhand der Satzfolge erschlossen werden, ohne die offizielle Turnierregel zu behaupten.
3. Der aus den Satzsiegen ermittelte Gewinner muss exakt der **von der Quelle gekennzeichneten Gewinnerseite** entsprechen. Bei Widerspruch wird der Matchbeleg nicht als Sieg/Niederlage übernommen.
4. Ein Satz nach bereits entschiedenem Match ist nicht zulässig; eine einzige Partie gilt nur bei explizitem 1×21-Quellenhinweis als abgeschlossen.
5. **21:20, 15:14 und 11:10** sind allein wegen ihrer Punktzahl **kein Ausschlussgrund** für einen als gespielt gemeldeten Satz. Jugend- und historische Turnierregeln unterscheiden sich. Die präzisen DBV-Zählweisen sind optionaler Kontext, kein Importfilter.
6. BYE/Rast, Walkover/kampflos, Aufgabe/Abbruch, Disqualifikation und Quellkarten ohne lesbare Satzstände werden **getrennt** kategorisiert und nie als regulär ausgespielte Siege gezählt.

## Darstellung und Datenherkunft

- In der Spielhistorie steht die echte gemeldete Satzfolge, das nach den gemeldeten Satzsiegen gewonnene/verlorene Match sowie die Quell-URL. Nur bei expliziter Angabe wird das offiziell benannte Zählformat gezeigt.
- **DBV-Ranglistenpunkte** sind eine separate Kennzahl aus dem offiziellen Excel-Ranglistenexport (inklusive eigener/höherer Altersklasse). Sie werden nicht aus Badhub-Sätzen berechnet.
- Die Supabase-Edge-Importfunktion und die Browser-Statistik nutzen exakt dasselbe `scripts/badminton-score-rules.mjs`-Regelmodul (Edge-Kopie identisch).
- Keine Änderung an offiziellen Platzierungen, keine automatische Auffüllung der Badhub-/DBV-Gesamtsummen durch erfundene Spiele.

## Verifizierter aktueller Befund

Philipp Metzger (DBV-ID 05-070879): 62 Quellkarten in Badhub, davon **58** mit eindeutigem Sieger anhand gemeldeter Sätze und veröffentlichter Winner-Kennzeichnung. Darunter zwei U11-Small-Games-Karten mit 11:10-Sätzen, die nicht wegen einer Punktgrenze verworfen werden dürfen. **4** Quellkarten enthalten keinen verlässlich auswertbaren Satzstand und bleiben ungeklärt. Die 58 Einzelbelege sind bereits im produktiven Supabase gespeichert.

Andere 2026/27-Zählweisen (3×21, 3×15, 5×11, 1×21) bleiben als offizielle Hintergrundregeln dokumentiert, ohne eine verbands- oder turnierübergreifende Zwangsprüfung der Ballpunktzahl einzuführen.

Fachquellen: https://www.badminton.de/fileadmin/dateien_upload/dateien_2026/juli_2026/dbv_satzungswerk_2026-27_stand_13.06.2026.pdf ; https://www.badminton.de/der-dbv/jugend-wettkampf/small-games-u11/u13/

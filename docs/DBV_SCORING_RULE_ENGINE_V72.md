# DBV-Zählweisen und Quellenbelege (v72, 11.10.2026)

## Fachlich verbindliche Regeln

- **3×21:** zwei Gewinnsätze, ab 20:20 zwei Punkte Vorsprung, Höchststand 30 (gültig: 30:28 und 30:29).
- **3×15:** zwei Gewinnsätze, ab 14:14 zwei Punkte Vorsprung, Höchststand 21 (gültig: 21:19 und 21:20). DBV-Individualturniere ab 04.01.2027, im Jahr 2026 nur bei ausgeschriebener Nutzung. Keine pauschale Umstellung von Liga oder historischen Turnieren allein wegen der Jahreszahl.
- **5×11:** drei Gewinnsätze, ab 10:10 zwei Punkte Vorsprung, Höchststand 15 (gültig: 12:10, 13:11, 14:12, 15:13 und 15:14). Bundesliga 2026 weiter 5×11.
- **1×21:** ein einziger Satz bis 21 mit standardmäßiger Verlängerung ist eine erlaubte alternative Wettkampfform. Aus einem einzelnen gespeicherten Satz darf sie **nicht** automatisch erschlossen werden. Sie muss ausdrücklich durch die Turnierausschreibung oder einen vergleichbar eindeutigen Quellhinweis belegt sein.
- **3×11 Jugendsonderform:** ältere Daten bleiben als anhand gültiger Satzergebnisse erschließbare Teilbelege möglich, sind jedoch keine automatisch bestätigte offizielle Turnierregel.
- **Abweichende Altregeln:** nur bei ausdrücklichem Quellbeleg auswählbar. Insbesondere 11:10 und 15:14 sind ohne eindeutig passendes Format nicht pauschal gültig.

## Datenmodell und Verhalten

`scripts/badminton-score-rules.mjs` enthält die versionsunabhängigen Regelprofile mit Sieger-, Satzende-, Maximalpunkte- und Matchabschlussprüfung. Ein Match endet zwingend beim Erreichen der erforderlichen Gewinnsätze; weitere Satzfolgen werden verworfen.

`explicitScoringRule` liest ausschließlich **explizite** Zählweisen aus Turnierbezeichnung/Quellkennzeichen. Jahr, Disziplin und Altersklasse allein bestimmen keine gültige Zählweise. Importfunktion und Frontend teilen dieselbe Scoring-Engine. Aus den Satzständen erschlossene Formate werden als solche kenntlich gemacht.

Der bestehende separate Klassifikator behandelt **BYE/Rast**, **Walkover/kampflos**, **Aufgabe/Abbruch**, **Disqualifikation** und **fehlenden Satzstand** getrennt. Diese Fälle gelangen ohne belegtes, regulär abgeschlossenes Match nicht in den Siegzähler. Ein Status kann auf Turnierfortschritt/Ranglistenwertung Einfluss haben, ohne dass ein tatsächlich gespielter Matchsieg vorliegt.

**DBV-Ranglistenpunkte** bleiben ausschließlich offizielle, datierte Ranglistenwerte. Nicht aus Matchpunkten, Erfolgsquoten oder fremden Turnierkarten hochrechnen. `scripts/update-ranking.py` übernimmt weiterhin nur den offiziellen DBV-Excel-Export.

## Praktischer Plausibilitätsbefund

Philipp Metzger: 62 erkannte Badhub-Quellkarten, 58 gespeicherte Einzelbelege vor v72. Mit den strengeren Regelprofilen im aktuellen öffentlichen Badhub-Quell-Audit sind **56** auswertbar, **4** haben keine Sätze und **2** enthalten 11:10-Satzstände. Letztere liegen bei A-RLT U11/U13 „Small Games“ 2026. Ob dort gesonderte verkürzte Zählweisen gelten, ist der jeweiligen offiziellen Turnierausschreibung zu entnehmen; darum nicht allein aus dem Ergebnis als gewerteten Matchsieg bestätigen. Die gespeicherten Originalbelege werden nicht gelöscht, nur nicht ohne gesicherte Regel als verifizierte Statistik gezählt.

## Nachweise

- Offizielle DBV-Regeln 2026/27, S. 372 (3×21), Anhang 3 S. 383–384 (1×21, 3×15, 5×11), Bundesliga-Spielformat S. 268: https://www.badminton.de/fileadmin/dateien_upload/dateien_2026/juli_2026/dbv_satzungswerk_2026-27_stand_13.06.2026.pdf
- DBV-Nationaländerung ab 2027: https://www.badminton.de/news/badminton/neue-zaehlweise-dbv-praesidium-beschliesst-einfuehrung-von-3-x-15/
- Small Games U11/U13: https://www.badminton.de/der-dbv/jugend-wettkampf/small-games-u11/u13/
- DBV Ranglisten-Punktetabellen: https://www.badminton.de/ergebnisse/dbv-ranglisten/

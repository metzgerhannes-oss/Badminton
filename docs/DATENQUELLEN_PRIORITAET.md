# Referenzliste für Ranglisten- und Turnierdaten

Stand: **9. Oktober 2026** · Projekt **Schmetterlinge / Badminton**

Die verbindliche, maschinenlesbare Liste liegt in **[`data/source-register.json`](../data/source-register.json)**. Neue Datenquellen müssen dort mit Herkunft, Qualitätsstufe, Eignung, Prüfstand und Zugriffsbeschränkung dokumentiert werden. Diese Liste bleibt im GitHub-Repository erhalten und ist nicht nur eine Chat-Notiz.

## Qualitätsstufen und Priorität

| Stufe | Quelle | Wofür geeignet? | Nicht daraus ableiten |
|---|---|---|---|
| **A · Original / amtlich** | DBV-`turnier.de`-Jugendrangliste mit Spieler-/Turnierdetails | **Einzelwertungen je Turnier**, falls dort explizit ausgewiesen | Nicht ohne konkrete Spieler-ID, Turnier, Disziplin, KW und Punkte übernehmen |
| **A · Original / amtlich** | DBV aktuelle Jugendrangliste als Excel (badminton.de) | Gesamtpunkte, Altersklasse, Disziplin, KW, Anzahl Turniere, bundesweite Grundgesamtheit und Landesverbandskennung | **Keine Turniernamen oder Einzelpunkte**: Diese Felder fehlen im Excel |
| **A · Original / amtlich** | DBV-Wochenarchive | Vorwoche, Punkteänderung, Rankings im gleichen Altersklassenfilter | Aus bloßer Änderung der Gesamtpunkte nicht automatisch einen konkreten Turnierwert behaupten |
| **A · Normativ** | DBV-Jugendspielordnung, FAQ und Punktetabelle | **Beste fünf Wertungen über zwölf Monate**, Turnierkategorien, Punkteregeln | Keine konkrete Spielerwertung ohne passende Turnierkategorie/Platzierung und Abgleich |
| **B · Offizielles Turnier/Verband** | Konkrete `dbv.turnier.de/tournament/UUID`-Seite; BWBV | Teilnehmer, Platzierungen, Datum, Disziplin, Kategorie, Partner | Ranglisten-Einzelpunkte nur bei ausdrücklich veröffentlichter Wertung |
| **C · Sekundär/Club** | SpVgg Mössingen, Badhub | Ergebnisrecherche, Mannschaft, konkrete Platzierungen, Turnierquellen, Quervergleich | Badhub-Gesamtpunkte nicht als fünf Einzelwertungen ausgeben |
| **D · Hinweis** | Eigene Screenshots/Erinnerungen | Identifikationshilfe, offene Prüfung, Ergänzung offizieller Links | Niemals selbst als offizielle Ranglistenpunkte ausgeben |

## Geprüfte Quelladressen

1. **A – DBV-Einzelwertungen (höchste Priorität für diese Funktion):** https://dbv.turnier.de/ranking/ranking.aspx?rid=238  
   Der DBV erklärt, dass `turnier.de/ranking` die **Einzelergebnisse aller Spieler** zeigt. Die U19-Ranglistenübersicht führt per Spielernamen zu den gespielten Turnieren. **Technische Grenze:** Der unverbindliche Browserabruf vom 09.10.2026 führt zur Cookie-Zustimmungsseite. Der automatische Import hat die einzelnen Punktwerte bisher nicht erreicht. Eine Browser-Sitzung mit erlaubter Cookie-Einwilligung und eine verifizierte Spielerdetailseite sind erst zu klären.
2. **A – aktuelle DBV-Gesamtrangliste:** https://turniere.badminton.de/ranking — Excel https://turniere.badminton.de/ranking/download  
   Diese Quelle wird bereits im Donnerstag-Workflow automatisiert ausgelesen. Stichtag KW 41, veröffentlicht 07.10.2026, 12:00 Uhr. **Philipp 05-070879:** HE 2.670 / 13 Turniere, HD 1.322 / 3, HM 1.469 / 2. **Charlotte 05-071969:** DE 611 / 2. Die Turnieranzahl ist **nicht** die Anzahl der fünf in die Punktsumme eingehenden Wertungen.
3. **A – wöchentliche DBV-Archive:** https://turniere.badminton.de/ranking/history — Beispiel https://turniere.badminton.de/uploads/ranking/Ranking_2026_KW40.xlsx. Nur Vergleichsstände, keine Einzelwertung je Turnier.
4. **A – DBV-FAQ und Ranglistenbestimmungen:** https://www.badminton.de/der-dbv/jugend-wettkampf/faq/ ; https://www.badminton.de/fileadmin/user_upload/jugendspielordnung_anlage_i_ranglistenbestimmungen.pdf. Regeln: jeweils zwölf Monate; **fünf beste** Wertungen; Donnerstag als regulärer Veröffentlichungsrhythmus.
5. **A – DBV-Jugend-Punktetabelle:** https://www.badminton.de/fileadmin/dateien_upload/dateien_august_2025/drlrl_u19_punktetabelle_20231108_u09-bis-o19.pdf. Der Wert ist abhängig von Altersklasse, Kategorie und Platzierung. Eine Tabellenberechnung wäre **abgeleitet**, nicht der aus einer offiziellen Spielerrangliste ausgelesene Punktwert. Sie darf nur bei eindeutig gesichertem Turnierlevel für eine Plausibilitätskontrolle verwendet werden.
6. **B – DBV-Turnierdatensatz Beispiel:** https://dbv.turnier.de/tournament/0477D9EC-DA56-4B16-938D-138CC817E8E2 — 35. Bezirksmeisterschaft Südwürttemberg am 11.07.2026. Amtliche Ergebnisreferenz, aber kein bislang verifizierter Einzelwertungswert.
7. **B – BWBV-Verband:** https://bwbv.de/2026/08/19/bezirksmeisterschaft-bw-suedwuerttemberg-u11-u19-am-11-juli-2026/ — Referenz zum DBV-Turnier.
8. **C – Vereinsberichte:** https://spvgg.org/abteilungen/badminton/aktuelles. Zum Beispiel https://www.spvgg.org/abteilungen/badminton/aktuelles/1-c-rangliste-bw-u11-u19-am-17-18-januar-2026, https://www.spvgg.org/abteilungen/badminton/aktuelles/2-c-rangliste-bw-u11-u19-am-28-februar-1-maerz-2026, https://www.spvgg.org/abteilungen/badminton/aktuelles/3-c-rangliste-bw-u11-u19-am-24-25-april-2026. Enthalten oft Turnierkategorie, Altersklasse, Platz und Partner.
9. **C – Badhub als DBV-Ergebnisübernahme:** https://badhub.de/spieler/05-070879?saison=2026&src=turnier ; https://badhub.de/spieler/05-071969?saison=2026&src=turnier. Die Webseite ist für Philipp erreichbar und dokumentiert Turnierliste und **Gesamtpunkte**, hat bisher jedoch **keine eindeutig verifizierte Einzelpunktetabelle** für die fünf besten Wertungen geliefert.

## Warum stehen die fünf Felder derzeit leer?

Der bisherige Parser `scripts/update-ranking.py` verarbeitet den **amtlichen Gesamtwert** des aktuellen Excel-Exports und die archivierten Vorwochenwerte. In diesem Excel fehlen pro Turnier **Name + Datum + Disziplin + exakt gutgeschriebene Wertung**. Er setzt deshalb bewusst `topFive: []` und `topFiveStatus: not-in-public-export`.

Dass der DBV die Einzelresultate auf seiner anderen Website anbietet, ist **bestätigt**. Deren genauer Punktezugriff für die beiden konkreten Spieler und die automatische Berechtigung/Abrufbarkeit ist jedoch **noch nicht bestätigt**. Das sind unterschiedliche Aussagen und dürfen nicht vermischt werden.

## Verbindliche Übernahmeregeln

- **Identität:** Nur korrekte DBV-Spieler-ID, Disziplin (HE/DE/HD/DD/HM/DM), offizielle AKL sowie eindeutiger Turnierdatensatz.
- **Stichtag:** Einzelwertungen und Gesamtscore müssen zur **gleichen Ranglistenwoche** gehören; beim Altersklassenwechsel getrennt vergleichen.
- **Gültigkeit:** Turnierstart innerhalb der letzten zwölf Monate, Wertung nach zum Turnierzeitpunkt gültiger Jugend-Punktetabelle.
- **Top fünf:** Wertungen **nach Punktzahl**, nicht die letzten fünf Turniere sortieren. Nur vorhandene gewertete Turniere zeigen (bei zwei Turnieren also höchstens zwei).
- **Rechenprüfung:** Summe der höchstens fünf belegten Einzelwertungen muss dem **amtlichen** Gesamtwert entsprechen; bei Abweichungen offen lassen und Datenprüfung markieren.
- **Quellenlink je Wert:** Wer die Zahl nachprüfen will, muss die konkrete Spielerranglistenwertung bzw. offizielle Turnierquelle öffnen können.
- **Qualitätsstatus:** `official-explicit`, `verified-derivation`, `secondary-confirmed`, `pending` oder `unavailable`. Nie „offiziell“ für bloße Tabellen-Ableitungen oder Familienangaben verwenden.
- **Zugriff:** Kein Login- oder Cookie-Zwang im Nutzer-Dashboard; automatischer Quellenzugriff nur, soweit zulässig. Ein technischer Cookie-/Sitzungsblocker darf **nicht** durch erfundene Daten ersetzt werden.

## Nächster technischer Schritt

Im normalen Browser unter https://dbv.turnier.de/ranking/ranking.aspx?rid=238 die **U19-Spielerrangliste**, dann Philipp Metzger (05-070879) oder Charlotte Metzger (05-071969) und die **einzelnen Turnierwertungen** öffnen. Eindeutigen Spielerdetail-Link und einen tatsächlichen Punkte-Datensatz festhalten. Erst danach den `topFive`-Import anbinden. Wenn die Website keine zugelassene maschinenlesbare Schnittstelle anbietet, bleiben ein gezielter offizieller Export oder eine einmalige manuelle Datenfreigabe als Alternativen.

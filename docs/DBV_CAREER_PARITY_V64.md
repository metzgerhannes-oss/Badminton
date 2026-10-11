# v64 – DBV-Karrierebilanz als datierter Kontrollstand (P0)

Stand: 11.10.2026. Gilt nur für Profile mit einem konkreten, datierten DBV-Beleg; **kein allgemeiner Live-Datenfeed**.

## Originalbeleg und Beleggrenze
Ein vom Nutzer bereitgestellter Screenshot aus dem angemeldeten DBV-„Mein Profil“ für **Philipp Metzger (05-070879)** zeigt am 11.10.2026:
- Karriere: **60 Spiele, 26 Siege, 34 Niederlagen**
- Kalenderjahr 2026: **49 Spiele, 21 Siege, 28 Niederlagen**
- Ohne Disziplinfilter. Kein amtlicher Einzelmatchdatensatz, kein permanenter DBV-API-Endpunkt.
- Bei einem zukünftigen Aktualisierungslauf sind diese Zahlen **historische Vergleichswerte**, keine Aussage zum aktuellen DBV-Stand.

## Produktverhalten
- Die **DBV-Snapshot-Karte** wird nur bei passendem Spieler und Scope gezeigt: Karriere oder belegtes Jahr; alle Disziplinen und alle Altersklassen.
- Darunter bleiben **auswertbare Badhub-Quellkarten** samt eigener Sieg-/Niederlage-Zählung als **Teilbestand** erhalten. Offizielle Einzelmatches und externe Quellkarten werden weiterhin niemals addiert.
- Die Gegenprüfung verlangt die Übereinstimmung aller drei Kennzahlen (Anzahl, Siege, Niederlagen), nicht nur gleiche Gesamtzahlen.
- **Abweichung:** klarer Hinweis, aber keine Behauptung „X Spiele fehlen“: Fremdquellen können Lücken, Dubletten, unterschiedliche Zuordnungen oder spätere Korrekturen enthalten.
- **Gleiche Summen:** ausdrücklich kein Beweis der Vollständigkeit der einzelnen Matchbelege.
- **Quelle nicht erreichbar:** kein Nullstand als geprüftes Resultat darstellen.
- Andere Spieler (Charlotte, Sarah, Vinzent) haben derzeit **keinen** auf dieselbe Weise belegten DBV-Karrieresnapshot. Keine erfundenen Null-/Gesamtwerte.

## Umsetzung und Tests
- **scripts/dbv-match-reference.mjs**: datierte Evidenz, Scope-Abgleich, strikte Summenprüfung.
- **stats.js / external-matches.js**: Home und Historie nutzen denselben Vergleich.
- **tests/dbv-match-reference.mjs**: Referenzzahlen, abweichende Siege bei gleicher Gesamtzahl, unbekannte Quellen, ungeeignete Filter und Nichtausweitung auf andere Spieler.
- **v64**: Service-Worker-Cache und CI auf den neuen Code angepasst.

## Weiterhin nicht erledigt
- Kein vollautomatischer Abruf der offiziellen DBV-Karrierebilanz für alle vier Spieler.
- Keine Quellkorrektur oder Löschung der historisch importierten Badhub-Matches; verdächtige Quellhäufungen bedürfen manueller Belege/Parserprüfung.
- Keine Behauptung vollständiger Matchabdeckung. Der Badhub-Import bleibt ein Teilbestand, bis jeder Einzelbeleg fachlich verifiziert ist.

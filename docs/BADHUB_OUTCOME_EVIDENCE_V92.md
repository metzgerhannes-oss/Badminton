# v92 – Badhub-Spielergebnisse ohne veröffentlichte Satzpunkte

Problem: Einzelne öffentliche Turnierkarten enthalten **zwei namentlich bestimmte Seiten**, **einen eindeutig markierten Gewinner** und einen **Gedankenstrich statt Satzpunkten**. Sie sind nicht automatisch Freilose oder ausgefallene Begegnungen. Eine bloße fehlende Punktzahl oder eine summarische Karrierebilanz ist aber **kein** individueller Ergebnisbeleg.

## Evidenzstufen / Schutz

1. Normaler Matchbeleg: Zwei oder mehr vollständig auswertbare Gewinnsätze (oder ausdrücklich zugelassene 1×21-Ausnahme); Spielgewinner muss mit der CSS-Gewinnerseite übereinstimmen. Punkte bleiben unverändert.
2. **Quellenmarkierter Ergebnisausgang ohne Sätze:** Nur Turnierkarten mit zwei identifizierten Seiten, eindeutig markierter Gewinnerseite, vollständiger Spieleridentität und explizitem Strich in der Ergebnis-Spalte, aber ohne auswertbare Sätze. Persistiert `games: []` und `outcome_evidence: "badhub-bold-dash"`; niemals Satz- oder Matchscores hinzudichten. Anzeige: „Gewinner laut Badhub hervorgehoben · Satzstände nicht angegeben“.
3. Ungeklärte Karten, BYE/Rast/Rust (als Freilos), Walkover, Aufgabe, Disqualifikation und widersprüchliche Ergebnisse: **ausschließen**, nicht als Siege/Niederlagen zählen.

**Datenbank-Sicherung:** `database/badhub_outcome_evidence_v92.sql` fügt ausschließlich eine optionale `outcome_evidence`-Spalte hinzu. CHECK erlaubt `games=[]` nur für `tournament` bei explizitem Belegtext; Einträge mit Sätzen dürfen diesen Belegtext nicht tragen. Ohne diesen Marker zählen Browser/Statistik Null-Satz-Fälle selbst dann nicht, wenn W/L angegeben wäre. Bereits gespeicherte 835 Satzmatchbelege bleiben unberührt. Der Backend-Parser ist mit dem Webclient-Parser zeichenidentisch.

**Quellenpilot:** Bei Philipp (DBV 05-070879) ist die Badhub-Karriereübersicht als Momentaufnahme vom 11.10.2026 mit 62 Matches (26 W / 36 L) belegt, während im geprüften Supabase-Bestand 58 Einzelmatchkarten mit Satzständen liegen. PR #86 ermittelt vier konkrete Turnierkarten mit fett markiertem Sieger und Strich aus `https://badhub.de/dbv/turnier.php?id=4428`, `https://badhub.de/bwbv/turnier.php?id=4190`, `https://badhub.de/bwbv/turnier.php?id=2757`. Diese historischen Quellenangaben werden **nicht allein wegen des 62er-Karrieretotals** zu Datenbankzeilen. Aufnahme ausschließlich bei erneut erfolgreichem echten Quellenabruf, identifiziertem DBV-Spieler und durchlaufener Validierung. Keine Behauptung eines erfolgreichen Liveimports ohne DB-Nachweis.

**Ablauf:** CI inkl. Parser-/Statistik-Tests → Migration ausschließlich Badminton-Projekt `yadexibmjmnjfmfabrug` → produktive Edge Function `history-match-import` mit identischem Parser deployen (bisherigen JWT-Modus beibehalten) → Frontend v92 mergen/Pages deployen → bedarfsgesteuerten Quellabgleich eines Pilotspielers nach bestehender Rate-/Lease-Regel durchführen → verifizierte neue DB-Zeilen und Fehler-/Ablehnungsquote dokumentieren. Importierte Einzelbelege sind von DBV-offiziellen Match-IDs zu unterscheiden; keinerlei künstliche Karrierestatistiken.

**Offen nach diesem Paket:** Vollständigkeit der offiziellen DBV-Matchhistorie, Feld-/Uhrzeit-Live-Feed, die tatsächlichen Quell-/Weiterverwendungsrechte (#17/#48/#56) und Endgeräte-Abnahme (#28).

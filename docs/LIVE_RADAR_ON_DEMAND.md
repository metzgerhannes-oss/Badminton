# Live-Radar – öffentlicher Matchday-Feed, bedarfsgesteuert und zentral gecacht

Stand 10.10.2026, PWA v31.

## Datenquelle und nachgewiesener Echtbetrieb

Badhubs öffentliche Turniertag-Anzeige ruft JSON ab: https://badhub.de/api/spieler_live.php?lic=05-061350 . Die direkte API wurde für Sarah Storz und Philipp Metzger ohne Zugangsschlüssel erfolgreich per HTTP 200 vom Supabase-Server erreicht. Am 10.10.2026 meldet die Quelle für beide Spieler kein laufendes Turnier. Der Supabase-Worker importierte beide Statusantworten mit der Rückgabe processed=2, ok=2, idle=2, errors=0. **Keine Spielstände wurden geschätzt.**

## Ablauf

1. Unter Turniere → Live-Radar wird beim Anzeigen eines eigenen/gefolgten DBV-Spielers ausschließlich die bestätigte öffentliche DBV-ID an die geschützte Supabase-Beobachtungsliste übermittelt. Bei unsichtbarer Seite keine neue Live-Abfrage.
2. Die private Supabase-Triggerfunktion verhindert doppelte Requests, verlangt einen bestätigten DBV-Spieler, begrenzt maximal 20 aktive ID-Beobachtungen und 60 neue Spieler pro 24 Stunden; Wiederholung höchstens alle 50 Sekunden.
3. Cron-Worker alle 60 Sekunden, maximal sechs aktive Spieler je Lauf, nur Spieler mit Aufruf innerhalb zwölf Minuten. Niemals ein Crawl aller 9.246 Spieler.
4. Der Worker prüft HTTP 200, JSON-Datentypen und feste Größenlimits (100 KB Antwort, 70 KB Snapshot); hält höchstens 20 kommende, zwölf vergangene und 15 angemeldete Turnierbegegnungen. Die Daten werden überschrieben, nicht dauerhaft zu einem Matcharchiv aufgebaut.
5. Die mobile App liest nur den von Supabase öffentlich lesbaren und ansonsten gesperrten Cache. Spielstatus, Wartestand, Gegner, Halle, Feld, Satzstände und Quellenaktualität werden aus Quellwerten abgeleitet; die Sätze werden anhand is_team1 aus Sicht des Spielers gedreht.
6. Bei einem Snapshot älter als zwei Minuten wird kein aktiver Live-Spielstand gezeigt. Eine laufende Begegnung ohne Satzangaben wird ausdrücklich „Spiel aufgerufen“ genannt. Bei Turnier=null erscheint „Gerade kein laufendes Turnier“. Quelllinks bleiben als Fallback.
7. Der alte DBV-Matchbereich und Karrierehistorie bleiben fachlich getrennt; es werden keinerlei Siege, Niederlagen oder offizielle Einzelmatches aus laufenden Meldungen erfunden.

## Grenzen und Abnahme

- Badhub ist der Quellbetreiber, nicht der Deutsche Badminton-Verband. Öffentliche Erreichbarkeit bedeutet nicht automatisch unbegrenzte Nutzungs- und Weiterveröffentlichungsrechte. Kurze begrenzte Abfragen, Quellenkennzeichnung und keine Massenkopie.
- Eine Badhub-Spielerseite kann existieren, ohne dass für diesen Spieler gerade ein Turnier läuft. Nicht alle DBV-Turniere müssen in diesem Feed enthalten sein.
- Die tatsächliche Aktualisierungsfrequenz richtet sich nach Anbieter, Netz und Cron; es gibt keine Sekundengenauigkeits-Garantie.
- Kein gespeichertes Familienkonto, keine private Freundesliste, keine Gerätedaten in der Datenbank; nur öffentlich bekannte DBV-IDs.
- Reale Tests an einem Veranstaltungstag mit Einzel/Doppel, Aufruf, Satzständen, Übergang zu „beendet“, iPhone-Sichtprüfung und Quellenrechten sind noch sinnvoll, bevor eine hundertprozentig vollständige Turnierabdeckung behauptet wird.

## Implementierung

- database/live-radar-on-demand.sql: RLS-Tabellen, privater Watch-Trigger, Minuten-Cron.
- scripts/live-radar.mjs: überprüfbarer Datenvalidator für Identität, Satzstand und Frische.
- live-radar.js: fokussierte mobile Karten, nur bei geöffneter Turnieransicht; kein Direkt-CORS zum Drittanbieter.
- index.html, design-v2.css, sw.js: PWA v31, Live- und Quellenlinks.
- tests/live-radar.mjs: Regeltests für Null-/Live-/veraltete Zustände, Sätze und Berechtigungen.

Schnittstellen- und Historienvollimport sind als Folgeaufgaben weiterhin im Backlog #17 erfasst.

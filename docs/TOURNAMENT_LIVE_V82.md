# v82 – Turnierweite Matchübersicht im LIVE-Reiter

Stand: 11. Oktober 2026 · GitHub-Frontend, **ohne neue Datenbankmigration**.

## Produkt
- Im LIVE-Reiter folgt auf „Meine Spiele“ eine **Turnierübersicht** direkt in der App.
- Auswahl eigener gespeicherter DBV-Turniere, Gesamtliste bereits importierter Matches, „Jetzt / Danach / Gespielt“, Feldfilter, Satzstände und Quellzeit.
- Der originale Turnierlink und Badhub bleiben als Fallback direkt darunter.
- Pro ausgewähltem Turnier erfolgt ein begrenzter öffentlicher Supabase-GET: `tournaments` nach überprüfter UUID; danach `matches` inklusive Teilnehmer und Sätze. Wiederholung maximal ca. einmal pro Minute, nur wenn die Ansicht geöffnet ist. Keine neuen Massenabfragen nach Spielern, keine privaten Daten in Supabase.
- Strikte URL-/UUID-Prüfung, Maximalumfang 240 importierte Matchbelege, Textanzeige ausschließlich per `textContent`, aktive Live-Labels nur bei Quellstand unter 2 Minuten. BYE/Rast/Kampflos zählt nicht als gespielt.

## Fachliche Grenze
**Einlesen ist nicht gleich Import.** Der bestehende DBV-Matchcache kann leer oder unvollständig sein. Weder Badhubs Spieler-Live-JSON noch öffentliche Badhub-Ergebnisseiten liefern uns nachweislich einen autorisierten turnierweiten Echtzeit-Feed. Die App zeigt deshalb nur tatsächlich importierte offizielle Matchdaten. Ein leerer Cache wird transparent angezeigt. Ein vollständiger Turnierfeed erfordert weiterhin einen Quell-Connector mit freigegebenem Anbieterzugang; die Datenquelle wird nicht durch HTML-Scraping oder Ergebnisraten ersetzt.

## Qualität
- `tests/tournament-live.mjs` prüft Identität, fremde URLs, Zuordnung, Punkte, Stale-State, Walkover, Filter, Grenzen und Kopplung.
- Playwright Mobile überprüft die In-App-Ansicht mit verifiziert simulierten Backend-Datensätzen.
- GitHub Actions und Pages nach Merge. Reale Turniertage mit vollständigem Import und verschiedenen Disziplinen bleiben externe Abnahme.

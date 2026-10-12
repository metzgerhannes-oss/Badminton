# v89 – DBV-Turnierlink zuerst, keine doppelte Quelleneingabe

## Ausgangslage
Die Turnierliste speichert bereits offizielle DBV-Turnier-URLs mit einer UUID. Im Live-/Turnierbereich stand bisher aber die separat manuell zu verknüpfende Badhub-Ergebnisquelle **oberhalb** der DBV-Auswahl. Das sah so aus, als müsse man für ein bekanntes Turnier einen zweiten Link eintippen.

## Verhalten
- Das gespeicherte DBV-Turnier wird automatisch vorausgewählt. Der **Original-Spielplan bei DBV** steht direkt an der Auswahl, auch im normalen Reiter **Turniere** und auch dann, wenn noch keine Matchzeilen importiert sind.
- Bei jeder Änderung der Turnierauswahl wird der sichtbare DBV-Originallink sofort synchron gewechselt, selbst ohne aktiven Live-Modus.
- Nur nachgewiesen importierte DBV-Matches erscheinen als In-App-Matchdaten; der Original-Link wird niemals fälschlich als importierter Livefeed dargestellt.
- Weitere auf Badhub veröffentlichte Ergebnisse sind ein **eingeklappter optionaler** Bereich. Die bisher lokal pro DBV-Turnier gespeicherte Badhub-Zuordnung wird weiterhin automatisch verwendet.
- Die Badhub-Quelleneingabe ist lediglich eine *optionale* Unterfunktion. Es gibt keine automatische Übertragung der DBV-UUID in eine Badhub-Zahl und keine ungesicherte Namensverknüpfung.
- Der kostenlose Badhub-Worker fragt bei eingeklapptem Bereich **nicht** im Hintergrund die zusätzlichen Veranstaltungsergebnisse ab.
- Ohne DBV-Turnierauswahl wird eine Badhub-Quelle nicht mehr unter einem globalen Schlüssel fälschlich zugeordnet.

## Daten- und Vertrauensgrenzen
Die beiden Plattformen verwenden unterschiedliche Veranstaltungsschlüssel. Ohne unabhängig belegte Quellidentität kann ein Anbieterergebnis nicht automatisch als dasselbe DBV-Turnier ausgewiesen werden. Der DBV-Originallink bleibt trotzdem direkt nutzbar; fehlende importierte DBV-Matches sind **keine Aussage** über den tatsächlichen Turnierverlauf.

## Abnahme
- Tests prüfen den Primärlink, UI-Reihenfolge, die eingeklappte Zusatzquelle sowie die Aktualisierung beim Auswahlwechsel.
- Playwright: 320px-Breite, DBV-Originallink ohne zweiten Link, kein Badhub-Eventabruf bei geschlossener Zusatzansicht.
- Restliche GitHub Actions und Pages vor der endgültigen Live-Freigabe abwarten.

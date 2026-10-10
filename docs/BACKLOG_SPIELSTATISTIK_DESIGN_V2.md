# Backlog: Matchstatistik und Schmetterlinge-Design v2

Stand: 10.10.2026. Referenz: vom Nutzer bereitgestelltes hellblaues iPhone-Startbild mit SpVgg-Schmetterlingen, zentralem Spielerprofil, drei Ranglistenkacheln, Trophäenschrank, kommenden Turnieren und Fußnavigation.

## Statistiken – Issue #6

Die Startseite zeigt eine neue Statistiksektion mit **Gesamtspiele**, **Siege**, **Niederlagen**, **Siegquote**; Filter **Alle, Einzel, Doppel, Mixed**, **Gesamt oder ausgewähltes Jahr**. Für jedes berücksichtigte Spiel ist eine belegte Einzelzeile mit Turnier, Datum, Gegenseite, Disziplin, ggf. Satzergebnis und HTTPS-Originalquelle verfügbar.

**Zählregeln:** Nur `public.player_match_observations` aus `matches`, `match_participants`, `match_games`, `events`, `tournaments` und `players` mit `security_invoker=true`. Eine Begegnung wird pro Spieler und eindeutiger Match-ID nur einmal gezählt. Zählbar nur bei `status='finished'`, expliziter `winning_side`, offiziellem `source_match_id`, HTTPS-Beleg, dokumentierter Gegenseite und bekannter Disziplin. `walkover`, abgebrochene/offene/unklare Spiele, doppelte konflikthafte Zuordnung oder fehlende Quellen werden ausgeschlossen. Bei Doppel/Mixed erhält jede erfasste Person die Wertung ihrer dokumentierten Mannschaftsseite. Keine Platzierungen, Gesamtpunkte, Ranglistenränge oder Anzahl der Turniere werden zu Siegen oder Spielen umgedeutet.

Bei **null** verwertbaren Matchdatensätzen lautet der sichtbare Zustand: *Noch keine belegten Spiele* (alle Zahlen als Gedankenstrich, Siegquote ebenfalls Gedankenstrich). Das bedeutet **nicht** null Karrierebegegnungen. Quelle und letzte Datenübernahme werden genannt, sofern verfügbar. Der vollständige Datensatz wird in 400er-Blöcken abgefragt; bei mehr als 10.000 Beobachtungen wird die Anzeige als unvollständig kenntlich gemacht.

**Aktueller DBV-Datenstand:** Die Matchtabellen in Supabase sind noch leer; folglich dürfen bis zum tatsächlichen Import keine Siegzahlen angezeigt werden. Die Auswertung ist vorbereitet, der fachlich zuverlässige DBV-Matchimport ist ein eigener offener Folgepunkt.

## Design – Issue #8

Die mobile Referenz wurde als ergänzender Stil `design-v2.css` umgesetzt und wird nach dem bisherigen `styles.css` geladen:

- Helles, sanftes Badminton-Blau statt dunkler Standardoberfläche.
- Weiße Info-/Ranglisten-/Bibliotheks-/Berichte-/Einstellungskarten, dunkle Schrift und ausreichende Kontraste.
- Bewährtes SpVgg-Logo in der freigegebenen, unverzerrten Darstellung – kein Austausch der Grafik.
- Drei Kacheln nebeneinander bei normaler Smartphonebreite, zwei nur auf sehr schmalen Geräten; echte offizielle Ranglistenwerte statt im Bild illustrierter Beispielwerte.
- Trophäenschrank direkt unter der Rangliste, mit tatsächlichen belegten Platzierungszahlen 1–4 und der Zahl erfasster Turniere. Vollständige Historie bleibt erreichbar.
- Darunter nächste Turniere und neue Matchstatistik, anschließend die Freunde.
- Sechs Navigationspunkte (Start, Historie, Turniere, Berichte, Spieler, Einstellungen) mit einheitlichen Outline-SVG-Icons statt uneinheitlichen Sonderzeichen und aktivem Zustand.
- Angemessene mobile Safe-Area-Abstände, 44px-Touch-Ziele, eindeutige Filter, Dialoge und Focus-Indikatoren.

Es werden keine Turniere, Siege, Platzierungen oder Ranglistenwerte nur zur visuellen Übereinstimmung mit der Screenshotvorlage verändert. Die Vorlage zeigt teilweise andere Zahlen und nur vier Reiter; die produktive App erhält ausdrücklich ihre sechs fachlich notwendigen Reiter.

**QA:** Node.js-GitHub-Actions-Tests prüfen Statistikregeln, Statik und Routen. Die reale visuelle Abnahme auf iPhone/Android, echte Touch-Zonen/Scrollpositionen und ein End-to-End-Matchimport sind eigenständige offene Abnahmeschritte. Für #8 bleibt die praktische Sichtprüfung erforderlich; eine CI-Erfolgsmeldung ist kein echter Mobilgerätetest.

## Spielerbibliothek – Issue #7

Schon produktiv: bestätigte **9.246** DBV-Spieler (Stand KW 41/2026) in Supabase, Suche nach Name/ID, Vereinsgruppierung und Vereins-/Landesverbands- sowie offiziellen Altersklassenfiltern. 40er-Pagination, Favoriten lokal, GitHub-JSON-Fallback. Die Design-V2-Stile wurden auf die Bibliothek angewendet. Die Bedienung mit großen Ergebnislisten benötigt ebenfalls noch eine echte visuelle Abnahme.

## Änderungen

- `database/player-match-observations.sql`: read-only SQL-View mit wirksamer RLS des aufrufenden Benutzers.
- `scripts/match-stats.mjs`: deduplizierende Statistikberechnung und Jahresfilter.
- `stats.js`: geschützte REST-Abfrage mit Saison- und Disziplinfilter, Quellnachweisen, Fehler-/Leerzustand.
- `index.html`: Startseitenkomponenten und sechs echte Navigationsicons, CSS-Versionierung.
- `dashboard.js`: echter Trophäenschrank mit bisherigen Auszeichnungen direkt auf der Startseite.
- `design-v2.css`: einheitliches helles Stilkonzept, mobil responsiv.
- `sw.js`, `manifest.webmanifest`, `.github/workflows/tests.yml`, `tests/match-stats.mjs`: PWA, Prüfung und Regression.

# P0-Fix – Home-Spielstatistik + alle gespeicherten Profile in der Importqueue (v36)

Stand: 10.10.2026. Auslöser: iPhone-Screenshot der Home-Spielstatistik mit vier Strichen trotz bereits real in Supabase importierter Matches.

## Bestätigte Fehlerursache

`stats.js` fragte ausschließlich `public.player_match_observations` ab. Der neue Echtimport aus Badhub speichert **bewusst separat** in `public.player_external_match_facts`, weil diese Quellkarten zwar echte Einzelbegegnungen mit Siegern und Satzständen sind, aber nicht immer eine offizielle DBV-Match-ID enthalten. Deshalb blieb Home bei allen bisher nur extern importierten Spielern leer.

**Live-Datenbankprüfung:** Philipp 42 Quelleneinzelmatches (39 Einzel, 1 Doppel, 2 Mixed), im Einzel 17 Siege bei 39 Matches. Sarah 240 Datensätze (90 Einzel, 97 Doppel, 53 Mixed), 151 Siege insgesamt; Vinzent Pius Ott 74 Datensätze (65 Einzel, 9 Doppel), 46 Siege insgesamt. Philipps/andere Drittanbieterzahlen sind **nicht automatisch die gesamte Karriere** und werden nicht mit Badhub-Karriereaggregaten addiert. Die Teilimporte von Sarah laufen serverseitig weiter. Charlotte hat noch keinen erfolgreich strukturiert übernommenen Matchbestand und eine zuvor fehlgeschlagene Quellenprüfung, die später neu versucht wird.

## Korrigierte Home-Anzeige

- Vorrangig ausschließlich **offiziell einzeln verifizierte DBV-Matches** aus `player_match_observations`. Wenn dort insgesamt noch **keine** belegten Matches vorliegen, zeigt dieselbe Karte die separat validierten Badhub-Einzelmatches.
- Die Quellenzeile wechselt dann ausdrücklich von **„Offizielle Matches“** zu **„Badhub · Einzelbelege“**. Offizieller Bestand und externer Bestand werden **nicht addiert**; doppelte oder widersprüchliche Quellkarten werden nicht als Sieg/Niederlage gezählt.
- „Gesamtspiele“, Siege, Niederlagen, Quote und Filter Einzel/Doppel/Mixed sowie Jahr funktionieren auch für den importierten externen Teilbestand. `match_year` filtert korrekt nach Jahr, da bei Turnierkarten oft nur der **Turnierbeginn**, nicht das tatsächliche Spieldatum, vorliegt.
- Der Hinweis benennt **Importfortschritt und Auslassungen** statt pauschal „Die detaillierte Spielhistorie wird noch ergänzt“. Verlinkte Einzelbelege zeigen Gegner, eigene Satzperspektive und Badhub-Originalquelle.
- Auf kleinen iPhones wird die Statistik in einem **2×2-Raster** angezeigt, sodass „Gesamtspiele“ nicht mehr unschön mitten im Wort umbricht.

## Tatsächliche Queue-Abdeckung

**Vor v36:** Das erstmalige Folgen eines Spielers bzw. die Neuanlage eines eigenen Profils löste den Import aus. Bei bestehenden, vor dieser Implementierung lokal gespeicherten Freunden/Eigenprofilen wurde **nur das aktuell ausgewählte Profil** geprüft und ggf. nachgemeldet. Deshalb kann nicht behauptet werden, dass alle gefolgten Personen schon in der Queue standen.

**Ab v36:** Bei jedem App-Start wird eine einmalige Registrierung für alle **auf diesem Gerät bereits gespeicherten eigenen und gefolgten DBV-IDs** ausgeführt. Der Browser überträgt **nur die öffentliche DBV-ID**, keine Followeridentität, und erstellt fehlende Queueeinträge. Maximal drei parallele, sparsame Registrierungsprüfungen, keine Massencrawls. Andere Geräte müssen die aktuelle PWA mindestens einmal öffnen, damit deren **nur lokal gespeicherte** Freundeslisten bekannt werden. Nicht alle 9.246 Spieler der öffentlichen Bibliothek werden importiert.

**Server:** Der bestehende Cronjob bleibt alle 30 Minuten bei höchstens einem Quellprofil pro Lauf, mit zentralem täglichem Limit. `partial`-Batches laufen weiter, `error` wird frühestens nach einem Tag, `awaiting_source` und vollständig gescannte `partial/complete`-Profile wöchentlich erneut geprüft. Bei wöchentlicher Überprüfung beginnt der Parser bewusst erneut mit den neuesten Karten (Cursor 0), damit neu hinzugekommene Spiele nicht übersehen werden. Kein belastbares Ergebnis wird vorgetäuscht, und eine Lastgarantie für sofortigen Abruf aller Profile besteht nicht.

## Abnahme

- `tests/source-stats-home.mjs` überprüft exakte Quellenidentität, Gewinner, Satzkonsistenz, Dubletten, Filtern, Zählung, Importfortschritt, alle lokalen Profil-IDs und wöchentliche Quellenprüfung.
- Bestehende `tests/match-stats.mjs` sichern die offizielle DBV-Bewertung unverändert. PWA-Cache auf v36.
- SQL-Claim/Cron-Funktionen bereits im Supabase-Projekt aktualisiert. Sicherheitsadvisor und CI prüfen.
- **Noch offen:** Vollimport von Sarahs übrigen auswertbaren Spielen, bislang verworfene Kartentypen fachlich prüfen, iPhone-Sicht- und Praxistests, langfristige Nutzungsrechte öffentlicher Badhub-Daten.

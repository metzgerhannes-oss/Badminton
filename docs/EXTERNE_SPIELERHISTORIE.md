# Historische Karrieren befreundeter Spieler – quellengestützte Ergänzung

Stand: 10.10.2026. Neue externe Jahresübersichten sind bewusst von unserer intern vollständig verifizierten DBV-Einzelmatchhistorie getrennt.

## Sarah Storz (05-061350, SpVgg. Mössingen)

Öffentliche Quelle: https://badhub.de/spieler/05-061350?saison=all&src=gesamt

Manuell anhand der veröffentlichten Badhub-Profilseite am 10.10.2026 abgelesen: **678 erfasste Spiele, 388 Siege, 290 Niederlagen, gerundet 57 % Siegquote**, davon 634 Turnierspiele (359 Siege) und 44 Ligaspiele (29 Siege). Diese Zahlen sind **Badhub-Drittanbieter-Aggregate**, keine durch unsere DBV-Matchdatenbank validierten Einzelergebnisse. Sie dürfen nicht mit den späteren Supabase-Statistiken addiert werden.

Jährliche Turnierübersichten: 2026: 9 Turniere/19 Platzierungen, 2025: 11/30, 2024: 13/34, 2023: 17/38, 2022: 20/44, 2021: 5/11, 2020: 6/12, 2019: 9/17, jeweils mit den in der Badhub-Veröffentlichung angegebenen Gold-, Silber- und Bronze-Platzierungen. Das Portal listet auch 2018, ohne dass dessen Jahresgesamtzahl in dieser Übernahme gesondert überprüft wurde. **2018 wird deshalb nicht mit geschätzten Zahlen gefüllt.**

Fünf ausgewählte historische Turnier-Ergebnisse mit Turnierbeginn, Disziplin, Altersklasse und ggf. Doppelpartner wurden separat aus der Badhub-Aufstellung übernommen. Bei mehrtägigen Turnieren bezeichnet das Datum den *Turnierbeginn*, nicht zwingend den Spieltag des Finales. Kein Beispiel wird automatisch zu einem einzeln verifizierten Trophäen-Eintrag im bisherigen `data/history.json`.

## Produktablauf

1. Freund über Suche hinzufügen und Profil öffnen.
2. Unter **Historie** erscheint – sofern für die DBV-ID in `data/player-history/index.json` eine nachweisbare Quelle hinterlegt ist – die separate Rubrik **Historische Spielerkarriere** mit Jahreskarten, echten Quellendaten, ausgewählten Platzierungen, Filter nach Jahr und Beispiel-Disziplin.
3. Auf **Home → Spielstatistik** ist bei einer historischen Badhub-Übernahme eine zusätzliche Box **„Historisch erfasste Spiele · Badhub“** zu sehen. Die offiziellen Match-KPIs bleiben als Gedankenstriche, bis einzelne verifizierte DBV-Matches importiert wurden. So sind 678 Badhub-Spiele nicht mit null intern validierten Spielen zu verwechseln.
4. Für andere DBV-IDs ohne eigenen überprüften externen Snapshot zeigt die Historie einen gekennzeichneten **Recherchelink** statt erfundener Match- oder Platzierungszahlen.
5. Das bestehende Auszeichnungsregal zählt weiterhin ausschließlich die persönlich verifizierten Einträge aus `data/history.json`; Badhub-Podestzusammenfassungen werden nicht hineinkopiert.

## Datenmodell und Pflege

- `data/player-history/index.json` ist eine ausdrückliche Whitelist mit DBV-ID und Quelldatei.
- `data/player-history/05-061350.json` ist ein separat datierter, nachvollziehbarer Drittanbieter-Snapshot und enthält **nur** selbst zusammengefasste strukturierte Fakten, keine vollständigen Artikeltexte.
- `scripts/external-history.mjs` prüft DBV-ID, Originalquelle, Siege+Niederlagen, Turnier-/Liga-Summen, Doppelzählungen und Jahreswerte. Unstimmige Daten werden nicht angezeigt.
- `career-history.js` zeigt nur ein passendes Profil, schützt vor asynchronen Profilwechseln, trennt die externen Zahlen vom offiziellen `stats.js` und bietet Quellverweise.
- `tests/external-history.mjs` testet Zahlenkonsistenz, Sarah-spezifische Zuordnung, 2018-Lücke, Trennung zu DBV-Matches, PWA-Dateien und Jahr-/Disziplinfilter.

## Noch offen

Eine **vollständige, systematisch importierte historische Einzelnachweis-Datenbank** aller 678 Badhub-Spiele ist das ausdrücklich weiter offene Backlog-Thema #6. Vor einer solchen Umsetzung muss ein zulässiger Datenzugang feststehen und für jedes Match Identität, Status (inkl. Walkover), Saison/Disziplin, Gegner, Spielausgang, Match-ID und Originalquelle eindeutig belegt sein. Der jetzige Schritt liefert bereits eine ehrliche mehrjährige Karriereansicht, **nicht** einen behaupteten Vollimport aller Begegnungen oder aller Badminton-Spieler.

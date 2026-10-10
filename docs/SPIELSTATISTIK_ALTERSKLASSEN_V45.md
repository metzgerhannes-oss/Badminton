# Spielstatistik – Einordnung nach Turnier-Altersklasse (v45)

Stand 10.10.2026 · Backlog #6

## Fachregel

Die Gesamtzahl der Spiele bleibt unverändert. Zusätzlich kann die Statistik nach dem Altersklassen-Kontext eines **nachgewiesenen Einzelmatches** gefiltert werden:
- **Alle Altersklassen:** bisherige Gesamtauswertung, inklusive Ligaspielen ohne Jugend-Altersklasse.
- **Eigene Altersklasse:** Match ist in der für den Spieler im **jeweiligen Turnierjahr** regulären U-Altersklasse ausgetragen.
- **Höhere Altersklasse:** laut Veranstalter wurde das Match in einer höheren U-Altersklasse bestritten.
- **Nicht zuordenbar:** Ligaspiel, Erwachsenenklasse, fehlende oder mehrere U-Angaben, fehlendes Geburtsjahr oder widersprüchliche (niedrigere) Turnierklasse.

Es wird **nicht das Alter einzelner Gegner** abgeleitet. Nur die öffentlich belegte Klasse des Turnierfelds wird verglichen.

## Daten

Quelle für das Geburtsjahr ist das öffentliche DBV-Player-Verzeichnis in Supabase (`players.birth_year`), nicht die momentane Ranglisten-Altersklasse oder ein geschätztes Alter. Bei fehlendem verlässlichem Jahrgang bleibt die Einordnung unbekannt.

Externe Belege: `player_external_match_facts.event`, z. B. `ME U17` oder `ME U19`, `match_year`, `category`. Für Ligen und `DE B`/Erwachsenenklassen ist keine Jugendklasse belegbar. Mehrdeutige Klassen wie `MD U17/U19` werden nicht geraten.

Offizielle Belege: `player_match_observations.event_code` und `match_date`; wenn der Code nur eine Disziplin enthält, keine Zuordnung.

## Rechenregel

Eigene Jugendklasse je Kalenderjahr = kleinste reguläre U9/U11/U13/U15/U17/U19/U22 oberhalb des Alters (`Turnierjahr - Geburtsjahr`). Beispiele:
- Jahrgang 2016 in 2026: U11; Teilnahme U13 oder U15 gilt als höher.
- Jahrgang 2010 in 2026: U17; Teilnahme U19 gilt als höher.
- Jahrgang 2010 in 2024: U15; U17 ist in 2024 bereits höher.
- Jugendklasse nicht sicher ableitbar: „Nicht zuordenbar“.

Es werden ausschließlich **bereits validierte, eindeutige Matches** eingeteilt; ungeklärte Matches bleiben wie zuvor vom W/L-Zähler ausgeschlossen. Der Altersklassenfilter rechnet nur eine Teilmenge der bestehenden Ergebnisse und darf die Gesamtbilanz nicht verändern.

## UX

Unter Disziplin und Zeitraum steht der optionale Filter „Gespielte Altersklasse“. Der Startwert ist **Alle Altersklassen**. Eine Zusatzzeile erläutert die **Verteilung der Niederlagen**: eigene AK, höhere AK, nicht zuordenbar. Jeder angezeigte Quellbeleg zeigt seine Klasse (z. B. `U19 · höhere AK (eigene U17)`).

**Wichtig:** Eine Niederlage in U19 ist nicht automatisch eine Niederlage gegen einen nachweislich älteren Gegner; auch Gleichaltrige können höher starten. Keine bewertende Gewichtung der Niederlage oder erfundene Gegner-Altersdaten.

Keine Änderungen an Quellrechten, Matchimport, LocalStorage oder bestehenden Ergebnissen; neue Einordnung ist reine Leselogik. Praxisabnahme auf iPhone ist zusätzlich nötig.

## Offizielle Regelhinweise

DBV Jugendwettkampf FAQ: https://www.badminton.de/der-dbv/jugend-wettkampf/faq/
DBV-Turnierkalender mit U9–U22: https://turniere.badminton.de/

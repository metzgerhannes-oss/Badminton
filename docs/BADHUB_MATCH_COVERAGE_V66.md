# v66 · Badhub-Satzformate und Matchabgleich – P0

Stand: 11. Oktober 2026. Live-Quellenaudit mit begrenzten GET-Anfragen und ohne Speicherung der HTML-Seiten oder der Namen einzelner Gegner.

## Empirisch nachgewiesene Ursache

Öffentliches Profil Philipp Metzger (DBV-ID 05-070879), Badhub:
- 62 veröffentlichte Matchkarten im zugänglichen Turnierquellbestand.
- Bisheriger produktiver Parser: 42 übernommene Karten, 20 ausgeschlossen.
- Neues Parser-Layout + korrekte Identitätsprüfung: 45 Karten mit vollständigem klassischem Satzformat.
- Zusätzlich 7 Karten mit vollständigen 11-Punkte-Sätzen.
- Weitere 6 Karten mit 15-Punkte-Sätzen wurden weiterhin ausgeschlossen: kein eindeutiger abgeschlossener Matchsieg nach auslesbaren Sätzen.
- 4 Quellkarten liefern keine auslesbaren Sätze.
- Somit **52 von 62** Karten auswertbar, **10** nicht belegbar. Diese 10 werden nicht künstlich zu Sieg/Niederlage.

Die maximalen Satzpunkte im Audit:
- 21–29: 45 Karten
- 11: 7 Karten
- 15: 6 Karten
- Ohne auslesbare Sätze: 4 Karten

BWBV veröffentlicht explizit Jugendturniere mit 11 oder 15 Punkten (z. B. BWBV Bericht 2024, E-Ranglistenberichte 2026). Ein ausschließlich auf 21 Punkte ausgelegter Parser ist fachlich falsch.

## Produktverhalten

- Home: datierter Badhub-Gesamtstand (Screenshot vom 11.10.2026: 62 Spiele, 26 Siege, 36 Niederlagen), getrennt vom DBV-Screenshot (60/26/34) und von einzeln belegten Matchkarten.
- Angabe zu Badhub und DBV wird **nicht** zur Ergänzung fiktiver Einzelmatches verwendet. Screenshots sind keine laufend aktuelle API-Abfrage.
- Vergleich nur über unverfilterte Karriereansichten; für Jahre/Altersklassen/Disziplinen ohne passend belegte Referenz bleibt die Karte ausgeblendet.
- Historie und Home verwenden die identische strenge Validierung auch für verkürzte, vollständig gespielte Sätze.
- Backend meldet die zahlenmäßigen Gründe ausgeschlossener Matchkarten an Importstatus; keine Original-HTML-Ablage.
- Bestehende Einträge werden nicht aufgrund bloßer Summenabweichung gelöscht.

## Weiter offen

- Für Charlotte und Vinzent ist bislang kein vollständiger Badhub-Aggregatsnapshot verifiziert.
- Sarahs Badhub-Sammelübersicht muss vor Nutzung in einer offiziellen Statistik mit den Einzelbelegen abgestimmt werden.
- Die Differenz zwischen 62 Spielen in Badhub und 60 Spielen im DBV bleibt quellenabhängig, ohne behauptete Ursache.
- Der Nutzwert von 52 belegten Quellkarten steigt erst nach dem erneuten produktiven Import. GitHub-Merge allein aktualisiert keine Supabase-Edge-Function und keine bestehenden Matchtabellen.

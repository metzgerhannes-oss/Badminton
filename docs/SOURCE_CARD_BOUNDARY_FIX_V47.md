# v47 – P0: Badhub-DBV-Crossfed-Turniere korrekt abgrenzen

**Nachweis:** Ein kontrollierter öffentlicher Badhub-Leseabruf von `/spieler/05-061350?src=turnier&saison=all` enthielt `<div class="card sp-tournament-card sp-tournament-card--crossfed">` und den DBV-Turnierlink `/dbv/turnier.php?id=950` für **Deutsche Einzelmeisterschaften U15-U19 Hoyerswerda 2025**. Der alte Parser trennte ausschließlich an `class="card sp-tournament-card"` und übernahm folglich komplette folgende DBV-Turnierabschnitte unter dem letzten BWBV-Turnierlink (z. B. Reutlingen 2026 / id 2871). Direkter Vergleich mit dem Vereinsbericht vom 16.12.2025 zeigte identische Gegner und Sätze im falschen 2026-Turnier.

**Änderung:** Jede Tournament-Kartengrenze unabhängig von weiteren CSS-Klassen trennen. Links der existierenden Badhub-Namensräume `bwbv` und `dbv` getrennt akzeptieren; für DBV-Crossfed-IDs eindeutige `source_key`-Kennung `tournament:dbv-<id>...`. Jahr, Wettbewerb und Gegner ausschließlich aus der richtigen Karte übernehmen. Keine unbekannten Anbieter-Domains oder URL-Pfade freischalten. Daten bleiben klar als **Badhub-Drittanbieter-Belege**, keine offiziellen DBV-Match-IDs.

**Migration:** `database/external-match-crossfed-v47.sql` erweitert ausschließlich den CHECK auf belegte, eigene Badhub-URLs. Bestehende RLS/Service-Role-Policies unverändert. Nach grünen Tests Schema verifizieren, Edge-Parser deployen, dann fälschlich zugeordnete Alteinträge gezielt mit Sicherung bereinigen; nicht blind alle historischen Matches entfernen.

**Offen:** Vollständiger rechtmäßiger DBV-/Badhub-Feed (#17), quellenweite Altbestandsreconciliation und die physische iPhone-Abnahme (#28).

# v42 – Spielerstatistik: Quellenausfall ist nicht gleich leere Historie

**Produktziel:** Eltern und Kinder dürfen fehlende Onlineergebnisse nicht als verlorene Sporthistorie interpretieren.

- Offizielle und Badhub-Einzelnachweise werden weiterhin **nicht zusammengezählt**; vorhandene belegt zählbare Treffer bleiben unverändert.
- Beide Quellen erfolgreich, 0 Einzelbelege: „Noch keine einzeln belegten Spiele verfügbar“ (in der App, keine Aussage über den Spieler).
- Eine Quelle fehlgeschlagen: „Spielstatistik derzeit nur teilweise abrufbar“, Retry sichtbar. Eine leere zweite Quelle darf daraus **keine** Behauptung über die Karriere ableiten.
- Beide Quellen fehlgeschlagen: „Spielstatistik gerade nicht erreichbar“, Retry sichtbar.
- Vorhandene belegte Matches bleiben auch bei Ausfall einer anderen Quelle angezeigt. Unter „Was zählt in die Statistik?“ wird der reduzierte Abgleich gekennzeichnet.
- Bei gültiger öffentlicher DBV-Spieler-ID bietet Home einen externen Link `https://badhub.de/spieler/<ID>?saison=all&src=gesamt` an. Nur Nutzerklick, keine automatische Drittanbieter-Abfrage und keinerlei Behauptung, dass es dort bestätigte Ergebnisse gibt. Ungültige/lokale IDs erhalten keinen Link.
- Keine DB- oder Importänderung; neue UI reagiert auf bestehende Fehlerflags aus der REST-Schnittstelle.
- Regression: `tests/match-availability.mjs` und mobiles Chromium/WebKit E2E mit temporärem 503/Retry; alle bisherigen Source-Provenienz-Tests bleiben verpflichtend.
- Noch offen: echter autorisierter und vollständiger DBV-/Badhub-Feed (#17), echte iPhone-Abnahme (#28), Historienvollständigkeit, endgültige UI-Gestaltung.

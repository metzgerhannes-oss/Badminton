# P2 #291 · Reihenfolge von Spielern und Mannschaften · v213

## Vorhandener funktionierender Bestand
- Bereits in Main v200 implementiert: Auf/Ab-Bedienung direkt unter Spieler und Teams, lokale Reihenfolge, Rücksetzung alphabetisch, Fokus nach Sortierschritt, neue Follows hinten angehängt, keine neue Tabelle/Cloud-Synchronisierung.
- Bestehende synthetische Playwright-Prüfungen für Sortierung und Reload sowie Desktop-Kontrasttests 390/1280/1440/1920 bleiben erhalten; die echten Serverrechte/DBV-Daten werden nicht angerührt.

## Abgeschlossener Komfortrest
- Ein eindeutig sichtbares **Fertig** unter beiden Sortierlisten. Klappt den Bearbeitungsbereich zu und gibt Tastatur-/Screenreaderfokus an dessen Überschrift zurück. Auf-/Ab-Aktionen speichern weiterhin sofort lokal, ein zusätzlicher Speichern-Dialog ist nicht erforderlich.
- Acht zusätzliche Browserfälle für Listen von 0, 1, 5 und 20 persönlichen Follows/Teams, auf 320/390px; bei Mehrfacheinträgen wird die Sortierung nach Neuladen und unveränderten eigenen Profilen überprüft; bei 0/1 Reset gesperrt. CSS ergänzt ausschließlich 44px-Touchfläche und sichtbaren Fokus; CD und Desktop bleiben gleich.
- Versions- und PWA-Cache-Synchronisierung auf v213, ohne Neuinstallation oder Löschen von Bestandsdaten. Reguläre Browser-CI bleibt synthetisch mit Supabase-Netzsperre.

Noch erforderlich: einmalige physische iPhone-/Desktop-Schlussabnahme im F11-Plan; technisch getesteter Funktionsumfang darf dafür bereitgestellt sein.

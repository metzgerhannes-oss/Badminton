# Schmetterlinge – fokussierte Navigation und Spielerbibliothek (v37)

Stand: 10.10.2026 · Bezug: #7, #8, #13 und Spielstatistik #6

## Menüstruktur

**Vier Hauptziele:** Home · Turniere · Spieler · Berichte. **Einstellungen** liegen oben rechts.
- **Home:** ausschließlich persönliche bzw. ausdrücklich gewählte Freundesübersicht, Ranglisten-KPIs, nachgewiesene Siege/Niederlagen/Gesamtspiele, Trophäen, nächste Turniere, befolgte Spieler. Ein Tipp auf Home oder das Logo beendet einen Freundesbesuch und öffnet das eigene aktive Startprofil.
- **Turniere:** Turniertag, Live-Stand (nur wo durch Quellen belegt), gespeicherte Turnierlinks. Die eigene **Turnierhistorie und Auszeichnungen** bleiben über einen direkten Link erreichbar (`#historie`); von dort zurück zum Turniertag. Bei `#historie` ist „Turniere“ aktiv.
- **Spieler:** **ein zentraler Such- und Folgeweg** über die DBV-Spielerbibliothek, anschließend eigene Profile und Freundesliste einschließlich Bearbeiten/Entfolgen. Der frühere zweite Freundesuchdialog in Einstellungen entfällt. Manuelle DBV-ID-Erfassung bleibt verfügbar.
- **Berichte:** Artikel und Spielererwähnungen.
- **Einstellungen (Zahnrad):** Einladungslink, Installation, Datenquellen und Datenschutz; keine doppelte Profilverwaltung.

Bestehende Routen (`#start`, `#historie`, `#turniere`, `#berichte`, `#spieler`, `#einstellungen`) und gespeicherte LocalStorage-Daten bleiben kompatibel. Die mobile Leiste zeigt nur die vier Hauptbereiche.

## Bibliothek – kein automatisches Anzeigen aller 9.246 Spieler

Ohne aktiven Suchbegriff oder Filter werden **keine Spieler-/Vereinskarten** geladen oder gerendert. Eine kleine Quellen-/Vereinsmetadatenabfrage für Landesverbände bleibt zulässig; eine komplette Spieler-Abfrage nicht.

Als aktive Kriterien gelten: nichtleere Namens-/ID-Suche, Verein, konkret ausgewählte Altersklasse oder Landesverband. „Alle“ gilt nicht als Filter. Treffer werden nach Verein gruppiert und seitenweise geladen. Bei Entfernung des letzten Kriteriums wird eine möglicherweise noch laufende Anfrage per Anfrageticket ungültig gemacht und das ruhige Startfeld erscheint; „Filter zurücksetzen“ erledigt dies in einem Schritt. Das gilt sowohl für Supabase als auch für die GitHub-Ausfallsicherung.

## Abgrenzung und Datenqualität

Die Spielerbibliothek enthält belegte öffentliche DBV-Ranglistendatensätze. Eigene Profile/Favoriten/Freundelisten liegen weiterhin lokal auf dem Gerät; bestehende Listen werden durch die UX-Änderung nicht zurückgesetzt.

Die bestehende **Spielstatistik** zeigt bestätigte Siege, Niederlagen, Anzahl der Spiele und Siegquote je Disziplin/Jahr an. Zurzeit sind 476 einzeln belegte Match-Fakten für drei DBV-Spieler in `player_external_match_facts` gespeichert; `matches`, `match_games` und `match_participants` (offizieller DBV-Matchimport) bleiben **leer**. Matchzahlen aus Badhub sind explizit als solche beschriftet und dürfen nicht als vollständige offizielle Karrierebilanz dargestellt werden.

Ein automatischer autorisierter Live-/Karriere-Import für beliebige neue Spieler bleibt **separat blockiert**, bis Quellenrechte/API-Zugang geklärt sind (#17). Keine unerlaubte Scraping-Umgehung, keine erfundenen Ergebnisse.

## Abnahmeumfang

- Vier sichtbare Hauptmenüpunkte, Einstellungen im Kopfbereich, Historie über Turniere und Home-Trophäen erreichbar.
- Nur **eine** Suchmöglichkeit zum Folgen in der Spielerbibliothek; Freundeliste und Profile unter Spieler, nicht doppelt unter Einstellungen.
- Home/Logo/„Zu mir“ bringen immer zum eigenen Profil, Freundesauswahl aus Spieler- oder Freunde-Bereich verwendet denselben zentralen Aufruf.
- Ohne Bibliothekskriterium keine Spieler-/Vereinsliste; Auswahl und Zurücksetzen funktionieren sowohl per Textsuche als auch über alle Dropdownfilter.
- Kleine iPhones: vier ausreichend große Ziele und keine abgeschnittenen unteren Bezeichnungen; Kopfprofil auf Spieler-/Berichte-/Einstellungsseiten ausgeblendet.
- Keine UI-Formulierung „Familien-Datenbasis“ oder „in unserer Sammlung“ beim Hinweis auf lückenhafte öffentliche Quellen.
- Automatisierte statische Navigationstests plus GitHub-Actions-Testlauf. Echte iPhone-/Android-Sichtprüfung nach Deployment bleibt eine separate praktische Abnahme.

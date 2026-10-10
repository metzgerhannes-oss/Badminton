# Gemeinsame DBV-Spielerbibliothek

Stand 10. Oktober 2026. Die App führt eine **gemeinsame öffentliche Bibliothek** aller Spieler, die im offiziellen veröffentlichten DBV-Excel-Ranglistenexport sicher durch eine numerische DBV-Spieler-ID identifizierbar sind. Das gesamte Verzeichnis ist für alle Nutzer der PWA gleich und braucht keinen Login.

## Start und automatische Aktualisierung

- Der bestehende Donnerstag-Workflow `.github/workflows/ranking.yml` lädt den offiziellen veröffentlichten DBV-Excel-Export und verarbeitet ihn mit `scripts/update-ranking.py`.
- Dieselben **vollständigen offiziellen Zeilen** erzeugen über `scripts/player-library.py` sechs Verzeichnisdateien `data/player-library/U11.json` bis `U22.json` sowie `data/player-library/index.json`. Spieler werden nach numerischer DBV-ID dedupliziert (Einzel, Doppel, Mixed erscheinen nicht dreifach).
- Der Export liefert Vor- und Nachname, Spieler-ID, offizielles Geburtsjahr, **AKL2** als offizielle Altersklasse, **Verein**, **ClubID** und Landesverband. Fehlt eine Vereinsangabe, wird sie nicht erfunden.
- Bei erneuten offiziellen Exporten werden vorhandene Spieler aktualisiert; früher im DBV-Export belegte IDs bleiben als historische Einträge mit letzter bestätigter Kalenderwoche auffindbar. Eine Änderung der offiziellen Altersklasse ordnet sie dem passenden Filter neu zu.
- Quelle für alle Daten: https://turniere.badminton.de/ranking und dortiger offizieller Excel-Download. Keine lokale Nutzerprofilangabe wird in die zentrale Bibliothek hochgeladen.
- **Initial** sind lediglich die beiden bereits bestätigten Profile enthalten; der nächste erfolgreiche Rankingschritt lädt den bundesweiten Verzeichnisbestand. Verfügbarkeit wird über die veröffentlichte `index.json` gezählt, keine Gesamtzahl wird vorweggenommen.

## App-Funktionen

- Neue Navigation **Spieler** (sechster Tab).
- Freie Suche nach Name, DBV-ID und Verein. Akzent-/Umlaut-tolerant.
- Filter: offizielle **U11, U13, U15, U17, U19, U22**, Verein als Eingabe mit Vorschlägen und Landesverband.
- Alphabetische Gruppierung nach Verein; zunächst 40 Treffer, weitere über einen Button. Für große Datensätze werden Altersklassen einzeln geladen und im aktuellen Browser zwischengespeichert.
- **Folgen/Entfolgen:** persönliches lokales Lesezeichen in `shuttleboard-v1.friends` (max. 30 wie im bisherigen System). Folgende Spieler können über **Ansehen** geöffnet werden; offizielle Ranglisten-KPI-Zahlen bleiben leer, solange sie nicht ausdrücklich für dieses Profil importiert wurden.
- Bereits als eigenes Profil eingerichtete Spieler werden nicht ein zweites Mal als Freunde gespeichert.
- Datenschutz: nur öffentliche Sportstammdaten der offiziellen DBV-Rangliste; keine Nutzungsdaten, Adressen, privaten Kontakte oder lokalen Favoritenlisten im globalen Verzeichnis.

## Architektur und Grenzen

Der **gemeinsame Verzeichnisfeed liegt zunächst auf GitHub Pages** in versionierten, öffentlich lesbaren JSON-Dateien, nicht in der Supabase-Tabelle `players`. Die Supabase-Tabelle enthält weiterhin den bisherigen verifizierten Grundbestand. Es ist bewusst **keine Supabase-Service-Role im Browser oder GitHub-Repository** hinterlegt; für eine spätere Datenbank-Synchronisierung wäre eine geschützte serverseitige Verbindung erforderlich. Das statische gemeinsame Verzeichnis löst die Auffindbarkeit und automatische bundesweite Erweiterung vollständig ohne Benutzeranmeldung und kostenlos.

Eine angegebene DBV-ID allein macht einen manuell angelegten Nutzer nicht automatisch zum verifizierten DBV-Spieler. Solche Profile bleiben lokal, bis die ID in einer offiziellen Quellenimportdatei nachweisbar ist. Der Katalog enthält nur belegte Sportdaten aus der offiziellen Rangliste, nicht alle jemals registrierten Personen ohne Ranglisteneintrag. Altersklassen werden **nicht aus dem Geburtsjahr geschätzt**, sondern direkt aus dem jeweils vorliegenden offiziellen AKL2-Wert übernommen. Einträge mit widersprüchlichen offiziellen ID-/Namens-/Jahrgangsdaten werden zurückgehalten statt vermischt.

## Tests

- `scripts/test-player-library.py`: bestätigt ID-Validierung, Deduplikation und Ausschluss widersprüchlicher Daten.
- `tests/player-library.mjs`: testet Verein, Suche, Filter und Anbindung an das persönliche Folgen.
- CI: `.github/workflows/tests.yml`; Datenaktualisierung und Veröffentlichung: `.github/workflows/ranking.yml`.

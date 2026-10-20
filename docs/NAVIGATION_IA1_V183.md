# Schmetterlinge · #13 – IA-1: verbindliche Navigation und Nutzerwege

Stand: 20.10.2026 · basierend auf `main` c0d702c0fd5db0d312e9038544615b9eb8a90129 · **Entscheidung, keine UI-Freigabe**.

## 1. Inventur (Ist) – konkrete Routen

| Oberfläche | Aktuell sichtbare Ziele | Technische Route/Anker | Besonderheit |
| --- | --- | --- | --- |
| iPhone Bottom-Navigation | Home, Turniere, Spieler, Mannschaft, Berichte | `#start`, `#turniere`, `#spieler`, `#mannschaft`, `#berichte` | fünf feste Ziele; enger 320px-Balken, kein separates „Mehr“ |
| iPhone dynamisch | Heute/LIVE | `#live` | **nur** bei nachgewiesener heutiger Ansetzung; Teil von Turniertag |
| Desktop Sidebar | wie iPhone + Verein | zusätzlich `#verein` | Verein ist Desktop-Kontext, nicht sechsster Mobil-Tab |
| Kopf | Home-Logo, Einstellungen | `#start`, `#einstellungen` | Home muss auch bei bereits aktivem Hash das eigene Profil wiederherstellen |
| Übersicht | Statistiken, Ergebnisse, Trophäen, Rangliste, Freunde | `#start`, `#historie/result/…`, `#spieler` | nur Vorschau und direkte belegte Nachweise; keine zweite Pflege |
| Spieler | eigenes Startprofil, gefolgte Spieler, DBV-Suche | `#spieler` und `#einstellungen/profile` | Profilverwaltung und Freundesverwaltung bislang verteilt |
| Mannschaft | gefolgte Teams, Saisondaten, Suche | `#mannschaft` | „Verwalten“ führt noch zu `#einstellungen` (unnötiger Umweg) |
| Turniertag und Historie | Turnieraktionen, Nachweise, Trophäen | `#turniere`, `#historie` | Historie ist Unteransicht von Turniere, nicht weiterer Tab |
| Berichte | Vereins-/Spielerberichte | `#berichte` | eigenständiger Lesebereich |
| Einstellungen (Hub) | Profile, Spieler, Mannschaften, Darstellung, Einladungen, Daten, Quellen | `#einstellungen/{profile,spieler,mannschaften,darstellung,einladungen,daten,quellen}` | sieben Karten; hier liegen **zweite** fachliche Verwaltungswege |
| Seltene Aktionen | Besitzeraktivierung, private Rechte, Sicherungen | Einstellungen-Detailkarten | Sichtbarkeit und serverseitige Berechtigungen nicht vereinfachen oder umgehen |

Die bestehenden Einstellungen werden dynamisch in `settings-rooms.js` aus `index.html`-Knoten zusammengestellt. `app.js` rendert `#friend-list` **und** `#friend-settings-list`. `teams.js` rendert `#team-followed` **und** `#team-settings-list`. Deshalb dürfen die Einstellungsräume **nicht** ohne vorherige sichere Verlagerung der Sortier-/Bearbeitungsaktionen gelöscht werden.

## 2. Navigationsmatrix – ein Pflegeweg je Aufgabe

Klicks: gezählt ab passendem Hauptmenü, ohne initialen Profil-/Einladungsvorgang. `→` ist ein Nutzerklick; die Anzahl kann bei verborgenem/leerem Bereich abweichen.

| Nutzerabsicht / Rolle | Ist / redundante Wege | Soll / kanonischer Weg | Kontext-Schnellzugriff und Rückweg |
| --- | --- | --- | --- |
| Eigenes Kind/Profil wechseln (Familie) | Kopf-Wechseln, Spieler-Startprofil, Einstellungen | **Kopf-Profilchip → eigenes Profil** (1 Klick zum Menü, 1 Auswahl), vorhandener Zustand | Home/Logo/„Zu mir“ → `#start` mit eigenem aktiven Profil; keine DBV-Rechteänderung |
| Eigenes Profil hinzufügen/bearbeiten (Familie) | `#einstellungen/profile`, alternative Ersteinrichtung | **Einstellungen → Meine Profile**, ein bestehendes Formular | „Mein Profil verwalten“ vom Kopf öffnet denselben Anker; keine parallele Anlage unter Freunde |
| Fremdem Spieler folgen/entfolgen (Mitglied) | Spieler +, Home +, Einstellungen/spieler, Einstellungen/Einladungen, separate Suche | **Spieler → Gefolgte Spieler / + Spieler suchen** (direkt in einer Seite) | Home-Freunde + öffnet **dieselbe** `#spieler`-Suche; „Alle anzeigen“ öffnet die Gefolgt-Liste; zurück zu Home |
| Gefolgte Spieler sortieren (Mitglied) | `#einstellungen/spieler` (zweite Liste) | **Spieler → Gefolgte Spieler → Reihenfolge** (selbe Daten, kein Extraformular) | Keine Kopie in Einstellungen; #291 als getrennte Funktionsfreigabe |
| Gefolgte Mannschaften folgen/entfolgen/sortieren (Mitglied) | Mannschaft +, `#einstellungen/mannschaften`, „Verwalten“ `#einstellungen` | **Mannschaften → Meine Mannschaften** mit Aktionen in derselben Ansicht | Kontext „Verwalten“ öffnet exakt dieselbe Ansicht oder entfällt, falls Aktionen direkt sichtbar |
| Turnier merken, aktuelle Begegnung ansehen (Mitglied) | `#turniere`, ggf. `#live`, Home-Karte | **Turniere** ist Pflege-/Detail-Heimat | „Heute“ nur bei wirklich belegtem heutigen Spiel, niemals dauerrot oder als erfundener Live-Status; zurück zu Turniere |
| Turnierhistorie / Einzelnachweis lesen | `#historie`, Home-Nachweise | **Turniere → Historie / genau passender Einzelnachweis** | Home-Ergebniskarte öffnet denselben Ergebnisbeleg (v181, #314) |
| Spielstatistiken/Ranglisten (Mitglied) | Home-Kacheln und historische Belege | **Home** als Ergebnisübersicht mit direkten Belegen; Ranglisten-Detail im bestehenden Dialog | keine zweite Berechnung oder Karte, Ranglisten keine erfundenen Matches |
| Berichte ansehen (alle Berechtigten) | `#berichte`, Mannschafts-Tab Berichte | **Berichte** für redaktionelle Quellen, Teamberichte als Mannschaft-Kontext | von Mannschaft zurück zur Mannschaft ohne neuen Pfad |
| App-Sprache/Vereinsdesign (Mitglied) | `#einstellungen/darstellung` | **Einstellungen → App & Darstellung** | keine weitere Unterebene |
| Einladung/privater Zugang (berechtigtes Mitglied/Owner) | `#einstellungen/einladungen` und Owner-Panel unter Profile | **Einstellungen → Zugänge & Freigaben**; getrennte Rollen und serverseitige Prüfung | Einladung und Widerruf unverändert; kein Freigabegewinn durch Folgen |
| Backup/Datenschutz (Mitglied) | `#einstellungen/daten` | **Einstellungen → Daten & Datenschutz** | Export/Import unverändert, Bestätigungen erhalten |
| Datenquellen/Anleitung (Mitglied) | `#einstellungen/quellen`, Wiki, diverse Hilfe | **Einstellungen → Hilfe & Informationen** für App-Hilfe; Wiki bleibt Wissensbereich auf Home | technisch belegte Quellen unverändert |

## 3. Ziel-Menübaum (nach Umsetzung IA-2 bis IA-4)

```text
Hauptnavigation (iPhone)
├─ Home       – eigenes aktives Profil, Statistiken, Belege, Vorschauen
├─ Turniere   – Turniertag, Historie, Ergebnisse, Vormerkungen
│  └─ Heute   – optionales dynamisches Ziel NUR bei belegter Ansetzung
├─ Spieler    – Freunde/gefolgte Spieler, DBV-Suche, Folgen und Sortierung
├─ Mannschaft – Meine Mannschaften, Suche, Folgen und Sortierung
└─ Berichte   – Artikel/Vereinsberichte

Desktop: dieselben Ziele plus „Verein“ in der Sidebar, kein doppeltes Mobil-Menü.

Kopf-Profilchip – eigenes Spielerprofil wechseln; Home/Logo: immer zu mir
Kopf-Einstellungen
├─ Profile & Familie     – ausschließlich eigene Kinder-/Spielerprofile
├─ App & Darstellung     – Sprache, Vereinsdesign
├─ Zugänge & Freigaben   – Einladungen, Rollen, Verwalterrechte bei Bedarf
├─ Daten & Datenschutz  – Export, Import, Transparenz, Bestätigungen
└─ Hilfe & Informationen – Datenquellen, Version, Anleitung
```

**Routenkompatibilität:** Aufgerufene ältere Links (`#einstellungen/spieler`, `#einstellungen/mannschaften`, `#einstellungen/darstellung`, `#einstellungen/einladungen`, `#einstellungen/daten`, `#einstellungen/quellen`) müssen entweder korrekt weiterleiten oder weiterhin dieselbe autorisierte Aktion erreichbar machen. Nicht einfach auf leere Einstellungsseiten fallen lassen.

## 4. Verbindliche Reihenfolge (KEINE parallelen Feature-PRs)

1. **IA-1 (dieser Schritt)**: Code-Inventur und Klick-/Routen-Matrix in diesem Dokument, überprüfbare technische Guardrails. Dokumentations-PR, keine CSS-, Daten- oder PWA-Version-Änderung; CI + Pages abwarten.
2. **IA-2 (#307 als fachliches Vor-Gate)**: Eigene `state.players` ≠ gefolgte `state.friends`; verlagere Sortieren/Bearbeiten/Entfolgen **ohne Kopie** in Spieler/Mannschaften. Suchweg einmalig `#spieler`, Teamsuche einmalig `#mannschaft`. Erst danach Einstellungs-Duplikate entfernen. Keine zweite Codeeingabe.
3. **IA-3**: Fünf logisch gruppierte Einstellungen mit geraden Links; alte Deep-Links kompatibel; Betreiberaktionen nur für Berechtigte; keine Berechtigungsänderung.
4. **IA-4**: Home/Navigationsfluss und Kontextlinks auf klaren Hauptweg reduzieren, Desktop-/iPhone-Navigation synchronisieren. Dynamisches „Heute“ und sofortiges synchrones Home-Routing aus v178/v179 unverändert.
5. **IA-5**: synthetische Chromium-/WebKit-/Desktop-QA bei 320/390/1280/1440/1920, Tastatur, Zurück, Reload/PWA, verschiedene Familienprofile, Freunde, Mannschaften, Freigabe sowie 100%-Desktop und echte iPhone-Abnahme.

## 5. Definition of Done und Schutzregeln

- Mindestens 44px Interaktionsziele, gut lesbare Labels; keine abgeschnittenen Navigationspunkte.
- Die Zahl der Navigationseinträge wird nicht durch ein verstecktes, unauffindbares „Mehr“ künstlich verkleinert.
- Ein Spieler **folgen** ist lokal und begründet **keine** privaten Lese-, Editier- oder Eigentümerrechte.
- Mehrere eigene Spielerprofile müssen erhalten bleiben. „Freund entfolgen“ darf keine Profile, Einladungen oder Turnierfavoriten löschen.
- Back/Home auch nach `#live`, Unterseiten, tiefen Links und verzögertem iPhone-Hashwechsel zuverlässig.
- iPhone-Installation und Einladungsfreigabe ohne Neuinstallation/erneute Codeeingabe.
- Keine zusätzlichen Netzwerkabfragen, Tracker, Imports, Cronjobs oder geänderte produktive Supabase-RLS.
- Für jede UI-Phase **5/5 PR-Checks**, Merge, **5/5 Main-Checks einschließlich Pages** und echte Nutzerabnahme; erst dann nächster Schritt.
- Abhängigkeiten: #307 Profiltrennung vor IA-2, #291 Sortierungslogik, #306 Volltext-DBV-Suche vor #305 geführter Einrichtung.

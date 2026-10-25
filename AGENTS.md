# Schmetterlinge / Badminton: verbindliche Projektausrichtung

Diese Datei beschreibt die geprüfte Zielumgebung. Sie gilt für **alle Arbeiten in diesem Repository**, insbesondere für Supabase, Importer, Edge Functions, SQL und Fehleranalysen.

## Supabase-Projekt: Badminton (kein anderes Projekt verwenden)

- **Badminton Project Ref:** `yadexibmjmnjfmfabrug`
- **Projekt-URL:** `https://yadexibmjmnjfmfabrug.supabase.co`
- **Dashboard:** https://supabase.com/dashboard/project/yadexibmjmnjfmfabrug
- **Region:** `eu-central-1` (Frankfurt)
- **Organisation:** `ulxwbtojkytbzuosftkg`
- **GitHub Repository:** `metzgerhannes-oss/Badminton`
- **Weitere Architekturdetails:** [docs/SUPABASE_BACKEND.md](docs/SUPABASE_BACKEND.md)

**WICHTIG: Die allgemeine Supabase-Connector-Antwort von `list_projects` ist zur Beurteilung des Badminton-Zugriffs unvollständig.** Sie zeigte am 12.10.2026 nur ein anderes Projekt an, obwohl der direkte Zugriff auf Badminton erfolgreich war. Darum niemals `list_projects` als alleinigen Negativnachweis für Zugriffsrechte oder Erreichbarkeit verwenden.

### Verbindliche Prüfung vor einer Aussage über fehlenden Zugriff

1. Badminton **direkt** prüfen: `get_project({id:"yadexibmjmnjfmfabrug"})`.
2. Verbindung nach Bedarf mit `get_project_url({project_id:"yadexibmjmnjfmfabrug"})`, `list_tables({project_id:"yadexibmjmnjfmfabrug",schemas:["public"],verbose:false})` oder einer reinen SELECT-Abfrage mittels `execute_sql({project_id:"yadexibmjmnjfmfabrug",query:"select 1 as ok"})` testen.
3. Erst bei **tatsächlichem Fehler dieser direkten Abfragen** den Zugriff als nicht bestätigt oder blockiert kennzeichnen, inklusive genauer Fehlermeldung. Ein einzelner Listenausfall ist keine Sperre.
4. Jeder schreibende Aufruf (SQL-Migrationen, Edge Functions, etc.) muss explizit `project_id:"yadexibmjmnjfmfabrug"` erhalten. Projekt-ID vor Ausführung erneut abgleichen.
5. **Keinesfalls** zu einem anderen sichtbaren Supabase-Projekt wechseln oder dort testweise Tabellen, Funktionen oder Daten verändern.

### Erfolgreiche Live-Prüfung 12.10.2026

- `get_project`: `ACTIVE_HEALTHY`, PostgreSQL 17.11, Badminton-Instanz in Frankfurt.
- `get_project_url`: Badminton-Projekt-URL erhalten.
- `list_tables`: 24 Tabellen im öffentlichen Schema, alle mit aktivem RLS; 9.246 Spieler, 916 Vereine, 839 externe Matchbelege.
- `execute_sql`: SQL-SELECT erfolgreich; 24 öffentliche Tabellen bestätigt.
- `list_projects` lieferte **trotzdessen** keine Badminton-Instanz. **Fazit: Sichtbarkeit in dieser Liste ist nicht gleich Zugriff über die ID.**

Diese Kennzahlen sind eine Momentaufnahme und keine garantierten aktuellen Daten. Vor neuen Aussagen erneut direkt abfragen.

## Weitere Abgrenzung

Ein `HTTP 401` an der separaten nuLiga-/DBV-API ist **kein** Hinweis auf fehlende Berechtigungen für Supabase. Quellzugriff und Datenbankzugriff sind unabhängig zu prüfen.

Bei Fehlern über Projektverfügbarkeit immer zuerst die obige Projekt-ID prüfen und die Ergebnisse dokumentieren. Keine Vermutungen über Zugangssperren als Tatsachen darstellen.

## UX-Projektbeschreibung · 25.10.2026 (verbindliche Zielausrichtung)

**Zentrale Quelle:** [Schmetterlinge UX-Redesign 2.0](docs/PROJEKTBESCHREIBUNG_UX_REDESIGN_2026-10-25.md). Vor UI-Änderungen den aktuellen Code/Backlog und dieses Konzept gegeneinander prüfen.

- **Alles außer Corporate Design veränderbar:** Navigation, Layout, Informationsarchitektur, Microcopy, Suchwege und Desktop/iPhone-Workflows können umfassend neu gestaltet werden. **Original-Logo, freigegebene Marken-/Vereinsfarben und CD-Identität bewahren**; den positiven Home-Look nicht versehentlich verschlechtern.
- **UX-Soll:** vier stabile mobile Ziele **Start · Spieler · Turniere · Teams**; LIVE als nachweisbasiertes kontextuelles Highlight, nicht als zusätzlicher verrutschender Haupttab. Berichte, Ranglisten, Statistik und Verein kontextbezogen.
- **Ein Pflegeweg pro Aufgabe:** eigene Familienprofile klar getrennt von gefolgten Personen, aber gut erreichbar im Spielerbereich; direkte Such-/Folge-/Sortieraktionen, konkrete Turnierorte als eigene Zeile, `+ Merken` ohne Umweg, Ergebnis → korrekter Einzelbeleg.
- **Technische Regeln unverändert:** alte Routen/Storage/Freigaben erhalten, kostenlose Freeplan-konforme Lösung, kein produktives Supabase in gewöhnlichen Unit/CI/Playwright-Tests, keine erfundenen Live-/Matchdaten, keine ungeprüften externen Quellennutzungen.
- **Lieferung:** vorhandene PRs/Gates und Issues (insb. #13, #306, #333, #305, #17, #56) zuerst abgleichen; Feature-Pakete sequenziell und mit technischen Prüfungen bis Main/Pages abschließen. **Keine manuellen Zwischenabnahmen**, eine physische iPhone-/Desktop-Schlussabnahme nach Gesamtabarbeitung.
- **Konzeptstatus:** Beschreibung, nicht implementiert oder freigegeben. Niemals aufgrund dieser Dokumentation „live“ oder „fertig“ behaupten.

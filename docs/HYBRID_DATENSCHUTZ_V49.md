# Variante B – Datenschutz- und Quellenkonzept (v49)

Stand: 10.10.2026. Technische Bestandsaufnahme, **keine vollumfängliche Datenschutzerklärung** und keine pauschale Lizenz zur Datenübernahme.

## Architektur

| Daten | Speicherung | Auslöser und Zugriff |
| --- | --- | --- |
| Eigene Familienprofile, Follows, Turnierfavoriten | Browser `shuttleboard-v1`, optionale lokale JSON-Sicherung | Nur lokale Nutzeraktionen; kein Online-Familienkonto |
| DBV-Spielerstammdaten, Vereine, Ranglisten, Quellartikel und kuratierte Platzierungen | Gemeinsame Supabase-Datenbank und öffentliche GitHub-Quellnachweise | Öffentlich lesbare Auswahl; regelmäßige vorhandene Serverjobs |
| `player_history_imports` und `player_history_overviews` | Zentrale DBV-ID, Status, externe Karriereübersicht | Ab v49 erst beim bewussten Öffnen der Historie; vorbestehende Queue läuft weiter |
| `player_external_match_facts` und `player_external_match_imports` | Zentrale Badhub-Einzelnachweise mit Quellenbelegen | Bei Bedarf durch Edge-Funktion und bestehende begrenzte Serverjobs |
| `matches` (offiziell) | Eigene zentrale Tabelle | Keine erfundenen offiziellen DBV-Matchdaten |

Die öffentliche DBV-Spieler-ID kann eine Person identifizieren, auch Minderjährige. Privatheit der Favoritenliste bedeutet nicht, dass die serverseitige Verarbeitung dieser IDs datenschutzrechtlich irrelevant ist. HTTP-Serverlogs und Herkunftsnachweise sind separat zu bewerten.

## In v49 umgesetzt (Frontend)

- App-Start, Folgen, lokales Profil hinzufügen, Einladung und Backup-Wiederherstellung erzeugen **keinen** neuen Historienauftrag.
- Erst `#historie` für einen eigenen/gefolgten Spieler veranlasst die Statusabfrage und gegebenenfalls ein begrenztes Importersuchen. Der zusätzliche Edge-Importversuch wird browserseitig auf höchstens einmal je DBV-ID in 15 Minuten begrenzt.
- Beim Verlassen der Historie werden die laufenden UI-Statusabfragen abgebrochen. Bereits aktive serverseitige Jobs werden davon nicht beendet.
- Im Bereich „Daten & Datenschutz“ werden Supabase-Speicherung, externe Quellen und die Übermittlung der DBV-ID ausdrücklich erklärt.
- Vorhandene Quellenangaben, Matchvalidierung, Trennung von offiziellen DBV-Einzelmatches und Drittanbieterbelegen bleiben bestehen.

## P0-Rechtehärtung: in Badminton-Produktivdatenbank angewandt und geprüft

Über die Projekt-ID **`yadexibmjmnjfmfabrug`** wurde das richtige aktive Badminton-Supabase-Projekt direkt erreicht (die allgemeine Projektliste war unvollständig). Die Migration `20261010200831` (`harden_public_truncate_v49_20261010`) wurde produktiv angewandt und entzieht `TRUNCATE` an `PUBLIC`, `anon` und `authenticated` auf allen vorhandenen öffentlichen Tabellen. Kontrollresultat: **0 Tabellen mit effektivem `TRUNCATE` für `anon` oder `authenticated`, alle 21 Tabellen behalten RLS, 18 haben weiterhin öffentliche `SELECT`-Rechte, 0 Supabase-Security-Advisor-Befunde.** Zusätzliche Migration `harden_postgres_default_truncate_v49_20261010` entzieht `TRUNCATE` für künftig vom Besitzer `postgres` in `public` neu angelegte Tabellen (nachträglich in `pg_default_acl` bestätigt).

**Offene Härtung für künftige Tabellen:** Unter der Besitzerrolle `supabase_admin` besteht im `public`-Schema weiterhin ein älterer Default-Grant mit `TRUNCATE` für `anon`/`authenticated`. Die aktuelle SQL-Sitzung als `postgres` gehört nicht dieser Rolle an; hierfür ist eine berechtigte Änderung an den Default-Rechten bzw. ein obligatorischer migrationsbasierter Privilegiencheck erforderlich. Diese Feststellung betrifft **noch nicht existierende, künftig von `supabase_admin` erstellte Tabellen**, nicht die bereits bereinigten 21 Tabellen. Keine Änderungen an `JohannasGartenwelt`.

## Aufgabenkatalog für den Betrieb

1. **P0 abgeschlossen für bestehende Tabellen:** Entzug produktiv geprüft; **P1 offen** ist das Härten alter `supabase_admin`-Default-Grants für künftig angelegte Tabellen sowie ein fortlaufender Berechtigungs-/RLS-Review von neuen Objekten.
2. **P0:** Vollständige Datenschutzerklärung: Verantwortliche mit Kontakt, Zwecke, Rechtsgrundlagen (inklusive Interessenabwägung), Empfänger/Hosting, Logs, Fristen und Betroffenenrechte.
3. **P1:** Cache-, Aufbewahrungs- und Löschkonzept je Sportdatentabelle: Quelle, Alter, letzte Nutzung, zweckgebundene Aufbewahrungszeit. Eine Entfolgung muss nicht alle gemeinsam genutzten Sportdaten löschen.
4. **P1:** Personenbezogene Erstprofile aus `app.js` sowie automatische persönliche Altprofilergänzungen aus `state-storage.js` entfernen und Altdaten sicher migrieren.
5. **P1:** Verifizierbaren Korrektur-/Löschweg einschließlich Auditspur implementieren.
6. **P2:** Freiwillige Familien-Cloud-Synchronisation erst mit Auth, geprüfter RLS und Konfliktbehandlung.
7. **P2:** Externe Quellen nur mit dokumentierter Erlaubnis und passendem Abrufprofil in regelmäßige Imports aufnehmen.

**Nicht behaupten:** Dieses Frontend-Release schaltet vorhandene DBV-Crons, den externen Badhub-Worker oder gespeicherte zentrale Ergebnisse nicht ab. Rechtmäßigkeit wiederholter Quellenentnahmen und Inhalte von Nutzerinformationen bleiben einzeln zu prüfen.

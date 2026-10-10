# Zentrale DBV-Spielerdaten in Supabase

Stand 10.10.2026. Supabase-Projekt `yadexibmjmnjfmfabrug`, Badminton-App.

## Datenbestand und Import

- 9.246 eindeutige offiziell identifizierte Spieler-IDs aus der DBV-Rangliste, KW 41/2026.
- 916 Clubs, verknüpft mit `players.club_id -> clubs.id`; offizieller Schlüssel in `clubs.dbv_club_id`. Die bereits vorhandene SpVgg Mössingen bleibt mit ihrer bisherigen Club-UUID bzw. Text-ID erhalten und hat jetzt ebenfalls die offizielle DBV-Vereins-ID `05-0148`.
- 3 offiziell ohne Verein gemeldete Personen: `club` leer und `club_id` NULL; keine Vereinszuordnung erfunden.
- Neue Spielerfelder: `age_class` (offizielle AKL2), `association` und `last_ranking_week`. Alte Spieler-UUIDs bleiben stabil; Referenzen in Turnieren, Platzierungen, Berichten und Ranglisten werden nicht umgebogen.
- Verein und Alter werden nicht aus manuellen App-Eingaben übernommen. Quelle: `https://turniere.badminton.de/ranking` über die validierte GitHub-Exportpipeline.

## Regelmäßige Synchronisierung

Der vorhandene DBV-GitHub-Workflow `ranking.yml` erzeugt weiterhin bei einem offiziellen Update den kostenlosen GitHub-JSON-Fallback unter `data/player-library/`.

Die Supabase-Datenbank zieht sich selbst den Index und die sechs Altersklassen-Dateien über feste öffentliche `raw.githubusercontent.com`-URLs. Sie nutzt die ausschließlich intern ausführbare Funktion `private.refresh_dbv_directory()` und die geprüfte `http`-Extension. Keine API-Schlüssel stehen in GitHub; auch im Browser befindet sich ausschließlich der öffentliche Publishable Key.

PostgreSQL Cron läuft **donnerstags 17:35 UTC** nach dem wöchentlichen Ranking-Export und nochmals **freitags 07:25 UTC** als Ausfallsicherung. Die Funktion validiert Quelladresse, Schema-Version, Jahr/Kalenderwoche, Alter, numerische DBV-ID, offizielle Vereinsreferenz und Gesamtanzahl. Ältere Stände überschreiben keine neueren und widersprüchliche Daten führen zu einem transaktionalen Abbruch statt Teilimport.

Der Import nutzt eindeutige DBV-Spieler-IDs und offizielle Vereins-IDs; bereits vorhandene Referenzen bleiben erhalten. `verified_at` und `updated_at` werden bei erneuter Bestätigung gesetzt. Nicht mehr in der aktuellen offiziellen Rangliste geführte Personen werden nicht gelöscht; ihr `last_ranking_week` zeigt die zuletzt bestätigte Woche.

Die ausführbare SQL-Definition einschließlich geplanter Cron-Jobs liegt unter `database/dbv-directory-sync.sql`. Zur manuellen Prüfung durch Administratoren: `select private.refresh_dbv_directory()`; zur Einsicht in Job-Status: `select jobname,schedule,active from cron.job where jobname like 'badminton-dbv-directory-%'`.

## Frontend, Performance und Ausfallsicherheit

- `library.js` fragt in Supabase mit `select`, serverseitigen Filtern und 40 Zeilen pro Seite direkt `public.players` ab: Name/DBV-ID, Altersklasse, Verein und Landesverband.
- Die alphabetisch nach Verein gruppierten Treffer können seitenweise nachgeladen werden. Vereinsvorschläge kommen aus den offiziellen `public.clubs`; Verbandsoptionen kommen ebenfalls aus diesem Verzeichnis.
- Bei Supabase-Fehlern verwendet die Anwendung weiterhin das bestehende `data/player-library/index.json` mit den sechs Altersklassen-Dateien.
- Supabase-RLS lässt den öffentlichen Rollen nur lesenden Zugriff; keine anonymen Inserts/Updates. Persönliches Folgen, Geräteprofile und Turnierfavoriten verbleiben lokal, bis später mit einer Anmeldung freiwillige geräteübergreifende Synchronisierung erfolgt.

## Einordnung und offene Punkte

Die schon bestehenden DB-Tabellen `ranking_weeks`, `ranking_entries`, `articles`, `article_player_mentions`, `tournaments`, `matches` und `tournament_placements` besitzen Referenzen auf Spieler-UUIDs und lassen sich mit den zusätzlichen 9.244 Spielerprofilen verbinden. Die Synchronisierung importiert derzeit **keine weiteren Match-Ergebnisse oder Ranglisten-Einzelwertungen**; dafür braucht es separate geprüfte Quelldaten und Importregeln.

Vereinswechsel werden derzeit am aktuellen Club-Feld sichtbar, aber noch nicht als vollständige Zeitreihe historisiert. Eine Cloud-Synchronisierung der Nutzerfavoriten erfordert später Supabase Auth, nutzergebundene RLS und ausdrücklich kontrollierte Migration der lokalen Daten.

Bei Infrastrukturproblemen bleiben zuletzt importierte Daten erhalten; das Lesefallback ist unabhängig von der Datenbank. Der kostenlose DBV-Quellenabgleich muss die Zugriffsrechte der Originalseite respektieren.

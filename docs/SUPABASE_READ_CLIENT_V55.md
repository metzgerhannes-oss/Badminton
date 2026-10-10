# Schmetterlinge – Validierter Supabase-Leseclient (v55)

## Ausgangslage und Umfang

Die gemeinsame Spielerbibliothek hat bisher Supabase direkt mit eigenem `fetch(API + path)` aufgerufen. Dadurch waren Begrenzung, Klassifizierung und Retry-Verhalten schwer testbar. v55 kapselt **ausschließlich schreibgeschützte PostgREST-GET-Abfragen** in `scripts/supabase-read.mjs` und nutzt den Client in `library.js`. Keine Erweiterung auf Family-Daten, keine Browser-Credentials, kein neuer Login, keine Backend-Migration.

- Nur relative, formvalidierte Ressourcenziele (`players?...`, `clubs?...`) unter dem festgelegten Badminton-`/rest/v1/`-Origin; kein externer Host oder freies HTTP-Verb.
- Netzwerkmodus `no-store`, `GET`, öffentliches publishable API-Key und unveränderte `Content-Range`-Auswertung für Trefferzahl/Pagination.
- Eingebaute Zeitgrenze 6,5 Sekunden je Versuch, maximal ein Retry ausschließlich bei Netzausfall/Timeout oder HTTP 429/502/503/504; bei HTTP 401/403/404, invalidem JSON oder unpassender Objektform **kein** Retry.
- Benutzer-Abbruch hat Vorrang; `PublicReadError.kind` unterscheidet `offline`, `timeout`, `aborted`, `http`, `transient`, `invalid`.
- Die bewährte Spielerbibliothek behält Suche nur nach Filterauswahl, 40er Seiten, Alters-/Vereinsfilter, lokalen Follow-State und die vorhandene Github-Backup-Datei für die Offline-Nutzung.
- Neues Modul wird im PWA-Shell precached; Version `schmetterlinge-shell-v55` erzwingt eine kontrollierte Cache-Aktualisierung. Bestehender Speicher-Key `shuttleboard-v1` wird **nicht** geändert.
- Node-Vertragstest mit Timeout, Retry-Grenzen, fehlerhaftem Response und abgebrochenem Request; bestehender Supabase-Library-Test testet die identische Filter-/Paging-Logik jetzt über die Modulbrücke.

## Verbleibende Architekturarbeit

Das ist ein **inkrementeller** Teilabschluss von #29. Weitere Komponenten und ein typisiertes Domänenmodell brauchen separate, schrittweise Umstellungen mit Browser- und realer iPhone-Abnahme; kein voreiliger Austausch aller Fetch-Wege. Datenschutz/DBV-Quellenrechte bleiben separat.

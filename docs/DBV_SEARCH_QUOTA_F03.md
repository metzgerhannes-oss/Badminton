# F03 · Schutz der registrierungsfreien DBV-Suche (#327)

Status: **Entwurf für produktive Migration, noch nicht installiert**. Browser-/PWA-Version v194 bleibt bestehen.
Repository-Basis: `351ba8522be6f98f6fb8fd65242cc749e783e96c`.

## Problem und Datengrundlage

Die produktive `public.search_dbv_player_identity(text,text,text,text)` ist als `SECURITY DEFINER` für `anon` und `authenticated` freigegeben. Direkter Tabellen-SELECT auf `public.players` ist für beide Rollen verwehrt (RLS aktiv). Der RPC filtert Namen/DBV-ID ab drei Zeichen und liefert maximal zwölf identitätsbezogene Treffer; eine serverseitige Aufrufquote gab es vor diesem Entwurf nicht. Die v194-429-Behandlung im Browser ist keine Serverbarriere.

Read-only Snapshot, 23.10.2026: ca. 130 passende SQL-Aufrufe seit Datenbankstatistik-Reset am 02.10.2026. Das ist **keine zuverlässige Prognose** für Tagespeaks.

## Vorgeschlagener Minimalansatz

`database/dbv-identity-quota-f03.sql` ändert **ausschließlich** die bestehende RPC-Implementierung und ergänzt eine RLS-geschützte, nicht per REST zugängliche Tabelle `private_content.dbv_identity_search_quota` mit **einem einzigen globalen Zählerdatensatz**:

- 60 gültige Suchabfragen je fester UTC-Minute; 1200 je UTC-Kalendertag. Beide Bedingungen müssen erfüllt sein. Ein atomarer UPSERT garantiert korrektes Verhalten bei parallelen Anforderungen.
- Kein IP-Hash, kein Fingerprinting, kein Cookie, kein Browser-/Kontokennzeichen, keine DBV-ID oder Suchzeichenfolge in Quota-Daten. Eine neue DB-Zeile statt täglich tausender Einzelaufzeichnungen.
- Eine Ratebegrenzung antwortet mit HTTP 429 und `Retry-After`; der vorhandene v194-Client zeigt die begrenzte Suche und behält bereits lokal gespeicherte Spielerprofile. Niemals GitHub-Backup als Quoten-Bypass.
- Exakt gleiche Parameter, Ausgabespalten, Filter (mindestens drei Zeichen, erlaubte Klassen/Verbände/Vereine) und maximal zwölf Ergebnisse; keine globalen Profile-, Match- oder Trophäenfreigaben.
- `VOLATILE` statt `STABLE` ist notwendig, damit PostgREST den atomaren Zähler schreiben darf. Der Funktionsinhaber bleibt `postgres`, `search_path=''`, enge `EXECUTE`-Grants.

**Grenze:** Ein einzelner Angreifer kann die **globale** Quote verbrauchen und damit legitime Suchen bis zur Rücksetzung blockieren. Dies ist ein einfacher Ressourcenschutz, **keine** faire Pro-Client-Drossel und kein vollständiger Anti-Enumeration-Schutz. Bei steigender Nutzung zunächst anonymisierte Lastdaten prüfen und gegebenenfalls einen vorgelagerten vertrauenswürdigen Edge-Rate-Limiter planen; keine ungesicherten IP-/Headerwerte oder selbst gemeldeten Tokens als Schutz ausgeben.

## Gating und Rollout

1. Genau ein F03-PR; fünf erforderliche aktuelle PR-HEAD-Gates, inklusive vollständiger offline Chromium/WebKit-R2. Normale CI darf ausschließlich synthetische Daten nutzen und muss produktives Supabase blockieren.
2. Nach erfolgreichem Code-Review SHA-gesichert in main mergen, dann Main/Pages für den neuen Merge-SHA prüfen. **Ein Code-Merge installiert dieses SQL noch nicht.**
3. Erst danach die **identische** GitHub-SQL-Datei über Supabase `apply_migration` mit einer festen Migration-ID `f03_dbv_identity_search_global_quota` ausschließlich in Projekt `yadexibmjmnjfmfabrug` installieren (Verbindung `Backup`). **Niemals** im Gartenwelt-Projekt. Vorher prüfbare funktionale Kompatibilität und SQL-/PostgREST-`PGRST`-Fehlerdarstellung herstellen.
4. Lesend verifizieren: `pg_get_functiondef`, `pg_get_function_identity_arguments`, Funktion `provolatile='v'`, EXECUTE nur für gewünschte Rollen, `public.players` weiter RLS/kein direkter SELECT, Quota-Tabelle RLS/keine externen SELECT/INSERT-Rechte, genau eine globale Zählerzeile nach normaler Suche, keine personenbezogenen Felder.
5. Zielgerichtete echte Negativprobe für **tatsächlichen HTTP 429 + Retry-After** außerhalb der normalen CI mit nicht-produktiven Testidentitäten; **keine** 60/1200 automatischen Produktionsanfragen erzeugen. Ohne belastbare Negativprobe #327 nur teilweise erledigt lassen. Physische iPhone-/PWA-Prüfung erst in F11.
6. Bei Fehlfunktion die ursprüngliche RPC-Definition aus `database/targeted_dbv_identity_search_v133.sql` (plus bestehende Grants) per kontrollierter Migration wiederherstellen; Quota-Tabelle zunächst unverändert stehen lassen, keine Familiendaten oder Favoriten verändern.

## Prüfumfang

`tests/dbv-search-server-quota.mjs` prüft **statisch** Sicherheitsbedingungen der SQL-Datei und den bestehenden 429-Client-Vertrag. Das beweist **nicht** Transaktions- oder Gateway-Verhalten. Die bestehende `tests/targeted-dbv-search.mjs` und die offline Browser-E2E prüfen dynamisch Clientreaktionen auf einen simulierten HTTP 429. Produktives SQL bleibt bis zu expliziter, SHA-bezogener Abnahme unangetastet.

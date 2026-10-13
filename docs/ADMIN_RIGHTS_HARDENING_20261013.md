# Supabase-Administratorrechte – technisch abgegrenzte Sicherheitsabnahme

Stand: 13.10.2026 · ausschließlich **Badminton** `yadexibmjmnjfmfabrug` – NICHT das zweite Supabase-Projekt.

## Was ist wirklich geändert?

Im produktiven Projekt läuft die verbundene SQL-Administration als **`postgres`**, nicht als `supabase_admin`.

| Prüfpunkt | Verifizierter Zustand 13.10.2026 |
| --- | --- |
| Bestehende `public`-Tabellen | 29, alle RLS-aktiv, Eigentümer `postgres` |
| `public`-Views | 1, Eigentümer `postgres`, `security_invoker=true` |
| Bestehende `public`-Funktionen | 7, Eigentümer `postgres`, bisherige EXECUTE-Rechte unverändert; beide SECURITY-DEFINER-Funktionen für anon/auth **nicht** ausführbar |
| Browserrollen `anon`/`authenticated` | kein `CREATE` im Schema public; vorhandene Tabellen ohne `TRUNCATE`/`TRIGGER`/`REFERENCES`/`MAINTAIN` |
| Neue `postgres`-Tabelle in `public` | Produktive DDL-Probe: RLS automatisch aktiv; kein `SELECT` oder `TRUNCATE` für anon/auth; Probe danach gelöscht (0 Reste) |
| Neue `postgres`-Funktion in `public` **vor** Korrektur | Produktive DDL-Probe: `anon` und `authenticated` konnten per eingebautem `PUBLIC EXECUTE` ausführen. Das war eine reale Lücke in den *zukünftigen* Standardrechten, kein Nachweis einer exponierten bestehenden SECURITY-DEFINER-Funktion. |
| Neue `postgres`-Funktion in `public` **nach** Korrektur | Produktive DDL-Probe: `anon`/`authenticated` können nicht mehr ausführen; Testfunktion gelöscht; Security Advisor weiterhin 0 Befunde |

Zur Abhilfe wurde **bereits produktiv** genau diese SQL-Anweisung ausgeführt:

```sql
alter default privileges for role postgres
  revoke execute on functions from public;
```

Das wirkt **global nur für künftig von `postgres` erzeugte Funktionen**. Ein auf `IN SCHEMA public` eingeschränktes `REVOKE` genügt nicht, da der PostgreSQL-Basisstandard `EXECUTE` an `PUBLIC` vergibt. Deshalb ist die Wiederholungsanweisung unter `database/harden_postgres_global_function_execute_v112.sql` bewusst schemafrei. Bereits vorhandene Funktionen und Tabellen bleiben erreichbar wie zuvor. Neue beabsichtigte öffentliche RPCs benötigen explizite `GRANT EXECUTE` nach vollständiger Authentifizierungs-/Autorisierungsprüfung; Browserzugriff darf nicht als Default angenommen werden.

## Interne Plattformrolle `supabase_admin`

Der Systemkatalog enthält noch alte **`supabase_admin`-Default-ACLs** im Schema `public` (u. a. `anon=arwdDxtm` für Tabellen). Eine Rolle darf die Default-Privilegien einer anderen Rolle nur verändern, wenn sie deren Mitglied ist. Die Live-Abfrage `pg_has_role(current_user,'supabase_admin','MEMBER')` ergibt **false**; `postgres` hat in gehostetem Supabase keinen Superuser-Zugriff. **Kein `SET ROLE`, keine Rechteeskalation und keine scheinbar erfolgreiche Migration für `supabase_admin`.**

Nach aktueller Diskussion zum Supabase-Hosted-Rollenmodell werden Plattformobjekte normalerweise in isolierten Systemschemata angelegt, nicht als kundenbezogene Objekte in `public`. Dies ist eine **öffentlich dokumentierte Community-Aussage, keine projektspezifische Garantie**. Das produktive Badminton-Projekt besitzt derzeit keine `supabase_admin`-Tabellen/Views im Schema `public`. Darum würde das Hochstufen eines Benutzerkontos zur Plattformrolle **keinen sinnvollen Sicherheitsgewinn** bringen und ist weder erforderlich noch vorgesehen.

Relevante Quellen:
- Supabase Rollenmodell: https://supabase.com/docs/guides/database/postgres/roles-superuser
- Supabase Data-API-Grants: https://supabase.com/docs/guides/api/securing-your-api
- PostgreSQL `ALTER DEFAULT PRIVILEGES`: https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html
- Supabase FAQ zur globalen `PUBLIC EXECUTE`-Voreinstellung: https://supabase.com/docs/guides/troubleshooting/custom-role-inherits-privileges-that-were-not-explicitly-granted-ddaa1c
- Supabase Community zur managed `supabase_admin`-Rolle: https://github.com/orgs/supabase/discussions/48259

## Freigabe neuer Datenbankobjekte

1. Neue Tabellen im Schema `public` standardmäßig ohne Browser-CRUD-Grants anlegen, RLS aktivieren und eng gefasste Policies definieren.
2. Nur für freigegebene Lese-/Schreibpfade **explizit** die erforderlichen GRANTs an `anon` bzw. `authenticated` in derselben Migration setzen. Keine Loginpflicht nur zur Absicherung *öffentlicher* Sportdaten einführen.
3. Bei neuen Funktionen unter `postgres` kein implizites `PUBLIC EXECUTE`. Für freigegebene RPCs `GRANT EXECUTE` erst nach Code- und Datenschutzprüfung. SECURITY-DEFINER-RPCs nur als ausdrückliche Ausnahme und mit eigenständiger Autorisierung.
4. Nach jeder Migration die RLS-/Privilegienabfrage aus `database/public-security-audit-v54.sql` und den Security Advisor prüfen. Besonders auffällige Eigentümer (`supabase_admin`) und Änderungen an Funktions-EXECUTE-Grants manuell untersuchen.
5. Die vorhandene Supabase-Event-Trigger-Funktion `rls_auto_enable()` protokolliert beim Fehlschlag der automatischen RLS-Aktivierung und schluckt die Exception. Die neue Default-GRANT-Sperre schützt auch dann davor, dass ein **nicht ausdrücklich freigegebenes** neues `postgres`-Objekt über die Data API erreichbar wird. Ein fail-closed Umbau des Plattformtriggers wird **nicht** ohne Supabase-Kompatibilitätsnachweis produktiv durchgeführt.

## Bewusste Grenzen

- Die Korrektur wirkt für künftig **von postgres** erzeugte Funktionen, nicht für von der Plattform unter `supabase_admin` erzeugte Objekte.
- Nicht überarbeitete Git-Historie, bestehende Quellenrechte, Datenlöschfristen oder Benutzeridentitäten sind hiervon nicht betroffen.
- Keine kostenpflichtigen Dienste, neue Admin-Nutzer, Service-Role-Schlüssel im Frontend oder neue Backend-Tokens erforderlich.
- Die Änderung ersetzt **keine** Prüfung ausdrücklich erlaubter RPCs und Privilegien neuer Migrationen.

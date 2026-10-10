# Schmetterlinge – Sicherheits-Release-Gate (v54)

Stand 10.10.2026. Dieses Paket enthält eine **lesende** Produktionsprüfung und einen statischen CI-Regressionstest. Es ist **keine** Erhöhung administrativer Berechtigungen und auch kein Nachweis für künftige Datenbanken.

## Nachweis aus Badminton Supabase

Projekt: `yadexibmjmnjfmfabrug` (nicht Johannas Gartenwelt).

- Bestehende öffentlich zugängliche Tabellen: **21**, RLS auf allen aktiviert; für `anon` und `authenticated` kein effektives `TRUNCATE`.
- Die normale Owner-Rolle `postgres` erhielt bereits in v49 sichere `ALTER DEFAULT PRIVILEGES` für neue Tabellen.
- Sonderfall: bestehende `supabase_admin`-Default-ACLs für im Schema `public` zukünftig durch **diese Owner-Rolle** erzeugte Tabellen sind nach damaliger Prüfung zu weit gefasst. `postgres` ist nicht Mitglied dieser Owner-Rolle. Die Lösung erfordert **berechtigte Administration**, keine `SET ROLE`-Umgehung.
- Der öffentliche Historien-RPC in v52 ist `SECURITY INVOKER`; sein eingeschränkter innerer Schreibhelfer liegt außerhalb des öffentlichen Data-API-Schemas. `last_demand_at` ist nur intern lesbar.
- Den tatsächlichen Stand vor jedem sicherheitsrelevanten Release mit `database/public-security-audit-v54.sql` überprüfen; alle bestehenden public-Tabellen müssen `OK` und die Zähler `rls_disabled`, `anon_truncate`, `authenticated_truncate` jeweils **0** melden. Ein neuer `supabase_admin`-Default-`D`-Grant bleibt ein **gesonderter P1-Blocker für künftige Tabellen**.

## Automatisierung und bewusste Grenze

- `tests/security-gate.mjs` läuft in `Schmetterlinge Tests`, prüft die eingecheckten Rechte-Migrationsverträge, die RPC-Isolation und das Vorhandensein der lesenden Produktionsabfrage.
- CI benötigt dafür **keinen Supabase-Service-Key**; es sieht **nicht** den Zustand einer Live-Datenbank. Deswegen kann ein grüner GitHub-Check die tatsächliche SQL-Abnahme ausdrücklich **nicht ersetzen**.
- Eine eventuelle Entfernung der verbliebenen Admin-Default-Rechte erst mit der tatsächlich berechtigten Owner-Rolle; anschließend erneut `pg_default_acl` auditieren und einen ungefährlichen Test mit ausdrücklich neu angelegter, leerer Tabelle durchführen.
- Bei Änderungen an `public`-Tabellen Datenbankabnahme, Supabase-Security-Advisor, RLS-Policies, `has_table_privilege` und `has_column_privilege` im richtigen Projekt prüfen.

Issue #54 bleibt solange offen, bis die Default-ACL des privilegierten Eigentümers nachweislich korrigiert ist. Datenlebenszyklus/Rechteprozesse: #53 und #56.

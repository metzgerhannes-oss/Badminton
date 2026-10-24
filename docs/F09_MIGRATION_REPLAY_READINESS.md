# F09 – Migration lineage and isolated replay readiness

**Status: NOT REPLAY READY.** Read-only inventory checked 2026-10-24.
This is a technical safety gate, not a production migration.

## Current evidence

The Badminton Supabase project has 70 applied migration versions.
The checked main tree has 7 versioned files under supabase/migrations/
and 53 historical .sql files under database/. Just one of the seven
version numbers exactly matches a registered applied version:
69 applied versions have no same-numbered local file and 6 local files
have no same-numbered applied version. Historically renamed or
aliased migrations are NOT presumed absent or eligible for execution.
Legacy SQL files cannot be replayed in an arbitrary order.

The existing private import_health_weekly snapshot from 2026-10-19
reported ok. This does not prove career completeness, source rights,
or monthly free-tier consumption.

## Offline-only tooling

Run the synthetic regression:
    node tests/f09-migration-lineage.mjs

Read inventory (counts only):
    node scripts/f09-migration-lineage.mjs --inventory-only

Authorized operators may prepare a PRIVATE metadata-only JSON
outside the repository with this schema:
    {"migrations":[{"version":"YYYYMMDDHHMMSS","sha256":"64 lowercase hex"}]}

Then run LOCALLY, never in CI:
    node scripts/f09-migration-lineage.mjs --manifest /private/metadata.json --expected-applied-count N

N must be freshly and independently verified using authorized read-only
migration-history access; do not simply copy the manifest's array length,
assume the old count of 70 is still current, or query production from CI.
A partial manifest is always NOT READY even if every supplied SHA matches.

Every missing SHA is an unverified comparison, never assumed equal.
Missing or mismatched independently verified applied count also fails closed.
Hashes compare exact SQL file bytes; statement-splitting/format
differences must be manually reviewed, not silently normalized.
Raw SQL and statement arrays are prohibited in the metadata input.
The report prints only summary counts; never commit or upload input.

Even if lineage_ready is true, isolated_replay_verified remains
false: a matching manifest cannot substitute for PostgreSQL replay,
RLS/privilege testing, cron and Edge verification.

## Closing conditions for #326

1. Obtain the applied-order/SQL provenance from the authorized
   migration history, privately audit for secrets, personal data,
   unsafe default grants, destructive statements and dependencies.
   Map renamed versions explicitly, keeping the original scripts.
2. Rebuild in a disposable, version-pinned, isolated PostgreSQL/
   Supabase instance with synthetic fixtures. NEVER reset production,
   reconnect a local CLI to production, or use production credentials.
3. Compare schemas, extensions, indexes, triggers, per-role grants,
   default ACLs, public RLS, sensitive RPC EXECUTE permissions,
   cron jobs, Edge prerequisites, invitation and backup contracts.
4. Record tool versions and the exact replay run, prove authorized
   positives and unauthorized negatives, and document any migration
   that cannot be reconstructed instead of claiming success.
5. Track independently: #255 measured monthly logs/egress;
   #162 cron, data freshness and deployment warnings;
   #161 Cloudflare billing under an authorized account.

CI must stay entirely synthetic with no productive Supabase request.
No payment changes, paid services, RLS weakening, or auto-repair.
External gates #56, #17 and physical F11 remain open.


## Guarded local replay runner (opt-in, never CI)

The new scripts/f09-isolated-replay.mjs can attempt replay ONLY
with privately recovered, SHA-pinned and individually reviewed SQL
against a fresh disposable PostgreSQL database. It never fetches,
exports or resets productive Supabase. CI tests mock all psql calls.

Private manifest outside the checkout:
    {"migrations":[{"version":"YYYYMMDDHHMMSS",
      "file":"YYYYMMDDHHMMSS.sql","sha256":"64 lowercase hex",
      "reviewed":true}]}

Every applied migration must be present in verified version order;
the independently observed applied count must match, all file hashes
must match. Symlinks, traversal, psql backslash commands and recognized
outbound/server-side SQL (including dblink, pg_net, cron.schedule and
COPY PROGRAM) are rejected. Never silently change historical SQL to
make a replay pass.

Run only from a fully network-isolated disposable PostgreSQL instance,
with a dedicated f09_replay role, empty f09_replay_* database and a
nondefault TCP port:

    node scripts/f09-isolated-replay.mjs --plan /private/manifest.json /private/sql 70

After explicitly reviewing the local target and complete private SQL:

    export F09_REPLAY_DATABASE_URL='postgresql://f09_replay@127.0.0.1:55432/f09_replay_test?sslmode=disable'
    node scripts/f09-isolated-replay.mjs --replay /private/manifest.json /private/sql 70 --confirm-local

Refresh the independent applied count; 70 is only the 24.10.2026
snapshot. The script rejects non-loopback hostnames, default port,
unsuitable DB names, passwords in URLs and non-allowlisted parameters,
strips ambient PG* configuration and checks that the target has no
application tables. A local URL is NOT by itself proof of network
isolation: no SSH production tunnel, real credentials or external
network may be present.

If a migration is unsupported, STOP. Do not retry against a partially
altered database; recreate the disposable scratch cluster and
document the discrepancy. Executing local SQL alone is not proof of
Supabase-compatible extensions, roles/RLS, Cron, Edge, backups or
invitation flows. NO real 70/70 replay is claimed. Issue #326 stays open.

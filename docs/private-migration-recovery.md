# S-01 / #326 – private, isolated migration replay

This procedure is **operator-only**. The public repository and GitHub Actions contain **no production SQL, credentials or player records**. The local runner only accepts the exact 78-migration private bundle after checking the existing SHA-256 manifest.

## Prerequisites

- An authorized, private `{ "migrations": [{ "version": "...", "name": "...", "sql": "..." }] }` bundle **outside the checkout**. Preserve original SQL bytes and order; do not normalize whitespace or line endings.
- A disposable **local PostgreSQL instance** listening on `127.0.0.1`; do not use a production connection, forwarded production port, Supabase branch or paid service.
- A fresh, empty local database named `schmetterlinge_recovery_<suffix>`, created manually, with a manually created `public.schmetterlinge_recovery_marker` table. Never reuse a production database. The marker is a deliberate preflight safeguard, not proof of complete isolation.
- `psql` available locally. Any Supabase-specific extensions/roles needed by the stored SQL must be provided **only in the isolated test environment**.

Example on a local, disposable PostgreSQL instance:

```sh
createdb -h 127.0.0.1 -p 5432 schmetterlinge_recovery_s01
psql -X -h 127.0.0.1 -p 5432 -d schmetterlinge_recovery_s01 \
  -v ON_ERROR_STOP=1 -c 'CREATE TABLE public.schmetterlinge_recovery_marker (id integer);'
node scripts/replay-private-migration-bundle.mjs /private/path/history.json
node scripts/replay-private-migration-bundle.mjs /private/path/history.json \
  --execute --database=schmetterlinge_recovery_s01 --port=5432
```

The first `node` invocation is **validation only**, with no database connection. The second validates again, checks the local address, database name and marker, and streams the verified SQL directly to `psql -X --single-transaction -f -`. It does **not** write SQL to files or echo it into logs. Any `psql` failure is treated as failure, not partial success. The runner does not automatically create or drop databases.

## Completion boundary

A successful replay reports `localReplaySucceeded:true`, but **`schemaAndAccessVerified:false`**. Before closing #326, compare the rebuilt schema with the production metadata (without exporting secrets), verify required extensions, functions, roles, grants and RLS, and exercise invitation/revocation and import flows with synthetic identities in the isolated database. Document exact local PostgreSQL version, result and non-sensitive schema differences in #326/#176. Do not upload the private SQL bundle, psql output, schema dumps containing data, or test secrets as GitHub artifacts.

A missing private bundle or unavailable local PostgreSQL instance is a **blocked real replay**, not a passing recovery test. No CI job connects to production Supabase.

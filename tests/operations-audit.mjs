import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

// This test validates a read-only operational audit; it is not a live security scan.
const [sql,runbook,workflow,lifecycle,publish,backup] = await Promise.all([
 "database/operational-health-audit-v104.sql",
 "docs/RISIKO_MASSNAHMEN_V104.md",
 ".github/workflows/tests.yml",
 "database/history-demand-lifecycle-v52.sql",
 "database/verified-player-publication-v90.sql",
 "scripts/local-backup.mjs"
].map(path=>readFile(path,"utf8")));
assert.match(sql,/cron\.job_run_details/);
assert.match(sql,/last_seen_at/);
assert.match(sql,/expired_history_leases/);
assert.match(sql,/pg_default_acl/);
assert.match(sql,/pg_database_size/);
assert.match(sql,/c\.relrowsecurity/);
assert.doesNotMatch(sql,/^\s*(?:create|alter|drop|truncate|insert|update|delete|grant|revoke|select\s+cron\.schedule|call)\b/im,
 "Health checks must never modify the database or cron schedule");
assert.doesNotMatch(sql,/select\s+\*/i,"Never export raw player or log records");
assert.match(runbook,/supabase_admin/);
assert.match(runbook,/nicht abgeschlossen|nicht erledigt|offen/i);
assert.match(runbook,/Lösch/i);
assert.match(runbook,/kein.*Service-Key|Kein Service-Key/i);
assert.match(lifecycle,/interval '24 hours'/);
assert.match(lifecycle,/>=60/);
assert.match(publish,/AS RESTRICTIVE/);
assert.match(publish,/revoked_at IS NULL/);
assert.match(backup,/normalizeLocalData/);
assert.match(workflow,/node tests\/operations-audit\.mjs/);
console.log("Operational audit: read-only, privacy-preserving and documented controls.");

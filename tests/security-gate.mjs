import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

// CI verifies that committed security contracts don't silently regress.
// It does not pretend to replace the live production privilege audit.
const [harden,lifecycle,audit,workflow]=await Promise.all([
 "database/hybrid-privileges-v49.sql",
 "database/history-demand-lifecycle-v52.sql",
 "database/public-security-audit-v54.sql",
 ".github/workflows/tests.yml"
].map(p=>readFile(p,"utf8")));

assert.match(harden,/revoke truncate on all tables in schema public from public, anon, authenticated/i);
assert.match(harden,/alter default privileges for role postgres in schema public\s+revoke truncate/i);
assert.match(lifecycle,/revoke select on public\.player_history_imports from anon,authenticated/i);
assert.match(lifecycle,/grant select\(dbv_id,status,[^;]+\)\s+on public\.player_history_imports to anon,authenticated/is);
assert.match(lifecycle,/create or replace function demand_internal\.request_player_history_demand/i);
assert.match(lifecycle,/create or replace function public\.request_player_history_demand\(target_id text\)\s+returns jsonb language sql security invoker/i);
assert.match(lifecycle,/revoke all on function public\.request_player_history_demand\(text\) from public,anon,authenticated/i);
assert.match(lifecycle,/grant execute on function public\.request_player_history_demand\(text\) to anon,authenticated/i);
assert.match(lifecycle,/if target_id is null or target_id !~ '\^\[0-9\]\{2\}-\[0-9\]\{6\}\$'/);
assert.match(audit,/c\.relrowsecurity/);
assert.match(audit,/has_table_privilege\('anon',c\.oid,'TRUNCATE'\)/);
assert.match(audit,/has_table_privilege\('authenticated',c\.oid,'TRUNCATE'\)/);
assert.match(audit,/pg_catalog\.pg_default_acl/);
assert.match(audit,/has_truncate_default/);
assert.match(audit,/has_column_privilege\('anon','public\.player_history_imports','last_demand_at','SELECT'\)/);
assert.doesNotMatch(audit,/\b(create|alter|delete|insert|update|drop|truncate|revoke|grant)\s+(table|function|schema|on|from|to)\b/i,
 "The release-audit file must remain read-only SQL");
assert.match(workflow,/node tests\/security-gate\.mjs/);
console.log("Security contract gate: SQL privileges, invoker RPC and read-only production audit statements intact.");

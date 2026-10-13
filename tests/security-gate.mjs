import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

// CI verifies that committed security contracts don't silently regress.
// It does not pretend to replace the live production privilege audit.
const [harden,lifecycle,audit,auxiliary,workflow]=await Promise.all([
 "database/hybrid-privileges-v49.sql",
 "database/history-demand-lifecycle-v52.sql",
 "database/public-security-audit-v54.sql",
 "database/harden_auxiliary_table_privileges_v54.sql",
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
assert.match(audit,/has_auxiliary_default/);
for(const privilege of ["TRIGGER","REFERENCES","MAINTAIN"]){
 assert.ok(audit.includes("has_table_privilege('anon',c.oid,'"+privilege+"')"));
 assert.ok(audit.includes("has_table_privilege('authenticated',c.oid,'"+privilege+"')"));
}
assert.ok(auxiliary.includes("revoke trigger, references, maintain on all tables in schema public"));
assert.ok(auxiliary.includes("revoke trigger, references, maintain on tables from anon, authenticated"));
assert.doesNotMatch(auxiliary,/\b(drop|delete|truncate)\s+table\b|\bdelete\s+from\b/i);
assert.match(audit,/has_column_privilege\('anon','public\.player_history_imports','last_demand_at','SELECT'\)/);
assert.doesNotMatch(audit,/\b(create|alter|delete|insert|update|drop|truncate|revoke|grant)\s+(table|function|schema|on|from|to)\b/i,
 "The release-audit file must remain read-only SQL");
assert.match(workflow,/node tests\/security-gate\.mjs/);

const opsSql=await readFile("database/operational-health-readonly.sql","utf8");
// Explicitly opt-in, read-only health checks: never add a hidden write or personal-identifier export.
const opsStatements=opsSql.split("\n").map(line=>line.replace(/--.*$/,"")).join("\n")
 .split(";").map(statement=>statement.trim()).filter(Boolean);
assert.equal(opsStatements.length,7,"Operational runbook must contain the seven reviewed checks");
for(const statement of opsStatements){
 assert.match(statement,/^select\b/i,"Every health check must begin with SELECT");
 const sqlWithoutStringLiterals=statement.replace(/\x27(?:\x27\x27|[^\x27])*\x27/g,"\x27\x27");\n assert.doesNotMatch(sqlWithoutStringLiterals,/\b(insert|update|delete|alter|drop|truncate|grant|revoke|create|copy)\b/i,
  "Operational checks must never modify production data or privileges");
}
assert.doesNotMatch(opsStatements.join("\n"),/\b(dbv_id|token_digest|owner_user_id|source_url|payload|client_ip)\b/i,
 "Operational health reports must not select personal identifiers, secrets or source payloads");

console.log("Security contract gate: SQL privileges, invoker RPC and read-only production audit statements intact.");

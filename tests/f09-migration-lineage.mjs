import assert from "node:assert/strict";
import {auditLineage,formatSafeReport,inspectLocal} from "../scripts/f09-migration-lineage.mjs";

const a="a".repeat(64), b="b".repeat(64);
const local=[
 {version:"20261010000001",sha256:a},
 {version:"20261010000002",sha256:b}
];
const verified=[
 {version:"20261010000001",sha256:a},
 {version:"20261010000002",sha256:b}
];
const ok=auditLineage(local,verified,53);
assert.equal(ok.lineage_ready,true);
assert.equal(ok.isolated_replay_verified,false);
assert.equal(ok.hash_verified,2);
assert.equal(ok.legacy_sql_files,53);

const missing=auditLineage(local,[...verified,
 {version:"20261010000003",sha256:a}],53);
assert.equal(missing.applied_without_local_file,1);
assert.equal(missing.lineage_ready,false);

const extra=auditLineage(local,[verified[0]],53);
assert.equal(extra.local_without_applied_record,1);
assert.equal(extra.lineage_ready,false);

const unverified=auditLineage(local,[verified[0],{version:verified[1].version}],53);
assert.equal(unverified.hash_missing,1);
assert.equal(unverified.lineage_ready,false);

const drift=auditLineage(local,[verified[0],{version:verified[1].version,sha256:a}],53);
assert.equal(drift.hash_mismatch,1);
assert.equal(drift.lineage_ready,false);

const duplicate=auditLineage([...local,local[0]],verified,53);
assert.equal(duplicate.duplicates,1);
assert.equal(duplicate.lineage_ready,false);

assert.throws(()=>auditLineage(local,[{version:verified[0].version,statements:["PRIVATE DATA"]}]),/Raw migration SQL/);
assert.throws(()=>auditLineage(local,[{version:verified[0].version,sql:"SECRET"}]),/Raw migration SQL/);
assert.equal(auditLineage(local,[],53).lineage_ready,false);

// Only counts and booleans can escape; never print object keys from source manifests.
const report=formatSafeReport({...missing,secret:"PERSONAL_NAME",token:"PRIVATE_TOKEN"});
assert.doesNotMatch(report,/PERSONAL_NAME|PRIVATE_TOKEN|20261010000001/);
assert.match(report,/applied_without_local_file: 1/);
assert.match(report,/isolated_replay_verified: false/);

// Repository inventory runs read-only and does not fetch or execute any SQL.
const inv=await inspectLocal();
assert.ok(inv.local.length>0);
assert.ok(inv.legacySqlCount>0);
assert.ok(inv.local.every(x=>/^\d{14}$/.test(x.version)&&/^[0-9a-f]{64}$/.test(x.sha256)));
console.log("F09 offline migration lineage: synthetic negative gates and local inventory PASS");

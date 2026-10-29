import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {auditMigrationInventory} from "../scripts/audit-migration-inventory.mjs";

const snapshot=JSON.parse(await readFile(new URL("../docs/supabase-migrations-registered-20261029.json",import.meta.url),"utf8"));
const files=(await readdir(new URL("../supabase/migrations/",import.meta.url)))
 .filter(name=>name.endsWith(".sql"));
assert.equal(snapshot.registered.length,78,
 "A historical snapshot of 78 registered migrations is retained for comparison");
const report=auditMigrationInventory(snapshot.registered,files);
assert.equal(report.registered,78);
assert.ok(report.localFiles>=13);
assert.ok(report.registeredVersionsWithoutExactTimestamp>0,
 "Do not declare a replayable schema from only a handful of source migrations");
assert.equal(report.recoveryReplayed,false);
assert.equal(report.sqlHashesVerified,false);
// The live 29 Oct repair was registered under a DIFFERENT timestamp than its
// source-file prefix; a candidate file must not be treated as applied SQL proof.
assert.ok(report.unmapped.includes(
 "20261029061000_import_health_stage_diagnostic_only.sql"));
assert.ok(snapshot.registered.some(x=>x.version==="20261029050420"&&
 x.name==="import_health_stage_diagnostic_only_20261029"));
const synthetic=[
 {version:"20261010120000",name:"exact"},
 {version:"20261010130000",name:"different"},
 {version:"20261010140000",name:"source_name"}
];
const classified=auditMigrationInventory(synthetic,[
 "20261010120000_exact.sql",
 "20261010130000_other.sql",
 "20261010150000_source_name.sql",
 "20261010160000_unknown.sql"
]);
assert.deepEqual([classified.exactVersionAndName,classified.registeredTimestampOnly,
 classified.sourceNameOnly,classified.unmapped.length],[1,1,1,1]);
assert.equal(classified.registeredVersionsWithoutExactTimestamp,1);
assert.throws(()=>auditMigrationInventory([synthetic[0],synthetic[0]],[]),
 /invalid_or_duplicate_registered_migration/);
assert.throws(()=>auditMigrationInventory(synthetic,["2026_invalid.sql"]),
 /invalid_or_duplicate_local_migration/);
assert.throws(()=>auditMigrationInventory(synthetic,["20261010120000_exact.sql",
 "20261010120000_exact.sql"]),/invalid_or_duplicate_local_migration/);
console.log("Read-only migration inventory: registered versions and repo files are not a verified recovery replay.");

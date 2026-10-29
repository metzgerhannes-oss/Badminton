import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {auditMigrationInventory,auditLegacySqlCandidates} from "../scripts/audit-migration-inventory.mjs";

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

const legacyFiles=(await readdir(new URL("../database/",import.meta.url)))
 .filter(name=>name.endsWith(".sql"));
const legacy=auditLegacySqlCandidates(snapshot.registered,legacyFiles);
assert.equal(legacy.legacyFiles,53);
assert.equal(legacy.exactNameCandidates,32,
 "Only exact normalized registered names are historical SQL candidates");
assert.equal(legacy.unmappedLegacy,21);
assert.equal(legacy.ambiguousNameCandidates,0);
assert.equal(legacy.sqlHashesVerified,false);
assert.equal(legacy.recoveryReplayed,false);
assert.ok(legacy.candidates.some(x=>x.filename==="badhub_outcome_evidence_v92.sql" &&
 x.registeredVersion==="20261012085609"));
const ambiguous=auditLegacySqlCandidates([
 {version:"20261010120000",name:"test_case"},
 {version:"20261010130000",name:"TEST_CASE"}
],["test-case.sql","not-mapped.sql"]);
assert.equal(ambiguous.exactNameCandidates,0);
assert.equal(ambiguous.ambiguousNameCandidates,1);
assert.equal(ambiguous.unmappedLegacy,1);
assert.throws(()=>auditLegacySqlCandidates(snapshot.registered,
 ["duplicate.sql","duplicate.sql"]),/invalid_or_duplicate_legacy_file/);
assert.throws(()=>auditLegacySqlCandidates(snapshot.registered,
 ["../escape.sql"]),/invalid_or_duplicate_legacy_file/);
console.log("Legacy SQL filenames: candidates only; no SQL hash equivalence or recovery proven.");

import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {auditMigrationInventory,auditLegacySqlCandidates,auditRegisteredSourceCoverage} from "../scripts/audit-migration-inventory.mjs";

const snapshot=JSON.parse(await readFile(new URL("../docs/supabase-migrations-registered-20261029.json",import.meta.url),"utf8"));
// Snapshot contains SQL fingerprints only; never fetches production data in CI.
assert.ok(snapshot.registered.every(x=>/^[a-f0-9]{64}$/.test(x.statement_sha256) &&
 Number.isSafeInteger(x.statement_bytes) && x.statement_bytes>0 &&
 x.statement_count===1),"Every registered migration has a stable stored-SQL fingerprint");
assert.equal(new Set(snapshot.registered.map(x=>x.version)).size,78,
 "Fingerprint manifest must have unique registered versions");
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


// S-01 #326: registered versions without even a candidate SQL file are
// explicitly visible. Filename matches alone are NOT proof of SQL identity.
const coverage=auditRegisteredSourceCoverage(snapshot.registered,files,legacyFiles);
assert.equal(coverage.registered,78);
assert.equal(coverage.candidateVersions,36);
assert.equal(coverage.unbackedVersions,42,
 "42 registered migrations have no uniquely matching local SQL candidate");
assert.equal(coverage.conflictingVersions,0);
assert.equal(coverage.sqlHashesVerified,false);
assert.equal(coverage.recoveryReplayed,false);
assert.ok(coverage.unbacked.every(x=>/^\d{14}$/.test(x.version)&&x.name),
 "Only migration names/versions, never user data, enter the offline report");
// A wrong name with the correct timestamp must NOT be counted as covered.
const cross=auditRegisteredSourceCoverage(synthetic,[
 "20261010120000_exact.sql",
 "20261010130000_other.sql",
 "20261010150000_source_name.sql"
],["exact.sql","different.sql"]);
assert.equal(cross.candidateVersions,3);
assert.equal(cross.unbackedVersions,0);
assert.equal(cross.conflictingVersions,1,
 "Two candidate files for one migration are flagged, not silently accepted");
assert.equal(cross.conflicting[0].version,"20261010120000");
const onlyWrongTimestamp=auditRegisteredSourceCoverage(synthetic,
 ["20261010130000_other.sql"],[]);
assert.equal(onlyWrongTimestamp.candidateVersions,0);
assert.equal(onlyWrongTimestamp.unbackedVersions,3);
const ambiguousNames=auditRegisteredSourceCoverage([
 {version:"20261010120000",name:"same_name"},
 {version:"20261010130000",name:"SAME_NAME"}
],[],["same-name.sql"]);
assert.equal(ambiguousNames.candidateVersions,0);
assert.equal(ambiguousNames.unbackedVersions,2);
console.log("S-01 #326: 36 source candidates / 42 unbacked versions; no SQL hash or replay claims.");

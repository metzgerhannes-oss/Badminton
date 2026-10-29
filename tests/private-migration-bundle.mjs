import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {verifyPrivateMigrationBundle} from "../scripts/verify-private-migration-bundle.mjs";

// Entirely synthetic: no SQL history, tokens, identities or live network.
const make=(version,name,sql)=>({version,name,sql});
const a=make("20261010120000","synthetic_create","CREATE TABLE synthetic_a (id int);");
const b=make("20261010130000","synthetic_unicode","SELECT 'ä';\n");
const meta=({version,name,sql})=>({
 version,name,statement_sha256:createHash("sha256").update(sql,"utf8").digest("hex"),
 statement_bytes:Buffer.byteLength(sql,"utf8"),statement_count:1
});
const manifest={registered:[meta(a),meta(b)]};
const bundle={migrations:[a,b]};
const result=verifyPrivateMigrationBundle(manifest,bundle);
assert.deepEqual(result,{verifiedMigrations:2,
 verifiedSqlBytes:Buffer.byteLength(a.sql,"utf8")+Buffer.byteLength(b.sql,"utf8"),
 exactStoredSql:true,recoveryReplayed:false});
assert.equal(JSON.stringify(result).includes("CREATE"),false,
 "No executable SQL is included in the report");

for(const malformed of [
 {migrations:[a]},
 {migrations:[b,a]},
 {migrations:[a,a]},
 {migrations:[a,{...b,version:"20261010140000"}]},
 {migrations:[a,{...b,name:"other_name"}]}
])assert.throws(()=>verifyPrivateMigrationBundle(manifest,malformed),
 /private_migration_bundle_(incomplete|identity_mismatch)/);

for(const mutated of [
 {...b,sql:b.sql+" "},
 {...b,sql:b.sql.replace("ä","a")},
 {...b,sql:b.sql.replace("\n","\r\n")}
])assert.throws(()=>verifyPrivateMigrationBundle(manifest,
 {migrations:[a,mutated]}),/private_migration_bundle_content_mismatch/);

assert.throws(()=>verifyPrivateMigrationBundle({registered:[{...meta(a),statement_count:2},meta(b)]},bundle),
 /private_migration_bundle_identity_mismatch/);
assert.throws(()=>verifyPrivateMigrationBundle({registered:[{...meta(a),statement_bytes:0},meta(b)]},bundle),
 /private_migration_bundle_identity_mismatch/);
assert.throws(()=>verifyPrivateMigrationBundle(manifest,{migrations:[a,{...b,sql:null}]}),
 /private_migration_bundle_identity_mismatch/);
assert.throws(()=>verifyPrivateMigrationBundle(manifest,{migrations:[]}),
 /private_migration_bundle_incomplete/);
console.log("S-01 #326: exact private SQL bundle validation is offline and fail-closed; no recovery replay claimed.");

import assert from "node:assert/strict";
import {validateReplayTarget,composeVerifiedReplaySql,parseLocalPreflight} from "../scripts/replay-private-migration-bundle.mjs";
// No private bundle, no psql, no network, no production data.
const target=validateReplayTarget("schmetterlinge_recovery_ci",5432);
assert.deepEqual(target,{host:"127.0.0.1",database:"schmetterlinge_recovery_ci",port:5432});
for(const database of ["postgres","Badminton","schmetterlinge_recovery_","schmetterlinge_recovery_x;DROP",
 "schmetterlinge_recovery_x.example.com","postgresql://127.0.0.1/db"])
 assert.throws(()=>validateReplayTarget(database,5432),/replay_target/);
for(const port of [0,65536,NaN,5432.5,"5432"])
 assert.throws(()=>validateReplayTarget("schmetterlinge_recovery_ci",port),/replay_invalid_local_port/);
const safePreflight="schmetterlinge_recovery_ci|127.0.0.1|schmetterlinge_recovery_marker|f|f|r";
assert.equal(parseLocalPreflight(safePreflight+"\n",target),true);
for(const value of ["prod|127.0.0.1|schmetterlinge_recovery_marker|f|f|r",
 "schmetterlinge_recovery_ci|10.1.2.3|schmetterlinge_recovery_marker|f|f|r",
 "schmetterlinge_recovery_ci|127.0.0.1||f|f|r",
 "schmetterlinge_recovery_ci|127.0.0.1|wrong|f|f|r",
 "schmetterlinge_recovery_ci|127.0.0.1|schmetterlinge_recovery_marker|f|f|v",
 "schmetterlinge_recovery_ci|127.0.0.1|schmetterlinge_recovery_marker"])
 assert.throws(()=>parseLocalPreflight(value,target),/replay_target_marker_or_host_mismatch/);
for(const value of [
 "schmetterlinge_recovery_ci|127.0.0.1|schmetterlinge_recovery_marker|t|f|r",
 "schmetterlinge_recovery_ci|127.0.0.1|schmetterlinge_recovery_marker|f|t|r",
 "schmetterlinge_recovery_ci|127.0.0.1|schmetterlinge_recovery_marker|t|t|r"])
 assert.throws(()=>parseLocalPreflight(value,target),/replay_target_not_empty/,
  "Existing user objects or marker rows must stop replay before any SQL write");
const sql=composeVerifiedReplaySql({migrations:[
 {sql:"CREATE TABLE synthetic_one (id int);"},
 {sql:"INSERT INTO synthetic_one VALUES (1)"}]});
assert.ok(sql.indexOf("CREATE TABLE")<sql.indexOf("INSERT INTO"));
assert.ok(sql.includes("INSERT INTO synthetic_one VALUES (1)\n;\n"));
assert.throws(()=>composeVerifiedReplaySql({migrations:[]}),/replay_missing_verified_migrations/);
assert.throws(()=>composeVerifiedReplaySql({migrations:[{sql:"\\! echo unsafe"}]}),
 /replay_psql_meta_command_forbidden/);
assert.throws(()=>composeVerifiedReplaySql({migrations:[{sql:""}]}),
 /replay_invalid_statement/);
console.log("S-01 #326: local-only replay target/marker and synthetic SQL ordering guards passed; no real replay performed.");

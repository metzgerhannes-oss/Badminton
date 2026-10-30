import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {excludeContradictoryRounds} from "../scripts/match-source-integrity.mjs";
import {assessSourceAvailability,importStatusForBatch,classifyImportFailure} from "../supabase/functions/history-match-import/source-availability.mjs";
const ok=s=>({status:"fulfilled",value:s});
const bad={status:"rejected",reason:new Error("HTTP 404")};
const all=assessSourceAvailability([ok("tournament HTML"),ok("league HTML")]);
assert.equal(all.available.length,2);
assert.deepEqual(all.missing,[]);
assert.equal(importStatusForBatch(true,0,all.missing),"complete");
const partial=assessSourceAvailability([ok("verified tournament"),bad]);
assert.deepEqual(partial.available,[{category:"tournament",html:"verified tournament"}]);
assert.deepEqual(partial.missing,["Liga"]);
assert.equal(importStatusForBatch(true,0,partial.missing),"partial");
const second=assessSourceAvailability([bad,ok("verified league")]);
assert.deepEqual(second.available,[{category:"league",html:"verified league"}]);
assert.deepEqual(second.missing,["Turnier"]);
const none=assessSourceAvailability([bad,bad]);
assert.equal(none.available.length,0);
assert.deepEqual(none.missing,["Turnier","Liga"]);
assert.equal(importStatusForBatch(true,4,[]),"partial");
assert.equal(importStatusForBatch(true,0,["Liga"]),"partial");
assert.equal(importStatusForBatch(false,0,[]),"partial");
assert.throws(()=>assessSourceAvailability([bad]),/Expected/);
// Private failure telemetry must be actionable without leaking raw source
// errors, personal identifiers, URLs or DB responses.
assert.equal(classifyImportFailure(new Error("Match parser rejected unexpected amount of source cards")),"source_coverage");
assert.equal(classifyImportFailure(new Error("Player-name mismatch on source page")),"source_identity");
assert.equal(classifyImportFailure(new Error("DB REST 409 private profile 99-123456 token=secret")),"storage_request");
assert.equal(classifyImportFailure(new Error("invalid_or_duplicate_source_key")),"source_reconciliation");
assert.equal(classifyImportFailure(Object.assign(new Error("operation aborted"),{name:"AbortError"})),"source_timeout");
assert.equal(classifyImportFailure(new Error("private player 99-123456 https://example.invalid?token=secret")),"unclassified");
for(const input of [new Error("DB REST 409 99-123456 token=secret"),new Error("unknown 99-123456 token=secret")]){
 const kind=classifyImportFailure(input);
 assert.match(kind,/^(?:source_timeout|source_coverage|source_identity|storage_request|source_reconciliation|unclassified)$/);
 assert.doesNotMatch(kind,/99-123456|token|secret|https?:/);
}
const fn=await readFile("supabase/functions/history-match-import/index.ts","utf8");
const parser=await readFile("supabase/functions/history-match-import/badhub-history-parser.mjs","utf8");
const original=await readFile("scripts/badhub-history-parser.mjs","utf8");
assert.equal(parser,original,"Deployed parser must match the audited source parser");
assert.match(fn,/Promise\.allSettled\(/);
assert.match(fn,/const failureCategory=classifyImportFailure\(error\)/);
assert.match(fn,/category:failureCategory/);
assert.doesNotMatch(fn,/console\.error\([^\n]*error\b/,
 "Never log the raw private source exception");
assert.match(fn,/parsePublicHistory\(html,profiles\[0\],category\)/);
assert.match(fn,/const storedKeys=await readStoredSourceKeys\(id\)/,
 "Partial upstream failure must still reconcile persisted source keys");
assert.match(fn,/const batch=reconcileMatchBatch\(all,storedKeys,120\)/,
 "A stale numeric cursor cannot suppress valid new evidence");
assert.doesNotMatch(fn,/const start=sources\.missing\.length\?0/,
 "Old cursor-reset workaround must stay removed");
assert.match(fn,/const status=importStatusForBatch\(finished,excluded,sources\.missing\)/,
 "Persisted status must be computed once from actual coverage");
assert.match(fn,/completed:status==="complete"/,
 "Response completion must agree with persisted status when cards are excluded");
assert.doesNotMatch(fn,/completed:finished&&!sources\.missing\.length/,
 "Finished batch with rejected cards must never report complete");
assert.match(fn,/status:missingSourceStatus\(saved\)/,
 "Missing upstream source must preserve existing saved match evidence");
assert.match(fn,/unavailable_categories:sources\.missing/);
assert.doesNotMatch(fn,/src=gesamt/,"Only existing tournament and league endpoints allowed");
const proof=(id,event,round)=>({category:"tournament",source_key:"tournament:777:"+event+":"+round+":"+id,
 event,round_label:round});
const audit=excludeContradictoryRounds([
 proof("a","JE U13","Halbfinale"),proof("b","JE U13","Halbfinale"),
 proof("c","JE U13","Finale"),proof("d","ME U13","Halbfinale"),
 proof("e","JE U17","Gruppe A"),proof("f","JE U17","Gruppe A")
]);
assert.equal(audit.excluded,3,"All contradictory-event rounds must be held back");
assert.equal(audit.affectedEvents,1);
assert.equal(audit.accepted.length,3,"Other fields and group games stay available");
const deployedIntegrity=await readFile("supabase/functions/history-match-import/match-source-integrity.mjs","utf8");
assert.equal(deployedIntegrity,await readFile("scripts/match-source-integrity.mjs","utf8"),
 "The deployed guard must be the tested guard");
assert.match(fn,/excludeContradictoryRounds\(\[\.\.\.matches\.values\(\)\]\)/);
console.log("Match importer: partial source failover, no false completion, source-key reconciliation and parser parity.");

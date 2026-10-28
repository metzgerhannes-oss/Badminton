import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {excludeContradictoryRounds} from "../scripts/match-source-integrity.mjs";
import {assessSourceAvailability,importStatusForBatch} from "../supabase/functions/history-match-import/source-availability.mjs";
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
assert.throws(()=>assessSourceAvailability([bad]),/Expected/);
const fn=await readFile("supabase/functions/history-match-import/index.ts","utf8");
const parser=await readFile("supabase/functions/history-match-import/badhub-history-parser.mjs","utf8");
const original=await readFile("scripts/badhub-history-parser.mjs","utf8");
assert.equal(parser,original,"Deployed parser must match the audited source parser");
assert.match(fn,/Promise\.allSettled\(/);
assert.match(fn,/parsePublicHistory\(html,profiles\[0\],category\)/);
assert.match(fn,/const storedKeys=await readStoredSourceKeys\(id\)/,
 "Partial upstream failure must still reconcile persisted source keys");
assert.match(fn,/const batch=reconcileMatchBatch\(all,storedKeys,120\)/,
 "A stale numeric cursor cannot suppress valid new evidence");
assert.doesNotMatch(fn,/const start=sources\.missing\.length\?0/,
 "Old cursor-reset workaround must stay removed");
assert.match(fn,/status:importStatusForBatch\(finished,excluded,sources\.missing\)/);
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

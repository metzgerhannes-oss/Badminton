import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {dbvMatchReferences,getDbvMatchReference,getBadhubMatchReference,compareDbvMatchReference,
 dbvReferenceMessage} from "../scripts/dbv-match-reference.mjs";
const bh=getBadhubMatchReference("05-070879");
assert.equal(bh.total,62);
assert.equal(bh.wins,26);
assert.equal(bh.losses,36);
assert.equal(bh.capturedOn,"2026-10-11");
assert.equal(getBadhubMatchReference("05-070879",{year:"2026"}),null);
assert.equal(getBadhubMatchReference("05-070879",{discipline:"Einzel"}),null);
assert.equal(getBadhubMatchReference("05-071969"),null);
const career=getDbvMatchReference("05-070879");
assert.equal(career.total,60);
assert.equal(career.wins,26);
assert.equal(career.losses,34);
assert.equal(career.capturedOn,"2026-10-11");
assert.equal(career.sourceType,"user-provided-screenshot");
assert.equal(getDbvMatchReference("05-070879",{year:"2026"}).total,49);
assert.equal(getDbvMatchReference("05-070879",{year:"2026"}).wins,21);
assert.equal(getDbvMatchReference("05-070879",{year:"2026"}).losses,28);
assert.equal(getDbvMatchReference("05-070879",{year:"2025"}),null);
assert.equal(getDbvMatchReference("05-071969"),null);
assert.equal(getDbvMatchReference("05-070879",{discipline:"Einzel"}),null);
assert.equal(getDbvMatchReference("05-070879",{ageClass:"higher"}),null);
assert.equal(getDbvMatchReference("05-070879",{category:"league"}),null);
assert.equal(compareDbvMatchReference(career,{total:42,wins:21,losses:21}),"mismatch");
assert.equal(compareDbvMatchReference(career,{total:60,wins:25,losses:35}),"mismatch");
assert.equal(compareDbvMatchReference(career,{total:60,wins:26,losses:34}),"counts-match-unverified");
assert.equal(compareDbvMatchReference(career,{total:0,wins:0,losses:0},{readFailed:true}),"unknown");
assert.match(dbvReferenceMessage(career,{total:42,wins:21,losses:21}),/kein Nachweis/);
assert.match(dbvReferenceMessage(career,{total:60,wins:26,losses:34}),/noch nicht nachgewiesen/);
const syntheticReference={total:5,wins:3,losses:2};
const syntheticPartial={total:2,wins:1,losses:1};
const badhubMismatch=dbvReferenceMessage(syntheticReference,syntheticPartial,{provider:"Badhub"});
assert.match(badhubMismatch,/Badhub-Karrierestand/);
assert.doesNotMatch(badhubMismatch,/DBV-Profilstand/,
 "A third-party reference must not be mislabelled as an official DBV snapshot");
assert.match(dbvReferenceMessage(syntheticReference,syntheticPartial),/DBV-Profilstand/);
assert.match(dbvReferenceMessage(syntheticReference,syntheticReference,{provider:"Badhub"}),
 /Badhub-Karrierestand/);
assert.doesNotMatch(dbvReferenceMessage(syntheticReference,syntheticReference,{provider:"Badhub"}),
 /DBV-Profilstand/);
assert.match(dbvReferenceMessage(syntheticReference,syntheticPartial,{provider:"unknown"}),
 /DBV-Profilstand/,"Unknown labels cannot spoof source attribution");
assert.equal(dbvMatchReferences["05-070879"].career.wins+dbvMatchReferences["05-070879"].career.losses,60);
const [home,history,html,sw]=await Promise.all(["stats.js","external-matches.js","index.html","sw.js"].map(f=>readFile(f,"utf8")));
assert.match(home,/getBadhubMatchReference/);
assert.doesNotMatch(home,/DBV · Kontrollstand|dbvReferenceMessage|dbv-secondary-reference/);
assert.match(home,/match-stats-reference/);
assert.match(history,/getDbvMatchReference/);
assert.match(history,/dbvReferenceMessage/);
assert.match(history,/provider:"Badhub"/,"Badhub screenshot must use non-official source label");
assert.match(history,/nichtamtlicher Screenshot/);
assert.ok(history.indexOf("const reference=getDbvMatchReference(selected")<
 history.indexOf("const badhub=getBadhubMatchReference(selected"),
 "The official DBV comparison must precede the Badhub comparison");
assert.match(html,/id="match-stats-reference"/);
assert.match(sw,/scripts\/dbv-match-reference\.mjs/);
console.log("DBV screenshot snapshot is dated, scope-guarded and never treated as live or exhaustive.");

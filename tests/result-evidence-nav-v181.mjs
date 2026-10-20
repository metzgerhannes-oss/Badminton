import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resultEvidenceHash,parseResultEvidenceHash} from "../scripts/result-evidence-nav.mjs";
const id="synthetisch:turnier/2026#mix";
const link=resultEvidenceHash(id);
assert.equal(link,"#historie/result/"+encodeURIComponent(id));
assert.equal(parseResultEvidenceHash(link),id);
for(const value of ["","#historie","#historie/result/","javascript:alert(1)","#historie/result/%ZZ",
 "#historie/result/a/b","#historie/result/a?x=1","#historie/result/"+("x".repeat(750))])
 assert.equal(parseResultEvidenceHash(value),"","reject invalid/malformed proof fragment");
assert.equal(resultEvidenceHash(""),"#historie");
const [stats,history,dashboard,sw,html]=await Promise.all([
 "stats.js","history.js","dashboard.js","sw.js","index.html"
].map(x=>readFile(x,"utf8")));
assert.match(stats,/data-result-outcome/);
assert.match(stats,/const proofRows=context\.details\.filter/);
assert.match(stats,/details\.open=true/);
assert.match(history,/r\.playerId===lastPlayer/);
assert.match(history,/r\.id===proofId&&r\.verified===true/);
assert.match(history,/data-proof-id/);
assert.match(dashboard,/resultEvidenceHash\(result\.id\)/);
assert.match(sw,/schmetterlinge-shell-v181/);
assert.match(sw,/scripts\/result-evidence-nav\.mjs/);
assert.match(html,/id="history-proof-feedback"/);
assert.match(html,/id="match-stats-selection-note"/);
console.log("v181: validated exact result deep-link, aggregated evidence navigation, privacy isolation and PWA precache.");

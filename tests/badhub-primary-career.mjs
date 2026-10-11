import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {getBadhubMatchReference} from "../scripts/dbv-match-reference.mjs";
const [stats,html,css,sw]=await Promise.all([
 "stats.js","index.html","design-v2.css","sw.js"
].map(x=>readFile(x,"utf8")));
const summary=getBadhubMatchReference("05-070879");
assert.deepEqual([summary.total,summary.wins,summary.losses],[62,26,36]);
assert.equal(summary.capturedOn,"2026-10-11");
assert.equal(summary.sourceType,"user-provided-screenshot");
assert.equal(getBadhubMatchReference("05-070879",{discipline:"Einzel"}),null,
 "A career-wide screenshot cannot be reinterpreted as singles-only data");
assert.equal(getBadhubMatchReference("05-070879",{year:"2026"}),null,
 "A career-wide screenshot cannot be reinterpreted as annual data");
assert.match(stats,/getBadhubMatchReference\(selected/);
assert.match(stats,/Badhub · veröffentlichte Karrierebilanz/);
assert.match(stats,/esc\(badhub\.total\)/);
assert.match(stats,/esc\(badhub\.wins\)/);
assert.match(stats,/esc\(badhub\.losses\)/);
assert.match(stats,/badhub\.capturedOn/);
assert.doesNotMatch(stats,/<p>Quelle: /);
assert.match(stats,/Intl\.NumberFormat\("de-DE"/);
assert.match(stats,/badhub\.wins\/badhub\.total/);
assert.match(stats,/Siegquote/);
assert.match(stats,/badhub\.sourceUrl/);
assert.match(stats,/if\(badhub&&referenceSection\)\{[\s\S]*?values\.hidden=true;/);
assert.match(stats,/if\(provenance\)provenance\.hidden=true;/);
assert.match(stats,/values\.hidden=false;[\s\S]*?const badhub=getBadhubMatchReference/,
 "Filtering or switching profiles restores the individual-source view");
assert.doesNotMatch(stats,/getDbvMatchReference|DBV · Kontrollstand|dbvReferenceMessage|dbv-secondary-reference|Einzelbeleg-Teilbestand/,
 "No second displayed DBV comparison or explanatory discrepancy");
assert.match(html,/aria-label="Datierte Badhub-Karrierebilanz"/);
assert.match(css,/#match-stats-values\[hidden\]/);
assert.match(css,/\.dbv-reference-totals\{display:grid;grid-template-columns:repeat\(4/);
assert.match(css,/@media\(max-width:500px\)\{\.dbv-reference-totals\{grid-template-columns:repeat\(2/);
assert.match(css,/#match-stats-note\[hidden\]/);
assert.match(sw,/schmetterlinge-shell-v72/);
console.log("v72: one sourced Badhub career balance, no duplicate DBV summary, filtered facts remain separate.");

import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {getBadhubMatchReference,getReportedPlayedWithoutScores} from "../scripts/dbv-match-reference.mjs";
const [stats,html,css,sw]=await Promise.all([
 "stats.js","index.html","design-v2.css","sw.js"
].map(x=>readFile(x,"utf8")));
const summary=getBadhubMatchReference("05-070879");
assert.deepEqual([summary.total,summary.wins,summary.losses],[62,26,36]);
const confirmed=getReportedPlayedWithoutScores("05-070879");
assert.equal(confirmed.count,4);
assert.equal(confirmed.confirmedOn,"2026-10-11");
assert.equal(confirmed.confirmation,"user-reported-played");
assert.equal(confirmed.individualOutcomesVerified,true);
assert.equal(getReportedPlayedWithoutScores("05-070879",{year:"2026"}),null);
assert.equal(getReportedPlayedWithoutScores("05-070879",{discipline:"Einzel"}),null);
assert.equal(getReportedPlayedWithoutScores("05-070879",{category:"league"}),null);
assert.equal(getReportedPlayedWithoutScores("05-061350"),null);
assert.match(await readFile("external-matches.js","utf8"),/getReportedPlayedWithoutScores\(selected/);
assert.doesNotMatch(await readFile("external-matches.js","utf8"),/Einzelne Siege oder Niederlagen werden ohne Ergebnisbeleg nicht zugeschrieben/);
assert.match(await readFile("external-matches.js","utf8"),/fett markierten Gewinner belegt/);
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
assert.match(stats,/<span class="wins"><strong>/);
assert.match(stats,/<span class="losses"><strong>/);
assert.match(css,/\.dbv-reference-totals span\.wins strong\{color:#07864c\}/);
assert.match(css,/\.dbv-reference-totals span\.losses strong\{color:#9b4242\}/);
assert.match(css,/background:#e9f6ff;color:var\(--muted/);

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
assert.doesNotMatch(css,/@media\(max-width:500px\)\{\.dbv-reference-totals\{grid-template-columns:repeat\(2/,
 "Small iPhones must show four career totals in one row");
assert.match(css,/v74: all four Badhub career figures share one compact/);
assert.match(css,/#match-stats-note\[hidden\]/);
assert.match(sw,/schmetterlinge-shell-v76/);
console.log("v72: one sourced Badhub career balance, no duplicate DBV summary, filtered facts remain separate.");

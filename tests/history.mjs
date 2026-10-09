import {readFile} from "node:fs/promises";
import assert from "node:assert/strict";
const history=JSON.parse(await readFile("data/history.json","utf8"));
assert.equal(history.schemaVersion,1);
assert.equal(history.curation,"club-association-and-family-confirmed");
assert.ok(history.results.length>=10,"Expected seeded historic results");
const ids=new Set();
const players=new Set();
for(const r of history.results){
 assert.ok(typeof r.id==="string"&&r.id);
 assert.ok(!ids.has(r.id),"History entry IDs must be unique");
 ids.add(r.id);
 assert.match(r.date,/^20\d{2}-\d{2}-\d{2}$/);
 assert.ok(Number.isInteger(r.place)&&r.place>0);
 assert.ok(["Einzel","Doppel","Mixed","noch offen"].includes(r.discipline));
 assert.ok(r.playerId&&r.playerName);
 assert.equal(r.verified,true,"Only source-verified data may be published");
 assert.equal(new URL(r.source.url).protocol,"https:");
 assert.ok(["spvgg.org","bwbv.de"].some(d=>r.source.url.includes(d)),"Historical entry must cite club/association");
 if(r.confirmation==="family-confirmed") assert.ok(r.verificationNote,"Family confirmation needs verification label");
 assert.ok(!("score" in r),"Do not invent individual match scores");
 players.add(r.playerName);
}
assert.ok(players.has("Philipp Metzger")&&players.has("Charlotte Metzger"));
assert.ok(Array.isArray(history.pendingResults));
const pending=history.pendingResults.find(r=>r.id==="pm-2026-07-11-district-double-possible-bronze");
assert.equal(pending.discipline,"Doppel");
assert.equal(pending.place,3);
assert.equal(pending.verified,false);
const singles=history.results.find(r=>r.id==="pm-2026-07-11-bezirksmeisterschaft-sw-gold");
assert.equal(singles.discipline,"Einzel");
assert.equal(singles.place,1);
assert.ok(!history.results.some(r=>r.id===pending.id),"Unverified doubles must not appear in trophy-counting history");

const linked=await readFile("index.html","utf8");
assert.ok(linked.includes('id="view-historie"'));
assert.ok(linked.includes('src="./history.js"'));
assert.ok(linked.includes('id="history-pending"'));
assert.ok(linked.indexOf('id="trophy-shelf"')<linked.indexOf('id="history-summary"'),"Trophy cabinet must be above the KPIs");
assert.ok(linked.indexOf('id="trophy-shelf"')<linked.indexOf('id="history-filters"'),"Trophy cabinet must be before chronology filters");
assert.ok(linked.includes('id="history-source" class="notice" role="status" hidden'),"Routine source box must be hidden");
assert.ok(!linked.includes("Platzierungen aus Vereins- und Verbandsberichten, nach Spieler"),"Remove verbose intro marked in screenshot");

const script=await readFile("history.js","utf8");
assert.ok(script.includes("plotTrends"));
assert.ok(script.includes("playerMatch"));
assert.ok(script.includes("renderTrophies(playerRecords)"),"Lifetime trophies should not change with chronicle filters");
assert.ok(!script.includes("renderTrophies(chosen)"),"Do not filter trophy shelf by year or discipline");
assert.ok(!script.includes('source.textContent="Ausgewählte Ergebnisse'),"No oversized notice on normal history load");

const app=await readFile("app.js","utf8");
assert.ok(app.includes("window.renderHistory?.(state.chosen,viewedProfiles,{mode:"));
const sw=await readFile("sw.js","utf8");
assert.ok(sw.includes("./data/history.json")&&sw.includes("./history.js"));
console.log("Verified history valid: "+history.results.length+" sourced results for "+players.size+" players.");

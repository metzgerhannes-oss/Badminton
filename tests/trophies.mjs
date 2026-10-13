import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {summarizeTrophies,TROPHY_PLACES} from "../scripts/trophy-stats.mjs";
const archive=JSON.parse(await readFile("data/history.json","utf8"));
assert.equal(archive.privacyMode,"private");
assert.deepEqual(archive.results,[],"No named historical records shipped in public GitHub");
assert.deepEqual(TROPHY_PLACES,[1,2,3,4]);
const synthetic=[
 {id:"test-a",playerId:"99-000001",place:1,verified:true,date:"2026-04-10",event:"Turnier A"},
 {id:"test-b",playerId:"99-000001",place:3,verified:true,date:"2026-06-10",event:"Turnier B"},
 {id:"test-c",playerId:"99-000002",place:5,verified:true,date:"2026-06-10",event:"Turnier C"}
];
const own=summarizeTrophies(synthetic.filter(r=>r.playerId==="99-000001"));
assert.deepEqual(own.counts,{1:1,2:0,3:1,4:0});
assert.equal(own.total,2);
assert.equal(summarizeTrophies(synthetic.filter(r=>r.playerId==="99-000002")).total,0);
assert.equal(summarizeTrophies([...synthetic,synthetic[0]]).total,2);
assert.equal(summarizeTrophies([...synthetic,{id:"test-unverified",place:1,verified:false}]).total,2);
assert.deepEqual(summarizeTrophies(null).counts,{1:0,2:0,3:0,4:0});
const html=await readFile("index.html","utf8");
const ui=await readFile("history.js","utf8");
const css=await readFile("styles.css","utf8");
const sw=await readFile("sw.js","utf8");
assert.ok(html.includes('id="trophy-shelf"')&&html.includes('id="trophy-awards"'));
assert.ok(html.indexOf('id="trophy-shelf"')<html.indexOf('id="history-summary"'));
assert.ok(html.includes('type="module" src="./history.js"'));
assert.ok(ui.includes("summarizeTrophies(chosen)")&&ui.includes("renderTrophies(playerRecords)"));
assert.ok(ui.includes("trophyPlace")&&ui.includes("Turnierbericht ansehen"));
assert.ok(css.includes(".trophy-slot")&&css.includes(".trophy-award"));
assert.ok(sw.includes("./scripts/trophy-stats.mjs"));
console.log("Trophy cabinet verified against synthetic records; published archive remains private.");

import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const dashboard=await readFile("dashboard.js","utf8");
const styles=await readFile("styles.css","utf8");
const index=await readFile("index.html","utf8");
const manifest=JSON.parse(await readFile("manifest.webmanifest","utf8"));
const dataset=JSON.parse(await readFile("data/ranking.json","utf8"));
const parser=await readFile("scripts/update-ranking.py","utf8");

// Evaluate the real production pure HTML formatter rather than a reimplementation.
const section=dashboard.slice(dashboard.indexOf("function renderFiveScores("),dashboard.indexOf("function renderRankDetails("));
assert.ok(section.startsWith("function renderFiveScores("));
const ctx=vm.createContext({
 Number,Array,Math,
 escape:x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])),
 num:x=>typeof x==="number"?new Intl.NumberFormat("de-DE",{maximumFractionDigits:0}).format(x):"–"
});
vm.runInContext(section,ctx,{filename:"dashboard-five-scores.js"});
const format=entry=>vm.runInContext("renderFiveScores("+JSON.stringify(entry)+")",ctx);
const snapshot=dataset.players["05-070879"].disciplines;
for(const [key,total] of [["HE",2670],["HD",1322],["HM",1469]]){
 const row=snapshot[key];
 assert.equal(row.points,total,"Official aggregate points "+key);
 assert.equal(row.countedLimit,5);
 assert.deepEqual(row.topFive,[],"Do not fill ranking valuations with guessed results");
 assert.equal(row.topFiveStatus,"not-in-public-export");
 const html=format(row);
 assert.equal((html.match(/class="ranking-score-row ranking-score-pending"/g)||[]).length,5);
 assert.ok(html.includes("nicht zuverlässig ausgelesen"));
 assert.ok(!html.includes(">0<"),"Don't invent zeros");
}
const verified=[
 {name:"Turnier Alpha",date:"2026-08-15",points:800,url:"https://dbv.turnier.de/tournament/0477D9EC-DA56-4B16-938D-138CC817E8E2"},
 {name:"Turnier Beta",date:"2026-05-17",points:700,url:"https://dbv.turnier.de/tournament/0477D9EC-DA56-4B16-938D-138CC817E8E2"},
 {name:"Turnier Gamma",date:"2026-03-21",points:600,url:"https://dbv.turnier.de/tournament/0477D9EC-DA56-4B16-938D-138CC817E8E2"},
 {name:"Turnier Delta",date:"2026-01-10",points:400,url:"https://dbv.turnier.de/tournament/0477D9EC-DA56-4B16-938D-138CC817E8E2"},
 {name:"Turnier Epsilon",date:"2025-12-03",points:170,url:"https://dbv.turnier.de/tournament/0477D9EC-DA56-4B16-938D-138CC817E8E2"}
];
const good=format({points:2670,topFive:verified});
assert.equal((good.match(/class="ranking-score-row"/g)||[]).length,5);
assert.ok(good.includes("2.670")===false,"Only the list is rendered here, not aggregate");
assert.ok(good.includes("800")&&good.includes("700")&&good.includes("170"));
const invalid=format({points:2671,topFive:verified});
assert.ok(invalid.includes("nicht zuverlässig ausgelesen"),"Never show nonreconciling valuations");
assert.ok(invalid.includes("Einzelwertung nicht verfügbar"),"No guessed score when sum mismatches");
const injected=format({points:2670,topFive:[{name:'<script>alert(1)</script>',date:"2026-01-01",points:2670,url:"javascript:alert(1)"}]});
assert.ok(!injected.includes("<script>"),"Source strings must be escaped");
assert.ok(!injected.includes('href="javascript:'),"Reject untrusted result URL");
assert.ok(dashboard.includes("ranking-compact-points"),"Total points should be visible on small ranking cards");
assert.ok(dashboard.includes("renderFiveScores(entry)"),"Details must show five best evaluations");
assert.ok(parser.includes('"topFive":[]')&&parser.includes('"topFiveStatus":"not-in-public-export"'));
assert.ok(styles.includes(".ranking-score-section")&&styles.includes(".ranking-score-total"));
assert.ok(styles.includes("mask-image:none;-webkit-mask-image:none"),"Approved crest cannot remain washed-out");
assert.ok(styles.includes(".brand-logo{width:76px;height:76px"),"Larger crest for visibility");
assert.ok(!styles.includes("background:purple"),"No alternate inconsistent theme");
assert.ok(manifest.theme_color==="#204d73"&&manifest.background_color==="#123758");
assert.ok(index.includes('content="#204d73"'));
console.log("Official total points and five-best ranking UI verified: no invented values, full reconciliation, larger crest and brighter blue.");

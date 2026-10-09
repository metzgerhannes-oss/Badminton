import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const page=await readFile("index.html","utf8");
const js=await readFile("dashboard.js","utf8");
const app=await readFile("app.js","utf8");
const sw=await readFile("sw.js","utf8");
const snapshot=JSON.parse(await readFile("data/ranking.json","utf8"));
assert.ok(page.includes('id="view-start"'));
assert.ok(page.includes('id="dashboard-rankings"'));
assert.ok(page.includes('id="dashboard-kpis"'));
assert.ok(page.includes('id="dashboard-next"'));
assert.ok(page.includes('src="./dashboard.js"'));
assert.ok(page.includes('href="#start" data-page="start"'));
assert.ok(!page.includes('class="hero"'),"No verbose hero on landing page");
assert.ok(app.includes('window.renderDashboard?.(state.chosen,viewedProfiles,state.viewingFriendId?[]:state.officialLinks'));
assert.ok(app.includes('page:"start"'));
assert.ok(app.includes('activeProfileId'));
assert.ok(app.includes('viewingFriendId'));
assert.ok(page.includes('data-page="einstellungen"'));
assert.ok(js.includes('friendNoHistory')&&js.includes('ranking'));

assert.ok(js.includes("e.bwAgeClassChange")&&js.includes("e.previousBwAgeClassRank"),"BW weekly arrows must use two real official snapshots");
assert.ok(js.includes("e.ageClassRank")&&js.includes("DE"),"Germany age-class rank remains secondary");
assert.ok(js.includes("archiveBehind")&&js.includes("ranking-stale-link"),"Stale DBV Excel week should show a warning");
assert.ok(js.includes('Jg. ')&&js.includes('bwAgeClassSize'),"Age class and BW comparison population must be shown");
assert.ok(js.includes('movement-up')&&js.includes('movement-down')&&js.includes('movement-unknown'));
assert.ok(sw.includes("./dashboard.js"));
assert.ok(page.includes('id="ranking-dialog"'));
assert.ok(page.includes('id="first-run-dialog"'));
assert.ok(page.includes('id="first-run-choices"'));
assert.ok(app.includes('freshDevice')&&app.includes('window.renderDashboard'));
assert.ok(js.includes("ranking-bw-title")&&js.includes("escape(e?.ageClass"),"KPI must label the official age group");
assert.ok(js.includes('ranking-bw-row'));
assert.ok(js.includes('ranking-de-row'));
assert.ok(page.includes('id="dashboard-friends"'));
assert.ok(app.includes("renderFriendQuick()"));
assert.ok(js.includes("function renderRankDetails"));
assert.ok(js.includes("ranking-compact"));
assert.ok(snapshot.schemaVersion===2);
assert.ok(["pending","available"].includes(snapshot.status));
if(snapshot.status==="pending")assert.deepEqual(snapshot.players,{},"Never seed fictional rankings");
if(snapshot.status==="available"&&snapshot.players?.["05-070879"]?.disciplines?.HE?.bwRank!=null){
 const ranks=snapshot.players["05-070879"].disciplines;
 for(const key of ["HE","HD","HM"]){
   assert.ok(ranks[key].bwAgeClassRank>=1,"BW rank positive");
   assert.ok(ranks[key].ageClassRank>=ranks[key].bwAgeClassRank,"BW position cannot be below German position");
   assert.equal(ranks[key].birthYear,2016);
   assert.equal(ranks[key].ageClass,"U11");
   assert.ok(ranks[key].ageClassSize>=ranks[key].bwAgeClassSize,"Whole country must include BW cohort");
 }
}
const workflow=await readFile(".github/workflows/ranking.yml","utf8");
assert.ok(workflow.includes("cron: '0 15 * * 4'"),"Schedule Thursday only");
assert.ok(workflow.includes("scripts/update-ranking.py"));
assert.ok(workflow.includes("scripts/test-ranking.py"));
console.log("Dashboard layout, cohort labels, neutral missing-state and Thursday importer configured.");

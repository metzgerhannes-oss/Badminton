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
 assert.ok(["spvgg.org","bwbv.de","dbv.turnier.de"].some(d=>r.source.url.includes(d)),"Historical entry must cite club/association/official DBV");
 if(r.confirmation==="player-results-crosschecked"){
  assert.equal(new URL(r.source.url).hostname,"dbv.turnier.de");
  assert.equal(new URL(r.verification?.url).hostname,"badhub.de");
  assert.ok(r.verificationNote,"Individual published player result must be documented");
 }
 if(r.confirmation==="family-confirmed") assert.ok(r.verificationNote,"Family confirmation needs verification label");
 assert.ok(!("score" in r),"Do not invent individual match scores");
 if(r.matchEvidence){
  assert.equal(r.matchEvidence.kind,"club-report-at-least-one-win");
  assert.equal(r.matchEvidence.minimumWins,1);
  assert.match(r.matchEvidence.statement,/nicht zur Matchstatistik/);
  assert.ok(!("opponent" in r.matchEvidence)&&!("games" in r.matchEvidence));
 }
 players.add(r.playerName);
}
assert.ok(players.has("Philipp Metzger")&&players.has("Charlotte Metzger"));
const verifiedNew=[{"id":"ss-2026-01-18-c-me-u19","playerId":"05-061350","place":1,"ageGroup":"U19","discipline":"Einzel","source":"https://spvgg.org/abteilungen/badminton/aktuelles/1-c-rangliste-bw-u11-u19-am-17-18-januar-2026"},{"id":"ss-2026-01-18-c-md-u19","playerId":"05-061350","place":1,"ageGroup":"U19","discipline":"Doppel","source":"https://spvgg.org/abteilungen/badminton/aktuelles/1-c-rangliste-bw-u11-u19-am-17-18-januar-2026"},{"id":"vo-2026-01-17-c-je-u15","playerId":"05-070006","place":19,"ageGroup":"U15","discipline":"Einzel","source":"https://spvgg.org/abteilungen/badminton/aktuelles/1-c-rangliste-bw-u11-u19-am-17-18-januar-2026"},{"id":"ss-2026-01-24-b-me-u17","playerId":"05-061350","place":1,"ageGroup":"U17","discipline":"Einzel","source":"https://spvgg.org/abteilungen/badminton/aktuelles/1-b-rangliste-suedost-u13-u19-am-24-25-januar-2026"},{"id":"ss-2026-01-24-b-md-u17","playerId":"05-061350","place":2,"ageGroup":"U17","discipline":"Doppel","source":"https://spvgg.org/abteilungen/badminton/aktuelles/1-b-rangliste-suedost-u13-u19-am-24-25-januar-2026"},{"id":"ss-2026-01-24-b-mx-u17","playerId":"05-061350","place":5,"ageGroup":"U17","discipline":"Mixed","source":"https://spvgg.org/abteilungen/badminton/aktuelles/1-b-rangliste-suedost-u13-u19-am-24-25-januar-2026"},{"id":"vo-2026-04-24-c-je-u15","playerId":"05-070006","place":9,"ageGroup":"U15","discipline":"Einzel","source":"https://spvgg.org/abteilungen/badminton/aktuelles/3-c-rangliste-bw-u11-u19-am-24-25-april-2026"},{"id":"vo-2026-04-24-c-jd-u15","playerId":"05-070006","place":5,"ageGroup":"U15","discipline":"Doppel","source":"https://spvgg.org/abteilungen/badminton/aktuelles/3-c-rangliste-bw-u11-u19-am-24-25-april-2026"},{"id":"vo-2025-05-24-d-je-u15","playerId":"05-070006","place":6,"ageGroup":"U15","discipline":"Einzel","source":"https://spvgg.org/abteilungen/badminton/aktuelles/2-d-rangliste-bw-nordwuerttemberg-u11-u19-am-24-mai-2025"},{"id":"vo-2025-05-24-d-jd-u15","playerId":"05-070006","place":3,"ageGroup":"U15","discipline":"Doppel","source":"https://spvgg.org/abteilungen/badminton/aktuelles/2-d-rangliste-bw-nordwuerttemberg-u11-u19-am-24-mai-2025"}];
for(const item of verifiedNew){
 const got=history.results.find(x=>x.id===item.id);
 assert.ok(got,"Missing backed historical placing "+item.id);
 assert.equal(got.playerId,item.playerId);
 assert.equal(got.place,item.place);
 assert.equal(got.ageGroup,item.ageGroup);
 assert.equal(got.discipline,item.discipline);
 assert.equal(got.source.url,item.source);
 assert.equal(got.verified,true);
 assert.ok(!("games" in got)&&!("score" in got)&&!("won" in got),
  "A newspaper/club placing is not a scored match");
}
assert.equal(verifiedNew.length,10);

for(const [ident,person,date,discipline,age,place] of [
 ["ss-2026-03-01-c-rlt-mx-u19","Sarah Storz","2026-03-01","Mixed","U19",3],
 ["vo-2026-02-28-c-rlt-me-u15","Vinzent Pius Ott","2026-02-28","Einzel","U15",19]
]){
 const row=history.results.find(r=>r.id===ident);
 assert.ok(row,"Missing new sourced club placement");
 assert.equal(row.playerName,person);assert.equal(row.date,date);
 assert.equal(row.discipline,discipline);assert.equal(row.ageGroup,age);
 assert.equal(row.place,place);
 assert.equal(row.source.url,"https://spvgg.org/abteilungen/badminton/aktuelles/2-c-rangliste-bw-u11-u19-am-28-februar-1-maerz-2026");
 assert.ok(row.verificationNote);
 assert.ok(!("games" in row)&&!("won" in row)&&!("score" in row),
  "Placings from a club report are not individual scored matches");
}
const report=JSON.parse(await readFile("data/report-articles.json","utf8")).articles
 .find(x=>x.url==="https://spvgg.org/abteilungen/badminton/aktuelles/2-c-rangliste-bw-u11-u19-am-28-februar-1-maerz-2026");
assert.deepEqual(report.players,["05-061350","05-070006","05-070879"]);

assert.equal(history.results.filter(r=>r.matchEvidence?.kind==="club-report-at-least-one-win").length,1);
assert.ok(Array.isArray(history.pendingResults));
assert.ok(!history.pendingResults.some(r=>r.id==="pm-2026-07-11-district-double-possible-bronze"),"Resolved double result must not remain pending");
const district=history.results.filter(r=>r.date==="2026-07-11"&&r.playerId==="05-070879");
assert.equal(district.length,3,"Three district event results: singles, doubles and mixed");
for(const [discipline,group,place,partner] of [
 ["Einzel","U11",1,null],["Doppel","U11",3,"Philipp Landhäußer"],["Mixed","U13",2,"Anneliese Zhu"]
]){
 const r=district.find(r=>r.discipline===discipline);
 assert.ok(r,"Missing "+discipline);
 assert.equal(r.ageGroup,group);
 assert.equal(r.place,place);
 assert.equal(r.partner,partner);
 assert.equal(r.confirmation,"player-results-crosschecked");
 assert.equal(r.source.url,"https://dbv.turnier.de/tournament/0477D9EC-DA56-4B16-938D-138CC817E8E2");
 assert.ok(r.verification?.url.includes("/spieler/05-070879"));
}

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
assert.ok(script.includes("history-match-evidence")&&script.includes("nicht in der Spielstatistik enthalten"));
assert.ok(script.includes("playerMatch"));
assert.ok(script.includes("Namentlichen Ergebnisbeleg")&&script.includes("DBV-Turnierergebnisse"));
assert.ok(script.includes("renderTrophies(playerRecords)"),"Lifetime trophies should not change with chronicle filters");
assert.ok(!script.includes("\n  renderTrophies(chosen);"),"Do not filter trophy shelf by year or discipline");
assert.ok(!script.includes('source.textContent="Ausgewählte Ergebnisse'),"No oversized notice on normal history load");

const app=await readFile("app.js","utf8");
assert.ok(app.includes("window.renderHistory?.(state.chosen,viewedProfiles,{mode:"));
const sw=await readFile("sw.js","utf8");
assert.ok(sw.includes("./data/history.json")&&sw.includes("./history.js"));
console.log("Verified history valid: "+history.results.length+" sourced results for "+players.size+" players.");

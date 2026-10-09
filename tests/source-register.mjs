import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const register=JSON.parse(await readFile("data/source-register.json","utf8"));
const docs=await readFile("docs/DATENQUELLEN_PRIORITAET.md","utf8");
const app=await readFile("index.html","utf8");
const dashboard=await readFile("dashboard.js","utf8");
const snapshot=JSON.parse(await readFile("data/ranking.json","utf8"));
assert.equal(register.schemaVersion,1);
assert.equal(register.reviewedAt,"2026-10-09");
assert.equal(register.tiers.length,4);
const references=register.references;
assert.ok(references.length>=10,"Keep comprehensive permanent source register");
assert.deepEqual(references.map(x=>x.priority),references.map((x,i)=>i+1));
assert.equal(new Set(references.map(x=>x.id)).size,references.length,"No duplicate source IDs");
for(const source of references){
 assert.ok(["A","B","C","D"].includes(source.tier),"Known quality tier");
 assert.ok(typeof source.observed==="string"&&source.observed.length>25,"Each source needs concrete evidence/limits");
 assert.ok(Array.isArray(source.data)&&source.data.length>0,"Describe data supported by source");
 if(source.url){
  const u=new URL(source.url);
  assert.equal(u.protocol,"https:");
 }
 if(source.tier==="D")assert.notEqual(source.maySupplyOfficialFive,true);
}
assert.equal(references[0].id,"dbv-u19-individual");
assert.equal(references[0].maySupplyOfficialFive,true,"DBV per-player ranking is the next original source");
assert.equal(references[0].automatedAccess,"cookie-wall","Do not claim automated official points available");
const excel=references.find(x=>x.id==="dbv-current-excel");
assert.ok(excel);
assert.equal(excel.maySupplyOfficialFive,false,"Aggregate Excel must never be treated as individual scoring");
assert.equal(excel.downloadUrl,"https://turniere.badminton.de/ranking/download");
assert.equal(register.validation.maxResults,5);
assert.equal(register.validation.timeWindowMonths,12);
assert.equal(register.validation.exactAggregateReconciliation,true);
assert.ok(docs.includes("DBV-Einzelwertungen")&&docs.includes("Cookie-Zustimmungsseite")&&docs.includes("Top fünf"));
assert.ok(app.includes("Quellenliste mit Qualitätsstufen"));
assert.ok(dashboard.includes("Einzelwertungen bei DBV prüfen"));
for(const player of Object.values(snapshot.players)){
 for(const discipline of Object.values(player.disciplines)){
  if(discipline.topFiveStatus==="not-in-public-export")assert.deepEqual(discipline.topFive,[],"No invented scores");
 }
}
console.log("Official source quality register and DBV point provenance rules verified: "+references.length+" ranked sources.");

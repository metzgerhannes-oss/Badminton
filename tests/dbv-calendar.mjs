import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {calendarEntry,filterCalendar,regionLabel} from "../scripts/dbv-calendar-utils.mjs";

const sample=JSON.parse(await readFile("data/dbv-calendar.json","utf8"));
assert.equal(sample.schemaVersion,1);
assert.ok(sample.entries.length>=100,"Observed DBV source set should not silently collapse");
const rows=sample.entries.map(calendarEntry).filter(Boolean);
assert.equal(rows.length,sample.entries.length,"Every stored DBV record must normalize");
assert.equal(new Set(rows.map(x=>x.key)).size,rows.length,"Official source keys must be unique");
const grouped=filterCalendar(rows,{group:"region",period:"all"});
assert.equal(grouped.total,rows.length);
assert.equal(grouped.groups.reduce((n,g)=>n+g.items.length,0),rows.length);
const withinBW=filterCalendar(rows,{region:"Baden-Württemberg",period:"all"});
assert.ok(withinBW.total>0,"BW calendar should have source-backed entries");
assert.ok(withinBW.groups.every(g=>g.label==="Baden-Württemberg"));
assert.ok(withinBW.groups.flatMap(g=>g.items).every(t=>t.bundesland==="Baden-Württemberg"));
const age=filterCalendar(rows,{age:"U11",period:"all"});
assert.ok(age.total>0);
assert.ok(age.groups.flatMap(g=>g.items).every(t=>t.ages.includes("U11")));
const c=filterCalendar(rows,{level:"C",period:"all"});
assert.ok(c.total>0);
assert.ok(c.groups.flatMap(g=>g.items).every(t=>t.level==="C"));
assert.ok(c.groups.flatMap(g=>g.items).some(t=>/^C[12]-Level$/.test(t.category)),"C1/C2 must remain visible");
const overRegional=rows.find(t=>t.organizer==="Gruppe Nord");
assert.ok(overRegional&&!overRegional.bundesland,"Group Nord must not be falsely mapped to a federal state");
assert.equal(regionLabel(overRegional),"Gruppe Nord");
const multi=filterCalendar(rows,{group:"age",period:"all"});
assert.ok(multi.groups.reduce((sum,g)=>sum+g.items.length,0)>=rows.length);
assert.deepEqual(filterCalendar(rows,{region:"Baden-Württemberg",age:"U11",level:"C",period:"all"}).groups.flatMap(g=>g.items)
 .every(t=>t.bundesland==="Baden-Württemberg"&&t.ages.includes("U11")&&t.level==="C"),true);
assert.equal(calendarEntry({...sample.entries[0],source_key:"from-unknown-site"}),null);
assert.equal(calendarEntry({...sample.entries[0],event_url:"https://evil.example/"}).hasDirectLink,false);
const index=await readFile("index.html","utf8");
const sw=await readFile("sw.js","utf8");
const app=await readFile("dbv-calendar.js","utf8");
for(const id of ["dbv-calendar-region","dbv-calendar-age","dbv-calendar-level","dbv-calendar-results","dbv-calendar-status"]){
 assert.ok(index.includes('id="'+id+'"'),"Missing source-driven filter "+id);
}
assert.ok(index.includes('src="./dbv-calendar.js"'));
assert.ok(sw.includes('"./dbv-calendar.js"'));
assert.ok(sw.includes('"./scripts/dbv-calendar-utils.mjs"'));
assert.ok(app.includes("dbv_calendar_entries?"),"Read-only Supabase data feed required");
assert.ok(app.includes("./data/dbv-calendar.json"),"Source-backed snapshot fallback required");
assert.ok(app.includes("Keine passenden Turniere"),"Missing data message required");
console.log("DBV calendar: source IDs, 3-dimensional facets, BW, age/level, no fake tournament links and offline integration passed.");

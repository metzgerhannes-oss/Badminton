import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {readableDiscipline,personalMatchdayBuckets,calendarDayCaption}
 from "../scripts/turniertag-glance.mjs";

const fixed=Date.parse("2026-11-07T13:20:00+01:00");
assert.equal(readableDiscipline("ME U15"),"Mädchen-Einzel U15");
assert.equal(readableDiscipline("MD U15"),"Mädchen-Doppel U15");
assert.equal(readableDiscipline("MX U15"),"Mixed U15");
assert.equal(readableDiscipline("JE U13"),"Jungen-Einzel U13");
assert.equal(readableDiscipline("JD U13"),"Jungen-Doppel U13");
assert.equal(readableDiscipline("XD U19"),"Mixed U19");
assert.equal(readableDiscipline("ZZ U15"),"ZZ U15","Unknown codes remain literal");
assert.equal(readableDiscipline(""),"");
const games=[
 {id:"finished1",category:"finished",discipline:"MX U15",
  scheduledAt:"2026-11-07T09:30:00+01:00",outcome:"Sieg"},
 {id:"tomorrow1",category:"upcoming",discipline:"MD U15",
  scheduledAt:"2026-11-08T10:00:00+01:00"},
 {id:"today2",category:"upcoming",discipline:"ME U15",
  scheduledAt:"2026-11-07T15:00:00+01:00"},
 {id:"other",category:"other"},
 {id:"empty",category:"upcoming"},
 {id:"today1",category:"live",discipline:"ME U15",
  scheduledAt:"2026-11-07T14:00:00+01:00"},
 {id:"later",category:"upcoming",scheduledAt:"2026-11-12T10:00:00+01:00"}
];
const g=personalMatchdayBuckets(games,fixed);
assert.deepEqual(g.today.map(x=>x.id),["today1","today2"]);
assert.deepEqual(g.tomorrow.map(x=>x.id),["tomorrow1"]);
assert.deepEqual(g.later.map(x=>x.id),["later"]);
assert.deepEqual(g.unscheduled.map(x=>x.id),["empty"]);
assert.deepEqual(g.finished.map(x=>x.id),["finished1"]);
assert.deepEqual(g.other.map(x=>x.id),["other"]);
assert.match(calendarDayCaption("2026-11-07"),/07\.11\./);
assert.match(calendarDayCaption("2026-11-08"),/08\.11\./);
const dst=personalMatchdayBuckets([{category:"upcoming",scheduledAt:"2027-03-28T10:00:00+02:00"}],
 Date.parse("2027-03-27T22:00:00+01:00"));
assert.equal(dst.tomorrow.length,1,"Berlin day bucketing crosses DST transition");
assert.equal(personalMatchdayBuckets([{category:"upcoming",scheduledAt:"n/a"}],fixed).unscheduled.length,1);
assert.deepEqual(personalMatchdayBuckets(null,fixed).today,[]);
const client=await readFile("today-in-action.js","utf8");
const css=await readFile("today-in-action.css","utf8");
assert.match(client,/personalMatchdayBuckets\(matches\)/);
assert.match(client,/addGroup\("Heute"/);
assert.match(client,/addGroup\("Morgen"/);
assert.match(client,/addGroup\("Bereits gespielt"/);
assert.match(client,/readableDiscipline\(m\.discipline\)/);
assert.match(client,/NÄCHSTES SPIEL/);
assert.match(css,/\[data-day="today"\]/);
assert.match(css,/\[data-day="tomorrow"\]/);
assert.match(css,/\[data-compact="true"\]/);
assert.match(css,/\[data-outcome="win"\]/);
assert.match(css,/\[data-outcome="loss"\]/);
console.log("v252 matchday: today/tomorrow/discipline/next game, Berlin DST, result density: OK");

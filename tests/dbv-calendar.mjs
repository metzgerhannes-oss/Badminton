import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {calendarEntry,filterCalendar,regionLabel,alternativeCalendarLevels,isNationalU11Masters,mergeOfficialCalendarRows} from "../scripts/dbv-calendar-utils.mjs";

const sample=JSON.parse(await readFile("data/dbv-calendar.json","utf8"));
assert.equal(sample.schemaVersion,1);
assert.ok(sample.entries.length>=100,"Observed DBV source set should not silently collapse");
const rows=sample.entries.map(calendarEntry).filter(Boolean);
assert.equal(rows.length,sample.entries.length,"Every stored DBV record must normalize");
assert.equal(new Set(rows.map(x=>x.key)).size,rows.length,"Official source keys must be unique");
const year2026=rows.filter(t=>t.start.startsWith("2026"));
const year2027=rows.filter(t=>t.start.startsWith("2027"));
assert.ok(year2026.length>=100,"2026 source snapshot must remain");
const synthetic2027={...rows[0],key:"dbv-calendar-999999",start:"2027-01-16",end:"2027-01-17"};
assert.equal(filterCalendar([rows[0],synthetic2027],{year:"2027",period:"all"}).total,1,
 "2027 filter must exclude 2026 and retain official published 2027 entries");
assert.equal(filterCalendar([rows[0],synthetic2027],{year:"2026",period:"all"}).total,1);
assert.equal(filterCalendar(rows,{year:"2026",period:"all"}).total,year2026.length);
assert.equal(filterCalendar(rows,{year:"2027",period:"all"}).total,year2027.length);
const grouped=filterCalendar(rows,{group:"region",period:"all"});
assert.equal(grouped.total,rows.length);
assert.equal(grouped.groups.reduce((n,g)=>n+g.items.length,0),rows.length);
const withinBW=filterCalendar(rows,{region:"Baden-Württemberg",period:"all"});
assert.ok(withinBW.total>0,"BW calendar should have source-backed entries");
assert.ok(withinBW.groups.every(g=>g.label==="Baden-Württemberg"));
assert.ok(withinBW.groups.flatMap(g=>g.items).every(t=>t.bundesland==="Baden-Württemberg"));
const bwU13C={year:"2026",region:"Baden-Württemberg",age:"U13",level:"C",period:"upcoming",today:"2026-10-12"};
assert.equal(filterCalendar(rows,bwU13C).total,0,"The reported triple-filter combination is legitimately empty in the published snapshot");
assert.deepEqual(alternativeCalendarLevels(rows,bwU13C),[{level:"D",count:4},{level:"E",count:6}],
 "Empty-result alternatives should point to matching source entries while preserving BW and U13");
assert.deepEqual(alternativeCalendarLevels(rows,{...bwU13C,level:"all"}),[]);

const age=filterCalendar(rows,{age:"U11",period:"all"});
assert.ok(age.total>0);
assert.ok(age.groups.flatMap(g=>g.items).every(t=>t.ages.includes("U11")));
// The official U11 Masters is national (DBV), but must remain discoverable
// in a Baden-Württemberg U11 search without mislabeling its region.
const masters=rows.find(isNationalU11Masters);
assert.ok(masters,"Official DBV snapshot must retain the German Masters U11");
assert.equal(masters.title,"German Masters U11");
assert.equal(masters.start,"2026-12-05");
assert.equal(masters.end,"2026-12-06");
assert.equal(masters.deadline,"2026-11-10");
const bwU11={region:"Baden-Württemberg",age:"U11",year:"2026",level:"A",period:"upcoming",today:"2026-10-16"};
const containsMasters=options=>filterCalendar(rows,options).groups.flatMap(g=>g.items).some(t=>t.key===masters.key);
assert.equal(containsMasters(bwU11),false,"Strict regional filter excludes national events by default");
assert.equal(containsMasters({...bwU11,includeNationalU11Masters:true}),true);
assert.equal(containsMasters({...bwU11,age:"U13",includeNationalU11Masters:true}),false);
assert.equal(containsMasters({...bwU11,level:"C",includeNationalU11Masters:true}),false);
assert.equal(containsMasters({...bwU11,year:"2027",includeNationalU11Masters:true}),false);
assert.equal(containsMasters({...bwU11,today:"2026-12-07",includeNationalU11Masters:true}),false);
assert.equal(containsMasters({...bwU11,q:"German Masters",includeNationalU11Masters:true}),true);
assert.equal(containsMasters({...bwU11,q:"unrelated",includeNationalU11Masters:true}),false);
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
// Impossible calendar days are never treated as official game/deadline data.
assert.equal(calendarEntry({...sample.entries[0],start_date:"2026-02-30"}),null,
 "Impossible calendar days must not be published as DBV event dates");
assert.equal(calendarEntry({...sample.entries[0],end_date:"2026-02-30"}),null);
assert.equal(calendarEntry({...sample.entries[0],start_date:"2026-13-01"}),null);
assert.equal(calendarEntry({...sample.entries[0],start_date:"2026-12-31",end_date:"2026-12-30"}),null);
assert.equal(calendarEntry({...sample.entries[0],registration_deadline:"2026-11-31"}).deadline,"",
 "An impossible registration deadline must never replace a real event start");
const eventUuid="E24DC6EE-152A-454D-B00C-E625B751D7D5";
const realEventUrl="https://dbv.turnier.de/tournament/"+eventUuid;
const confirmedEvent=calendarEntry({...sample.entries[0],event_url:realEventUrl});
assert.equal(confirmedEvent.hasDirectLink,true);
assert.equal(confirmedEvent.url,realEventUrl);
for(const generic of ["https://turniere.badminton.de/","https://turniere.badminton.de/embed",
 "https://dbv.turnier.de/","https://dbv.turnier.de/tournament",
 "https://dbv.turnier.de/tournament/"+eventUuid+"?view=all",
 "https://dbv.turnier.de.evil.example/tournament/"+eventUuid]){
 const row=calendarEntry({...sample.entries[0],event_url:generic});
 assert.equal(row.hasDirectLink,false,
  "Generic/ambiguous source links must not masquerade as event-detail links: "+generic);
 assert.equal(row.url,"https://turniere.badminton.de/",
  "Unverified source URLs must remain at the official calendar overview");
}

// Synthetic overlap must never roll back corrections from a current official feed.
const currentOfficial={...rows[0],key:"dbv-calendar-999998",title:"Aktuelles D-RLT",
 start:"2026-12-01",end:"2026-12-01",place:"Neue Halle"};
const staleArchive={...currentOfficial,title:"Veraltetes E-RLT",start:"2026-11-15",
 end:"2026-11-15",place:"Alter Ort",historicalArchive:true};
const otherArchive={...staleArchive,key:"dbv-calendar-999997"};
const merged=mergeOfficialCalendarRows([currentOfficial],[staleArchive,otherArchive]);
assert.equal(merged.length,2,"Only identical official source keys deduplicate");
assert.equal(merged.find(t=>t.key===currentOfficial.key),currentOfficial,
 "Current DBV metadata wins over stale archive without mutation");
assert.equal(merged.find(t=>t.key===otherArchive.key),otherArchive,
 "Distinct source keys must remain separate even with similar metadata");
assert.equal(merged.find(t=>t.key===currentOfficial.key).historicalArchive,undefined);

const index=await readFile("index.html","utf8");
const sw=await readFile("sw.js","utf8");
const app=await readFile("dbv-calendar.js","utf8");
for(const id of ["dbv-calendar-region","dbv-calendar-age","dbv-calendar-level","dbv-calendar-results","dbv-calendar-status"]){
 assert.ok(index.includes('id="'+id+'"'),"Missing source-driven filter "+id);
}
assert.ok(index.includes('id="dbv-calendar-year"'),"Users must be able to select 2027");
assert.ok(index.includes('src="./dbv-calendar.js"'));
assert.ok(sw.includes('"./dbv-calendar.js"'));
assert.ok(sw.includes('"./scripts/dbv-calendar-utils.mjs"'));
assert.ok(app.includes("dbv_calendar_entries?"),"Read-only Supabase data feed required");
assert.ok(app.includes("./data/dbv-calendar.json"),"Source-backed snapshot fallback required");
assert.ok(app.includes("Keine passenden Turniere"),"Missing data message required");
assert.ok(app.includes("passende Turniere"),"Source-backed tournament hits must be counted visibly");
assert.ok(app.includes("data-calendar-alternative-level"),"Empty state must offer one-tap source-backed alternate level");
assert.ok(app.includes("data-calendar-toggle"),"Every DBV calendar card should render an accessible plus/check toggle");
assert.ok(app.includes("badmintonCalendarToggle"),"Quick action must connect to private local bookmark handler");
assert.ok(app.includes('aria-pressed'),"Bookmark state needs accessible status");
const main=await readFile("app.js","utf8");
assert.ok(main.includes("window.badmintonCalendarToggle="),"App must implement quick save with own-player context");
assert.ok(main.includes('source:"dbv-calendar"'),"Source type prevents false official tournament detail IDs");
assert.ok(main.includes('state.officialLinks.unshift(entry)'),"Private bookmark must appear in saved tournament list");
assert.ok(main.includes('source!=="dbv-calendar"'),"Unverified calendar events must not be used for official live match options");
console.log("DBV calendar: source IDs, 3-dimensional facets, BW, age/level, no fake tournament links and offline integration passed.");

assert.ok(app.includes("BW_YOUTH_ARCHIVE_2026")&&app.includes("t.ages.includes(filters.age)"),"Real verified historical BW youth results must be correctly age-filtered");
assert.ok(app.includes("bwFrameworkHTML"),"Official planning sources remain distinct from confirmed event IDs");
assert.ok(app.includes("data-calendar-show-history"),"Users must be able to open actual past results directly");

assert.ok(app.includes("2027-01-16"),"Official BWBV 2027 framework starts in January");
assert.ok(app.includes("2027-06-27"),"Official BWBV 2027 framework includes June");
assert.ok(app.includes("dbv-calendar-external-plan")&&app.includes("dbv-calendar-external-result"),
 "Official plans and completed real tournament results must be visually and technically distinct");

assert.ok(app.includes("readBWArchive")&&app.includes("mergeOfficialCalendarRows(entries,historical)"),
 "Calendar must use current-first source precedence on archive overlap");
assert.ok(app.includes("./data/bw-youth-calendar-archive.json"),"Historical BW archive must remain a separate verifiable source");
assert.ok(app.includes("isVerifiedCalendarDuplicate")&&!app.includes("isCuratedDuplicate"),
 "Do not hide a distinct event based only on shared city, date, age or level; collapse only exact DBV UUIDs");

assert.ok(app.includes("readBWBVFramework"),"Official BWBV planning snapshot must supersede hardcoded cards");
assert.ok(app.includes("./data/bwbv-youth-framework-2027.json"),"Verified 2027 BWBV/DBV source is a published file");

assert.match(index,/id="dbv-calendar-q" type="search"/,"Direct name/place search remains first-class");
assert.match(index,/id="dbv-calendar-advanced"/,"Rare calendar filters use native accessible details");
assert.match(app,/data-tournament-shortcut="find"|tournamentShortcut==="find"/,"Short path focuses existing search");

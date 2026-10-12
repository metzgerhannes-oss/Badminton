import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const values=new Map();
const storage={
 getItem:key=>values.get(key)||null,
 setItem:(key,value)=>values.set(key,value)
};
const context=vm.createContext({localStorage:storage,Intl,Date,Math,String,Number,Object,Array,Error});
vm.runInContext(fs.readFileSync(new URL("../spond-calendar.js",import.meta.url),"utf8"),context);
const api=vm.runInContext("SchmetterlingeSpond",context);
function equal(a,b){assert.deepEqual(JSON.parse(JSON.stringify(a)),b)}

const ics=[
 "BEGIN:VCALENDAR",
 "BEGIN:VEVENT",
 "UID:spond-tournament-123",
 "SUMMARY:Jugend-Ranglistenturnier",
 "LOCATION:Sporthalle\\, Reutlingen",
 "DTSTART;VALUE=DATE:20261024",
 "DTEND;VALUE=DATE:20261026",
 "END:VEVENT",
 "BEGIN:VEVENT",
 "UID:spond-tournament-124",
 "SUMMARY:Training",
 "DTSTART;TZID=Europe/Berlin:20261025T100000",
 "DTEND;TZID=Europe/Berlin:20261025T120000",
 "END:VEVENT",
 "END:VCALENDAR"
].join("\r\n");
const rows=api.parseSource(ics);
assert.equal(rows.length,2);
assert.equal(api.looksLikeTournament(rows[0].name),true);
assert.equal(api.looksLikeTournament(rows[1].name),false);
assert.equal(rows[0].endDate,"2026-10-25","all-day DTEND is exclusive");
assert.equal(rows[0].location,"Sporthalle, Reutlingen");
assert.equal(rows[1].startDate,"2026-10-25");
assert.equal(api.day("20261024T233000Z"),"2026-10-25","UTC to Berlin local day");

const first=api.importBatch(rows,"05-123456");
equal(first,{added:2,updated:0,unchanged:0});
assert.equal(api.importBatch(rows,"05-123456").unchanged,2,"reimports must not duplicate");
assert.equal(api.read().length,2);
assert.equal(api.dashboardItems("05-654321").length,0,"private calendar events don't leak into other profiles");
assert.equal(api.dashboardItems("05-123456").length,2);
assert.equal(api.dashboardItems("05-123456",[{playerId:"05-123456",name:"Jugend-Ranglistenturnier",startDate:"2026-10-24"}]).length,1,"same DBV bookmark hidden from Home duplicates");

const amended=[{...rows[0],name:"Jugend-Ranglistenturnier NEU"}];
const delta=api.importBatch(amended,"05-123456");
assert.equal(delta.updated,1);
assert.equal(api.read().find(t=>t.uid==="spond-tournament-123").name,"Jugend-Ranglistenturnier NEU");
api.remove(rows[0].id,"05-123456");
assert.equal(api.read().length,1);
assert.equal(api.parseSource("Turnier A\t2026-11-01\t2026-11-02\tHalle").length,1);
assert.throws(()=>api.parseSource("{bad json}"),/JSON/);
assert.throws(()=>api.parseSource(""),/Keine Kalenderdaten/);
assert.equal(api.parseSource(JSON.stringify({events:[{title:"Test",start:"2026-12-01"}]})).length,1);
console.log("Spond-Kalender: Parser, Zeitzone, Privatsphäre, Dubletten, Aktualisierung und Entfernen geprüft.");

import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import {
 LOCAL_STORE_KEY,SPOND_STORE_KEY,LEGACY_BACKUP_VERSION,BACKUP_KIND,BACKUP_VERSION,MAX_BACKUP_BYTES,
 normalizeLocalData,normalizeCalendarEvents,createLocalBackup,inspectLocalBackup
} from "../scripts/local-backup.mjs";

const tournament="https://dbv.turnier.de/tournament/E24DC6EE-152A-454D-B00C-E625B751D7D5";
const original={
 players:[{id:"05-070879",name:"Philipp Metzger",club:"SpVgg Mössingen",birthYear:2016},
          {id:"05-071969",name:"Charlotte Metzger",birthYear:2014}],
 friends:[{id:"05-061350",name:"Sarah Storz",club:"SpVgg Mössingen"}],
 officialLinks:[{id:"E24DC6EE-152A-454D-B00C-E625B751D7D5",
  url:tournament,name:"Turnier",playerId:"05-070879",
  startDate:"2026-10-11",endDate:"2026-10-12"}],
 activeProfileId:"05-070879",chosen:"05-061350",historyProfilesInitialized:true
};
const stored=JSON.stringify(original);
const privateCalendar=[{name:"Beispiel-Ranglistenturnier",startDate:"2026-10-24",
 endDate:"2026-10-25",location:"Testhalle",uid:"test-uid-123",
 importedAt:"2026-10-10T11:00:00.000Z",playerId:"05-070879",source:"spond"}];
const created=createLocalBackup(stored,new Date("2026-10-10T11:00:00.000Z"),
 JSON.stringify(privateCalendar));
const parsed=inspectLocalBackup(created);
assert.equal(LOCAL_STORE_KEY,"shuttleboard-v1");
assert.equal(SPOND_STORE_KEY,"schmetterlinge.calendarEvents.v1");
assert.equal(LEGACY_BACKUP_VERSION,1);
assert.equal(JSON.parse(created).kind,BACKUP_KIND);
assert.equal(JSON.parse(created).schemaVersion,BACKUP_VERSION);
assert.deepEqual(parsed.summary,{
 players:2,friends:1,tournaments:1,calendarEvents:1,activePlayer:"Philipp Metzger"
});
assert.equal(parsed.data.activeProfileId,"05-070879");
assert.equal(parsed.data.chosen,"05-070879","Viewing a friend must not replace the own Home profile");
assert.deepEqual(parsed.data.friends,[{id:"05-061350",name:"Sarah Storz",club:"SpVgg Mössingen",url:""}]);
assert.equal(parsed.data.officialLinks[0].url,tournament);
assert.equal(parsed.calendarEvents.length,1);
assert.equal(parsed.calendarEvents[0].source,"spond");
assert.match(parsed.calendarEvents[0].id,/^calendar-[0-9a-f]{8}$/);
assert.equal(parsed.calendarEvents[0].playerId,"05-070879");
assert.equal(parsed.calendarEvents[0].name,"Beispiel-Ranglistenturnier");
const roundTrip=createLocalBackup(JSON.stringify(parsed.data),new Date("2026-10-11T11:00:00Z"),
 JSON.stringify(parsed.calendarEvents));
assert.deepEqual(inspectLocalBackup(roundTrip).calendarEvents,parsed.calendarEvents);
const legacyArchive=JSON.parse(created);
legacyArchive.schemaVersion=LEGACY_BACKUP_VERSION;
delete legacyArchive.calendarEvents;
const legacy=inspectLocalBackup(JSON.stringify(legacyArchive));
assert.equal(legacy.calendarEvents,null,"An older backup cannot erase newer private calendar data");
assert.equal(legacy.summary.calendarEvents,null);
assert.equal(parsed.data.historyProfilesInitialized,true);
assert.deepEqual(inspectLocalBackup(createLocalBackup(JSON.stringify(parsed.data))).data,parsed.data);

const damaged=change=>{
 const b=JSON.parse(created);change(b);return JSON.stringify(b);
};
for(const bad of [
 damaged(b=>b.kind="different-app"),damaged(b=>b.schemaVersion=999),
 damaged(b=>b.data.players=[]),
 damaged(b=>b.data.players.push(b.data.players[0])),
 damaged(b=>b.data.friends[0].id="javascript:alert(1)"),
 damaged(b=>b.data.friends[0].id="05-070879"),
 damaged(b=>b.data.players[0].url="javascript:alert(1)"),
 damaged(b=>b.data.officialLinks[0].url="https://evil.example/tournament/E24DC6EE-152A-454D-B00C-E625B751D7D5"),
 damaged(b=>b.data.officialLinks[0].endDate="2026-01-01"),
 damaged(b=>b.data.activeProfileId="05-061350"),
 damaged(b=>b.data.officialLinks[0].playerId="05-061350"),
 damaged(b=>b.data.players[0].name="<script>\n"),
 damaged(b=>b.calendarEvents[0].playerId="05-000000"),
 damaged(b=>b.calendarEvents[0].name="test\nname"),
 damaged(b=>b.calendarEvents[0].endDate="2025-01-01"),
 damaged(b=>b.calendarEvents.push(b.calendarEvents[0])),
 damaged(b=>b.calendarEvents={}),
 damaged(b=>delete b.calendarEvents),
])assert.throws(()=>inspectLocalBackup(bad));
assert.throws(()=>inspectLocalBackup("{" ));
assert.throws(()=>inspectLocalBackup("x".repeat(MAX_BACKUP_BYTES+1)));
assert.throws(()=>createLocalBackup("{bad json"));
assert.throws(()=>createLocalBackup(stored,new Date(),"{invalid-json"));
assert.throws(()=>createLocalBackup(stored,new Date(),JSON.stringify([{...privateCalendar[0],playerId:"05-999999"}])));
assert.throws(()=>normalizeCalendarEvents(Array(121).fill(privateCalendar[0]),new Set(["05-070879"])));

const storage=new Map([[LOCAL_STORE_KEY,JSON.stringify(parsed.data)]]);
const ctx=vm.createContext({
 URL,Intl,Date,
 document:{addEventListener(){}},
 localStorage:{
  getItem:key=>storage.get(key)??null,
  setItem:(key,val)=>storage.set(key,String(val))
 }
});
const app=await readFile("app.js","utf8");
vm.runInContext(await readFile("state-storage.js","utf8"),ctx,{filename:"state-storage.js"});
vm.runInContext(await readFile("tournament-bookmarks.js","utf8"),ctx,{filename:"tournament-bookmarks.js"});
vm.runInContext(app,ctx,{filename:"app.js"});
vm.runInContext("restore()",ctx);
const restored=JSON.parse(vm.runInContext("JSON.stringify({players:state.players,friends:state.friends,officialLinks:state.officialLinks,activeProfileId:state.activeProfileId,viewingFriendId:state.viewingFriendId})",ctx));
assert.equal(restored.players.length,2);
assert.equal(restored.friends[0].id,"05-061350");
assert.equal(restored.officialLinks[0].id,"E24DC6EE-152A-454D-B00C-E625B751D7D5");
assert.equal(restored.activeProfileId,"05-070879");
assert.equal(restored.viewingFriendId,null);
const html=await readFile("index.html","utf8");
const script=await readFile("backup.js","utf8");
const sw=await readFile("sw.js","utf8");
assert.match(html,/id="backup-export"/);
assert.match(html,/id="backup-file"/);
assert.match(html,/id="backup-restore"[^>]*disabled/);
assert.match(html,/id="backup-feedback"/);
assert.match(script,/window\.confirm\(/,"Import requires explicit approval");
assert.ok(script.includes("localStorage.setItem(LOCAL_STORE_KEY"));
assert.ok(script.includes("localStorage.setItem(SPOND_STORE_KEY"));
assert.match(script,/selectionVersion/);
assert.match(script,/previousFamily/);
assert.match(script,/previousCalendar/);
assert.match(script,/window\.location\.reload/);
assert.doesNotMatch(script,/fetch\(|XMLHttpRequest/,"Personal backups never go over the network");
assert.match(sw,/scripts\/local-backup\.mjs/);
assert.match(sw,/backup\.js/);
assert.match(sw,/schmetterlinge-shell-v[1-9][0-9]*/);
console.log("Offline backup contract: roundtrip, canonical home profile, old app restore, unsafe/duplicate files rejected.");

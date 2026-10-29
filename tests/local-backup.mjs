import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import {
 LOCAL_STORE_KEY,SPOND_STORE_KEY,LEGACY_BACKUP_VERSION,BACKUP_KIND,BACKUP_VERSION,MAX_BACKUP_BYTES,
 normalizeLocalData,normalizeCalendarEvents,createLocalBackup,inspectLocalBackup
} from "../scripts/local-backup.mjs";

const tournament="https://dbv.turnier.de/tournament/11111111-2222-4333-8444-555555555555";
const original={
 players:[{id:"99-100001",name:"Testperson A",club:"Musterverein",birthYear:2016},
          {id:"99-100002",name:"Testperson B",birthYear:2014}],
 friends:[{id:"99-100003",name:"Testperson C",club:"Musterverein"}],
 officialLinks:[{id:"11111111-2222-4333-8444-555555555555",
  url:tournament,name:"Turnier",playerId:"99-100001",
  startDate:"2026-10-11",endDate:"2026-10-12"}],
 activeProfileId:"99-100001",chosen:"99-100003",historyProfilesInitialized:true
};
// Generated test IDs deliberately use a non-production prefix; never put real family details in generic backups.
assert.ok([...original.players,...original.friends].every(p=>p.id.startsWith("99-")&&p.name.startsWith("Testperson")));
const stored=JSON.stringify(original);
const privateCalendar=[{name:"Beispiel-Ranglistenturnier",startDate:"2026-10-24",
 endDate:"2026-10-25",location:"Testhalle",uid:"test-uid-123",
 importedAt:"2026-10-10T11:00:00.000Z",playerId:"99-100001",source:"spond"}];
const created=createLocalBackup(stored,new Date("2026-10-10T11:00:00.000Z"),
 JSON.stringify(privateCalendar));
const parsed=inspectLocalBackup(created);
assert.equal(LOCAL_STORE_KEY,"shuttleboard-v1");
assert.equal(SPOND_STORE_KEY,"schmetterlinge.calendarEvents.v1");
assert.equal(LEGACY_BACKUP_VERSION,1);
assert.equal(JSON.parse(created).kind,BACKUP_KIND);
assert.equal(JSON.parse(created).schemaVersion,BACKUP_VERSION);
assert.deepEqual(parsed.summary,{
 players:2,friends:1,tournaments:1,calendarEvents:1,activePlayer:"Testperson A"
});
assert.equal(parsed.data.activeProfileId,"99-100001");
assert.equal(parsed.data.chosen,"99-100001","Viewing a friend must not replace the own Home profile");
assert.deepEqual(parsed.data.friends,[{id:"99-100003",name:"Testperson C",club:"Musterverein",url:""}]);
assert.equal(parsed.data.officialLinks[0].url,tournament);
const withDetails={...original,officialLinks:[{...original.officialLinks[0],
 place:"Sporthalle Musterort, Hauptstraße 22",deadline:"2026-10-01"}]};
const withDetailsRestored=inspectLocalBackup(createLocalBackup(JSON.stringify(withDetails)));
assert.equal(withDetailsRestored.data.officialLinks[0].place,"Sporthalle Musterort, Hauptstraße 22");
assert.equal(withDetailsRestored.data.officialLinks[0].deadline,"2026-10-01");
assert.equal(withDetailsRestored.data.officialLinks[0].startDate,"2026-10-11");

assert.equal(parsed.calendarEvents.length,1);
assert.equal(parsed.calendarEvents[0].source,"spond");
assert.match(parsed.calendarEvents[0].id,/^calendar-[0-9a-f]{8}$/);
assert.equal(parsed.calendarEvents[0].playerId,"99-100001");
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

// A device-local ID is an independent identity, even when another official
// profile has the same display name. Neither favorites nor Home choice move.
const sameNameLocal={...original,
 players:[{id:"local-charlotte",name:"Testperson B"},{id:"99-100002",name:"Testperson B"}],
 friends:[],
 officialLinks:[{...original.officialLinks[0],playerId:"local-charlotte"},
  {...original.officialLinks[0],playerId:"99-100002"}],
 activeProfileId:"local-charlotte",chosen:"99-100002"};
const sameNameRestored=inspectLocalBackup(createLocalBackup(JSON.stringify(sameNameLocal)));
assert.deepEqual(sameNameRestored.data.players.map(p=>p.id),["local-charlotte","99-100002"]);
assert.deepEqual(sameNameRestored.data.officialLinks.map(t=>t.playerId),["local-charlotte","99-100002"]);
assert.equal(sameNameRestored.data.activeProfileId,"local-charlotte");
assert.equal(sameNameRestored.data.chosen,"local-charlotte");
assert.equal(inspectLocalBackup(createLocalBackup(JSON.stringify(sameNameRestored.data))).data.activeProfileId,"local-charlotte");
assert.throws(()=>createLocalBackup(JSON.stringify({...sameNameLocal,
 players:[{id:"99-100002",name:"Testperson B"}]})),
 /unbekannten Spieler/,"A removed local owner must not silently transfer a tournament");
assert.throws(()=>inspectLocalBackup(JSON.stringify({...JSON.parse(created),
 data:{...original,activeProfileId:"local-charlotte"}})),
 /kein eigenes Spielerprofil/,"A stale active alias must not select an unrelated official profile");

// A person can be an own profile and independently followed with the same
// official DBV ID; these are roles, not evidence of a new ownership grant.
const dualRole={...original,friends:[{id:"99-100001",name:"Testperson A"}]};
const dualRestored=inspectLocalBackup(createLocalBackup(JSON.stringify(dualRole)));
assert.equal(dualRestored.data.players[0].id,"99-100001");
assert.equal(dualRestored.data.friends[0].id,"99-100001");
assert.equal(dualRestored.data.officialLinks[0].playerId,"99-100001");
assert.equal(dualRestored.data.activeProfileId,"99-100001");
assert.throws(()=>createLocalBackup(JSON.stringify({
 ...dualRole,players:[...dualRole.players,dualRole.players[0]]
})),/Doppelte Spieler-ID/,"Duplicate owned profiles are still rejected");
assert.throws(()=>createLocalBackup(JSON.stringify({
 ...dualRole,friends:[...dualRole.friends,dualRole.friends[0]]
})),/Doppelte Spieler-ID/,"Duplicate follows are still rejected");

// F06: backup v2 must preserve ALL existing private tournament kinds, not
// reject calendar/framework favorites or silently lose their venue on restore.
const calendarFavorite={id:"dbv-calendar-44014",source:"dbv-calendar",url:"https://turniere.badminton.de/",
 name:"Synthetischer C-Termin",playerId:"99-100001",startDate:"2026-01-17",endDate:"2026-01-18",place:"Reutlingen"};
const frameworkFavorite={id:"bwbv-2027-c-1",source:"bwbv-framework",
 url:"https://bwbv.de/wp-content/uploads/2026/03/Termine-2026_2027_Jugend.pdf",
 name:"Synthetischer 2027 Rahmentermin",playerId:"99-100002",
 startDate:"2027-01-16",endDate:"2027-01-17",place:""};
const mixed={...original,officialLinks:[...original.officialLinks,calendarFavorite,frameworkFavorite]};
const mixedBackup=createLocalBackup(JSON.stringify(mixed),new Date("2026-10-24T07:00:00Z"));
const mixedParsed=inspectLocalBackup(mixedBackup);
assert.equal(mixedParsed.summary.tournaments,3);
assert.equal(mixedParsed.data.officialLinks[1].source,"dbv-calendar");
assert.equal(mixedParsed.data.officialLinks[1].place,"Reutlingen");
assert.equal(mixedParsed.data.officialLinks[2].source,"bwbv-framework");
assert.equal(mixedParsed.data.officialLinks[2].place,"");
assert.deepEqual(inspectLocalBackup(createLocalBackup(JSON.stringify(mixedParsed.data))).data.officialLinks,
 mixedParsed.data.officialLinks,"Roundtrip must preserve source, dates, player and venue");
for(const changed of [
 {...calendarFavorite,id:"dbv-calendar-unsafe"},
 {...calendarFavorite,url:"https://evil.example/"},
 {...calendarFavorite,playerId:"99-100003"},
 {...frameworkFavorite,id:"bwbv-2027-c-999"},
 {...frameworkFavorite,startDate:"2027-01-23"},
 {...frameworkFavorite,url:"https://example.invalid/"},
 {...frameworkFavorite,playerId:"99-100003"}
])assert.throws(()=>createLocalBackup(JSON.stringify({...original,officialLinks:[changed]})));

const damaged=change=>{
 const b=JSON.parse(created);change(b);return JSON.stringify(b);
};
for(const bad of [
 damaged(b=>b.kind="different-app"),damaged(b=>b.schemaVersion=999),
 damaged(b=>b.data.players=[]),
 damaged(b=>b.data.players.push(b.data.players[0])),
 damaged(b=>b.data.friends[0].id="javascript:alert(1)"),
 // Same DBV ID in an own profile and Follow is now a valid dual-role case.
 damaged(b=>b.data.players[0].url="javascript:alert(1)"),
 damaged(b=>b.data.officialLinks[0].url="https://evil.example/tournament/11111111-2222-4333-8444-555555555555"),
 damaged(b=>b.data.officialLinks[0].endDate="2026-01-01"),
 damaged(b=>b.data.activeProfileId="99-100003"),
 damaged(b=>b.data.officialLinks[0].playerId="99-100003"),
 damaged(b=>b.data.players[0].name="<script>\n"),
 damaged(b=>b.calendarEvents[0].playerId="99-999998"),
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
assert.throws(()=>createLocalBackup(stored,new Date(),JSON.stringify([{...privateCalendar[0],playerId:"99-999999"}])));
assert.throws(()=>normalizeCalendarEvents(Array(121).fill(privateCalendar[0]),new Set(["99-100001"])));

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
assert.equal(restored.friends[0].id,"99-100003");
assert.equal(restored.officialLinks[0].id,"11111111-2222-4333-8444-555555555555");
assert.equal(restored.activeProfileId,"99-100001");
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


// S-01 / #153: exercise the real offline restore UI with isolated browser
// storage. Two writes are not transactional; a calendar quota failure must
// restore the prior family and calendar rather than leave a mixed backup.
const backupRuntime=(await readFile("backup.js","utf8"))
 .replace(/\bimport\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];?/,"");
assert.doesNotMatch(backupRuntime,/^\s*import\s/m,"Restore harness must evaluate the real module body");
function restoreHarness({archive=created,approve=true,failCalendarOnce=false}={}){
 const beforeFamily=JSON.stringify(parsed.data);
 const beforeCalendar=JSON.stringify(privateCalendar);
 const storage=new Map([[LOCAL_STORE_KEY,beforeFamily],[SPOND_STORE_KEY,beforeCalendar]]);
 const status={textContent:"",dataset:{}};
 const restoreButton={disabled:false};
 let reloads=0,confirmations=0,calendarFailurePending=failCalendarOnce;
 const context=vm.createContext({
  LOCAL_STORE_KEY,SPOND_STORE_KEY,MAX_BACKUP_BYTES,createLocalBackup,inspectLocalBackup,
  document:{getElementById:id=>({
   "backup-feedback":status,"backup-restore":restoreButton
  })[id]||null,addEventListener:()=>{}},
  localStorage:{
   getItem:key=>storage.get(key)??null,
   setItem:(key,value)=>{
    if(key===SPOND_STORE_KEY&&calendarFailurePending){
     calendarFailurePending=false;
     throw new Error("synthetic storage quota");
    }
    storage.set(key,String(value));
   },
   removeItem:key=>storage.delete(key)
  },
  window:{confirm:()=>{confirmations++;return approve;},
   location:{hash:"#spieler",reload:()=>{reloads++;}}},
  Date,Intl,JSON,URL,Blob,setTimeout,__testArchive:archive
 });
 vm.runInContext(backupRuntime,context,{filename:"backup.js"});
 vm.runInContext("pending=inspectLocalBackup(__testArchive); restore();",context);
 return {storage,status,restoreButton,reloads,confirmations,beforeFamily,beforeCalendar,
  hash:context.window.location.hash};
}
const declinedRestore=restoreHarness({approve:false});
assert.equal(declinedRestore.confirmations,1);
assert.equal(declinedRestore.reloads,0);
assert.equal(declinedRestore.storage.get(LOCAL_STORE_KEY),declinedRestore.beforeFamily);
assert.equal(declinedRestore.storage.get(SPOND_STORE_KEY),declinedRestore.beforeCalendar);
assert.match(declinedRestore.status.textContent,/abgebrochen/i);

const successfulRestore=restoreHarness();
assert.equal(successfulRestore.confirmations,1);
assert.equal(successfulRestore.reloads,1);
assert.equal(successfulRestore.hash,"#start");
assert.deepEqual(JSON.parse(successfulRestore.storage.get(LOCAL_STORE_KEY)),parsed.data);
assert.deepEqual(JSON.parse(successfulRestore.storage.get(SPOND_STORE_KEY)),parsed.calendarEvents);

const failedRestore=restoreHarness({failCalendarOnce:true});
assert.equal(failedRestore.reloads,0,"A partial write must not reload the app");
assert.equal(failedRestore.storage.get(LOCAL_STORE_KEY),failedRestore.beforeFamily,
 "Restore failure must roll back the original own/followed profiles");
assert.equal(failedRestore.storage.get(SPOND_STORE_KEY),failedRestore.beforeCalendar,
 "Restore failure must preserve private calendar data");
assert.equal(failedRestore.status.dataset.error,"true");

const legacyRestore=restoreHarness({archive:JSON.stringify(legacyArchive)});
assert.equal(legacyRestore.reloads,1);
assert.equal(legacyRestore.storage.get(SPOND_STORE_KEY),legacyRestore.beforeCalendar,
 "A v1 archive must not erase newer private Spond events");
console.log("S-01 #153: cancel, successful offline restore, storage-quota rollback and v1 calendar preservation passed.");

import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import {
 LOCAL_STORE_KEY,BACKUP_KIND,BACKUP_VERSION,MAX_BACKUP_BYTES,
 normalizeLocalData,createLocalBackup,inspectLocalBackup
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
const created=createLocalBackup(stored,new Date("2026-10-10T11:00:00.000Z"));
const parsed=inspectLocalBackup(created);
assert.equal(LOCAL_STORE_KEY,"shuttleboard-v1");
assert.equal(JSON.parse(created).kind,BACKUP_KIND);
assert.equal(JSON.parse(created).schemaVersion,BACKUP_VERSION);
assert.deepEqual(parsed.summary,{
 players:2,friends:1,tournaments:1,activePlayer:"Philipp Metzger"
});
assert.equal(parsed.data.activeProfileId,"05-070879");
assert.equal(parsed.data.chosen,"05-070879","Viewing a friend must not replace the own Home profile");
assert.deepEqual(parsed.data.friends,[{id:"05-061350",name:"Sarah Storz",club:"SpVgg Mössingen",url:""}]);
assert.equal(parsed.data.officialLinks[0].url,tournament);
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
])assert.throws(()=>inspectLocalBackup(bad));
assert.throws(()=>inspectLocalBackup("{" ));
assert.throws(()=>inspectLocalBackup("x".repeat(MAX_BACKUP_BYTES+1)));
assert.throws(()=>createLocalBackup("{bad json"));

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
assert.match(script,/localStorage\.setItem\(LOCAL_STORE_KEY/);
assert.match(script,/window\.location\.reload/);
assert.doesNotMatch(script,/fetch\(|XMLHttpRequest/,"Personal backups never go over the network");
assert.match(sw,/scripts\/local-backup\.mjs/);
assert.match(sw,/backup\.js/);
assert.match(sw,/schmetterlinge-shell-v39/);
console.log("Offline backup contract: roundtrip, canonical home profile, old app restore, unsafe/duplicate files rejected.");

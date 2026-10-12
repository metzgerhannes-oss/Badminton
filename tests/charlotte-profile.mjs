import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
const code=await readFile("app.js","utf8");
const storageCode=await readFile("state-storage.js","utf8");
const bookmarksCode=await readFile("tournament-bookmarks.js","utf8");
const history=JSON.parse(await readFile("data/history.json","utf8"));
const localKey="shuttleboard-v1";
const store=new Map([[localKey,JSON.stringify({
  players:[
    {id:"05-070879",name:"Philipp Metzger",birthYear:2016,url:"https://dbv.turnier.de/player-profile/A7CCCDAE-8A57-4D13-BB2A-5B6084671153"},
    {id:"local-charlotte",name:"Charlotte Metzger",birthYear:2014,url:""}
  ],
  activeProfileId:"local-charlotte",chosen:"local-charlotte",
  officialLinks:[{id:"E24DC6EE-152A-454D-B00C-E625B751D7D5",playerId:"local-charlotte",name:"Charlottes Turnier",url:"https://dbv.turnier.de/tournament/E24DC6EE-152A-454D-B00C-E625B751D7D5",startDate:"2026-10-12",endDate:""}],
  historyProfilesInitialized:true
})]]);
const context=vm.createContext({URL,Intl,Date,document:{addEventListener(){}},
 localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))}});
vm.runInContext(storageCode,context,{filename:"state-storage.js"});
vm.runInContext(bookmarksCode,context,{filename:"tournament-bookmarks.js"});
vm.runInContext(code,context,{filename:"app.js"});
const run=script=>vm.runInContext(script,context);
run("restore()");
assert.equal(run("state.activeProfileId"),"05-071969","Old Charlotte active profile must be migrated");
assert.equal(run("state.chosen"),"05-071969");
assert.equal(run('state.players.filter(p=>p.id==="05-071969").length'),1);
assert.equal(run('state.players.filter(p=>p.id==="local-charlotte").length'),0);
assert.equal(run('state.players.find(p=>p.id==="05-071969").birthYear'),2014);
assert.equal(run('state.players.find(p=>p.id==="05-071969").name'),"Charlotte Metzger");
assert.equal(run('selectedLinks()[0].playerId'),"05-071969","Charlotte's saved tournaments must survive");
run("save()");
const copy=JSON.parse(store.get(localKey));
assert.equal(copy.activeProfileId,"05-071969");
assert.equal(copy.officialLinks[0].playerId,"05-071969");
assert.equal(copy.players.filter(p=>p.id==="05-071969").length,1);
const charlotteResult=history.results.find(x=>x.playerName==="Charlotte Metzger");
assert.equal(charlotteResult.playerId,"05-071969");
assert.equal(charlotteResult.ageGroup,"U13");
assert.equal(charlotteResult.discipline,"Einzel");
assert.equal(charlotteResult.place,5);
assert.equal(charlotteResult.verified,true);
const charlotteEvents=history.results.filter(x=>x.playerId==="05-071969"&&x.verified);
assert.equal(new Set(charlotteEvents.map(x=>x.date+"|"+x.event)).size,2,
 "A new device must see both source-verified Charlotte tournaments");
const charlotteChampionship=charlotteEvents.find(x=>x.id==="cm-2026-10-03-bw-me-u13-17");
assert.equal(charlotteChampionship?.place,17);
assert.equal(charlotteChampionship?.ageGroup,"U13");
assert.equal(charlotteChampionship?.discipline,"Einzel");
assert.match(charlotteChampionship?.source?.url||"",/spvgg\.org\/abteilungen\/badminton\/aktuelles\/55-bwbv-meisterschaft/);
assert.equal(charlotteChampionship?.verified,true);

const freshStore=new Map();
const fresh=vm.createContext({URL,Intl,Date,document:{addEventListener(){}},localStorage:{
 getItem:k=>freshStore.get(k)??null,setItem:(k,v)=>freshStore.set(k,String(v))
}});
vm.runInContext(storageCode,fresh,{filename:"state-storage.js"});
vm.runInContext(bookmarksCode,fresh,{filename:"tournament-bookmarks.js"});
vm.runInContext(code,fresh,{filename:"app.js"});
assert.equal(vm.runInContext("state.players.length",fresh),0,"New installs must never inherit someone else's family profiles");
assert.equal(vm.runInContext("state.activeProfileId",fresh),"","New installs need explicit setup");
assert.doesNotMatch(code,/DEFAULT_PLAYERS|name:"Charlotte Metzger"|name:"Philipp Metzger"/);
console.log("Legacy local DBV-ID migration and bookmarks preserved; new devices start without personal family profiles.");

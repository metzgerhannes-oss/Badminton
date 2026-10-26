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
    {id:"05-900001",name:"Person Alpha",birthYear:2016,url:"https://dbv.turnier.de/player-profile/A7CCCDAE-8A57-4D13-BB2A-5B6084671153"},
    {id:"local-charlotte",name:"Person Beta",birthYear:2014,url:""}
  ],
  activeProfileId:"local-charlotte",chosen:"local-charlotte",
  officialLinks:[{id:"E24DC6EE-152A-454D-B00C-E625B751D7D5",playerId:"local-charlotte",name:"Privates Turnier",url:"https://dbv.turnier.de/tournament/E24DC6EE-152A-454D-B00C-E625B751D7D5",startDate:"2026-10-12",endDate:""}],
  historyProfilesInitialized:true
})]]);
const context=vm.createContext({URL,Intl,Date,document:{addEventListener(){}},
 localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))}});
vm.runInContext(storageCode,context,{filename:"state-storage.js"});
vm.runInContext(bookmarksCode,context,{filename:"tournament-bookmarks.js"});
vm.runInContext(code,context,{filename:"app.js"});
const run=script=>vm.runInContext(script,context);
run("restore()");
assert.equal(run("state.activeProfileId"),"local-charlotte","Legacy device ID remains owned locally");
assert.equal(run("state.chosen"),"local-charlotte");
assert.equal(run('state.players.filter(p=>p.id==="05-071969").length'),0,
 "A hardcoded DBV identity must not be fabricated");
assert.equal(run('state.players.filter(p=>p.id==="local-charlotte").length'),1);
assert.equal(run('state.players.find(p=>p.id==="local-charlotte").birthYear'),2014);
assert.equal(run('state.players.find(p=>p.id==="local-charlotte").name'),"Person Beta");
assert.equal(run('selectedLinks()[0].playerId'),"local-charlotte","Saved tournament ownership must survive");
run("save()");
const copy=JSON.parse(store.get(localKey));
assert.equal(copy.activeProfileId,"local-charlotte");
assert.equal(copy.officialLinks[0].playerId,"local-charlotte");
assert.equal(copy.players.filter(p=>p.id==="local-charlotte").length,1);
assert.equal(history.privacyMode,"private");
assert.deepEqual(history.results,[],"Historical family results must not be in the public static build");
const freshStore=new Map();
const fresh=vm.createContext({URL,Intl,Date,document:{addEventListener(){}},localStorage:{
 getItem:k=>freshStore.get(k)??null,setItem:(k,v)=>freshStore.set(k,String(v))
}});
vm.runInContext(storageCode,fresh,{filename:"state-storage.js"});
vm.runInContext(bookmarksCode,fresh,{filename:"tournament-bookmarks.js"});
vm.runInContext(code,fresh,{filename:"app.js"});
assert.equal(vm.runInContext("state.players.length",fresh),0,"New installs must never inherit someone else's family profiles");
assert.equal(vm.runInContext("state.activeProfileId",fresh),"","New installs need explicit setup");
assert.doesNotMatch(code,/DEFAULT_PLAYERS|local-charlotte|05-071969/);
console.log("Legacy local identity and own bookmarks preserved; new devices remain empty.");

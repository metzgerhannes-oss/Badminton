import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
const code=await readFile("app.js","utf8");
const storageCode=await readFile("state-storage.js","utf8");
const history=JSON.parse(await readFile("data/history.json","utf8"));
const localKey="shuttleboard-v1";
const store=new Map([[localKey,JSON.stringify({
  players:[
    {id:"05-070879",name:"Philipp Metzger",birthYear:2016,url:"https://dbv.turnier.de/player-profile/A7CCCDAE-8A57-4D13-BB2A-5B6084671153"},
    {id:"local-charlotte",name:"Charlotte Metzger",url:""}
  ],
  activeProfileId:"local-charlotte",chosen:"local-charlotte",
  officialLinks:[{id:"E24DC6EE-152A-454D-B00C-E625B751D7D5",playerId:"local-charlotte",name:"Charlottes Turnier",url:"https://dbv.turnier.de/tournament/E24DC6EE-152A-454D-B00C-E625B751D7D5",startDate:"2026-10-12",endDate:""}],
  historyProfilesInitialized:true
})]]);
const context=vm.createContext({URL,Intl,Date,document:{addEventListener(){}},
 localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))}});
vm.runInContext(storageCode,context,{filename:"state-storage.js"});
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
const freshStore=new Map();
const fresh=vm.createContext({URL,Intl,Date,document:{addEventListener(){}},localStorage:{
 getItem:k=>freshStore.get(k)??null,setItem:(k,v)=>freshStore.set(k,String(v))
}});
vm.runInContext(storageCode,fresh,{filename:"state-storage.js"});
vm.runInContext(code,fresh,{filename:"app.js"});
assert.equal(vm.runInContext('state.players.find(p=>p.name==="Charlotte Metzger").id',fresh),"05-071969","New installs must have verified Charlotte ID");
assert.equal(vm.runInContext('state.players.find(p=>p.id==="05-071969").birthYear',fresh),2014);
console.log("Charlotte DBV profile migration passed: verified identity, selected profile and bookmarked tournaments retained.");

import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const [storageScript,bookmarksScript,appScript]=await Promise.all([
 readFile("state-storage.js","utf8"),readFile("tournament-bookmarks.js","utf8"),readFile("app.js","utf8")
]);
assert.doesNotMatch(storageScript,/fetch\(|XMLHttpRequest/,"Local state may not call remote APIs");
assert.match(storageScript,/const STORE="shuttleboard-v1"/);
const key="shuttleboard-v1";
const tournament="https://dbv.turnier.de/tournament/E24DC6EE-152A-454D-B00C-E625B751D7D5";
const original={
 players:[{id:"05-070879",name:"Philipp Metzger",birthYear:2016},
          {id:"local-charlotte",name:"Charlotte Metzger",birthYear:2014}],
 friends:[{id:"05-061350",name:"Sarah Storz",club:"SpVgg Mössingen"}],
 officialLinks:[{id:"ignored-by-normalizer",url:tournament,name:"Turnier",playerId:"local-charlotte",startDate:"2026-10-11",endDate:""}],
 activeProfileId:"local-charlotte",chosen:"05-061350",historyProfilesInitialized:true
};
const items=new Map([[key,JSON.stringify(original)],["separate-setting","do-not-touch"]]);
function makeVM(storage=items){
 const context=vm.createContext({URL,Intl,Date,document:{addEventListener(){}},localStorage:{
  getItem:k=>storage.get(k)??null,
  setItem:(k,v)=>storage.set(k,String(v))
 }});
 vm.runInContext(storageScript,context,{filename:"state-storage.js"});
 vm.runInContext(bookmarksScript,context,{filename:"tournament-bookmarks.js"});
 vm.runInContext(appScript,context,{filename:"app.js"});
 return {context,run:q=>vm.runInContext(q,context)};
}
let first=makeVM();
assert.equal(first.run("SchmetterlingeStorage.SCHEMA_VERSION"),1);
assert.equal(first.run("SchmetterlingeStorage.STORE"),key);
first.run("restore()");
assert.equal(first.run("state.activeProfileId"),"local-charlotte");
assert.equal(first.run("state.viewingFriendId"),null);
assert.equal(first.run("state.friends[0].id"),"05-061350");
assert.equal(first.run("state.officialLinks[0].playerId"),"local-charlotte");
first.run('state.viewingFriendId="05-061350";state.chosen="05-061350"');
first.run("save()");
const saved=JSON.parse(items.get(key));
assert.deepEqual(saved.players.map(p=>p.id),["05-070879","local-charlotte"],"No hardcoded person identity migration");
assert.equal(saved.chosen,saved.activeProfileId);
assert.equal(saved.activeProfileId,"local-charlotte");
assert.equal(saved.friends.length,1);
assert.equal(saved.officialLinks[0].playerId,"local-charlotte","Old favorites keep their actual device owner");
assert.equal(saved.viewingFriendId,undefined);
assert.equal(items.get("separate-setting"),"do-not-touch");
const second=makeVM();
second.run("restore()");
assert.equal(second.run("state.activeProfileId"),"local-charlotte");
assert.equal(second.run("state.friends.length"),1);
assert.equal(second.run("state.officialLinks.length"),1);
// Restore a local first-name alias and a DBV player with matching first name.
// Do not guess they are the same human or reassign private bookmarks.
const aliasStore=new Map([[key,JSON.stringify({
 players:[
  {id:"local-older",name:"Philipp",club:"SpVgg Mössingen"},
  {id:"05-070879",name:"Philipp Metzger",club:"SpVgg Mössingen",birthYear:2016},
  {id:"05-071969",name:"Charlotte Metzger"}],
 officialLinks:[{id:"ignored",url:tournament,name:"Philipps nächstes Turnier",
  playerId:"local-older",startDate:"2026-11-21",endDate:""}],
 activeProfileId:"local-older",chosen:"local-older",friends:[{id:"05-061350",name:"Sarah Storz"}]
})]]);
const aliasApp=makeVM(aliasStore);
aliasApp.run("restore();save()");
const aliasData=JSON.parse(aliasStore.get(key));
assert.deepEqual(aliasData.players.map(p=>p.id),["local-older","05-070879","05-071969"]);
assert.equal(aliasData.activeProfileId,"local-older");
assert.equal(aliasData.chosen,"local-older");
assert.equal(aliasData.officialLinks[0].playerId,"local-older");
assert.equal(aliasData.officialLinks[0].startDate,"2026-11-21");
assert.equal(aliasData.friends[0].id,"05-061350");
const conflictStore=new Map([[key,JSON.stringify({
 players:[{id:"local-ph",name:"Philipp",birthYear:2013},
  {id:"05-070879",name:"Philipp Metzger",birthYear:2016}],
 activeProfileId:"local-ph",officialLinks:[],friends:[]
})]]);
const conflictApp=makeVM(conflictStore);
conflictApp.run("restore();save()");
assert.equal(JSON.parse(conflictStore.get(key)).players.length,2,
 "Different known birth years must not merge into one profile");
const sameNameDifferentPeople=new Map([[key,JSON.stringify({
 players:[{id:"local-candidate",name:"Anna Muster",club:"Testclub",birthYear:2012},
 {id:"99-000001",name:"Anna Muster",club:"Testclub",birthYear:2012}],
 activeProfileId:"local-candidate",officialLinks:[{
 id:"old",url:tournament,name:"Eigener Favorit",playerId:"local-candidate",startDate:"2026-10-22"
 }],friends:[]})]]);
const isolated=makeVM(sameNameDifferentPeople);isolated.run("restore();save()");
const own=JSON.parse(sameNameDifferentPeople.get(key));
assert.equal(own.players.length,2,"Identical full name, birth year and club are not proven identity");
assert.equal(own.activeProfileId,"local-candidate");
assert.equal(own.officialLinks[0].playerId,"local-candidate","Never steal old local favorites");

const corrupt=new Map([[key,"invalid json"]]);
const damaged=makeVM(corrupt);
assert.doesNotThrow(()=>damaged.run("restore()"));
assert.equal(damaged.run("state.players.length"),0,"Invalid local data must not insert anybody else’s family profiles");
const blocked=vm.createContext({URL,Intl,Date,document:{addEventListener(){}},
 localStorage:{getItem(){throw new Error("blocked")},setItem(){throw new Error("blocked")}}
});
vm.runInContext(storageScript,blocked,{filename:"state-storage.js"});
vm.runInContext(bookmarksScript,blocked,{filename:"tournament-bookmarks.js"});
vm.runInContext(appScript,blocked,{filename:"app.js"});
assert.doesNotThrow(()=>vm.runInContext("restore();save()",blocked));
assert.equal(vm.runInContext("state.players.length",blocked),0,"Blocked storage does not bootstrap private profiles");
console.log("Storage v50: neutral defaults, legacy ID migration, follows/bookmarks and blocked storage preserved.");

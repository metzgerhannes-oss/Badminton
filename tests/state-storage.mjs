import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const [storageScript,appScript]=await Promise.all([
 readFile("state-storage.js","utf8"),readFile("app.js","utf8")
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
 vm.runInContext(appScript,context,{filename:"app.js"});
 return {context,run:q=>vm.runInContext(q,context)};
}
let first=makeVM();
assert.equal(first.run("SchmetterlingeStorage.SCHEMA_VERSION"),1);
assert.equal(first.run("SchmetterlingeStorage.STORE"),key);
first.run("restore()");
assert.equal(first.run("state.activeProfileId"),"05-071969");
assert.equal(first.run("state.viewingFriendId"),null);
assert.equal(first.run("state.friends[0].id"),"05-061350");
assert.equal(first.run("state.officialLinks[0].playerId"),"05-071969");
first.run('state.viewingFriendId="05-061350";state.chosen="05-061350"');
first.run("save()");
const saved=JSON.parse(items.get(key));
assert.deepEqual(saved.players.map(p=>p.id),["05-070879","05-071969"]);
assert.equal(saved.chosen,saved.activeProfileId);
assert.equal(saved.activeProfileId,"05-071969");
assert.equal(saved.friends.length,1);
assert.equal(saved.officialLinks[0].playerId,"05-071969");
assert.equal(saved.viewingFriendId,undefined);
assert.equal(items.get("separate-setting"),"do-not-touch");
const second=makeVM();
second.run("restore()");
assert.equal(second.run("state.activeProfileId"),"05-071969");
assert.equal(second.run("state.friends.length"),1);
assert.equal(second.run("state.officialLinks.length"),1);
const corrupt=new Map([[key,"invalid json"]]);
const damaged=makeVM(corrupt);
assert.doesNotThrow(()=>damaged.run("restore()"));
assert.equal(damaged.run("state.players.length"),2,"Malformed old storage must not empty default players");
const blocked=vm.createContext({URL,Intl,Date,document:{addEventListener(){}},
 localStorage:{getItem(){throw new Error("blocked")},setItem(){throw new Error("blocked")}}
});
vm.runInContext(storageScript,blocked,{filename:"state-storage.js"});
vm.runInContext(appScript,blocked,{filename:"app.js"});
assert.doesNotThrow(()=>vm.runInContext("restore();save()",blocked));
assert.equal(vm.runInContext("state.players.length",blocked),2);
console.log("Storage v40: legacy migration, own profile, follows, bookmarks, unrelated settings and blocked storage preserved.");

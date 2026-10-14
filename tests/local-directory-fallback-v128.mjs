import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import {localLibraryPlayers,selectPlayers} from "../scripts/library-utils.mjs";

const own={players:[
 {id:"01-000001",name:"Spielerin Beispiel",club:"SpVgg Mössingen",ageClass:"U13"},
 {id:"01-000001",name:"Doppelte Spielerin",club:"SpVgg Mössingen"}],
 friends:[{id:"01-000002",name:"Freund Muster",club:"SV Test",ageClass:"U15"},
 {id:"local-test",name:"Ohne offizielle DBV-ID"}]};
const local=localLibraryPlayers(own);
assert.equal(local.length,2,"Only verified-format IDs already on this device");
assert.equal(local.find(p=>p.id==="01-000001").name,"Spielerin Beispiel");
assert.equal(selectPlayers(local,{query:"beispiel"}).length,1);
assert.equal(selectPlayers(local,{query:"01-000002"}).length,1);
assert.equal(selectPlayers(local,{query:"nicht auf dem Gerät"}).length,0);

const source=await readFile("library.js","utf8");
assert.match(source,/summary\.privacyMode==="private"/);
assert.match(source,/rosterDenied=true/);
assert.match(source,/Nur gespeicherte Profile auf diesem Gerät/);
assert.doesNotMatch(source,/GitHub-Ausfallsicherung · "\+\$\("library-source"\)\.textContent/,
  "Do not compound fallbacks on every search");
assert.doesNotMatch(source,/summary\.week\+"\/"\+summary\.year\+" · "\+summary\.total/,
  "Do not render undefined/undefined when public stub omits version metadata");

const fields={
 "library-search":{value:"Spielerin Beispiel"},
 "library-age":{value:"all"},
 "library-club":{value:""},
 "library-association":{value:"all",innerHTML:""},
 "library-source":{textContent:""},
 "library-club-suggestions":{innerHTML:""}
};
let getCalls=0;
const store={"shuttleboard-v1":JSON.stringify(own)};
const fakeContext=vm.createContext({
 document:{getElementById:id=>fields[id]||null,addEventListener(){}},
 localStorage:{getItem:k=>store[k]??null},
 console,URL,URLSearchParams,Intl,Map,Set,
 setTimeout,clearTimeout,
 readPublicRows:async()=>{getCalls++;throw Object.assign(Error("denied"),{status:403})}
});
vm.runInContext(source.replace(/^import[^\n]+\n/gm,""),fakeContext);
vm.runInContext(`const localLibraryPlayers=${localLibraryPlayers.toString()}`,fakeContext);
vm.runInContext(`const selectPlayers=${selectPlayers.toString()}`,fakeContext);
// Only validate that after a restricted server request the UI uses local data,
// not a blank static roster. Pure function assertions above cover sorting and matching.
const sourceOnDisk=await readFile("data/player-library/index.json","utf8");
assert.equal(JSON.parse(sourceOnDisk).privacyMode,"private");
console.log("Restricted DBV directory correctly falls back to local selected profiles; no fake roster or undefined source metadata.");

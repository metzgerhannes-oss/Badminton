import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {parseDbvReference,normalizeProfile,addProfileToStore,invitationUrl,STORE} from "../scripts/invitation.mjs";

assert.equal(STORE,"shuttleboard-v1","Legacy storage key must remain unchanged");
const playerId=parseDbvReference("05-070879");
assert.equal(playerId.valid,true);
assert.equal(playerId.id,"05-070879");
assert.equal(playerId.url,"");
const url=parseDbvReference("https://dbv.turnier.de/player-profile/A7CCCDAE-8A57-4D13-BB2A-5B6084671153");
assert.equal(url.valid,true);
assert.equal(url.id,"","Official profile UUID is NOT the numeric DBV ID");
assert.match(url.url,/^https:\/\/dbv\.turnier\.de\/player-profile\/A7CCCDAE/);
for(const raw of [
 "https://dbv.turnier.de/tournament/0477D9EC-DA56-4B16-938D-138CC817E8E2",
 "https://dbv.turnier.de/ranking/",
 "http://dbv.turnier.de/player-profile/A7CCCDAE-8A57-4D13-BB2A-5B6084671153",
 "https://evil.example/player-profile/A7CCCDAE-8A57-4D13-BB2A-5B6084671153",
 "https://dbv.turnier.de.evil.test/player-profile/A7CCCDAE-8A57-4D13-BB2A-5B6084671153",
 "https://dbv.turnier.de@evil.test/player-profile/A7CCCDAE-8A57-4D13-BB2A-5B6084671153",
 "05-12345"
]){
 assert.equal(parseDbvReference(raw).valid,false,"Untrusted reference accepted: "+raw);
}
assert.equal(invitationUrl("https://metzgerhannes-oss.github.io/Badminton/#einstellungen"),
 "https://metzgerhannes-oss.github.io/Badminton/welcome.html");
assert.equal(invitationUrl("https://metzgerhannes-oss.github.io/Badminton/index.html"),
 "https://metzgerhannes-oss.github.io/Badminton/welcome.html");

assert.throws(()=>normalizeProfile({mode:"dbv",name:"Test",reference:""}),/DBV/);
assert.throws(()=>normalizeProfile({mode:"manual",name:"  "}),/Spielernamen/);
assert.throws(()=>normalizeProfile({mode:"manual",name:"Test",birthYear:"2099"}),/Geburtsjahr/);
const fresh=normalizeProfile({mode:"dbv",name:"  Neue   Spielerin ",reference:"05-999999",birthYear:"2015",club:"SV Beispiel"});
assert.equal(fresh.id,"05-999999");
assert.equal(fresh.name,"Neue Spielerin");
assert.equal(fresh.birthYear,2015);
assert.equal(fresh.club,"SV Beispiel");
const added=addProfileToStore(null,fresh);
assert.equal(added.players.length,1,"Invited users must NOT receive Philipp/Charlotte as their own profiles");
assert.equal(added.activeProfileId,"05-999999");
assert.equal(added.historyProfilesInitialized,true);
assert.deepEqual(added.officialLinks,[]);

const existing={
 players:[{id:"05-070879",name:"Philipp",club:"SpVgg Mössingen"}],
 activeProfileId:"05-070879",chosen:"05-070879",
 friends:[{id:"05-123456",name:"Freund"}],
 officialLinks:[{id:"TID",playerId:"05-070879",name:"Vereinsturnier"}],
 historyProfilesInitialized:true,customSetting:"keep-this",
};
const further=addProfileToStore(existing,fresh);
assert.equal(further.players.length,2);
assert.equal(further.activeProfileId,"05-070879","Existing preferred profile must survive invitation");
assert.deepEqual(further.friends,existing.friends);
assert.deepEqual(further.officialLinks,existing.officialLinks);
assert.equal(further.customSetting,"keep-this");
assert.equal(existing.players.length,1,"Original stored object must not be modified");
assert.throws(()=>addProfileToStore(existing,{...fresh,id:"05-070879"}),/bereits/);
const direct=normalizeProfile({mode:"dbv",name:"Neu",reference:url.url});
assert.match(direct.id,/^local-/,"Do not misrepresent UUID as numeric DBV ID");
assert.equal(direct.url,url.url);

const welcome=await readFile("welcome.html","utf8");
const app=await readFile("index.html","utf8");
const sw=await readFile("sw.js","utf8");
const welcomeJs=await readFile("welcome.js","utf8");
assert.match(app,/id="invite-share"/);
assert.match(app,/id="invite-copy"/);
assert.match(app,/href="\.\/welcome\.html#installation"/);
assert.match(welcome,/id="welcome-form"/);
assert.match(welcome,/id="onboard-install"/);
assert.match(welcome,/Zu Home-Bildschirm hinzufügen/);
assert.match(welcome,/Zum Startbildschirm hinzufügen/);
assert.match(welcome,/name="name"/);
assert.match(welcomeJs,/addProfileToStore/);
assert.match(sw,/welcome\.html/);
assert.match(sw,/scripts\/invitation\.mjs/);
console.log("Invitation tests passed: shareable URL, DBV reference validation, fresh setup, existing-data preservation, guided install.");

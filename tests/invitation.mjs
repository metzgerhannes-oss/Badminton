import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {parseDbvReference,normalizeProfile,addProfileToStore,invitationUrl,STORE} from "../scripts/invitation.mjs";
import {invitationCandidates,searchInvitationPlayers} from "../scripts/invitation-search.mjs";

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

assert.match(welcome,/id="welcome-player-search"/);
assert.match(welcome,/id="welcome-search-results"/);
assert.match(welcome,/id="welcome-selection-save"/);
assert.match(welcome,/id="welcome-manual-panel"/);
assert.match(welcomeJs,/searchInvitationPlayers/);
assert.match(sw,/scripts\/invitation-search\.mjs/);
assert.match(sw,/scripts\/friend-search\.mjs/);
assert.match(sw,/scripts\/supabase-read\.mjs/);
assert.equal(invitationCandidates([
 {dbv_id:"05-061350",name:"Sarah Storz",birth_year:2010,club:"SpVgg Mössingen"},
 {dbv_id:"05-061350",name:"Duplicate Sarah"},
 {dbv_id:"invalid",name:"Wrong ID"}
]).length,1,"Search must deduplicate and reject unverified IDs");
const responses=(value)=>({ok:true,json:async()=>value,headers:{get:()=>null}});
const live=await searchInvitationPlayers("Sarah Storz",{
 fetchImpl:async (url,{method})=>{
  assert.equal(method,"GET");
  const parsed=new URL(url);
  assert.equal(parsed.pathname,"/rest/v1/players");
  assert.match(parsed.searchParams.get("or"),/Sarah Storz/);
  return responses([{dbv_id:"05-061350",name:"Sarah Storz",birth_year:2010,club:"SpVgg Mössingen"}]);
 }
});
assert.equal(live.source,"dbv");
assert.equal(live.players[0].id,"05-061350");
assert.equal(live.players[0].birthYear,2010);
const empty=await searchInvitationPlayers("S");
assert.deepEqual(empty,{players:[],source:"none"});
const backedUp=await searchInvitationPlayers("Storz",{
 fetchImpl:async (url)=>{
  const path=String(url);
  if(path.includes("/rest/v1/players"))throw Error("offline");
  if(path.endsWith("/index.json"))return responses({schemaVersion:1,ageGroups:[{age:"U17"}]});
  if(path.endsWith("/U17.json"))return responses({players:[{id:"05-061350",name:"Sarah Storz",birthYear:2010,club:"SpVgg Mössingen"}]});
  throw Error("Unexpected request: "+path);
 }
});
assert.equal(backedUp.source,"backup");
assert.equal(backedUp.players[0].id,"05-061350");
const aborted=new AbortController();
aborted.abort();
await assert.rejects(()=>searchInvitationPlayers("Sarah",{signal:aborted.signal,fetchImpl:async()=>{throw Error("No fetch on abort")}}));

console.log("Invitation tests passed: shareable URL, DBV reference validation, fresh setup, existing-data preservation, guided install.");

import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {parseDbvReference,normalizeProfile,addProfileToStore,invitationUrl,STORE} from "../scripts/invitation.mjs";
import {invitationCandidates,searchInvitationPlayers} from "../scripts/invitation-search.mjs";

assert.equal(STORE,"shuttleboard-v1","Legacy storage key must remain unchanged");
const playerId=parseDbvReference("05-900001");
assert.equal(playerId.valid,true);
assert.equal(playerId.id,"05-900001");
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
assert.equal(added.players.length,1,"Invited users must NOT receive Person/Person B as their own profiles");
assert.equal(added.activeProfileId,"05-999999");
assert.equal(added.historyProfilesInitialized,true);
assert.deepEqual(added.officialLinks,[]);

const existing={
 players:[{id:"05-900001",name:"Person",club:"SpVgg Mössingen"}],
 activeProfileId:"05-900001",chosen:"05-900001",
 friends:[{id:"05-123456",name:"Freund"}],
 officialLinks:[{id:"TID",playerId:"05-900001",name:"Vereinsturnier"}],
 historyProfilesInitialized:true,customSetting:"keep-this",
};
const further=addProfileToStore(existing,fresh);
assert.equal(further.players.length,2);
assert.equal(further.activeProfileId,"05-900001","Existing preferred profile must survive invitation");
assert.deepEqual(further.friends,existing.friends);
assert.deepEqual(further.officialLinks,existing.officialLinks);
assert.equal(further.customSetting,"keep-this");
assert.equal(existing.players.length,1,"Original stored object must not be modified");
assert.throws(()=>addProfileToStore(existing,{...fresh,id:"05-900001"}),/bereits/);
// A search result has a genuine DBV-ID. It must become the visible own profile
// even when an older local family profile was selected.
const selectedOwn=addProfileToStore(existing,fresh,{confirmed:true});
assert.equal(selectedOwn.activeProfileId,fresh.id);
assert.equal(selectedOwn.chosen,fresh.id);
assert.equal(selectedOwn.players.length,2);
assert.equal(selectedOwn.players.find(p=>p.id===fresh.id).name,fresh.name);
assert.equal(selectedOwn.friends.length,1);
assert.equal(existing.activeProfileId,"05-900001","Source state must be immutable");
// Exact confirmed DBV ID may be reselected, but a local first-name alias
// remains separate: name, club and age do not prove device ownership.
const knownWithAlias={
 players:[{id:"local-42",name:"Person",club:"SpVgg Mössingen"},
  {id:"05-900001",name:"Person Alpha",birthYear:2016,club:"SpVgg Mössingen",
   url:"https://dbv.turnier.de/player-profile/A7CCCDAE-8A57-4D13-BB2A-5B6084671153"},
  {id:"05-900002",name:"Person Beta"}],
 activeProfileId:"local-42",chosen:"local-42",
 friends:[{id:"05-900001",name:"Person Alpha"},{id:"05-900003",name:"Person C"}],
 officialLinks:[{id:"T1",playerId:"local-42",name:"Turnier 1",startDate:"2026-12-01"},
  {id:"T2",playerId:"05-900002",name:"Turnier 2"}],
 customSetting:"still-here"
};
const verified=normalizeProfile({mode:"dbv",reference:"05-900001",name:"Person Alpha",
 birthYear:"2016",club:"SpVgg Mössingen"});
const repaired=addProfileToStore(knownWithAlias,verified,{confirmed:true});
assert.deepEqual(repaired.players.map(p=>p.id),["local-42","05-900001","05-900002"]);
assert.equal(repaired.activeProfileId,"05-900001");
assert.equal(repaired.chosen,"05-900001");
assert.equal(repaired.officialLinks[0].playerId,"local-42","Keep old locally owned tournament separate");
assert.equal(repaired.officialLinks[1].playerId,"05-900002");
assert.equal(repaired.players[1].url,knownWithAlias.players[1].url,"Existing official link survives");
assert.deepEqual(repaired.friends.map(f=>f.id),["05-900003"]);
assert.equal(repaired.customSetting,"still-here");
assert.equal(knownWithAlias.players.length,3,"Must not mutate previous storage");
const localOnly={players:[{id:"local-1",name:"Person Alpha"}],
 officialLinks:[{id:"T3",playerId:"local-1",startDate:"2026-11-21"}]};
const replacedLocal=addProfileToStore(localOnly,verified,{confirmed:true});
assert.equal(replacedLocal.players.length,2);
assert.equal(replacedLocal.players[0].id,"local-1");
assert.equal(replacedLocal.players[1].id,"05-900001");
assert.equal(replacedLocal.officialLinks[0].playerId,"local-1");
assert.throws(()=>addProfileToStore(null,{id:"local-123",name:"Person"},{confirmed:true}),/DBV-ID/);
const differentBirth={players:[{id:"local-1",name:"Person",birthYear:2013},
 {id:"05-900001",name:"Person Alpha",birthYear:2016}]};
assert.equal(addProfileToStore(differentBirth,verified,{confirmed:true}).players.length,2,
 "Conflicting birth years must never be silently merged");
const ambiguous={players:[{id:"local-1",name:"Person"},
 {id:"local-2",name:"Person"}, {id:"05-900001",name:"Person Alpha"}]};
assert.equal(addProfileToStore(ambiguous,verified,{confirmed:true}).players.length,3,
 "Two same-name local profiles must not be guessed into one");

const sameFullName={players:[
 {id:"local-private",name:"Sina Beispiel",birthYear:2015,club:"Testverein"}],
 officialLinks:[{id:"Private-Turnier",playerId:"local-private"}],
 activeProfileId:"local-private",friends:[]};
const verifiedHomonym={id:"99-000002",name:"Sina Beispiel",birthYear:2015,club:"Testverein"};
const twoSinas=addProfileToStore(sameFullName,verifiedHomonym,{confirmed:true});
assert.deepEqual(twoSinas.players.map(p=>p.id),["local-private","99-000002"]);
assert.equal(twoSinas.officialLinks[0].playerId,"local-private","Never transfer third-party local favorites");
assert.equal(twoSinas.activeProfileId,"99-000002","New explicit selection may become active");
assert.equal(sameFullName.players.length,1,"Never mutate source owner store");

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
assert.doesNotMatch(welcome,/<section class="welcome-hero"/,"Invitation begins directly with setup, not a marketing hero");
assert.match(welcome,/id="progress-install"[^>]*>1\. Schritt App hinzufügen<\/span>/);
assert.match(welcome,/id="progress-profile"[^>]*>2\. Schritt Profil anlegen<\/span>/);
assert.match(welcomeJs,/shouldOfferInstallationFirst/);
assert.match(welcome,/<h2 id="setup-title">Für wen möchtest du ein Profil anlegen\?<\/h2>/,"Invitation headline must use natural German");
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
 {dbv_id:"05-900003",name:"Person Gamma",birth_year:2010,club:"SpVgg Mössingen"},
 {dbv_id:"05-900003",name:"Duplicate Person"},
 {dbv_id:"invalid",name:"Wrong ID"}
]).length,1,"Search must deduplicate and reject unverified IDs");
const previousWindow=globalThis.window;
// A guest cannot initiate a DBV search, even when a mock network exists.
let guestRequests=0;
await assert.deepEqual(await searchInvitationPlayers("Person Gamma",{
 fetchImpl:async()=>{guestRequests++;throw Error("Guest must not fetch");}
}),{players:[],source:"restricted"});
assert.equal(guestRequests,0);
globalThis.window={badmintonAppAccess:{allowed:true,
 getAccessToken:async()=>"synthetic-verified-member-token"}};
const responses=(value)=>({ok:true,json:async()=>value,headers:{get:()=>null}});
const live=await searchInvitationPlayers("Person Gamma",{
 fetchImpl:async (url,{method,body})=>{
  assert.equal(method,"POST");
  const parsed=new URL(url);
  assert.equal(parsed.pathname,"/rest/v1/rpc/search_dbv_player_identity");
  assert.equal(JSON.parse(body).p_query,"Person Gamma");
  return responses([{dbv_id:"05-900003",name:"Person Gamma",club:"SpVgg Mössingen",age_class:"U17"}]);
 }
});
assert.equal(live.source,"dbv");
assert.equal(live.players[0].id,"05-900003");
assert.equal(live.players[0].birthYear,undefined,"Member identity lookup must not return birth years");
const empty=await searchInvitationPlayers("S");
assert.deepEqual(empty,{players:[],source:"none"});
const backedUp=await searchInvitationPlayers("Gamma",{
 fetchImpl:async (url)=>{
  const path=String(url);
  if(path.includes("/rpc/search_dbv_player_identity"))throw Error("offline");
  if(path.endsWith("/index.json"))return responses({schemaVersion:1,ageGroups:[{age:"U17"}]});
  if(path.endsWith("/U17.json"))return responses({players:[{id:"05-900003",name:"Person Gamma",birthYear:2010,club:"SpVgg Mössingen"}]});
  throw Error("Unexpected request: "+path);
 }
});
assert.equal(backedUp.source,"backup");
assert.equal(backedUp.players[0].id,"05-900003");
const aborted=new AbortController();
aborted.abort();
await assert.rejects(()=>searchInvitationPlayers("Person C",{signal:aborted.signal,fetchImpl:async()=>{throw Error("No fetch on abort")}}));

if(previousWindow===undefined)delete globalThis.window;
else globalThis.window=previousWindow;
console.log("Invitation tests passed: shareable URL, DBV reference validation, fresh setup, existing-data preservation, guided install.");

import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {acceptedInvitationsFor,cleanImportedProfile,cleanImportedMatches,cleanImportedTrophies,loadImportedSnapshot,saveImportedSnapshot,deleteImportedSnapshot,IMPORT_SNAPSHOT_KEY} from "../scripts/player-data-import.mjs";

const player="01-111111";
const right="12345678-1234-1234-1234-123456789abc",foreign="87654321-4321-4321-4321-cba987654321";
const memory=new Map();
const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
storage.setItem("schmetterlinge.acceptedPlayerInvite.v3",JSON.stringify([right,foreign]));
storage.setItem("schmetterlinge.acceptedPlayerInviteBindings.v1",JSON.stringify({[right]:player,[foreign]:"01-222222"}));
assert.deepEqual(acceptedInvitationsFor(player,storage),[right]);
assert.deepEqual(acceptedInvitationsFor("01-222222",storage),[foreign]);
assert.deepEqual(acceptedInvitationsFor("local-1",storage),[]);
const profile=cleanImportedProfile({dbv_id:player,name:"Spielerin",club:"Verein",age_class:"U13",birth_year:2014},player);
assert.equal(profile.dbv_id,player);
assert.equal(cleanImportedProfile({dbv_id:"01-222222",name:"Fremd"},player),null);
const matches=cleanImportedMatches([{match_date:"2026-10-09",competition:"Turnier",discipline:"Einzel",games:[[21,9],[21,15]]},
 ...Array.from({length:40},()=>({match_date:"2026-10-08",competition:"Test"}))]);
assert.equal(matches.length,30);
const raw={player_dbv_id:player,results:[
 {id:"one",playerId:player,verified:true,date:"2026-09-21",place:1,source:{url:"https://dbv.turnier.de/1"}},
 {id:"two",playerId:player,verified:true,date:"2026-09-21",place:4,source:{url:"https://dbv.turnier.de/2"}},
 {id:"bad",playerId:player,verified:false,date:"2026-09-21",place:2,source:{url:"https://dbv.turnier.de/3"}},
 {id:"foreign",playerId:"01-222222",verified:true,date:"2026-09-21",place:1,source:{url:"https://dbv.turnier.de/4"}}
]};
const trophies=cleanImportedTrophies(raw,player);
assert.equal(trophies.length,2);
assert.equal(cleanImportedTrophies(raw,"01-222222"),null);
const now="2026-10-14T12:00:00.000Z";
assert.equal(saveImportedSnapshot(player,{profile,matches,trophies,fetchedAt:now},storage),true);
const saved=loadImportedSnapshot(player,storage);
assert.equal(saved.profile.name,"Spielerin");
assert.equal(saved.matches.length,30);
assert.equal(saved.trophies.length,2);
assert.equal(loadImportedSnapshot("01-222222",storage),null);
assert.doesNotMatch(storage.getItem(IMPORT_SNAPSHOT_KEY),/12345678-1234-1234-1234-123456789abc/,"Never store invitation ID in download");
assert.equal(saveImportedSnapshot(player,{profile,matches,trophies:null,fetchedAt:now},storage),true);
assert.equal(loadImportedSnapshot(player,storage).trophies,null,"V1 profile/matches never acquire trophy scope");
assert.equal(deleteImportedSnapshot(player,storage),true);
assert.equal(loadImportedSnapshot(player,storage),null);
const app=await readFile("app.js","utf8");
const welcome=await readFile("welcome.js","utf8");
const ui=await readFile("player-data-import.js","utf8");
const home=await readFile("scripts/private-trophy-source.mjs","utf8");
const index=await readFile("index.html","utf8");
const sw=await readFile("sw.js","utf8");
assert.match(app,/badminton:profile-selected/);
assert.match(welcome,/pendingProfileDataImport\.v1/);
assert.match(ui,/Daten jetzt abrufen/);
assert.match(ui,/getPrivateSession\(false\)/,"No automatic or mandatory account setup");
assert.match(ui,/badminton:profile-selected/);
assert.match(ui,/private_player_access_read/);
assert.match(ui,/private_player_trophies_read/);
assert.match(ui,/acceptedInvitationsFor\(target,localStorage\)/);
assert.match(ui,/saveImportedSnapshot/);
assert.match(ui,/Später/);
assert.match(home,/coverage:"device_snapshot"/);
assert.match(index,/player-data-import\.js/);
assert.match(sw,/scripts\/player-data-import\.mjs/);
assert.doesNotMatch(sw,/\.\/data\/history-with-names/);
console.log("Profile selection prompts consent-only, device-scoped one-way import; no implicit access or v1 scope expansion.");

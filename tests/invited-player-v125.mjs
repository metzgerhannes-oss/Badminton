import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {addAcceptedPlayerToLocalStore,invitationFollowCandidate} from "../scripts/invited-player-local.mjs";
import {searchInvitationPlayers} from "../scripts/invitation-search.mjs";

const person={dbv_id:"05-070879",name:"Philipp Metzger",club:"SpVgg Mössingen",birth_year:2016,age_class:"U13"};
const added=addAcceptedPlayerToLocalStore(null,person);
assert.deepEqual(added.players,undefined,"Accepted invitation must NOT create a self-owned player");
assert.equal(added.friends.length,1);
assert.deepEqual(added.friends[0],{id:"05-070879",name:"Philipp Metzger",club:"SpVgg Mössingen",birthYear:2016,url:""});
assert.equal(added.activeProfileId,undefined,"No owner/active profile assigned");
assert.equal(invitationFollowCandidate({dbv_id:"x",name:"Wrong"}),null);
assert.equal(addAcceptedPlayerToLocalStore(null,{dbv_id:"05-070879",name:""}),null);

const existing={players:[{id:"05-071969",name:"Charlotte"}],
 friends:[{id:"05-070879",name:"Old display",birthYear:2016,url:""}],
 activeProfileId:"05-071969",officialLinks:[{id:"T1",name:"Existing tournament"}],
 customSetting:"still stored"};
const merged=addAcceptedPlayerToLocalStore(existing,person);
assert.equal(merged.players.length,1,"Do not replace own profiles");
assert.equal(merged.players[0].name,"Charlotte");
assert.equal(merged.friends.length,1,"No duplicate followed players");
assert.equal(merged.friends[0].name,"Philipp Metzger");
assert.equal(merged.activeProfileId,existing.activeProfileId);
assert.deepEqual(merged.officialLinks,existing.officialLinks);
assert.equal(merged.customSetting,"still stored");
assert.equal(existing.friends[0].name,"Old display","Do not mutate prior state");
const ownsSame=addAcceptedPlayerToLocalStore({players:[{id:person.dbv_id,name:"Philipp"}],friends:[]},person);
assert.equal(ownsSame.friends.length,0,"Existing owned profile must not duplicate into following");

const local=await searchInvitationPlayers("Philipp",{savedCandidates:added.friends,fetchImpl:async()=>{throw Error("No network expected")}});
assert.equal(local.source,"device");
assert.equal(local.players[0].id,person.dbv_id);
const forbidden=await searchInvitationPlayers("Anderer Spieler",{fetchImpl:async(url)=>{
 if(String(url).includes("/rest/v1/players"))return {ok:false,status:403};
 throw Error("Blocked direct table read must not trigger GitHub name list fallback");
}});
assert.equal(forbidden.source,"restricted");
assert.deepEqual(forbidden.players,[]);
const ui=await readFile("app.js","utf8");
assert.match(ui,/if\(!state\.players\.length&&state\.friends\.length\)/);
assert.match(ui,/if\(!state\.players\.length&&!state\.friends\.length\)/);
const reader=await readFile("private-player-reader.js","utf8");
assert.match(reader,/addAcceptedPlayerToLocalStore/);
assert.ok(reader.indexOf('rpc("private_player_access_read"')<reader.indexOf("if(!show(data))"));
const sql=await readFile("database/private_invite_player_metadata_v125.sql","utf8");
assert.match(sql,/i\.accepted_by=auth\.uid\(\)/);
assert.match(sql,/g\.revoked_at is null/);
assert.match(sql,/'birth_year',p\.birth_year/);
assert.doesNotMatch(sql,/grant select|drop table|truncate/i);
console.log("v125 private invite: scoped metadata prefills followed player, privacy restrictions preserved.");

/** F03 isolated browser-source contract: v2 scoped invitation, v1 denial,
 * foreign-player rejection. Uses no live backend, credentials or personal data. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const player="99-000001",other="99-000002";
const invitation="11111111-2222-4333-8444-555555555555";
const source=(await readFile("scripts/private-trophy-source.mjs","utf8"))
 .replace(/^import .*;\r?\n/gm,"")
 .replace(/^export function /gm,"function ")
 +"\nglobalThis.__api={requestPrivateTrophies,trophySnapshot};";

function fixture({inviteResult}={}){
 const keys={
  "schmetterlinge.acceptedPlayerInvite.v3":JSON.stringify([invitation]),
  "schmetterlinge.acceptedPlayerInviteBindings.v1":JSON.stringify({[invitation]:player})
 };
 const requests=[];
 const ctx={
  SUPABASE_ROOT:"https://example.invalid/rest/v1/",
  PUBLIC_KEY:"synthetic",
  getPrivateSession:async()=>({access_token:"synthetic-only"}),
  loadPlayerCopy:()=>null,
  localStorage:{getItem:key=>keys[key]??null},
  window:{badmintonAppAccess:{allowed:false},dispatchEvent:()=>{}},
  CustomEvent:class{constructor(name,options){this.type=name;this.detail=options?.detail}},
  fetch:async(url,init)=>{
   const endpoint=String(url).split("/").at(-1);
   const body=JSON.parse(init.body);
   assert.ok(["private_owner_trophies_read","private_player_trophies_read"].includes(endpoint),
    "No direct table or global member archive request permitted: "+endpoint);
   requests.push({endpoint,body});
   if(endpoint==="private_player_trophies_read")
    assert.equal(body.p_invitation_id,invitation,"Only the accepted invitation may be used");
   return {ok:true,status:200,json:async()=>
    endpoint==="private_player_trophies_read"?inviteResult:null};
  },
  AbortController,setTimeout,clearTimeout,JSON,Date,Promise,Error
 };
 vm.runInNewContext(source,vm.createContext(ctx),{filename:"private-trophy-source.mjs"});
 return {api:ctx.__api,requests};
}
function trophy(playerId){
 return {player_dbv_id:playerId,scope:"player_invite_v2",results:[{
  id:"synthetic-placing",playerId,verified:true,place:3,date:"2026-10-03",
  source:{url:"https://example.invalid/evidence"}}]};
}
// A v2 server grant for a specific player yields only that player's proof.
{
 const {api,requests}=fixture({inviteResult:trophy(player)});
 await api.requestPrivateTrophies(player);
 assert.equal(api.trophySnapshot(player).state,"ready");
 assert.equal(api.trophySnapshot(player).results.length,1);
 await api.requestPrivateTrophies(other);
 assert.notEqual(api.trophySnapshot(other).state,"ready",
  "A followed/foreign player must not inherit the accepted player's grant");
 assert.equal(requests.filter(r=>r.endpoint==="private_player_trophies_read").length,1,
  "No invite-scoped RPC for an unbound player");
}
// Old v1 player-link: simulated server denial must not reveal v2 trophies.
{
 const {api}=fixture({inviteResult:null});
 await api.requestPrivateTrophies(player);
 assert.equal(api.trophySnapshot(player).state,"protected");
}
// Even a malformed/incorrectly scoped response cannot contaminate another player.
{
 const {api}=fixture({inviteResult:trophy(other)});
 await api.requestPrivateTrophies(player);
 assert.equal(api.trophySnapshot(player).state,"protected");
}
console.log("F03: scoped synthetic v2 grant, v1 denial, and foreign identity isolation passed.");

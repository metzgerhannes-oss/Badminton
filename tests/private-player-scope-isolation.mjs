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
// A wrong-player response is a server contract failure, not a genuine 403.
// It must remain invisible and report unavailable rather than fake denial/zero.
{
 const {api}=fixture({inviteResult:trophy(other)});
 await api.requestPrivateTrophies(player);
 assert.equal(api.trophySnapshot(player).state,"unavailable",
  "Cross-player payload must fail closed without pretending the grant was denied");
 assert.equal(api.trophySnapshot(player).results.length,0);
}
console.log("F03: scoped synthetic v2 grant, v1 denial, and foreign identity isolation passed.");


// F03 private match archive: exercise the real browser source, never a live RPC.
const matchSource=(await readFile("scripts/private-match-source.mjs","utf8"))
 .replace(/^import .*;\r?\n/gm,"")
 .replace(/^export function /gm,"function ")
 +"\nglobalThis.__matches={requestPrivateMatches,matchArchiveSnapshot,clearPrivateMatchArchive};";
const matchRow=(id)=>({
 dbv_id:id,source_key:"synthetic-match-001",
 source_url:"https://example.invalid/match/001",match_date:"2026-10-02",
 player_side:1,winning_side:2,games:[],opponent_names:[]
});
const matchPage=(id)=>({
 dbv_id:id,kind:"match_card",scope_version:2,total:1,offset:0,
 entries:[matchRow(id)]
});
const matchOk=(id)=>({ok:true,status:200,json:async()=>matchPage(id)});
const matchDenied={ok:false,status:403,json:async()=>({message:"not_authorized"})};
const nextTick=()=>new Promise(resolve=>setImmediate(resolve));

function matchFixture({fetchImpl=async()=>matchOk(player),getSession=async()=>({access_token:"synthetic"})}={}){
 const keys={
  "schmetterlinge.acceptedPlayerInvite.v3":JSON.stringify([invitation]),
  "schmetterlinge.acceptedPlayerInviteBindings.v1":JSON.stringify({[invitation]:player})
 };
 const requests=[];
 const ctx={
  SUPABASE_ROOT:"https://example.invalid/rest/v1/",PUBLIC_KEY:"synthetic",
  getPrivateSession:getSession,loadPlayerCopy:()=>null,
  readPublicRows:async()=>{throw Error("guest cannot read direct REST tables")},
  localStorage:{getItem:key=>keys[key]??null},
  window:{badmintonAppAccess:{allowed:false},dispatchEvent:()=>{}},
  CustomEvent:class{constructor(name,options){this.type=name;this.detail=options?.detail}},
  fetch:async(url,init)=>{
   const endpoint=String(url).split("/").at(-1);
   assert.equal(endpoint,"private_player_archive_read","guest must use only scoped archive RPC");
   const body=JSON.parse(init.body);
   assert.equal(body.p_invitation_id,invitation,"guest may use only accepted link");
   assert.equal(body.p_kind,"match_card");
   requests.push({endpoint,body,authorization:init.headers.Authorization});
   return fetchImpl(url,init);
  },
  AbortController,setTimeout,clearTimeout,JSON,Date,Promise,Error
 };
 vm.runInNewContext(matchSource,vm.createContext(ctx),{filename:"private-match-source.mjs"});
 return {api:ctx.__matches,requests,keys};
}

// Accepted v2 guest receives only a verified match page for its bound player.
{
 const {api,requests}=matchFixture();
 await api.requestPrivateMatches(player);
 assert.equal(api.matchArchiveSnapshot(player).state,"ready");
 assert.equal(api.matchArchiveSnapshot(player).rows.length,1);
 await api.requestPrivateMatches(other);
 assert.equal(api.matchArchiveSnapshot(other).state,"protected");
 assert.equal(requests.length,1,"foreign DBV ID cannot reuse a player's accepted link");
}

// v1, expired or revoked v2: simulated server 403 is never shown as zero matches.
{
 const {api}=matchFixture({fetchImpl:async()=>matchDenied});
 await api.requestPrivateMatches(player);
 assert.equal(api.matchArchiveSnapshot(player).state,"protected");
}

// A malformed server page belonging to a different player cannot leak match rows.
{
 const {api}=matchFixture({fetchImpl:async()=>matchOk(other)});
 await api.requestPrivateMatches(player);
 assert.equal(api.matchArchiveSnapshot(player).state,"unavailable");
 assert.equal(api.matchArchiveSnapshot(player).rows.length,0);
}

// S-01 #199/#227: a valid page envelope must not hide an invalid match row.
// Reject the whole page as unavailable, never present a falsely empty archive.
for(const badRow of [
 {...matchRow(other),source_key:"synthetic-foreign-row"},
 {...matchRow(player),source_url:"http://example.invalid/unsafe-match"},
 {...matchRow(player),winning_side:null}
]){
 const {api}=matchFixture({fetchImpl:async()=>({
  ok:true,status:200,json:async()=>({...matchPage(player),entries:[badRow]})
 })});
 await api.requestPrivateMatches(player);
 assert.equal(api.matchArchiveSnapshot(player).state,"unavailable",
  "Invalid row inside an otherwise valid response must not become ready");
 assert.equal(api.matchArchiveSnapshot(player).rows.length,0);
}

// Seven currently stored sourced cards have a documented year but no exact
// match date. Preserve the evidence without inventing a day or silently
// dropping the card. A missing year as well must still fail closed.
{
 const undated={...matchRow(player),match_date:null,match_year:2026};
 const {api}=matchFixture({fetchImpl:async()=>({
  ok:true,status:200,json:async()=>({...matchPage(player),entries:[undated]})
 })});
 await api.requestPrivateMatches(player);
 assert.equal(api.matchArchiveSnapshot(player).state,"ready");
 assert.equal(api.matchArchiveSnapshot(player).rows.length,1);
 assert.equal(api.matchArchiveSnapshot(player).rows[0].match_date,null);
}
{
 const undatedUnverified={...matchRow(player),match_date:null,match_year:null};
 const {api}=matchFixture({fetchImpl:async()=>({
  ok:true,status:200,json:async()=>({...matchPage(player),entries:[undatedUnverified]})
 })});
 await api.requestPrivateMatches(player);
 assert.equal(api.matchArchiveSnapshot(player).state,"unavailable");
}

// Revocation and session switch: a late old-session success cannot override 403.
{
 let resolveOld,call=0,session="old-synthetic";
 const {api,requests}=matchFixture({
  getSession:async()=>({access_token:session}),
  fetchImpl:()=>{
   call++;
   return call===1?new Promise(resolve=>{resolveOld=resolve;}):Promise.resolve(matchDenied);
  }
 });
 const old=api.requestPrivateMatches(player);
 await nextTick();
 assert.equal(call,1);
 api.clearPrivateMatchArchive({refresh:false});
 session="new-synthetic";
 await api.requestPrivateMatches(player);
 assert.equal(api.matchArchiveSnapshot(player).state,"protected");
 assert.equal(requests[0].authorization,"Bearer old-synthetic");
 assert.equal(requests[1].authorization,"Bearer new-synthetic");
 resolveOld(matchOk(player));
 await old;
 assert.equal(api.matchArchiveSnapshot(player).state,"protected",
  "late old-session success must never restore revoked matches");
}

// Pagehide/revoke while session is pending must not trigger any private RPC.
{
 let resolveSession,requests=0;
 const {api}=matchFixture({
  getSession:()=>new Promise(resolve=>{resolveSession=resolve;}),
  fetchImpl:async()=>{requests++;return matchOk(player);}
 });
 const pending=api.requestPrivateMatches(player);
 api.clearPrivateMatchArchive({refresh:false});
 resolveSession({access_token:"stale-synthetic"});
 await pending;
 assert.equal(requests,0);
 assert.notEqual(api.matchArchiveSnapshot(player).state,"ready");
}
console.log("F03: match archive v2/v1, foreign IDs, revoke and session-switch isolation passed.");


// #327/F03 static guard: public identity search remains a small, deliberate
// lookup, never an anonymous SELECT on the full player or result tables.
// This cannot prove a server-side rate limit or production RPC deployment.
{
 const searchSql=await readFile("database/targeted_dbv_identity_search_v133.sql","utf8");
 const trophySql=await readFile("database/private_rpc_invoker_hardening_v127_1.sql","utf8");
 assert.match(searchSql,/SECURITY DEFINER/);
 assert.match(searchSql,/SET search_path = ''/);
 assert.match(searchSql,/\{3,70\}/,"server rejects queries shorter than three characters");
 assert.match(searchSql,/LIMIT 12/,"server limits each result set");
 assert.match(searchSql,/RETURNS TABLE\(dbv_id text, name text, club text, age_class text, association text\)/);
 assert.match(searchSql,/GRANT EXECUTE ON FUNCTION public\.search_dbv_player_identity\(text,text,text,text\)/);
 assert.doesNotMatch(searchSql,/GRANT SELECT ON public\.(players|player_external_match_facts)/i);
 assert.match(trophySql,/i\.accepted_by=auth\.uid\(\)/);
 assert.match(trophySql,/i\.scope_version=2/);
 assert.match(trophySql,/i\.granted_sections@>ARRAY\['trophies'\]::text\[\]/);
 assert.match(trophySql,/i\.revoked_at IS NULL/);
}
console.log("F03: checked-in DBV lookup and v2 trophy scope invariants passed; production quota unverified.");

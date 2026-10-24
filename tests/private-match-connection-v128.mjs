import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
const [sql,bridge,home,history,sw]=await Promise.all([
 "database/auto_archived_player_evidence_v128.sql",
 "scripts/private-match-source.mjs","stats.js","external-matches.js","sw.js"
].map(f=>readFile(f,"utf8")));
assert.match(sql,/has_independent_player_grant\(i\.owner_user_id,i\.player_dbv_id\)/);
assert.match(sql,/has_independent_player_grant\(auth\.uid\(\),p\.dbv_id\)/);
assert.match(sql,/i\.accepted_by=auth\.uid\(\)/);
assert.match(sql,/i\.scope_version=2/);
assert.match(sql,/i\.revoked_at is null/);
assert.match(sql,/i\.granted_sections @> ARRAY\['profile','trophies','matches'\]/);
assert.match(sql,/grant execute on function public\.private_player_owner_archive_read/);
assert.match(sql,/revoke all on function public\.private_player_owner_archive_read/);
assert.doesNotMatch(sql,/grant select on/i);
assert.match(bridge,/getPrivateSession\(false\)/);
assert.match(bridge,/acceptedPlayerInviteBindings\.v1/);
assert.match(bridge,/cache:"no-store"/);
assert.doesNotMatch(bridge,/localStorage\.setItem|sessionStorage\.setItem|caches\.open/);
assert.match(bridge,/private_player_owner_archive_read/);
assert.match(bridge,/private_player_archive_read/);
assert.match(bridge,/badminton:profile-change/);
assert.match(bridge,/badminton:private-player-revoked/);
assert.match(home,/matchArchiveSnapshot/);
assert.match(history,/matchArchiveSnapshot/);
assert.match(sw,/scripts\/private-match-source\.mjs/);
console.log("Private archive sync authorization, cache and integration checks passed.");

// F05 regression: two independently authorized family profiles can load at
// once. Starting the second must not invalidate the first or strand it in a
// permanent loading state. All requests are synthetic example.invalid RPCs.
const source=bridge.replace(/^import .*;\\r?\\n/gm,"")
 .replace(/^export function /gm,"function ")
 +"\\nglobalThis.__privateMatchFixture={requestPrivateMatches,matchArchiveSnapshot,clearPrivateMatchArchive};";
const playerA="99-000001",playerB="99-000002";
const inviteA="11111111-2222-4333-8444-555555555555";
const inviteB="22222222-3333-4444-8555-666666666666";
const bindings={[inviteA]:playerA,[inviteB]:playerB};
const storage={
 "schmetterlinge.acceptedPlayerInvite.v3":JSON.stringify([inviteA,inviteB]),
 "schmetterlinge.acceptedPlayerInviteBindings.v1":JSON.stringify(bindings),
 "shuttleboard-v1":JSON.stringify({players:[]})
};
const deferred=new Map(),requests=[];
const context={SUPABASE_ROOT:"https://example.invalid/rest/v1/",PUBLIC_KEY:"fixture",
 getPrivateSession:async()=>({access_token:"synthetic"}),loadPlayerCopy:()=>null,
 localStorage:{getItem:key=>storage[key]??null},
 window:{badmintonAppAccess:{allowed:false},dispatchEvent:()=>{}},
 CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail;}},
 fetch:async(url,options)=>{
  assert.match(url,/^https:\\/\\/example\\.invalid\\/rest\\/v1\\/rpc\\/private_player_archive_read$/);
  const args=JSON.parse(options.body);
  assert.equal(args.p_offset,0);
  requests.push(args.p_invitation_id);
  return new Promise(resolve=>deferred.set(args.p_invitation_id,resolve));
 },
 AbortController,URLSearchParams,JSON,Date,Error,Promise,setTimeout,clearTimeout};
vm.runInNewContext(source,vm.createContext(context),{filename:"private-match-source.mjs"});
const api=context.__privateMatchFixture;
const response=(id,count=1)=>({ok:true,status:200,json:async()=>({
 dbv_id:id,kind:"match_card",scope_version:2,offset:0,total:count,
 entries:Array.from({length:Math.min(count,100)},(_,i)=>({
  dbv_id:id,source_key:"tournament:synthetic:"+i,
  source_url:"https://example.invalid/match",match_date:"2026-10-01",
  player_side:1,winning_side:1,games:[[21,10],[21,12]],opponent_names:["Testgegner"]
 }))
})});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const first=api.requestPrivateMatches(playerA);
const second=api.requestPrivateMatches(playerB);
await tick();
assert.deepEqual([...deferred.keys()].sort(),[inviteA,inviteB].sort(),
 "Both independently authorized players must issue their own scoped RPC");
deferred.get(inviteB)(response(playerB));
deferred.get(inviteA)(response(playerA));
await Promise.all([first,second]);
for(const id of [playerA,playerB]){
 assert.equal(api.matchArchiveSnapshot(id).state,"ready",
  "Another player loading must not strand this player's archive");
 assert.equal(api.matchArchiveSnapshot(id).rows.length,1);
}
// Revocation while a multi-page response is pending must not continue reading
// later pages or repopulate stale results, even with a valid old session.
deferred.clear();
const late=api.requestPrivateMatches(playerA,{force:true});
await tick();
assert.equal(deferred.size,1);
api.clearPrivateMatchArchive({refresh:false});
deferred.get(inviteA)(response(playerA,101));
await late;
assert.equal(requests.length,3,"No second-page RPC after invalidation");
assert.notEqual(api.matchArchiveSnapshot(playerA).state,"ready",
 "Revoked pending result cannot restore the private archive");
console.log("F05 private match archive: concurrent profiles and revoke-safe pagination.");

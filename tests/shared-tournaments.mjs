import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
 sharedTournamentQuery,normalizeSharedTournaments,readSharedTournaments
} from "../scripts/shared-tournaments.mjs";

const dbv="05-070879",other="05-071969";
const uuid="e24dc6ee-152a-454d-b00c-e625b751d7d5";
assert.equal(sharedTournamentQuery([]),"");
assert.equal(sharedTournamentQuery(["no-match", "05-1234"]),"");
const path=sharedTournamentQuery([dbv,dbv,other,"other"]);
const q=new URL("https://test.invalid/rest/v1/"+path).searchParams;
assert.equal(q.get("dbv_player_id"),"in.("+dbv+","+other+")");
assert.equal(q.get("limit"),"150");
assert.ok(!path.includes("shuttleboard-v1"));
const rows=normalizeSharedTournaments([
 {dbv_player_id:dbv,tournament_id:uuid,title:"     Herbstturnier ",start_date:"2026-11-05",end_date:"2026-11-06"},
 {dbv_player_id:dbv,tournament_id:uuid,title:"Duplikat",start_date:null},
 {dbv_player_id:other,tournament_id:uuid,title:"Für Charlotte",start_date:"2026-12-11"},
 {dbv_player_id:"05-000001",tournament_id:uuid,title:"Fremde ID"},
 {dbv_player_id:dbv,tournament_id:"malicious",title:"Kaputter Link"},
 {dbv_player_id:dbv,tournament_id:"../../evil",title:"Pfadangriff"}
],[dbv,other]);
assert.equal(rows.length,2);
assert.equal(rows[0].playerId,dbv);
assert.equal(rows[0].title,"Herbstturnier");
assert.equal(rows[0].startDate,"2026-11-05");
assert.equal(rows[0].officialUrl,
 "https://dbv.turnier.de/tournament/E24DC6EE-152A-454D-B00C-E625B751D7D5");
let attempts=0;
const mock=await readSharedTournaments([dbv],{fetchImpl:async (url,init)=>{
 attempts++;
 const parsed=new URL(url);
 assert.equal(parsed.pathname,"/rest/v1/shared_player_tournaments");
 assert.equal(init.method,"GET");
 assert.equal(init.headers.apikey.startsWith("sb_publishable_"),true);
 return {ok:true,headers:{get:()=>null},json:async()=>[
  {dbv_player_id:dbv,tournament_id:uuid,title:"Herbstturnier",start_date:"2026-11-05"}
 ]};
}});
assert.equal(attempts,1);
assert.equal(mock.available,true);
assert.equal(mock.rows[0].playerId,dbv);
const unavailable=await readSharedTournaments([dbv],{
 fetchImpl:async()=>({ok:false,status:404})
});
assert.equal(unavailable.available,false);
assert.deepEqual(unavailable.rows,[],"A missing migration must not invent events");
const cancelled=new AbortController();cancelled.abort();
await assert.rejects(()=>readSharedTournaments([dbv],{
 signal:cancelled.signal,fetchImpl:async()=>{throw Error("must not fetch")}
}));
const sql=await readFile("database/shared-player-tournaments-v87.sql","utf8");
assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
assert.match(sql,/REVOKE ALL ON TABLE public.shared_player_tournaments FROM PUBLIC, anon, authenticated/);
assert.match(sql,/GRANT SELECT ON TABLE public.shared_player_tournaments TO anon, authenticated/);
assert.doesNotMatch(sql,/GRANT (?:INSERT|UPDATE|DELETE)[^;]+ TO anon/);
assert.match(sql,/auth\.uid\(\)/);
assert.match(sql,/dbv_player_sharing_claims/);
assert.match(sql,/verified_at IS NOT NULL/);
assert.match(sql,/unpublish_on_claim_revoke/);
const sw=await readFile("sw.js","utf8");
assert.match(sw,/scripts\/shared-tournaments\.mjs/);
console.log("Secure tournament sharing: bounded followed-player lookup, official URLs only, dedup, RLS contract and graceful 404.");

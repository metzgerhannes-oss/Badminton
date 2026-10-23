import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

// Execute the real isolated RPC helper with a synthetic fetch. No live requests,
// secrets, Supabase endpoints, user records or Playwright production access.
const specs=[
 {path:"scripts/private-match-source.mjs",pattern:/async function rpc\(session,name,args\)\{[\s\S]*?\n\}/,
  args:[{access_token:"fixture-token"},"synthetic_read",{p_player_dbv_id:"99-000001"}]},
 {path:"scripts/private-trophy-source.mjs",pattern:/async function rpc\(name,args,session\)\{[\s\S]*?\n\}/,
  args:["synthetic_read",{p_player_dbv_id:"99-000001"},{access_token:"fixture-token"}]}
];
for(const spec of specs){
 const source=await readFile(spec.path,"utf8");
 const snippet=source.match(spec.pattern)?.[0];
 assert.ok(snippet,"Real private RPC helper found: "+spec.path);
 for(const status of [200,400,401,403,404,429,500,503]){
  let calls=0;
  const sandbox={
   SUPABASE_ROOT:"https://example.invalid/rest/v1/",PUBLIC_KEY:"synthetic",
   AbortController,JSON,Error,setTimeout,clearTimeout,
   fetch:async(url,opts)=>{
    calls++;
    assert.match(url,/example\.invalid\/rest\/v1\/rpc\/synthetic_read$/);
    assert.equal(opts.method,"POST");
    assert.equal(opts.cache,"no-store");
    assert.equal(opts.headers.Authorization,"Bearer fixture-token");
    return {ok:status===200,status,
     json:async()=>({dbv_id:"99-000001",entries:[],results:[]})};
   }
  };
  const rpc=vm.runInNewContext("("+snippet+")",sandbox);
  if(status===200){
   const result=await rpc(...spec.args);
   assert.equal(result.dbv_id,"99-000001");
  }else if(status===401||status===403){
   assert.equal(await rpc(...spec.args),null,
    "Only genuine auth denials may produce protected state");
  }else{
   await assert.rejects(()=>rpc(...spec.args),/archive read temporarily unavailable|service unavailable|private trophy endpoint not installed/,
    "Bad request, missing endpoint, quota or server errors must not masquerade as empty results");
  }
  assert.equal(calls,1,"One bounded synthetic RPC call");
 }
}
console.log("F03 private RPC errors: 400/404/429/5xx unavailable; 401/403 denied; 200 parsed.");

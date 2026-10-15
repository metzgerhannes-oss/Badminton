/** GitHub OIDC writer: no stored Supabase secrets, no raw rows in Actions logs.
 * Allowed only from main's signed, regularly scheduled source scan. */
const AUD="schmetterlinge-fresh-results-yadexibmjmnjfmfabrug";
const ENDPOINT="https://yadexibmjmnjfmfabrug.supabase.co/functions/v1/spvgg-match-rebuild";
export async function stageFreshResults(rows,health,env=process.env){
 if(env.GITHUB_REPOSITORY!=="metzgerhannes-oss/Badminton"||
    env.GITHUB_REF!=="refs/heads/main"||
    !["push","workflow_dispatch","schedule"].includes(env.GITHUB_EVENT_NAME)||
    !/^\d{8,20}$/.test(env.GITHUB_RUN_ID||""))throw Error("Main workflow only");
 const endpoint=env.ACTIONS_ID_TOKEN_REQUEST_URL,token=env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
 if(!endpoint?.startsWith("https://")||!token)throw Error("Missing ephemeral GitHub OIDC identity");
 const req=new URL(endpoint);req.searchParams.set("audience",AUD);
 const response=await fetch(req,{headers:{Authorization:"bearer "+token,Accept:"application/json"},
  signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error("GitHub OIDC identity unavailable");
 const jwt=(await response.json()).value;
 if(typeof jwt!=="string"||jwt.length<200||jwt.length>10000)throw Error("Invalid OIDC token");
 let sent=0;
 const chunks=[];
 for(let i=0;i<rows.length;i+=60)chunks.push(rows.slice(i,i+60));
 for(const [index,chunk] of chunks.entries()){
  const post=await fetch(ENDPOINT,{
   method:"POST",headers:{Authorization:"Bearer "+jwt,"Content-Type":"application/json"},
   body:JSON.stringify({run:"run-"+env.GITHUB_RUN_ID,rows:chunk}),
   signal:AbortSignal.timeout(22000)
  });
  if(!post.ok)throw Error("Staging upload HTTP "+post.status+" batch "+(index+1));
  const ack=await post.json();
  if(ack.ok!==true||ack.staged!==chunk.length)throw Error("Staging acknowledgement mismatch");
  sent+=chunk.length;
 }
 if(!health||!Number.isInteger(health.sources_ok)||!Number.isInteger(health.sources_missing))
  throw Error("Missing source-coverage summary");
 const finalize=await fetch(ENDPOINT,{
  method:"POST",headers:{Authorization:"Bearer "+jwt,"Content-Type":"application/json"},
  body:JSON.stringify({mode:"reconcile",run:"run-"+env.GITHUB_RUN_ID,expected_count:rows.length,
   sources_ok:health.sources_ok,sources_missing:health.sources_missing}),
  signal:AbortSignal.timeout(25000)
 });
 if(!finalize.ok)throw Error("P0 coverage reconciliation rejected HTTP "+finalize.status);
 const checked=await finalize.json();
 if(checked.ok!==true||checked.source_rows!==rows.length)
  throw Error("P0 reconciliation acknowledgement mismatch");
 return {sent,chunks:chunks.length,run:"run-"+env.GITHUB_RUN_ID,
  new_matches:checked.new_matches,quarantined:checked.quarantined,
  sources_ok:checked.sources_ok,sources_missing:checked.sources_missing};
}

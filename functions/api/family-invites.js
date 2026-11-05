/** P1 #442: protected family email invitations. No secrets in the browser.
 * Cloudflare Access JWT is independently checked by the existing signed bootstrap.
 * Only the verified Supabase site owner can issue or revoke invitations.
 */
const SITE="https://schmetterlinge-familie.pages.dev";
const SB="https://yadexibmjmnjfmfabrug.supabase.co";
const KEY="sb_publishable_WdNC1AoOLe4rqDomSVnxWw_wq64M5kE";
const POLICY="https://api.cloudflare.com/client/v4/accounts/efcfb2621fe1284f971d9d5e3dc300db/access/apps/469ad52f-a995-475f-a0de-345caa0e4b07/policies/15583893-e472-4d0b-875e-e32c3b3874b1";
const EMAIL=/^[^\s@<>]{1,64}@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 "Content-Type":"application/json","Cache-Control":"no-store",
 "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}});
const normalise=s=>String(s||"").trim().toLowerCase();
async function postJson(fetcher,url,body,headers){
 const response=await fetcher(url,{method:"POST",cache:"no-store",
  headers:{"Content-Type":"application/json",...headers},body:JSON.stringify(body),
  signal:AbortSignal.timeout(12000)});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error("upstream_http_"+response.status);
 return data;
}
async function authenticate(request,fetcher){
 const jwt=request.headers.get("Authorization")||"";
 const assertion=request.headers.get("Cf-Access-Jwt-Assertion")||"";
 if(!/^Bearer\s+[A-Za-z0-9._-]+$/.test(jwt)||!assertion)return false;
 const bootstrap=await postJson(fetcher,SB+"/functions/v1/cf-access-bootstrap",{},
  {Authorization:jwt,apikey:KEY,"X-Cloudflare-Access-Assertion":assertion});
 if(bootstrap?.allowed!==true)return false;
 const owner=await postJson(fetcher,SB+"/rest/v1/rpc/app_access_status",{},
  {Authorization:jwt,apikey:KEY});
 return owner?.owner===true;
}
function policyHeaders(env){return {"Authorization":"Bearer "+env.CF_ACCESS_API_TOKEN,"Accept":"application/json"};}
async function readPolicy(env,fetcher){
 const response=await fetcher(POLICY,{method:"GET",headers:policyHeaders(env),
  signal:AbortSignal.timeout(10000),cache:"no-store"});
 const d=await response.json().catch(()=>null);
 if(!response.ok||d?.success!==true)
  throw Error([401,403].includes(response.status)?"cloudflare_read_denied":"cloudflare_read_failed");
 const p=d.result;
 if(p?.decision!=="allow"||!Array.isArray(p?.include)||!p.include.length||
    p.include.some(rule=>typeof rule?.email?.email!=="string"))
  throw Error("unsafe_access_policy");
 return p;
}
async function writePolicy(env,fetcher,policy,emails){
 const unique=[...new Set(emails.map(normalise))];
 if(!unique.length||unique.length>190)throw Error("invalid_allowlist");
 const body={name:policy.name,decision:"allow",precedence:policy.precedence,
  include:unique.map(email=>({email:{email}})),
  require:policy.require||[],exclude:policy.exclude||[]};
 const response=await fetcher(POLICY,{method:"PUT",headers:{
  ...policyHeaders(env),"Content-Type":"application/json"},
  body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
 const data=await response.json().catch(()=>null);
 if(!response.ok||data?.success!==true)
  throw Error([401,403].includes(response.status)?"cloudflare_update_denied":"cloudflare_update_failed");
}
async function manageEmail(fetcher,jwt,email,action){
 const status=await postJson(fetcher,SB+"/rest/v1/rpc/cf_access_email_invite_manage",
  {p_email:email,p_action:action},{Authorization:jwt,apikey:KEY});
 if(typeof status!=="string")throw Error("database_unavailable");
 return status;
}
export async function onRequestPost({request,env={},fetcher=fetch}){
 const url=new URL(request.url);
 if(url.origin!==SITE||url.pathname!=="/api/family-invites"||
    request.headers.get("Origin")&&request.headers.get("Origin")!==SITE)
  return respond({error:"access_denied"},403);
 if(Number(request.headers.get("Content-Length")||0)>2048)
  return respond({error:"invalid_request"},400);
 let input;
 try{const raw=await request.text();if(raw.length>2048)throw Error("too large");input=JSON.parse(raw);}
 catch{return respond({error:"invalid_request"},400);}
 const action=input?.action;
 if(!["status","invite","revoke"].includes(action))
  return respond({error:"invalid_request"},400);
 try{
  if(!await authenticate(request,fetcher))return respond({error:"access_denied"},403);
 }catch{return respond({error:"access_denied"},403);}
 const ready=Boolean(env.CF_ACCESS_API_TOKEN);
 if(action==="status")return respond({ready});
 if(!ready)
  return respond({error:"cloudflare_not_configured"},503);
 const email=normalise(input.email);
 if(!EMAIL.test(email)||email.length>254)return respond({error:"invalid_email"},400);
 const jwt=request.headers.get("Authorization");
 let policy,changedCloudflare=false,managedResult="";
 try{
  if(action==="invite"){
   // Check the independent Supabase allowlist first. Original family addresses
   // are already approved by Access AND Supabase. Re-fetching the Cloudflare
   // policy for them was an unnecessary failure point on every invitation.
   managedResult=await manageEmail(fetcher,jwt,email,"enable");
   if(managedResult==="rate_limited")throw Error("rate_limited");
   if(managedResult==="invalid_email")throw Error("invalid_email");
   if(!["new","existing","baseline"].includes(managedResult))throw Error("database_unavailable");
   if(managedResult==="baseline"||managedResult==="existing")
    return respond({prepared:true,url:SITE+"/"});
   // Only a genuinely NEW address requires a Cloudflare Access policy change.
   policy=await readPolicy(env,fetcher);
   const current=policy.include.map(x=>normalise(x.email.email));
   if(!current.includes(email)){
    await writePolicy(env,fetcher,policy,[...current,email]);
    changedCloudflare=true;
   }
   return respond({prepared:true,url:SITE+"/"});
  }
  // Revoke data membership before the outer Access policy, fail closed even
  // when Cloudflare is temporarily unreachable.
  managedResult=await manageEmail(fetcher,jwt,email,"disable");
  if(managedResult==="unmanaged")return respond({error:"not_managed"},403);
  if(managedResult!=="revoked")throw Error("database_unavailable");
  policy=await readPolicy(env,fetcher);
  const current=policy.include.map(x=>normalise(x.email.email));
  if(current.includes(email))
   await writePolicy(env,fetcher,policy,current.filter(x=>x!==email));
  return respond({revoked:true});
 }catch(error){
  if(action==="invite"&&managedResult==="new"){
   // New grants that could not be applied on both systems must not linger.
   try{await manageEmail(fetcher,jwt,email,"disable");}
   catch{/* admin reconciliation needed; do not report success */}
   if(changedCloudflare){
    try{
     const latest=await readPolicy(env,fetcher);
     await writePolicy(env,fetcher,latest,
      latest.include.map(x=>normalise(x.email.email)).filter(x=>x!==email));
    }catch{/* do not hide the original error */}
   }
  }
  const reason=String(error?.message||"");
  const safeErrors=new Set(["cloudflare_read_denied","cloudflare_read_failed",
   "cloudflare_update_denied","cloudflare_update_failed","unsafe_access_policy",
   "rate_limited","invalid_email","database_unavailable"]);
  return respond({error:safeErrors.has(reason)?reason:
    reason.startsWith("upstream_http_")?"supabase_invite_unavailable":"service_unavailable"},
    reason==="rate_limited"?429:reason==="invalid_email"?400:503);
 }

}

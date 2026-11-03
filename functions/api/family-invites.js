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
 if(!response.ok)throw Error("upstream_rejected");
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
 if(!response.ok||d?.success!==true)throw Error("cloudflare_unavailable");
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
 if(!response.ok||data?.success!==true)throw Error("cloudflare_update_failed");
}
async function manageEmail(fetcher,jwt,email,action){
 const status=await postJson(fetcher,SB+"/rest/v1/rpc/cf_access_email_invite_manage",
  {p_email:email,p_action:action},{Authorization:jwt,apikey:KEY});
 if(typeof status!=="string")throw Error("database_unavailable");
 return status;
}
async function sendMail(env,fetcher,email){
 // Mailjet Free: verified sender address (domain is recommended, not required).
 // No recipient list is stored by this function; each invitation is transactional.
 const auth=btoa(env.MAILJET_API_KEY+":"+env.MAILJET_SECRET_KEY);
 const response=await fetcher("https://api.mailjet.com/v3.1/send",{
  method:"POST",headers:{"Authorization":"Basic "+auth,
   "Content-Type":"application/json"},
  body:JSON.stringify({Messages:[{
   From:{Email:env.MAILJET_SENDER_EMAIL,Name:"Schmetterlinge"},
   To:[{Email:email}],Subject:"Einladung zu Schmetterlinge",
   TextPart:"Du wurdest zur privaten Badminton-App Schmetterlinge eingeladen.\\n\\n"+
    "Öffne diesen Link: "+SITE+"/\\n\\n"+
    "Melde dich bei Cloudflare Access mit genau dieser E-Mail-Adresse an. "+
    "Du erhältst dort einen einmaligen Bestätigungscode. Ein weiteres App-Passwort brauchst du nicht.\\n\\n"+
    "Wenn du keine Einladung erwartet hast, ignoriere diese Nachricht."
  }]}),signal:AbortSignal.timeout(12000)});
 const result=await response.json().catch(()=>null);
 if(!response.ok||result?.Messages?.[0]?.Status!=="success")
  throw Error("email_send_failed");
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
 const ready=Boolean(env.CF_ACCESS_API_TOKEN&&env.MAILJET_API_KEY&&
  env.MAILJET_SECRET_KEY&&typeof env.MAILJET_SENDER_EMAIL==="string"&&
  EMAIL.test(env.MAILJET_SENDER_EMAIL));
 if(action==="status")return respond({ready});
 if(!env.CF_ACCESS_API_TOKEN||action==="invite"&&!ready)
  return respond({error:"mail_not_configured"},503);
 const email=normalise(input.email);
 if(!EMAIL.test(email)||email.length>254)return respond({error:"invalid_email"},400);
 const jwt=request.headers.get("Authorization");
 let policy,changedCloudflare=false,managedResult="";
 try{
  policy=await readPolicy(env,fetcher);
  const current=policy.include.map(x=>normalise(x.email.email));
  const included=current.includes(email);
  if(action==="revoke"){
   // The SQL RPC refuses to modify the original, unmanaged family allowlist.
   const result=await manageEmail(fetcher,jwt,email,"disable");
   if(result==="unmanaged")return respond({error:"not_managed"},403);
   if(result!=="revoked")throw Error("database_unavailable");
   if(included)await writePolicy(env,fetcher,policy,current.filter(x=>x!==email));
   return respond({revoked:true});
  }
  if(!included){await writePolicy(env,fetcher,policy,[...current,email]);changedCloudflare=true;}
  managedResult=await manageEmail(fetcher,jwt,email,"enable");
  if(managedResult==="rate_limited")throw Error("rate_limited");
  if(!["new","existing","baseline"].includes(managedResult))throw Error("database_unavailable");
  await sendMail(env,fetcher,email);
  return respond({sent:true});
 }catch(error){
  if(action==="invite"){
   // Cross-provider compensation; never touch pre-existing recipients.
   if(managedResult==="new"){
    try{await manageEmail(fetcher,jwt,email,"disable");}catch{/* fail closed on next admin repair */}
   }
   if(changedCloudflare){
    try{
     const latest=await readPolicy(env,fetcher);
     await writePolicy(env,fetcher,latest,
      latest.include.map(x=>normalise(x.email.email)).filter(x=>x!==email));
    }catch{/* configuration is inconsistent; caller sees an explicit failure */}
   }
  }
  const reason=error?.message;
  return respond({error:reason==="unsafe_access_policy"?"unsafe_access_policy":
   reason==="email_send_failed"?"email_send_failed":
   reason==="rate_limited"?"rate_limited":"service_unavailable"},
   reason==="rate_limited"?429:503);
 }

}

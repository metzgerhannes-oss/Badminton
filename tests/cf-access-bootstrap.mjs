import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {onRequestPost} from "../functions/api/access-bootstrap.js";

const TEST_URL="https://schmetterlinge-familie.pages.dev/api/access-bootstrap";
const authorized=()=>new Request(TEST_URL,{method:"POST",headers:{
 Origin:"https://schmetterlinge-familie.pages.dev",
 Authorization:"Bearer valid.supabase.session",
 "Cf-Access-Jwt-Assertion":"signed.cloudflare.assertion"
}});
const denied=async(request)=>{
 let touched=false;
 const response=await onRequestPost({request,fetcher:async()=>{touched=true;throw Error("unreachable")}});
 assert.equal(touched,false,"Missing Access requirements must stop before network");
 assert.notEqual(response.status,200);
 assert.deepEqual(await response.json(),{allowed:false});
 assert.equal(response.headers.get("cache-control"),"no-store");
};
await denied(new Request(TEST_URL,{method:"POST",headers:{Authorization:"Bearer fake.jwt"}}));
await denied(new Request(TEST_URL,{method:"POST",headers:{"Cf-Access-Jwt-Assertion":"fake"}}));
await denied(new Request(TEST_URL,{method:"POST",headers:{
 Origin:"https://attacker.example",Authorization:"Bearer fake.jwt",
 "Cf-Access-Jwt-Assertion":"forged"
}}));
await denied(new Request("https://untrusted.example/api/access-bootstrap",{method:"POST",headers:{
 Authorization:"Bearer fake.jwt","Cf-Access-Jwt-Assertion":"forged"
}}));
let upstream=0;
const ok=await onRequestPost({request:authorized(),fetcher:async(url,options)=>{
 upstream++;
 assert.equal(url,"https://yadexibmjmnjfmfabrug.supabase.co/functions/v1/cf-access-bootstrap");
 assert.equal(options.headers.Authorization,"Bearer valid.supabase.session");
 assert.equal(options.headers["X-Cloudflare-Access-Assertion"],"signed.cloudflare.assertion");
 assert.equal(options.method,"POST");
 return new Response(JSON.stringify({allowed:true}),{status:200});
}});
assert.equal(upstream,1);
assert.equal(ok.status,200);
assert.deepEqual(await ok.json(),{allowed:true});
assert.equal(ok.headers.get("cache-control"),"no-store");
for(const status of [401,403,500]){
 const response=await onRequestPost({request:authorized(),fetcher:async()=>
  new Response(JSON.stringify({allowed:false,debug:"never leak"}),{status})});
 assert.notEqual(response.status,200);
 const output=await response.text();
 assert.ok(!output.includes("debug"));
 assert.ok(!output.includes("signed.cloudflare"));
}
const sql=await readFile(new URL("../database/p1-427-cloudflare-member-bootstrap.sql",import.meta.url),"utf8");
assert.match(sql,/REVOKE ALL ON FUNCTION public\.cf_access_enroll_member\(uuid,text\) FROM PUBLIC,anon,authenticated/);
assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.cf_access_enroll_member\(uuid,text\) TO service_role/);
assert.match(sql,/d\.valid_until>now\(\)/);
assert.match(sql,/a\.enabled/);
const edge=await readFile(new URL("../supabase/functions/cf-access-bootstrap/index.ts",import.meta.url),"utf8");
assert.match(edge,/crypto\.subtle\.verify/);
assert.match(edge,/payload\?\.iss!==CF_ISSUER/);
assert.match(edge,/payload\.aud/);
assert.match(edge,/\/auth\/v1\/user/);
assert.ok(!edge.includes('console.log('));
const app=await readFile(new URL("../app-access.js",import.meta.url),"utf8");
assert.match(app,/confirmed\?\.allowed===true/);
assert.match(app,/grantAfterIntro\(\)/);
console.log("P1 #427: Access assertion bridge, backend verification and restricted member enrollment contract OK");

const inviteSql=await readFile(new URL("../database/p1-442-email-invite-managed.sql",import.meta.url),"utf8");
assert.match(inviteSql,/cf_access_invite_managed ENABLE ROW LEVEL SECURITY/);
assert.match(inviteSql,/site_owners/);
assert.match(inviteSql,/REVOKE ALL ON FUNCTION public\.cf_access_email_invite_manage/);
const emailApi=await import("../functions/api/family-invites.js");
const emailRequest=new Request("https://schmetterlinge-familie.pages.dev/api/family-invites",{
 method:"POST",body:JSON.stringify({action:"invite",email:"test@example.test"})});
const emailDenied=await emailApi.onRequestPost({request:emailRequest,env:{},
 fetcher:async()=>{throw Error("Untrusted request must not call services");}});
assert.equal(emailDenied.status,403);
console.log("P1 #442: email invite server rejects unauthenticated access, SQL guarded.");

const site="https://schmetterlinge-familie.pages.dev";
const authHeaders={Origin:site,Authorization:"Bearer valid.synthetic.session",
 "Cf-Access-Jwt-Assertion":"valid.synthetic.assertion"};
const makeInvite=action=>new Request(site+"/api/family-invites",{method:"POST",
 headers:authHeaders,body:JSON.stringify({action,email:"invitee@example.test"})});
const envGrant={CF_ACCESS_API_TOKEN:"test-only"};
function emailMock({failure=false,owner=true,baseline=false,cfDenied=false}={}){
 let allowed=["owner@example.test"];
 const steps=[];
 const call=async(url,options)=>{
  const method=options?.method||"GET";
  if(url.includes("cf-access-bootstrap")){steps.push("jwt");return Response.json({allowed:true});}
  if(url.includes("app_access_status")){steps.push("owner");return Response.json({owner});}
  if(url.includes("/access/apps/")){
   if(method==="GET"){
    steps.push("cf_read");
    if(cfDenied)return new Response(JSON.stringify({success:false,errors:[{code:10000}]}),{status:403});
    return Response.json({success:true,result:{name:"Family",decision:"allow",
    precedence:1,include:allowed.map(email=>({email:{email}})),exclude:[],require:[]}});
   }
   allowed=JSON.parse(options.body).include.map(x=>x.email.email);
   steps.push("cf_write");return Response.json({success:true});
  }
  if(url.includes("cf_access_email_invite_manage")){
   const action=JSON.parse(options.body).p_action;steps.push("db_"+action);
   if(failure&&action==="enable")return new Response("{}",{status:503});
   return Response.json(action==="enable"?(baseline?"baseline":"new"):"revoked");
  }
  throw Error("Unexpected test endpoint");
 };
 return {call,steps,get allowed(){return allowed}};
}
const successfulEmail=emailMock();
const sent=await emailApi.onRequestPost({request:makeInvite("invite"),env:envGrant,
 fetcher:successfulEmail.call});
assert.equal(sent.status,200);
assert.deepEqual(await sent.json(),{prepared:true,url:site+"/"});
assert.ok(successfulEmail.allowed.includes("invitee@example.test"));
assert.deepEqual(successfulEmail.steps,["jwt","owner","db_enable","cf_read","cf_write"]);
const bounced=emailMock({failure:true});
const noMail=await emailApi.onRequestPost({request:makeInvite("invite"),env:envGrant,
 fetcher:bounced.call});
assert.equal(noMail.status,503);
assert.deepEqual(bounced.allowed,["owner@example.test"]);
assert.deepEqual(bounced.steps,["jwt","owner","db_enable"]);
const alreadyApproved=emailMock({baseline:true,cfDenied:true});
const existingSent=await emailApi.onRequestPost({request:makeInvite("invite"),env:envGrant,
 fetcher:alreadyApproved.call});
assert.deepEqual(await existingSent.json(),{prepared:true,url:site+"/"});
assert.deepEqual(alreadyApproved.steps,["jwt","owner","db_enable"],
 "Approved family email must not depend on Cloudflare policy lookups.");
const blockedCloudflare=emailMock({cfDenied:true});
const blockedNew=await emailApi.onRequestPost({request:makeInvite("invite"),env:envGrant,
 fetcher:blockedCloudflare.call});
assert.equal(blockedNew.status,503);
assert.equal((await blockedNew.json()).error,"cloudflare_read_denied");
assert.deepEqual(blockedCloudflare.steps,["jwt","owner","db_enable","cf_read","db_disable"],
 "New grants must be rolled back if Cloudflare denies policy read.");
const blockedOwner=emailMock({owner:false});
const notOwner=await emailApi.onRequestPost({request:makeInvite("invite"),env:envGrant,
 fetcher:blockedOwner.call});
assert.equal(notOwner.status,403);
assert.deepEqual(blockedOwner.steps,["jwt","owner"]);
console.log("P1 #442: owner-only mailto preparation, allowlist consistency and rollback smoke OK");

const fixedSql=await readFile(new URL("../database/p1-442-email-validation-fix.sql",import.meta.url),"utf8");
for(const source of [inviteSql,fixedSql]){
 assert.ok(source.includes("([.][a-z0-9-]+)+"),
  "Invitation email validation must use an unambiguous literal dot");
 assert.ok(!source.includes("(\\.[a-z0-9-]+)+"),
  "Never double-escape a Postgres regex dot (valid emails were rejected)");
 assert.match(source,/site_owners/,"Email grants must remain owner-only");
}
console.log("P1 #442: valid recipient domain punctuation and owner-only SQL regression covered.");

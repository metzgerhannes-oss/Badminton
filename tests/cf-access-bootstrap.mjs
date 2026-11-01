import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {onRequestPost} from "../functions/api/access-bootstrap.js";

const URL="https://schmetterlinge-familie.pages.dev/api/access-bootstrap";
const authorized=()=>new Request(URL,{method:"POST",headers:{
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
await denied(new Request(URL,{method:"POST",headers:{Authorization:"Bearer fake.jwt"}}));
await denied(new Request(URL,{method:"POST",headers:{"Cf-Access-Jwt-Assertion":"fake"}}));
await denied(new Request(URL,{method:"POST",headers:{
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

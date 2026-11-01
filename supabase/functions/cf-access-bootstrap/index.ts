/** Issue #427: signed Cloudflare Access assertion -> independently approved Supabase member.
 * This function is deployed with verify_jwt=true; never trust client-supplied email.
 * The service-role key must remain server-side in the Supabase Edge environment.
 */
const SUPABASE_URL="https://yadexibmjmnjfmfabrug.supabase.co";
const CF_ISSUER="https://green-fire-6719.cloudflareaccess.com";
const CF_AUDIENCE="a35241e426829e517c449debcc39f49dfe8746d06ff3a9b132a9a4aa9961c0e5";
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{
 status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",
 "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}});
function base64Url(input:string){
 if(!/^[a-zA-Z0-9_-]+$/.test(input))throw Error("invalid_jwt_encoding");
 const encoded=input.replace(/-/g,"+").replace(/_/g,"/");
 const raw=atob(encoded+"=".repeat((4-encoded.length%4)%4));
 return Uint8Array.from(raw,x=>x.charCodeAt(0));
}
function segment(input:string){
 return JSON.parse(new TextDecoder().decode(base64Url(input)));
}
async function verifyCloudflareJwt(token:string){
 if(typeof token!=="string"||token.length>8192)throw Error("invalid_assertion");
 const parts=token.split(".");
 if(parts.length!==3)throw Error("invalid_assertion");
 const header=segment(parts[0]),payload=segment(parts[1]);
 if(header?.alg!=="RS256"||typeof header.kid!=="string"||header.kid.length>256)
  throw Error("invalid_signing_algorithm");
 const time=Math.floor(Date.now()/1000);
 if(payload?.iss!==CF_ISSUER||
    !(Array.isArray(payload.aud)?payload.aud.includes(CF_AUDIENCE):payload.aud===CF_AUDIENCE)||
    typeof payload.exp!=="number"||payload.exp<=time||
    typeof payload.nbf==="number"&&payload.nbf>time+30||
    typeof payload.iat==="number"&&payload.iat>time+30)
  throw Error("invalid_access_claims");
 const email=typeof payload.email==="string"?payload.email.trim().toLowerCase():"";
 if(email.length<5||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  throw Error("missing_verified_email");
 const cert=await fetch(CF_ISSUER+"/cdn-cgi/access/certs",{
  signal:AbortSignal.timeout(6000),headers:{Accept:"application/json"}});
 if(!cert.ok)throw Error("access_key_unavailable");
 const jwks=await cert.json();
 const jwk=(Array.isArray(jwks?.keys)?jwks.keys:[]).find((key:any)=>
  key.kid===header.kid&&key.kty==="RSA"&&(key.alg===undefined||key.alg==="RS256"));
 if(!jwk)throw Error("unknown_access_signing_key");
 const key=await crypto.subtle.importKey("jwk",jwk,
  {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
 const input=new TextEncoder().encode(parts[0]+"."+parts[1]);
 const ok=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,base64Url(parts[2]),input);
 if(!ok)throw Error("invalid_access_signature");
 return email;
}
Deno.serve(async request=>{
 if(request.method!=="POST")return json({allowed:false},405);
 const userJwt=(request.headers.get("Authorization")||"").match(/^Bearer\s+([A-Za-z0-9._-]+)$/i)?.[1];
 const accessJwt=request.headers.get("X-Cloudflare-Access-Assertion");
 if(!userJwt||!accessJwt)return json({allowed:false},401);
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 const anon=Deno.env.get("SUPABASE_ANON_KEY");
 if(!service||!anon||Deno.env.get("SUPABASE_URL")!==SUPABASE_URL)
  return json({allowed:false,error:"server_configuration"},503);
 try{
  // First verify the signed Access assertion and its specific application audience.
  const email=await verifyCloudflareJwt(accessJwt);
  // Validate the *real* Supabase Auth session server-side. Never accept a
  // user ID supplied in a request body.
  const identity=await fetch(SUPABASE_URL+"/auth/v1/user",{
   method:"GET",headers:{Authorization:"Bearer "+userJwt,apikey:anon},
   signal:AbortSignal.timeout(7000),cache:"no-store"});
  if(!identity.ok)return json({allowed:false},401);
  const user=await identity.json();
  if(typeof user?.id!=="string"||!/^[-0-9a-f]{36}$/i.test(user.id))
   return json({allowed:false},401);
  // Only service_role can call this RPC; it checks the private, operator-
  // approved email allowlist and links only this verified Supabase user.
  const response=await fetch(SUPABASE_URL+"/rest/v1/rpc/cf_access_enroll_member",{
   method:"POST",signal:AbortSignal.timeout(7000),cache:"no-store",
   headers:{"Content-Type":"application/json",apikey:service,Authorization:"Bearer "+service},
   body:JSON.stringify({p_user_id:user.id,p_verified_email:email})
  });
  if(!response.ok)return json({allowed:false,error:"enrollment_unavailable"},503);
  if(await response.json()!==true)return json({allowed:false},403);
  return json({allowed:true});
 }catch{
  // No assertion, JWT, email or internal error is ever echoed to the browser.
  return json({allowed:false,error:"verification_failed"},403);
 }
});

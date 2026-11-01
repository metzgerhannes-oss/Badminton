/** Issue #427: same-origin Access assertion bridge.
 * CF Access protects the Pages site and injects the signed JWT into the
 * origin request header. The browser never receives this assertion.
 */
const TARGET="https://yadexibmjmnjfmfabrug.supabase.co/functions/v1/cf-access-bootstrap";
const PUB_KEY="sb_publishable_WdNC1AoOLe4rqDomSVnxWw_wq64M5kE";
const deny=(status=403)=>new Response(JSON.stringify({allowed:false}),{
 status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",
 "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}});
export async function onRequestPost({request,fetcher=fetch}){
 const origin=new URL(request.url).origin;
 if(request.headers.get("Origin") && request.headers.get("Origin")!==origin)
  return deny(403);
 if(new URL(request.url).hostname!=="schmetterlinge-familie.pages.dev")
  return deny(403);
 const assertion=request.headers.get("Cf-Access-Jwt-Assertion");
 const authorization=request.headers.get("Authorization");
 if(!assertion||!/^Bearer\s+[\w.-]+$/.test(authorization||""))
  return deny(401);
 try{
  const reply=await fetcher(TARGET,{
   method:"POST",cache:"no-store",signal:AbortSignal.timeout(12000),
   headers:{Authorization:authorization,"X-Cloudflare-Access-Assertion":assertion,
    apikey:PUB_KEY,"Content-Type":"application/json"},
   body:"{}"
  });
  const result=await reply.json();
  return new Response(JSON.stringify(reply.ok&&result?.allowed===true?{allowed:true}:{allowed:false}),{
   status:reply.ok&&result?.allowed===true?200:(reply.status===401?401:403),
   headers:{"Content-Type":"application/json","Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}
  });
 }catch{return deny(503)}
}
export const onRequest=onRequestPost;

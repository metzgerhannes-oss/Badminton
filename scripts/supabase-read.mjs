/** Read-only, bounded public Supabase client. No family data is written remotely. */
export const SUPABASE_ROOT="https://yadexibmjmnjfmfabrug.supabase.co/rest/v1/";
export const PUBLIC_KEY="sb_publishable_WdNC1AoOLe4rqDomSVnxWw_wq64M5kE";

export class PublicReadError extends Error{
 constructor(kind,detail="",status=0){
  super(detail||kind);
  this.name="PublicReadError";
  this.kind=kind;
  this.status=status;
 }
}
function safeReadUrl(path){
 if(typeof path!=="string"||path.length>2000||!/^[a-z][a-z0-9_]*\?[^#]*$/.test(path))
  throw new PublicReadError("invalid","Invalid relative read query");
 const url=new URL(path,SUPABASE_ROOT);
 if(url.origin!==new URL(SUPABASE_ROOT).origin||!url.pathname.startsWith("/rest/v1/"))
  throw new PublicReadError("invalid","Cross-origin or non-REST request");
 return url.href;
}
/** GET only. Retry a transient failure at most once; caller abort always wins.
 * Returns the original PostgREST row array and Content-Range for pagination.
 */
export async function readPublicRows(path,{fetchImpl=fetch,signal,timeoutMs=6500,retries=1,count=true}={}){
 const url=safeReadUrl(path);
 if(!Number.isFinite(timeoutMs)||timeoutMs<100||timeoutMs>30000)
  throw new PublicReadError("invalid","Invalid timeout");
 if(!Number.isInteger(retries)||retries<0||retries>1)
  throw new PublicReadError("invalid","Invalid retry count");
 for(let attempt=0;attempt<=retries;attempt++){
  if(signal?.aborted)throw new PublicReadError("aborted","Request cancelled");
  const controller=new AbortController();
  let timedOut=false;
  const onAbort=()=>controller.abort();
  if(signal)signal.addEventListener("abort",onAbort,{once:true});
  const timer=setTimeout(()=>{timedOut=true;controller.abort()},timeoutMs);
  try{
   const response=await fetchImpl(url,{
    method:"GET",signal:controller.signal,cache:"no-store",
    headers:{apikey:PUBLIC_KEY,Accept:"application/json",...(count?{Prefer:"count=exact"}:{})}
   });
   if(!response.ok){
    const status=response.status||0;
    throw new PublicReadError([429,502,503,504].includes(status)?"transient":"http",
     "Supabase HTTP "+status,status);
   }
   let rows;
   try{rows=await response.json()}
   catch{throw new PublicReadError("invalid","Invalid JSON response")}
   if(!Array.isArray(rows))throw new PublicReadError("invalid","Expected row array");
   return {rows,range:response.headers?.get("content-range")||""};
  }catch(error){
   const normalized=error instanceof PublicReadError?error:
    new PublicReadError(signal?.aborted?"aborted":timedOut?"timeout":"offline",
     signal?.aborted?"Request cancelled":timedOut?"Request timed out":"Network unavailable");
   if(signal?.aborted)throw new PublicReadError("aborted","Request cancelled");
   if(attempt>=retries||!["transient","timeout","offline"].includes(normalized.kind))throw normalized;
  }finally{
   clearTimeout(timer);
   if(signal)signal.removeEventListener("abort",onAbort);
  }
 }
 throw new PublicReadError("offline","Network unavailable");
}

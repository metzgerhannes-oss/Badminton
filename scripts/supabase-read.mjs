/** P0 #417: bounded, read-only Supabase REST client for verified family members. */
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
   // P0 #417: every PostgREST table read requires a verified family member.
   // Supabase Anonymous Auth also uses the "authenticated" DB role; an
   // accepted player-scoped link must NEVER be treated as global membership.
   const member=typeof window!=="undefined"?window.badmintonAppAccess:null;
   if(member?.allowed!==true)
    throw new PublicReadError("restricted","Verified family membership required",403);
   const sessionToken=await member.getAccessToken?.();
   if(typeof sessionToken!=="string"||!sessionToken)
    throw new PublicReadError("restricted","Verified family session unavailable",403);
   const response=await fetchImpl(url,{
    method:"GET",signal:controller.signal,cache:"no-store",
    headers:{apikey:PUBLIC_KEY,Accept:"application/json",...(count?{Prefer:"count=exact"}:{}),
     ...(sessionToken?{Authorization:"Bearer "+sessionToken}:{})}
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

/** Match import progress for invited members. This is advisory: failure must not
 * suppress backed, server-authorized match-card reads. */
export async function readMatchImportProgress(id,{signal}={}){
 if(typeof id!=="string"||!/^[0-9]{2}-[0-9]{6}$/.test(id))return null;
 if(typeof window!=="undefined"&&window.badmintonAppAccess?.allowed){
  const jwt=await window.badmintonAppAccess.getAccessToken();
  if(!jwt)return null;
  const response=await fetch(SUPABASE_ROOT+"rpc/app_access_player_coverage",{
   method:"POST",cache:"no-store",signal,
   headers:{apikey:PUBLIC_KEY,Authorization:"Bearer "+jwt,"Content-Type":"application/json"},
   body:JSON.stringify({p_player_dbv_id:id})
  });
  if(!response.ok)return null;
  const d=await response.json();
  if(d?.dbv_id!==id)return null;
  return {status:d.import_status||null,verified_count:Number(d.match_cards||0),
   last_finished_at:d.last_import||null,
   birth_year:Number.isInteger(d.birth_year)?d.birth_year:null};
 }
 // No anonymous status fallback: member-only coverage RPC is authoritative.
 return null;
}

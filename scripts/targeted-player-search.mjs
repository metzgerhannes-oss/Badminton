/** User-initiated, limited DBV identity lookup. This never grants private access. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./supabase-read.mjs";
import {normalizeFriendSearch,asFriendCandidate} from "./friend-search.mjs";
export const IDENTITY_SEARCH_LIMIT=12;
// Courtesy backoff only. This is NOT a server-side abuse or rate-limit guard.
const DEFAULT_RATE_WAIT_MS=30000,MAX_RATE_WAIT_MS=300000;
let blockedUntil=0;
export function dbvRetryDelayMs(header,now=Date.now()){
 const raw=String(header??"").trim();
 let delay=DEFAULT_RATE_WAIT_MS;
 if(/^\d{1,6}$/.test(raw))delay=Number(raw)*1000;
 else if(raw&&Number.isFinite(Date.parse(raw)))delay=Date.parse(raw)-now;
 return Math.min(MAX_RATE_WAIT_MS,Math.max(1000,Number.isFinite(delay)?delay:DEFAULT_RATE_WAIT_MS));
}
function rateLimitedError(){
 const error=new Error("DBV-Suche vorübergehend begrenzt. Bitte später erneut versuchen.");
 error.status=429;error.retryAfterMs=Math.max(0,blockedUntil-Date.now());
 return error;
}
export function validDbvLookup(raw){
 const q=normalizeFriendSearch(raw);
 return q.length>=3&&q.length<=70&&/^[\p{L}\p{N} -]+$/u.test(q)?q:"";
}
export async function searchDbvIdentities(raw,{
 fetchImpl=fetch,signal,ageClass=null,club=null,association=null
}={}){
 const q=validDbvLookup(raw);
 if(!q)return [];
 if(Date.now()<blockedUntil)throw rateLimitedError();
 // P0 #417: the SECURITY DEFINER search RPC is member-only. No guest probe.
 const member=typeof window!=="undefined"?window.badmintonAppAccess:null;
 const token=member?.allowed===true?await member.getAccessToken?.():null;
 if(typeof token!=="string"||!token){
  const error=new Error("DBV-Suche nur mit bestätigtem Familienzugang verfügbar");
  error.status=403;throw error;
 }
 const optional=(s,max)=>String(s??"").trim().slice(0,max)||null;
 const response=await fetchImpl(SUPABASE_ROOT+"rpc/search_dbv_player_identity",{
  method:"POST",cache:"no-store",signal,
  headers:{apikey:PUBLIC_KEY,Authorization:"Bearer "+token,
   "Content-Type":"application/json",Accept:"application/json"},
  body:JSON.stringify({p_query:q,p_age_class:ageClass||null,
   p_club:optional(club,90),p_association:association&&association!=="all"?optional(association,50):null})
 });
 if(!response.ok){
  if(response.status===429){
   const wait=dbvRetryDelayMs(response.headers?.get?.("retry-after"));
   blockedUntil=Math.max(blockedUntil,Date.now()+wait);
   throw rateLimitedError();
  }
  const error=new Error("DBV-Identitätssuche derzeit nicht erreichbar");
  error.status=response.status;throw error;
 }
 const rows=await response.json();
 if(!Array.isArray(rows))throw Error("Invalid DBV identity response");
 const seen=new Set();
 return rows.slice(0,IDENTITY_SEARCH_LIMIT).flatMap(row=>{
  const p=asFriendCandidate(row);
  if(!p||seen.has(p.id))return [];
  seen.add(p.id);return [p];
 });
}

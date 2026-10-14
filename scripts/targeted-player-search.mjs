/** User-initiated, limited DBV identity lookup. This never grants private access. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./supabase-read.mjs";
import {normalizeFriendSearch,asFriendCandidate} from "./friend-search.mjs";
export const IDENTITY_SEARCH_LIMIT=12;
export function validDbvLookup(raw){
 const q=normalizeFriendSearch(raw);
 return q.length>=3&&q.length<=70&&/^[\p{L}\p{N} -]+$/u.test(q)?q:"";
}
export async function searchDbvIdentities(raw,{
 fetchImpl=fetch,signal,ageClass=null,club=null,association=null
}={}){
 const q=validDbvLookup(raw);
 if(!q)return [];
 const optional=(s,max)=>String(s??"").trim().slice(0,max)||null;
 const response=await fetchImpl(SUPABASE_ROOT+"rpc/search_dbv_player_identity",{
  method:"POST",cache:"no-store",signal,
  headers:{apikey:PUBLIC_KEY,"Content-Type":"application/json",Accept:"application/json"},
  body:JSON.stringify({p_query:q,p_age_class:ageClass||null,
   p_club:optional(club,90),p_association:association&&association!=="all"?optional(association,50):null})
 });
 if(!response.ok){
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

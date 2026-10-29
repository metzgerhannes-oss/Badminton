import {parsePublicHistory} from "./badhub-history-parser.mjs";
import {assessSourceAvailability,importStatusForBatch,missingSourceStatus,reconcileMatchBatch} from "./source-availability.mjs";
import {readBoundedJson,PayloadTooLargeError} from "./bounded-request.mjs";
import {excludeContradictoryRounds} from "./match-source-integrity.mjs";
const API=Deno.env.get("SUPABASE_URL")||"";
const ADMIN=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const PUBLIC="sb_publishable_WdNC1AoOLe4rqDomSVnxWw_wq64M5kE";
const ALLOWED_ORIGINS=new Set(["https://schmetterlinge-familie.pages.dev",
  "https://metzgerhannes-oss.github.io"]);
// v136: PostgREST verifies the user JWT and the server-side invite membership.
// Origin and publishable key are never accepted as a substitute for this.
async function isInvitedMember(req:Request):Promise<boolean>{
 const raw=req.headers.get("authorization")||"";
 if(!/^Bearer [A-Za-z0-9._-]+$/.test(raw)||raw.length>4500)return false;
 try{
  const response=await fetch(API+"/rest/v1/rpc/app_access_status",{
   method:"POST",
   headers:{apikey:PUBLIC,Authorization:raw,"Content-Type":"application/json"},
   body:"{}",redirect:"error"
  });
  if(!response.ok)return false;
  const data=await response.json();
  return data?.allowed===true;
 }catch{return false}
}
const headers=(origin:string|null)=>({
 "Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin",
 "Access-Control-Allow-Origin":origin&&ALLOWED_ORIGINS.has(origin)?origin:"null",
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Access-Control-Allow-Headers":"content-type,apikey,authorization"
});
const respond=(code:number,body:any,origin:string|null)=>new Response(
 JSON.stringify(body),{status:code,headers:headers(origin)});
async function api(path:string,init:RequestInit={}):Promise<any>{
 if(!API||!ADMIN)throw Error("Service credentials missing");
 const res=await fetch(API+"/rest/v1/"+path,{
 ...init,headers:{apikey:ADMIN,Authorization:"Bearer "+ADMIN,
 "Content-Type":"application/json",...(init.headers||{})}
 });
 const content=await res.text();
 if(!res.ok)throw Error("DB REST "+res.status+" "+content.slice(0,150));
 return content?JSON.parse(content):null;
}
async function update(id:string,fields:Record<string,unknown>){
 return api("player_external_match_imports?dbv_id=eq."+encodeURIComponent(id),{
  method:"PATCH",headers:{Prefer:"return=minimal"},
  body:JSON.stringify({...fields,updated_at:new Date().toISOString()})
 });
}
// Read at most one individually sourced persisted match (not the import counter):
// a profile page going empty must never erase the existence of actual results.
async function hasStoredMatchFact(id:string):Promise<boolean>{
 const facts=await api("player_external_match_facts?select=source_key&dbv_id=eq."+
  encodeURIComponent(id)+"&limit=1");
 if(!Array.isArray(facts))throw Error("Unexpected source fact read");
 return facts.length>0;
}
// A numeric cursor is not proof of completeness when the external feed reorders.
// Read only this already-authorized profile's persisted source keys, in bounded pages.
async function readStoredSourceKeys(id:string):Promise<Set<string>>{
 const result=new Set<string>(),pageSize=500,maxRows=10000;
 for(let offset=0;offset<maxRows;offset+=pageSize){
  const rows=await api("player_external_match_facts?select=source_key&dbv_id=eq."+
   encodeURIComponent(id)+"&order=source_key.asc&limit="+pageSize+"&offset="+offset);
  if(!Array.isArray(rows)||rows.length>pageSize)throw Error("Invalid source-key page");
  for(const row of rows){
   if(typeof row?.source_key!=="string"||!row.source_key)throw Error("Invalid persisted source key");
   result.add(row.source_key);
  }
  if(rows.length<pageSize)return result;
 }
 throw Error("Persisted source-key pagination limit");
}
async function updateNoNewSource(id:string,detail:string){
 const saved=await hasStoredMatchFact(id);
 await update(id,{status:missingSourceStatus(saved),lease_until:null,
  last_finished_at:new Date().toISOString(),
  detail:saved
   ?"Vorhandene Einzelmatchbelege sind gespeichert; "+detail
   :detail});
 return saved;
}
async function source(id:string,category:string,signal:AbortSignal){
 const url="https://badhub.de/spieler/"+id+"?src="+category+"&saison=all";
 const res=await fetch(url,{
  signal,redirect:"error",headers:{Accept:"text/html",
  "User-Agent":"Schmetterlinge/1.0 (on-demand source-backed personal player history)"}
 });
 if(!res.ok||!(res.headers.get("content-type")||"").includes("text/html"))
  throw Error("Source unavailable");
 const size=Number(res.headers.get("content-length")||0);
 if(size>5500000)throw Error("Source too large");
 const text=await res.text();
 if(text.length>5500000)throw Error("Source too large");
 return text;
}
Deno.serve(async req=>{
 const origin=req.headers.get("origin");
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(origin)});
 if(req.method!=="POST")return respond(405,{error:"post_required"},origin);
 if(origin&&!ALLOWED_ORIGINS.has(origin))return respond(403,{error:"disallowed_origin"},origin);
 // The publishable key is not authentication: reject oversized input
 // BEFORE allocating an unbounded JSON body or touching the database.
 let data:any;
 try{data=await readBoundedJson(req,1024)}
 catch(error){
  if(error instanceof PayloadTooLargeError)
   return respond(413,{error:"payload_too_large"},origin);
  return respond(400,{error:"invalid_json"},origin);
 }
 const id=String(data?.dbv_id||"");
 if(!/^\d{2}-\d{6}$/.test(id))return respond(400,{error:"invalid_id"},origin);
 if((req.headers.get("apikey")||data?.public_key)!==PUBLIC)
  return respond(403,{error:"missing_public_key"},origin);
 // Membership is checked by PostgREST under the caller's JWT on every import.
 // No lease, service-role query, or external fetch before this check passes.
 if(!(await isInvitedMember(req)))return respond(403,{error:"app_invitation_required"},origin);
 let claimed=false;
 try{
  // This is NOT authenticated account access. The service-only RPC enforces
  // verified player, existing followed-player request, lease and daily limits.
  const claim=await api("rpc/claim_external_match_import",{
   method:"POST",body:JSON.stringify({target_id:id})
  });
  if(!claim?.accepted)return respond(200,{queued:false,reason:claim?.reason||"skipped"},origin);
  claimed=true;
  const profiles=await api("players?select=dbv_id,name&dbv_id=eq."+encodeURIComponent(id)+"&limit=1");
  if(!Array.isArray(profiles)||profiles.length!==1||profiles[0].dbv_id!==id)
   throw Error("Verified profile unavailable");
  const ctl=new AbortController();
  const time=setTimeout(()=>ctl.abort(),35000);
  let outcomes:PromiseSettledResult<string>[];
  try{
   outcomes=await Promise.allSettled([
    source(id,"turnier",ctl.signal),source(id,"liga",ctl.signal)
   ]);
  }finally{clearTimeout(time)}
  // A temporarily missing category must not discard valid results in the other.
  // Do not claim complete if only tournament OR league was reachable.
  const sources=assessSourceAvailability(outcomes);
  if(sources.available.length===0){
   const saved=await updateNoNewSource(id,
    "Badhub-Turnier- und Ligaquellen derzeit nicht erreichbar; erneute Prüfung vorgesehen");
   return respond(200,{queued:true,stored:0,eligible:0,existing_proof:saved,
    reason:"source_temporarily_unavailable"},origin);
  }
  const parsed=sources.available.map(({category,html})=>
   parsePublicHistory(html,profiles[0],category));
  const matches=new Map<string,any>();
  for(const result of parsed)for(const match of result.items)
   matches.set(match.source_key,match);
  // The original Badhub player pages can contain contradictory K.-o. rounds.
  // Never re-add those cards after a fresh, manually reviewed P0 import.
  const guarded=excludeContradictoryRounds([...matches.values()]);
  const all=guarded.accepted.sort((a,b)=>
   b.match_year-a.match_year
   ||String(b.match_date||"").localeCompare(String(a.match_date||""))
   ||a.source_key.localeCompare(b.source_key));
  const cardCount=parsed.reduce((n,result)=>n+result.cards_seen,0);
  if(cardCount===0){
   const saved=await updateNoNewSource(id,sources.missing.length
    ?"Nur ein Teil der Badhub-Quellen war erreichbar; keine zusätzlichen Matchkarten gefunden."
    :"In den erreichbaren allgemeinen Spielerquellen sind derzeit keine neuen Einzelmatchkarten veröffentlicht.");
   return respond(200,{queued:true,stored:0,eligible:0,existing_proof:saved,
    reason:sources.missing.length?"partial_source_no_matches":"no_source_matches"},origin);
  }
  if(all.length<Math.floor(cardCount*0.55))
   throw Error("Match parser rejected unexpected amount of source cards");
  // Reconcile every fresh, verified source_key against actual persisted proof.
  // This also finds older missing cards after source reordering; old numeric
  // cursor_offset and stale source_count are never used to infer completeness.
  const storedKeys=await readStoredSourceKeys(id);
  const batch=reconcileMatchBatch(all,storedKeys,120);
  // Reconciliation prioritizes newly evidenced scoreless cards within the
  // same 120-row quota; progress and remaining_eligible now match writes.
  const written=batch.selected;
  const scoreless=written.filter(row=>row.outcome_evidence==="badhub-bold-dash");
  for(let i=0;i<written.length;i+=25){
   await api("player_external_match_facts?on_conflict=dbv_id,source_key",{
    method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify(written.slice(i,i+25))
   });
  }
  const progress=batch.progress;
  const finished=batch.finished;
  const excluded=Math.max(0,cardCount-all.length);
  const incomplete=sources.missing.length
   ?" · "+sources.missing.join(" und ")+"-Quelle derzeit nicht abrufbar; Gesamtbestand unvollständig":"";
  const rejectedByReason={};
  for(const result of parsed)for(const [reason,count] of Object.entries(result.rejection_reasons||{}))
   rejectedByReason[reason]=(rejectedByReason[reason]||0)+count;
  const reasonSummary=Object.entries(rejectedByReason)
   .filter(([,count])=>Number.isSafeInteger(count)&&count>0)
   .map(([reason,count])=>reason+":"+count).slice(0,12).join(", ");
  const detail=(finished
   ?String(all.length)+" einzelne Badhub-Matches aus erreichbaren Quellen verarbeitet; "+String(excluded)+" unklare Karten ausgeschlossen"
   :String(progress)+" von "+String(all.length)+" geprüften Quellenspielen verarbeitet")+incomplete+
   (reasonSummary?" · Prüfung: "+reasonSummary:"");
  const status=importStatusForBatch(finished,excluded,sources.missing);
  await update(id,{
   status,
   cursor_offset:progress,source_count:cardCount,
   verified_count:all.length,rejected_count:excluded,
   lease_until:null,last_finished_at:new Date().toISOString(),detail
  });
  return respond(200,{
   queued:true,stored:written.length,scoreless_evidence_count:scoreless.length,progress,eligible:all.length,
   source_cards:cardCount,excluded,remaining_eligible:batch.remaining_eligible,
   completed:status==="complete",
   unavailable_categories:sources.missing,
   provenance:"Badhub – public match cards, not official DBV match IDs"
  },origin);
 }catch(error){
  if(claimed)try{
   if(String(error).includes("Source unavailable")){
    await updateNoNewSource(id,
     "Für diesen Spieler liefert das allgemeine Badhub-Profil gerade keinen neuen Matchdatensatz");
   }else{
    await update(id,{status:"error",lease_until:null,
     last_finished_at:new Date().toISOString(),
     detail:"Quellenabgleich fehlgeschlagen; vorhandene belegte Matches bleiben gespeichert"});
   }
  }catch{}
  // Never log player IDs, source URLs or raw provider/database errors.
  console.error("External source import failed (private source/validation path)");
  return respond(502,{error:"source_import_unavailable"},origin);
 }
});

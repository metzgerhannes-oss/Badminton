import {parsePublicHistory} from "./badhub-history-parser.mjs";
import {assessSourceAvailability,importStatusForBatch} from "./source-availability.mjs";
const API=Deno.env.get("SUPABASE_URL")||"";
const ADMIN=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const PUBLIC="sb_publishable_WdNC1AoOLe4rqDomSVnxWw_wq64M5kE";
const ORIGIN="https://metzgerhannes-oss.github.io";
const headers=(origin:string|null)=>({
 "Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin",
 "Access-Control-Allow-Origin":origin===ORIGIN?ORIGIN:"null",
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
 if(origin&&origin!==ORIGIN)return respond(403,{error:"disallowed_origin"},origin);
 let data:any;
 try{data=await req.json()}catch{return respond(400,{error:"invalid_json"},origin)}
 const id=String(data?.dbv_id||"");
 if(!/^\d{2}-\d{6}$/.test(id))return respond(400,{error:"invalid_id"},origin);
 if((req.headers.get("apikey")||data?.public_key)!==PUBLIC)
  return respond(403,{error:"missing_public_key"},origin);
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
   await update(id,{status:"awaiting_source",lease_until:null,
    last_finished_at:new Date().toISOString(),
    detail:"Badhub-Turnier- und Ligaquellen derzeit nicht erreichbar; erneute Prüfung vorgesehen"});
   return respond(200,{queued:true,stored:0,eligible:0,
    reason:"source_temporarily_unavailable"},origin);
  }
  const parsed=sources.available.map(({category,html})=>
   parsePublicHistory(html,profiles[0],category));
  const matches=new Map<string,any>();
  for(const result of parsed)for(const match of result.items)
   matches.set(match.source_key,match);
  const all=[...matches.values()].sort((a,b)=>
   b.match_year-a.match_year
   ||String(b.match_date||"").localeCompare(String(a.match_date||""))
   ||a.source_key.localeCompare(b.source_key));
  const cardCount=parsed.reduce((n,result)=>n+result.cards_seen,0);
  if(cardCount===0){
   await update(id,{status:"awaiting_source",lease_until:null,
    last_finished_at:new Date().toISOString(),
    detail:sources.missing.length
     ?"Nur ein Teil der Badhub-Quellen war erreichbar; bisher keine belegten Einzelmatches."
     :"In den erreichbaren Badhub-Quellen sind derzeit keine Einzelmatchkarten veröffentlicht."});
   return respond(200,{queued:true,stored:0,eligible:0,
    reason:sources.missing.length?"partial_source_no_matches":"no_source_matches"},origin);
  }
  if(all.length<Math.floor(cardCount*0.55))
   throw Error("Match parser rejected unexpected amount of source cards");
  // A partial source can reorder/shorten the feed: never resume at an old
  // offset and silently skip verified matches from the accessible category.
  const start=sources.missing.length?0:Math.min(Number(claim.cursor)||0,all.length);
  const selected=all.slice(start,start+120);
  for(let i=0;i<selected.length;i+=25){
   await api("player_external_match_facts?on_conflict=dbv_id,source_key",{
    method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify(selected.slice(i,i+25))
   });
  }
  const progress=start+selected.length;
  const finished=progress>=all.length;
  const excluded=Math.max(0,cardCount-all.length);
  const incomplete=sources.missing.length
   ?" · "+sources.missing.join(" und ")+"-Quelle derzeit nicht abrufbar; Gesamtbestand unvollständig":"";
  const detail=(finished
   ?String(all.length)+" einzelne Badhub-Matches aus erreichbaren Quellen verarbeitet; "+String(excluded)+" unklare Karten ausgeschlossen"
   :String(progress)+" von "+String(all.length)+" geprüften Quellenspielen verarbeitet")+incomplete;
  await update(id,{
   status:importStatusForBatch(finished,excluded,sources.missing),
   cursor_offset:progress,source_count:cardCount,
   verified_count:all.length,rejected_count:excluded,
   lease_until:null,last_finished_at:new Date().toISOString(),detail
  });
  return respond(200,{
   queued:true,stored:selected.length,progress,eligible:all.length,
   source_cards:cardCount,excluded,completed:finished&&!sources.missing.length,
   unavailable_categories:sources.missing,
   provenance:"Badhub – public match cards, not official DBV match IDs"
  },origin);
 }catch(error){
  if(claimed)try{await update(id,{
   status:String(error).includes("Source unavailable")?"awaiting_source":"error",
   lease_until:null,last_finished_at:new Date().toISOString(),
   detail:String(error).includes("Source unavailable")
     ?"Für diesen Spieler liefert Badhub noch keinen abrufbaren Matchdatensatz"
     :"Quellenabgleich fehlgeschlagen; keine unbelegten Matches gespeichert"
  });}catch{}
  console.error("External source import failed",id,String(error).slice(0,250));
  return respond(502,{error:"source_import_unavailable"},origin);
 }
});

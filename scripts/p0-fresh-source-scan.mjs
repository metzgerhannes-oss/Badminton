/* One-time P0 source inventory. Does not change the DB or publish names/results.
 * Inspect the 13 agreed club profiles in a reproducible browser-like runner. */
import {parsePublicHistory} from "./badhub-history-parser.mjs";
const people=[
 ["05-067838","Amélie Zhu"],["05-070637","Anneliese Zhu"],["05-069897","Benjamin Belser"],
 ["05-071969","Charlotte Metzger"],["05-061414","Julian Mikitisin"],["05-061352","Kian Tiegs"],
 ["05-067866","Léona Plaisant"],["05-070915","Philipp Landhäußer"],
 ["05-070879","Philipp Metzger"],["05-061350","Sarah Storz"],
 ["05-070941","Saran Saengkla"],["05-070006","Vinzent Pius Ott"],["05-068197","Vladimir Gehl"]];
async function get(id,category){
 const url="https://badhub.de/spieler/"+id+"?src="+category+"&saison=all";
 try {
  const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),13000);
  try{
   const res=await fetch(url,{redirect:"error",signal:ctl.signal,headers:{Accept:"text/html"}});
   if(!res.ok||!(res.headers.get("content-type")||"").includes("text/html"))return {status:res.status};
   if(Number(res.headers.get("content-length")||0)>5500000)return {status:"oversized"};
   const html=await res.text();
   if(html.length>5500000)return {status:"oversized"};
   return {status:res.status,html};
  }finally{clearTimeout(timeout)}
 }catch(error){return {status:error?.name==="AbortError"?"timeout":"unavailable"}}
}
function contradictions(rows){
 const knock=/^(?:achtelfinale|viertelfinale|halbfinale|finale|\d+[.]\/\d+[.]\s*platz)$/i;
 const seen=new Map(),bad=new Set();
 for(const r of rows){
  const round=String(r.round_label||"").trim().toLowerCase().replace(/\s+/g," ");
  if(r.category!=="tournament"||!knock.test(round))continue;
  const key=[r.competition_id,r.event,round].join("|");
  seen.set(key,(seen.get(key)||0)+1);
  if(seen.get(key)>1)bad.add([r.competition_id,r.event].join("|"));
 }
 return {bad,rest:rows.filter(x=>!bad.has([x.competition_id,x.event].join("|")))};
}
let done=0,sourceOK=0,sourceGone=0,count=0,eligible=0,containsTarget=0;
const results=await Promise.all(people.map(async ([id,name],index)=>{
 const check=[];
 for(const kind of ["turnier","liga"]){
  const data=await get(id,kind);let matches=[],candidates=0,reason=null;
  if(data.html){
   sourceOK++;
   try{
    const parsed=parsePublicHistory(data.html,{dbv_id:id,name},kind==="turnier"?"tournament":"league");
    matches=parsed.items;candidates=parsed.cards_seen;
   }catch(e){reason="parser_mismatch"}
  }else sourceGone++;
  const related=matches.filter(m=>m.opponent_names.some(p=>p.toLowerCase().includes("charlotte metzger")));
  containsTarget+=related.length;count+=matches.length;
  const clean=contradictions(matches);eligible+=clean.rest.length;
  check.push({source:kind,status:data.status,cardCount:candidates,parsed:matches.length,
   safe:clean.rest.length,conflictedEvents:clean.bad.size,opponentMatchFound:related.length,reason});
 }
 done++;
 return {profile:index+1,results:check};
}));
console.log("FRESH_SOURCE_AUDIT "+JSON.stringify({profiles:done,sources_ok:sourceOK,sources_unavailable:sourceGone,
 candidate_cards:count,noncontradictory_cards:eligible,target_opponent_match_cards:containsTarget}));
for(const result of results)console.log("FRESH_PROFILE "+JSON.stringify(result));

// Optional, bounded Badhub source audit. Records only grouped rejection reasons,
// never page HTML, opponent names, raw match cards or credentials.
import {parsePublicHistory} from "./badhub-history-parser.mjs";
const player={dbv_id:"05-070879",name:"Philipp Metzger"};
const results=[];
for(const category of ["turnier","liga"]){
 const url="https://badhub.de/spieler/"+player.dbv_id+"?src="+category+"&saison=all";
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(url,{signal:controller.signal,redirect:"error",
   headers:{Accept:"text/html","User-Agent":"Schmetterlinge-source-audit/1.0"}});
  if(!response.ok||!String(response.headers.get("content-type")).includes("text/html"))
   throw Error("Unreachable source");
  const html=await response.text();
  if(html.length>5500000)throw Error("Oversize page");
  const data=parsePublicHistory(html,player,category==="turnier"?"tournament":"league");
  results.push({source:category,cardCount:data.cards_seen,accepted:data.items.length,
   rejected:Math.max(0,data.cards_seen-data.items.length),
   reasons:data.rejection_reasons});
 }catch(error){results.push({source:category,status:"unavailable",reason:error.name==="AbortError"?"timeout":"fetch_or_parse_failed"});}
 finally{clearTimeout(timer);}
}
console.log("Sourced match-card diagnostic (no personally identifying match data):");
console.log(JSON.stringify(results));

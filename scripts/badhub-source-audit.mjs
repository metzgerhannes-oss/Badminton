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
  const grouped={};
  for(const item of data.items){
   const key=item.category+":"+(item.match_year||"unknown")+":"+item.competition_id;
   if(!grouped[key])grouped[key]={count:0,wins:0};
   grouped[key].count++;
   if(item.player_side===item.winning_side)grouped[key].wins++;
  }
  // Anonymous histogram of set-size patterns; helps identify youth shortened games.
  const scoreHistogram={};
  const maxEndpointHistogram={};
  const scoreLengthHistogram={};
  const shortPatterns={};
  for(const chunk of html.split(/<div class="sp-match-item\b[^>]*>/).slice(1)){
   const values=[...chunk.matchAll(/class="sp-set-score"[^>]*>([\s\S]*?)<\/div>/g)]
    .map(m=>[...m[1].matchAll(/class="sp-s(?: [^"]*)?"[^>]*>(\d{1,2})<\/span>/g)]
     .map(x=>Number(x[1]))).filter(v=>v.length===2);
   const max=values.length?Math.max(...values.flat()):0;
   const band=max>=30?"30+":max>=21?"21-29":max>=15?"15-20":max>=11?"11-14":max?"under11":"no-sets";
   scoreHistogram[band]=(scoreHistogram[band]||0)+1;
   const endpoint=String(max||0);maxEndpointHistogram[endpoint]=(maxEndpointHistogram[endpoint]||0)+1;
   const scoreType=endpoint+"/"+values.length+" sets";scoreLengthHistogram[scoreType]=(scoreLengthHistogram[scoreType]||0)+1;
   if(max>=15&&max<21){const p=values.map(v=>Math.max(...v)).sort((a,b)=>a-b).join("-");shortPatterns[p]=(shortPatterns[p]||0)+1;}
  }
  results.push({source:category,cardCount:data.cards_seen,accepted:data.items.length,
   rejected:Math.max(0,data.cards_seen-data.items.length),
   reasons:data.rejection_reasons,
   acceptedCompetitionCounts:Object.values(grouped).map(v=>v.count).sort((a,b)=>b-a).slice(0,10),
   scoreBands:scoreHistogram,scoreMaxima:maxEndpointHistogram,scoreLengths:scoreLengthHistogram,shortSetWinnerPoints:shortPatterns});
 }catch(error){results.push({source:category,status:"unavailable",reason:error.name==="AbortError"?"timeout":"fetch_or_parse_failed"});}
 finally{clearTimeout(timer);}
}
console.log("Sourced match-card diagnostic (no personally identifying match data):");
console.log(JSON.stringify(results));

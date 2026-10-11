import {classifyNonPlayedCard} from "./nonplayed-rounds.mjs";
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
  if(category==="turnier")reportUnknownScorelessCards(html);
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
  const skipKeywords={bye:0,rast:0,rust:0,freilos:0,spielfrei:0,wo:0,walkover:0,aufgabe:0,unknown:0};
  const noScoreClassHints={};
  const noScoreSides={};
  const roundKinds={};
  for(const chunk of html.split(/<div class="sp-match-item\b[^>]*>/).slice(1)){
   const values=[...chunk.matchAll(/class="sp-set-score"[^>]*>([\s\S]*?)<\/div>/g)]
    .map(m=>[...m[1].matchAll(/class="sp-s(?: [^"]*)?"[^>]*>(\d{1,2})<\/span>/g)]
     .map(x=>Number(x[1]))).filter(v=>v.length===2);
   const roundKind=classifyNonPlayedCard(chunk);
   if(roundKind)roundKinds[roundKind]=(roundKinds[roundKind]||0)+1;
   const max=values.length?Math.max(...values.flat()):0;
   if(values.length===0){
    const keywords={bye:/\bBYE\b/i,rast:/\bRAST\b/i,rust:/\bRUST\b/i,
      freilos:/\bFreilos\b/i,spielfrei:/\bspielfrei\b/i,
      wo:/\bW[.]?O[.]?\b/i,walkover:/\bwalkover\b/i,aufgabe:/\bAufgabe\b/i};
    let found=false;
    for(const [key,re] of Object.entries(keywords))
     if(re.test(chunk)){skipKeywords[key]++;found=true;}
    if(!found)skipKeywords.unknown++;
    const a=chunk.indexOf('class="sp-match-body"');
    const scoreAt=chunk.indexOf('class="sp-result-col"',Math.max(0,a));
    const awayAt=chunk.indexOf('class="sp-side sp-side--away"',Math.max(0,scoreAt));
    const home=a>=0?chunk.slice(a,scoreAt>=0?scoreAt:undefined):"";
    const away=awayAt>=0?chunk.slice(awayAt):"";
    const countNames=s=>(s.match(/class="sp-name-full"/g)||[]).length;
    const flag=(countNames(home)>0?"home-name":"no-home")+"-"+(countNames(away)>0?"away-name":"no-away")+
      "-"+(chunk.includes("sp-side--winner")?"marked-winner":"no-winner");
    noScoreSides[flag]=(noScoreSides[flag]||0)+1;
    // Aggregate CSS modifier families; do not output HTML or player details.
    const names=[...chunk.matchAll(/class="([^"]+)"/g)].flatMap(m=>m[1].split(/\s+/))
       .filter(v=>/^(sp-match|sp-side|sp-result|sp-status|sp-player)/.test(v))
       .map(v=>v.replace(/\d+/g,"#"));
    for(const name of new Set(names))noScoreClassHints[name]=(noScoreClassHints[name]||0)+1;
   }
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
   scoreBands:scoreHistogram,scoreMaxima:maxEndpointHistogram,scoreLengths:scoreLengthHistogram,shortSetWinnerPoints:shortPatterns,skipKeywords,noScoreClassHints,noScoreSides,roundKinds});
 }catch(error){results.push({source:category,status:"unavailable",reason:error.name==="AbortError"?"timeout":"fetch_or_parse_failed"});}
 finally{clearTimeout(timer);}
}
console.log("Sourced match-card diagnostic (no personally identifying match data):");
console.log(JSON.stringify(results));

/* Temporary public-source review. Print ONLY cards without readable scores.
 * Never output HTML source, response headers, cookies or account data. */
function normalizePublicText(str){
 return String(str||"").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/g," ")
  .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/\s+/g," ").trim().slice(0,170);
}
function firstContent(markup,regex){
 const m=markup.match(regex);return normalizePublicText(m?.[1]||"");
}
function publicNames(markup){
 return [...markup.matchAll(/class="sp-name-full"[^>]*>([\s\S]*?)<\/span>/g)]
  .map(m=>normalizePublicText(m[1])).filter(Boolean).slice(0,2);
}
function reportUnknownScorelessCards(html){
 const unknown=[];
 const sections=html.split(/<div class="card sp-tournament-card(?: [^"]*)?">/).slice(1);
 for(const section of sections){
  const top=section.slice(0,section.indexOf('<div class="sp-meeting">')>0?section.indexOf('<div class="sp-meeting">'):1400);
  const head=top.match(/class="sp-tournament-name"[^>]*>[\s\S]*?<a href="\/(bwbv|dbv)\/turnier\.php\?id=(\d+)"[^>]*>([\s\S]*?)<\/a>/);
  const tournament=head?normalizePublicText(head[3]):"Turniername nicht lesbar";
  const link=head?"https://badhub.de/"+head[1]+"/turnier.php?id="+head[2]:null;
  const date=firstContent(top,/class="sp-tournament-meta"[^>]*>([\s\S]*?)<\/span>/);
  const meetings=section.split(/<div class="sp-meeting">/).slice(1);
  for(const meeting of meetings){
   const event=firstContent(meeting.slice(0,950),/class="sp-t-event-badge"[^>]*>([\s\S]*?)<\/span>/);
   const split=meeting.split(/<div class="sp-match-item\b[^>]*>/);
   let phase=firstContent(split[0],/class="sp-t-phase-header"[^>]*>([\s\S]*?)<\/div>/);
   for(let i=1;i<split.length;i++){
    const card=split[i];
    const sets=[...card.matchAll(/class="sp-set-score"[^>]*>([\s\S]*?)<\/div>/g)]
     .map(m=>[...m[1].matchAll(/class="sp-s(?: [^"]*)?"[^>]*>(\d{1,2})<\/span>/g)])
     .filter(values=>values.length===2);
    if(!sets.length){
     const bodyStart=card.search(/class="[^"]*\bsp-match-body\b/);
     const resultAt=card.search(/class="[^"]*\bsp-result-col\b/);
     const awayAt=card.search(/class="(?=[^"]*\bsp-side\b)(?=[^"]*\bsp-side--away\b)[^"]*"/);
     const home=bodyStart>=0&&resultAt>=bodyStart?card.slice(bodyStart,resultAt):"";
     const center=resultAt>=0&&awayAt>=resultAt?card.slice(resultAt,awayAt):"";
     const away=awayAt>=0?card.slice(awayAt,card.indexOf("</div>",awayAt)+6):"";
     const label=normalizePublicText(center);
     const sourceWinnerSide=home.includes("sp-side--winner")?"links":
         away.includes("sp-side--winner")?"rechts":"kein Sieger markiert";
     const sourceSelfSide=home.includes("sp-player-name--self")?"links":
         away.includes("sp-player-name--self")?"rechts":"nicht erkennbar";
     unknown.push({tournament,date,event,round:phase||"nicht ausgewiesen",
       left:publicNames(home),right:publicNames(away),
       resultText:label||"kein Satzergebnis",winner:sourceWinnerSide,
       playerSide:sourceSelfSide,source:link,cardInEvent:i});
    }
    const next=firstContent(card,/class="sp-t-phase-header"[^>]*>([\s\S]*?)<\/div>/);
    if(next)phase=next;
   }
  }
 }
 console.log("REVIEW_PHILIPP_UNRESOLVED="+JSON.stringify({count:unknown.length,cards:unknown}));
}

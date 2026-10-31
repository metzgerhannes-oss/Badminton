import {summarizeTrophies,TROPHY_PLACES} from "./scripts/trophy-stats.mjs";
import {parseResultEvidenceHash} from "./scripts/result-evidence-nav.mjs";
import {trophySnapshot,requestPrivateTrophies} from "./scripts/private-trophy-source.mjs";
"use strict";
/** Curated, sourced historical tournament placements; never a live DBV API. */
(() => {
 // Public history.json is a deliberately empty privacy placeholder.
 let records=[],pendingResults=[],loaded=true,error=null,year="all",discipline="all",lastPlayer="all",lastProfiles=[],trophyPlace="all",viewMode="own";
 let priorProofFilters=null,activeProofId="";
 const $=id=>document.getElementById(id);
 const escape=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 const safeUrl=s=>{try{const u=new URL(String(s));return u.protocol==="https:"?u.href:""}catch{return ""}};
 const dateFmt=new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"short",year:"numeric",timeZone:"Europe/Berlin"});
 const niceDate=s=>{const t=new Date(s+"T12:00:00Z");return Number.isNaN(t.getTime())?s:dateFmt.format(t)};
 const rank=n=>n===1?"gold":n===2?"silver":n===3?"bronze":"standard";
 const playerMatch=(r,selected)=>DBV_ID.test(selected)&&r?.playerId===selected;
 const DBV_ID=/^[0-9]{2}-[0-9]{6}$/;
 function plotTrends(chosen){
 const root=$("history-trends");if(!root)return;
 const groups=new Map();
 for(const r of chosen.filter(x=>x.discipline==="Einzel")){
   const playerLabel=r.playerName||lastProfiles.find(p=>p.id===r.playerId)?.name||"Spieler";
   const group=playerLabel+"|"+r.ageGroup;
   if(!groups.has(group))groups.set(group,[]);
   groups.get(group).push(r);
 }
 const eligible=[...groups.entries()].filter(([,items])=>items.length>=2).sort((a,b)=>a[0].localeCompare(b[0],"de"));
 if(!eligible.length){root.innerHTML="";return}
 const diagrams=eligible.map(([label,items])=>{
   const data=items.slice().sort((a,b)=>a.date.localeCompare(b.date));
   const w=340,left=35,right=19,top=24,bottom=20,lowest=1,highest=Math.max(8,...data.map(x=>x.place)),graphH=90;
   const x=i=>left+(data.length===1?0:i*(w-left-right)/(data.length-1));
   const y=p=>top+(p-lowest)/(highest-lowest)*graphH;
   const points=data.map((p,i)=>({x:x(i),y:y(p.place),place:p.place,date:p.date}));
   const path=points.map((p,i)=>(i?"L":"M")+p.x.toFixed(1)+" "+p.y.toFixed(1)).join(" ");
   const circles=points.map(p=>'<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="4.3" fill="#9de5ff" stroke="#17395c" stroke-width="2"/><text x="'+p.x.toFixed(1)+'" y="'+Math.max(p.y-9,11).toFixed(1)+'" text-anchor="middle" font-size="11" font-weight="700" fill="#e8f6ff">'+p.place+'.</text>').join("");
   const ticks=points.map((p,i)=>'<text x="'+p.x.toFixed(1)+'" y="'+(top+graphH+18)+'" text-anchor="middle" font-size="9" fill="#adbfda">'+escape(data[i].date.slice(2,7))+'</text>').join("");
   const svg='<svg class="history-spark" viewBox="0 0 340 142" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+escape(label)+': '+data.map(p=>p.place+". Platz am "+p.date).join(", ")+'"><path d="M35 114 H321" stroke="#476581" stroke-dasharray="4 4" fill="none"/><path d="'+path+'" stroke="#8bd8ff" stroke-width="2.6" stroke-linejoin="round" fill="none"/>'+circles+ticks+'</svg>';
   return '<div class="history-trend-card"><div class="history-trend-title">'+escape(label.replace("|"," · "))+'</div>'+svg+'</div>';
 });
 root.innerHTML='<h3>Platzierungsverlauf</h3><p>Vergleich nur innerhalb derselben Altersklasse und Disziplin. Niedrigere Platznummer = bessere Platzierung; keine Ranglistenpunkte.</p>'+diagrams.join("");
}


 const trophyLevels={
  1:{title:"Gold",caption:"1. Platz",detail:"Turniersiege",tone:"gold"},
  2:{title:"Silber",caption:"2. Platz",detail:"Finalteilnahmen",tone:"silver"},
  3:{title:"Bronze",caption:"3. Platz",detail:"Podestplätze",tone:"bronze"},
  4:{title:"Vierter Platz",caption:"4. Platz",detail:"Top-4-Ergebnisse",tone:"fourth"}
 };
 function trophyIcon(place){
  if(place===4){
   return '<svg viewBox="0 0 94 104" width="94" height="104" aria-hidden="true" focusable="false"><path d="M32 12l15 13 15-13 7 35-22 13-22-13z" fill="#6294ca"/><path d="M32 12l15 13-6 27-16-5z" fill="#9bc7f0"/><path d="M62 12L47 25l6 27 16-5z" fill="#386da8"/><circle cx="47" cy="59" r="28" fill="#2c5b92" stroke="#a8d9ff" stroke-width="3"/><circle cx="47" cy="59" r="20" fill="#80bff2" stroke="#d3ecff" stroke-width="2"/><text x="47" y="72" font-size="34" text-anchor="middle" font-weight="900" fill="#133960">4</text></svg>';
  }
  const color=place===1?["#FFF0AF","#E7AC38","#A66A1B"]:place===2?["#F6FAFF","#B3C5DB","#70859D"]:["#FFE4C2","#C48455","#7D4A32"];
  const gradient="metal-"+place;
  return '<svg viewBox="0 0 94 104" width="94" height="104" aria-hidden="true" focusable="false"><defs><linearGradient id="'+gradient+'" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="'+color[0]+'"/><stop offset="55%" stop-color="'+color[1]+'"/><stop offset="100%" stop-color="'+color[2]+'"/></linearGradient></defs><path d="M25 20H69V38C69 57 60 67 47 67S25 57 25 38Z" fill="url(#'+gradient+')" stroke="'+color[2]+'" stroke-width="2"/><path d="M25 28H13v9c0 14 10 20 21 20M69 28h12v9c0 14-10 20-21 20" fill="none" stroke="'+color[1]+'" stroke-width="8" stroke-linecap="round"/><path d="M38 66h18v12H38zM29 79h36v10H29z" fill="url(#'+gradient+')" stroke="'+color[2]+'" stroke-width="1.4"/><path d="M37 23v15c0 14 3 19 8 22" fill="none" stroke="#fff" stroke-opacity=".52" stroke-width="3" stroke-linecap="round"/><circle cx="47" cy="40" r="11" fill="'+color[2]+'" fill-opacity=".18"/><text x="47" y="46" font-size="16" font-weight="900" text-anchor="middle" fill="'+color[2]+'">'+place+'</text></svg>';
 }
 function renderTrophies(chosen){
  const shelf=$("trophy-shelf"),awards=$("trophy-awards"),title=$("trophy-awards-heading"),showAll=$("trophy-show-all");
  if(!shelf||!awards||!title||!showAll)return;
  const {counts,results,total}=summarizeTrophies(chosen);
  shelf.innerHTML=TROPHY_PLACES.map(place=>{
    const conf=trophyLevels[place];
    const active=String(place)===String(trophyPlace);
    const value=counts[place];
    return '<button type="button" class="trophy-slot trophy-'+conf.tone+(active?' active':'')+(value===0?' not-yet':'')+'" data-place="'+place+'" aria-pressed="'+active+'" aria-label="'+conf.caption+': '+value+' Auszeichnungen anzeigen"><span class="trophy-glow" aria-hidden="true"></span><span class="trophy-illustration">'+trophyIcon(place)+'</span><span class="trophy-count">'+value+'</span><strong class="trophy-label">'+conf.title+'</strong><small class="trophy-rank">'+conf.caption+'</small></button>';
  }).join("");
  shelf.querySelectorAll("[data-place]").forEach(button=>button.addEventListener("click",()=>{
    trophyPlace=String(button.dataset.place);
    renderTrophies(chosen);
  }));
  showAll.hidden=trophyPlace==="all";
  const selected=results.filter(r=>trophyPlace==="all"||r.place===Number(trophyPlace));
  title.textContent=trophyPlace==="all"?"Alle Auszeichnungen ("+total+")":trophyLevels[Number(trophyPlace)].caption+" ("+selected.length+")";
  if(!selected.length){
    awards.innerHTML='<div class="trophy-empty"><span aria-hidden="true">✦</span><p>'+(total===0?'Für diese Auswahl sind bisher keine Platzierungen von 1 bis 4 belegt.':'Für diese Platzierung gibt es in der aktuellen Auswahl noch keinen belegten Eintrag.')+'</p></div>';
    return;
  }
  awards.innerHTML=selected.map(r=>{
    const conf=trophyLevels[r.place];
    const source=safeUrl(r.source?.url);
    const verification=safeUrl(r.verification?.url);
    const person=lastPlayer==="all"?'<span>'+escape(r.playerName)+'</span>':"";
    return '<article class="trophy-award"><div class="trophy-award-icon trophy-'+conf.tone+'" aria-hidden="true">'+(r.place===4?'4':'★')+'</div><div class="trophy-award-info"><div class="trophy-award-top"><strong>'+conf.caption+'</strong><span>'+escape(niceDate(r.date))+'</span></div><div class="trophy-award-title">'+escape(r.event)+'</div><div class="trophy-award-meta">'+person+'<span>'+escape(r.discipline)+' · '+escape(r.ageGroup)+'</span>'+(r.partner?'<span>mit '+escape(r.partner)+'</span>':'')+'</div>'+(r.confirmation==="family-confirmed"?'<div class="history-family-flag">Familienbestätigung · offizielle Detailprüfung offen</div>':'')+(source?'<a target="_blank" rel="noopener noreferrer" href="'+escape(source)+'">'+(source.includes("dbv.turnier.de")?'DBV-Turnier ansehen ↗':'Turnierbericht ansehen ↗')+'</a>':'')+(verification?'<a class="history-verification-link" target="_blank" rel="noopener noreferrer" href="'+escape(verification)+'">Namentlichen Ergebnisbeleg öffnen ↗</a>':'')+'</div></article>';
  }).join("");
 }

function renderPending(){
  const panel=$("history-pending"); if(!panel)return;
  const filtered=pendingResults.filter(r=>playerMatch(r,lastPlayer)&&
    (year==="all"||r.date.startsWith(year))&&
    (discipline==="all"||r.discipline===discipline));
  panel.innerHTML=filtered.map(r=>{
    const link=safeUrl(r.source?.url);
    return '<div class="pending-medal"><strong>Zur Prüfung: möglicherweise '+escape(r.place)+'. Platz im '+escape(r.discipline)+'</strong><span>'+escape(r.event)+' · '+escape(niceDate(r.date))+'</span><p>Von der Familie vermutet, noch nicht anhand der offiziellen Ergebnisse bestätigt. Zählt derzeit nicht als Trophäe.</p>'+(link?'<a href="'+escape(link)+'" rel="noopener noreferrer" target="_blank">Offiziellen Turnierbericht öffnen ↗</a>':'')+'</div>';
  }).join("");
}
function render(){
  const source=$("history-source"),coverage=$("history-source-coverage"),summary=$("history-summary"),timeline=$("history-timeline"),yearSelect=$("history-year");
  if(!source||!summary||!timeline||!yearSelect)return;
  if(coverage){coverage.hidden=true;coverage.textContent=""}
  const filters=$("history-filters");
  const chronicle=document.querySelector("#view-historie .history-chronicle-title");
  const rankingNote=document.querySelector("#view-historie .history-ranking-note");
  const showChronicle=visible=>{
   if(filters)filters.hidden=!visible;
   if(chronicle)chronicle.hidden=!visible;
   if(rankingNote)rankingNote.hidden=!visible;
  };
  if(error){showChronicle(false);source.hidden=false;source.textContent="Die Historie konnte nicht geladen werden. "+error;summary.innerHTML="";timeline.innerHTML="";$("history-pending").innerHTML="";$("trophy-shelf").innerHTML="";$("trophy-awards").innerHTML="";return;}
  // The history opens directly with the trophies. Show a notice only if loading fails.
  source.hidden=true;
  source.textContent="";
  if(!loaded){showChronicle(false);return;}
  const state=trophySnapshot(lastPlayer);
  const trophySection=$("trophy-shelf")?.closest(".trophy-section");
  if(state.state!=="ready"){
   const notice=state.state==="loading"
    ?"Private Platzierungen werden geprüft."
    :state.state==="protected"
    ?"Diese Auszeichnungen sind privat geschützt. Ein gültiger neuer Berechtigungslink oder ein unabhängig bestätigter Verwalternachweis ist erforderlich."
    :"Die private Ergebnisquelle ist vorübergehend nicht abrufbar; das bedeutet nicht 0 Trophäen.";
   if(trophySection)trophySection.hidden=true;
   showChronicle(false);
   source.classList.add("history-private-notice");
   source.hidden=false;source.textContent=notice;
   if(state.state==="unavailable"){
    const retry=document.createElement("button");
    retry.type="button";retry.className="outline-button history-private-retry";
    retry.textContent="Erneut laden";
    retry.addEventListener("click",()=>{
     retry.disabled=true;retry.textContent="Ergebnisse werden geprüft …";
     void requestPrivateTrophies(lastPlayer,{force:true});
    });
    source.append(retry);
   }
   // One accessible notice, not the same error again in a dark empty card.
   summary.innerHTML="";timeline.innerHTML="";
   $("history-trends").innerHTML="";$("history-pending").innerHTML="";
   $("trophy-shelf").innerHTML="";$("trophy-awards").innerHTML="";
   $("trophy-awards-heading").textContent="Auszeichnungen";
   return;
  }
  // All sourced placements are displayed in the chronology. Only verified
  // top-four finishes produce trophies. Coverage may be incomplete.
  source.hidden=true;source.textContent="";
  showChronicle(true);
  // Partial-coverage notes are accessible behind the existing source disclosure.
  // Authentication, loading and failure notices stay visibly on the page.
  if(coverage){
   coverage.hidden=false;
   coverage.textContent=state.coverage==="device_snapshot"
    ?"Lokale Datenkopie vom "+new Date(state.fetchedAt).toLocaleDateString("de-DE")+": belegte Top-4-Platzierungen. Keine automatische Aktualisierung."
    :state.coverage==="sourced_placements_partial"
    ?"Belegte Platzierungen aller Ränge im aktuellen Quellenbestand. Im Trophäenschrank zählen nur bestätigte Top-4-Ergebnisse. Die Historie kann Lücken enthalten."
    :"Geschütztes Teilarchiv: Belegte Top-4-Platzierungen. Weitere Ergebnisse können fehlen.";
  }
  const playerRecords=state.results.filter(r=>r.playerId===lastPlayer);
  // Fragment is only a display pointer; authorization always comes from the
  // exact already-granted player snapshot, never from a URL-supplied identity.
  const proofId=parseResultEvidenceHash(location.hash);
  const proof=proofId?playerRecords.find(r=>r.id===proofId&&r.verified===true):null;
  if(!proofId&&priorProofFilters){
   year=priorProofFilters.year;discipline=priorProofFilters.discipline;
   priorProofFilters=null;activeProofId="";
  }
  if(proof&&proofId!==activeProofId){
   if(!priorProofFilters)priorProofFilters={year,discipline};
   year=proof.date.slice(0,4);discipline=proof.discipline;trophyPlace="all";
   activeProofId=proofId;
  }
  const notice=$("history-proof-feedback");
  if(notice){
   notice.hidden=!proofId;
   notice.textContent=!proofId?"":!proof
    ?"Für das ausgewählte Profil ist dieser Einzelnachweis nicht verfügbar oder nicht freigegeben."
    :proof.matchEvidence?.kind==="club-report-scored-games"
    ?"Bestätigte Einzelspiele aus dem Vereinsbericht; nicht Teil der Badhub-Statistik."
    :"Keine einzelnen Matchbelege verfügbar. Die belegte Platzierung und die vorhandenen Originalquellen sind unten verlinkt.";
  }
  // Lifetime trophy cabinet is independent of the chronicle's year/discipline filters.
  renderTrophies(playerRecords);
  if(trophySection)trophySection.hidden=false;
  const years=[...new Set(playerRecords.map(r=>r.date.slice(0,4)))].sort((a,b)=>b.localeCompare(a));
  const old=year;
  yearSelect.innerHTML='<option value="all">Alle Jahre</option>'+years.map(v=>'<option value="'+escape(v)+'">'+escape(v)+'</option>').join("");
  year=years.includes(old)?old:"all";yearSelect.value=year;
  renderPending();
  const chosen=playerRecords.filter(r=>(year==="all"||r.date.startsWith(year))&&(discipline==="all"||r.discipline===discipline))
    .slice().sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  const events=new Set(chosen.map(r=>r.event+"|"+r.date));
  plotTrends(chosen);
  const podium=chosen.filter(r=>r.place<=3).length;
  const playerCount=new Set(chosen.map(r=>r.playerId)).size;
  summary.innerHTML=[
    ['Turniere',events.size],['Platzierungen',chosen.length],['Podestplätze',podium]
  ].map(([k,v])=>'<div class="history-stat"><span>'+escape(k)+'</span><strong>'+escape(v)+'</strong></div>').join("");
  if(!chosen.length){timeline.innerHTML='<div class="empty"><h3>Keine Einträge für diese Auswahl</h3><p>Die verifizierten Ergebnisse werden ergänzt, sobald weitere Quellen vorliegen.</p></div>';return}
  const grouped=new Map();
  for(const r of chosen){
   const key=r.date+"|"+r.event+"|"+r.playerId;
   if(!grouped.has(key))grouped.set(key,{date:r.date,event:r.event,playerId:r.playerId,playerName:r.playerName,location:r.location,source:r.source,items:[]});
   grouped.get(key).items.push(r);
  }
  timeline.innerHTML=[...grouped.values()].map(t=>{
    const sourceUrl=safeUrl(t.source?.url);
    const proofUrl=safeUrl(t.items.find(r=>r.verification?.url)?.verification?.url);
    const entries=t.items.map(r=>'<div class="history-result" data-proof-id="'+escape(r.id)+'"><div class="history-place '+rank(r.place)+'"><b>'+escape(r.place)+'.</b><small>Platz</small></div><div class="history-result-copy"><strong>'+escape(r.discipline)+" "+escape(r.ageGroup)+'</strong>'+(r.partner?'<small>mit '+escape(r.partner)+'</small>':"")+
   (r.matchEvidence?.kind==="club-report-at-least-one-win"
    ?'<p class="history-match-evidence">Vereinsbericht: mindestens '+escape(r.matchEvidence.minimumWins)+
      ' Sieg bestätigt. Gegner und Satzstände fehlen – nicht in der Spielstatistik enthalten.</p>':"")+
   (r.matchEvidence?.kind==="club-report-scored-games"&&Array.isArray(r.matchEvidence.matches)
    ?'<section class="history-scored-match-proof"><strong>Einzelspiele aus Vereinsbericht · nicht in der Badhub-Statistik enthalten</strong><ul>'+
      r.matchEvidence.matches.filter(m=>Array.isArray(m.games)&&[2,3].includes(m.games.length)&&
        m.games.every(g=>Array.isArray(g)&&g.length===2&&g.every(v=>Number.isInteger(v)&&v>=0&&v<=30)))
       .map(m=>'<li><span>'+escape(m.result)+' gegen '+escape(m.opponent)+'</span><small>Sätze: '+
         escape(m.games.map(g=>g[0]+":"+g[1]).join(" · "))+'</small></li>').join("")+
      '</ul><small>Quellbeleg aus Vereinsbericht; noch ohne Abgleich eindeutiger Match-IDs</small></section>':"")+
   (proof&&r.id===proof.id&&r.matchEvidence?.kind!=="club-report-scored-games"
    ?'<p class="history-detail-note">Keine einzelnen Matchbelege verfügbar · Platzierungsquelle siehe unten.</p>':"")+
   '</div></div>').join("");
    return '<article class="history-event"><div class="history-stem" aria-hidden="true"></div><div class="history-content"><div class="history-date">'+escape(niceDate(t.date))+'</div><h3>'+escape(t.event)+'</h3><div class="history-location">'+escape(t.location||"Ort unbekannt")+(lastPlayer==="all"?" · "+escape(t.playerName):"")+'</div><div class="history-results">'+entries+'</div>'+(t.items.some(i=>i.confirmation==="family-confirmed")?'<div class="history-family-flag">Familienbestätigung · offizielle Detailprüfung offen</div>':'')+(sourceUrl?'<a href="'+escape(sourceUrl)+'" target="_blank" rel="noopener noreferrer" class="history-source-link">'+(sourceUrl.includes("dbv.turnier.de")?'DBV-Turnierergebnisse ↗':'Originalbericht ansehen ↗')+'</a>':"")+(proofUrl?'<a href="'+escape(proofUrl)+'" target="_blank" rel="noopener noreferrer" class="history-source-link history-verification-link">Namentlichen Ergebnisbeleg ↗</a>':"")+'</div></article>';
  }).join("");
  if(proof){
   const node=[...timeline.querySelectorAll("[data-proof-id]")].find(x=>x.dataset.proofId===proof.id);
   if(node){
    node.classList.add("is-proof-target");
    node.setAttribute("tabindex","-1");
    const route=location.hash;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
     if(location.hash!==route||!node.isConnected)return;
     node.scrollIntoView({block:"center",behavior:"auto"});
     node.focus({preventScroll:true});
    }));
   }
  }
 }
 window.addEventListener("hashchange",()=>{if(lastPlayer&&document.getElementById("view-historie"))render()});
 window.renderHistory=(selected,profiles,options={})=>{
   lastPlayer=selected||"";lastProfiles=Array.isArray(profiles)?profiles:[];viewMode=options.mode==="friend"?"friend":"own";
   requestPrivateTrophies(lastPlayer);
   render();
 };
 document.addEventListener("DOMContentLoaded",()=>{
  $("history-year")?.addEventListener("change",e=>{year=e.target.value;render()});
  $("history-discipline")?.addEventListener("change",e=>{discipline=e.target.value;render()});
  $("trophy-show-all")?.addEventListener("click",()=>{trophyPlace="all";render();});
  render();
 });
 window.addEventListener("badminton:private-trophies-updated",event=>{
  if(event.detail?.playerId===lastPlayer)render();
 });
})();

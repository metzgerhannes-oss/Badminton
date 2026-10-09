"use strict";
/** Curated, sourced historical tournament placements; never a live DBV API. */
(() => {
 const feedUrl="./data/history.json";
 let records=[],loaded=false,error=null,year="all",discipline="all",lastPlayer="all",lastProfiles=[];
 const $=id=>document.getElementById(id);
 const escape=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 const safeUrl=s=>{try{const u=new URL(String(s));return u.protocol==="https:"?u.href:""}catch{return ""}};
 const dateFmt=new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"short",year:"numeric",timeZone:"Europe/Berlin"});
 const niceDate=s=>{const t=new Date(s+"T12:00:00Z");return Number.isNaN(t.getTime())?s:dateFmt.format(t)};
 const rank=n=>n===1?"gold":n===2?"silver":n===3?"bronze":"standard";
 const playerMatch=(r,selected)=>{
  if(selected==="all")return true;
  const profile=lastProfiles.find(p=>p.id===selected);
  return r.playerId===selected || (!!profile && r.playerName===profile.name) || (!!profile && r.playerId===profile.name);
 };
 function render(){
  const source=$("history-source"),summary=$("history-summary"),timeline=$("history-timeline"),yearSelect=$("history-year");
  if(!source||!summary||!timeline||!yearSelect)return;
  if(error){source.textContent="Die Historie konnte nicht geladen werden. "+error;summary.innerHTML="";timeline.innerHTML="";return;}
  if(!loaded){source.textContent="Verifizierte Platzierungen werden geladen …";return;}
  source.textContent="Ausgewählte, belegte Turnierergebnisse aus Vereinsberichten (2025–2026). Keine vollständige DBV-Matchhistorie; Satzergebnisse nur mit Quelle.";
  const playerRecords=records.filter(r=>playerMatch(r,lastPlayer));
  const years=[...new Set(playerRecords.map(r=>r.date.slice(0,4)))].sort((a,b)=>b.localeCompare(a));
  const old=year;
  yearSelect.innerHTML='<option value="all">Alle Jahre</option>'+years.map(v=>'<option value="'+escape(v)+'">'+escape(v)+'</option>').join("");
  year=years.includes(old)?old:"all";yearSelect.value=year;
  const chosen=playerRecords.filter(r=>(year==="all"||r.date.startsWith(year))&&(discipline==="all"||r.discipline===discipline))
    .slice().sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  const events=new Set(chosen.map(r=>r.event+"|"+r.date));
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
    const entries=t.items.map(r=>'<div class="history-result"><div class="history-place '+rank(r.place)+'"><b>'+escape(r.place)+'.</b><small>Platz</small></div><div class="history-result-copy"><strong>'+escape(r.discipline)+" "+escape(r.ageGroup)+'</strong>'+(r.partner?'<small>mit '+escape(r.partner)+'</small>':"")+'</div></div>').join("");
    return '<article class="history-event"><div class="history-stem" aria-hidden="true"></div><div class="history-content"><div class="history-date">'+escape(niceDate(t.date))+'</div><h3>'+escape(t.event)+'</h3><div class="history-location">'+escape(t.location||"Ort unbekannt")+(lastPlayer==="all"?" · "+escape(t.playerName):"")+'</div><div class="history-results">'+entries+'</div>'+(sourceUrl?'<a href="'+escape(sourceUrl)+'" target="_blank" rel="noopener noreferrer" class="history-source-link">Originalbericht ansehen ↗</a>':"")+'</div></article>';
  }).join("");
 }
 window.renderHistory=(selected,profiles)=>{
   lastPlayer=selected||"all";lastProfiles=Array.isArray(profiles)?profiles:[];
   render();
 };
 async function load(){
  try{
   const resp=await fetch(feedUrl+"?v=2",{cache:"no-store"});
   if(!resp.ok)throw Error("HTTP "+resp.status);
   const data=await resp.json();
   if(data?.schemaVersion!==1||!Array.isArray(data.results))throw Error("Unerwartetes Datenformat");
   records=data.results.filter(r=>r&&typeof r.id==="string"&&typeof r.playerId==="string"&&
    /^\d{4}-\d\d-\d\d$/.test(r.date)&&typeof r.place==="number"&&r.place>0&&
    typeof r.playerName==="string"&&safeUrl(r.source?.url)&&r.verified===true);
   loaded=true;
  }catch(e){error="Quelle derzeit nicht verfügbar.";}
  render();
 }
 document.addEventListener("DOMContentLoaded",()=>{
  $("history-year")?.addEventListener("change",e=>{year=e.target.value;render()});
  $("history-discipline")?.addEventListener("change",e=>{discipline=e.target.value;render()});
  load();
 });
})();

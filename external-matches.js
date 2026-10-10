/** Individual sourced Badhub match cards, separate from official DBV match facts. */
const API="https://yadexibmjmnjfmfabrug.supabase.co/rest/v1/";
const KEY="sb_publishable_WdNC1AoOLe4rqDomSVnxWw_wq64M5kE";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let selected="",rows=[],progress=null,loaded=false,seq=0,abortController;
let year="all",discipline="all",category="all",show=20;
function safeLink(raw){
 try{const u=new URL(raw);return u.protocol==="https:"&&u.hostname==="badhub.de" &&
 /^\/bwbv\/(?:turnier|begegnung)\.php$/.test(u.pathname)?u.href:null;}catch{return null;}
}
const fmt=n=>Number(n||0).toLocaleString("de-DE");
const isValidId=id=>/^\d{2}-\d{6}$/.test(id||"");
const gameScore=row=>(Array.isArray(row.games)?row.games:[])
 .filter(g=>Array.isArray(g)&&g.length===2&&g.every(Number.isInteger))
 .map(g=>row.player_side===2?g[1]+":"+g[0]:g[0]+":"+g[1]).join(" · ");
async function readJSON(route,signal){
 const r=await fetch(API+route,{signal,cache:"no-store",headers:{apikey:KEY,Accept:"application/json"}});
 if(!r.ok)throw Error("Match archive HTTP "+r.status);
 const json=await r.json();return Array.isArray(json)?json:[];
}
function render(){
 const root=$("external-match-history");if(!root)return;
 root.hidden=!isValidId(selected);
 if(root.hidden)return;
 const progressEl=$("external-match-progress"),list=$("external-match-list"),
   count=$("external-match-count"),years=$("external-match-year"),more=$("external-match-more");
 if(!loaded){
  progressEl.textContent="Öffentliche Matchbelege werden geladen …";
  list.innerHTML="";count.textContent="";more.hidden=true;return;
 }
 const imported=Math.max(rows.length,Number(progress?.cursor_offset)||0);
 const eligible=Number(progress?.verified_count)||0;
 const excluded=Number(progress?.rejected_count)||0;
 if(progress?.status==="loading"||progress?.status==="queued"){
  progressEl.textContent="Der nächste Quellenabgleich läuft. Bereits gespeicherte Spiele bleiben sichtbar.";
 }else if(eligible){
  progressEl.textContent=fmt(imported)+" von "+fmt(eligible)+" auswertbaren Badhub-Einzelmatches übernommen"+
   (imported<eligible?" · weitere folgen automatisch.":".")+
   (excluded?" "+fmt(excluded)+" unklare Quelleneinträge nicht als Spiel gezählt.":"");
 }else if(progress?.status==="awaiting_source"){
  progressEl.textContent="Für dieses Profil sind noch keine öffentlichen Einzelmatchdaten verfügbar. Wir prüfen die Quelle später erneut.";
 }else{
  progressEl.textContent="Noch keine einzeln übernommenen Ergebnisse. Die Quellenprüfung wird automatisch gestartet.";
 }
 const options=[...new Set(rows.map(r=>r.match_year).filter(Number.isInteger))].sort((a,b)=>b-a);
 years.innerHTML='<option value="all">Alle Jahre</option>'+options.map(x=>'<option value="'+x+'">'+x+'</option>').join("");
 if(year!=="all"&&!options.includes(Number(year)))year="all";
 years.value=year;
 const filtered=rows.filter(r=>(year==="all"||String(r.match_year)===year)&&
  (discipline==="all"||r.discipline===discipline)&&
  (category==="all"||r.category===category));
 const won=filtered.filter(r=>r.player_side===r.winning_side).length;
 count.textContent=filtered.length
  ?fmt(filtered.length)+" nachgewiesene importierte Spiele · "+fmt(won)+" Siege · "+
   fmt(filtered.length-won)+" Niederlagen (Badhub-Einzelnachweise)"
  :"Für diese Auswahl sind noch keine einzeln belegten Spiele übernommen.";
 list.innerHTML=filtered.slice(0,show).map(r=>{
  const win=r.player_side===r.winning_side;
  const opponent=(r.opponent_names||[]).join(" / ");
  const partner=(r.partner_names||[]).join(" / ");
  const url=safeLink(r.source_url);
  return '<article class="external-match-item">'+
   '<div class="external-match-row"><span class="external-match-result '+(win?"won":"lost")+'">'+(win?"Sieg":"Niederlage")+'</span>'+
   '<span>'+esc(r.match_date?r.category==="tournament"?"Turnierbeginn "+r.match_date:"Spieltag "+r.match_date:"Jahr "+r.match_year)+'</span>'+
   '<span>'+esc(r.discipline)+'</span></div>'+
   '<strong>'+esc(r.competition||"Historisches Turnier")+'</strong>'+
   '<p>Gegen '+esc(opponent)+(partner?' · mit '+esc(partner):'')+'</p>'+
   '<div class="external-match-foot"><span>Sätze: '+esc(gameScore(r))+(r.round_label?' · '+esc(r.round_label):'')+'</span>'+
   (url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Quellbeleg ↗</a>':'')+
   '</div></article>';
 }).join("");
 more.hidden=show>=filtered.length;
 more.textContent="Weitere Spiele anzeigen ("+Math.max(0,filtered.length-show)+" übrig)";
}
async function load(id){
 if(!isValidId(id)){selected=id;loaded=true;rows=[];progress=null;render();return}
 selected=id;loaded=false;show=20;year="all";discipline="all";category="all";
 abortController?.abort();abortController=new AbortController();
 const ticket=++seq;const signal=abortController.signal;render();
 try{
  const [status]=await readJSON("player_external_match_imports?select=dbv_id,status,cursor_offset,verified_count,rejected_count,source_count,detail&dbv_id=eq."+id+"&limit=1",signal);
  const collected=[];
  for(let offset=0;offset<1000;offset+=250){
   const route="player_external_match_facts?select=dbv_id,source_key,category,competition,event,discipline,round_label,match_date,match_year,player_side,winning_side,opponent_names,partner_names,games,source_url"+
     "&dbv_id=eq."+id+"&order=match_year.desc,match_date.desc.nullslast,source_key.asc&limit=250&offset="+offset;
   const group=await readJSON(route,signal);
   collected.push(...group);
   if(group.length<250)break;
  }
  if(ticket!==seq)return;
  rows=collected;progress=status||null;loaded=true;render();
 }catch(error){
  if(ticket!==seq||error?.name==="AbortError")return;
  console.warn("Historic match proofs unavailable:",error?.message);
  rows=[];progress=null;loaded=true;render();
  const p=$("external-match-progress");if(p)p.textContent="Die historischen Einzelspiele sind gerade nicht erreichbar.";
 }
}
document.addEventListener("DOMContentLoaded",()=>{
 if(!$("external-match-history"))return;
 for(const [field,key] of [["external-match-year","year"],["external-match-discipline","discipline"],["external-match-category","category"]]){
  $(field).addEventListener("change",e=>{
   if(key==="year")year=e.target.value;
   if(key==="discipline")discipline=e.target.value;
   if(key==="category")category=e.target.value;
   show=20;render();
  });
 }
 $("external-match-more").addEventListener("click",()=>{show+=20;render()});
 const current=()=>String(window.badmintonActivePlayerId||"");
 window.addEventListener("badminton:profile-change",e=>{
  const id=String(e.detail?.playerId||"");
  if(id!==selected){selected=id;if(location.hash==="#historie")load(id);}
 });
 window.addEventListener("badminton:external-matches-updated",e=>{
  const id=String(e.detail?.playerId||"");
  if(id===selected&&location.hash==="#historie")load(id);
 });
 window.addEventListener("hashchange",()=>{
  if(location.hash==="#historie")load(current());
 });
 if(location.hash==="#historie")load(current());
});

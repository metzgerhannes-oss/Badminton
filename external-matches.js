/** Badhub historical match details: same scoring and evidence rules as Home. */
import {computeExternalStats,sourceMatchYears,importCompleteness} from "./scripts/external-match-stats.mjs";
const API="https://yadexibmjmnjfmfabrug.supabase.co/rest/v1/";
const KEY="sb_publishable_WdNC1AoOLe4rqDomSVnxWw_wq64M5kE";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Number(n||0).toLocaleString("de-DE");
const isValidId=id=>/^\d{2}-\d{6}$/.test(id||"");
const PAGE_LIMIT=400,MAX_ROWS=10000;
let selected="",rows=[],progress=null,loaded=false,failed=false,partial=false,seq=0,abortController;
let year="all",discipline="all",category="all",show=20;
function safeLink(raw){
 try{
  const u=new URL(raw);
  return u.protocol==="https:"&&u.hostname==="badhub.de" &&
   /^\/bwbv\/(?:turnier|begegnung)\.php$/.test(u.pathname)&&
   /^\d+$/.test(u.searchParams.get("id")||"")?u.href:null;
 }catch{return null;}
}
const gameScore=row=>(Array.isArray(row.games)?row.games:[])
 .filter(g=>Array.isArray(g)&&g.length===2&&g.every(Number.isInteger))
 .map(g=>row.player_side===2?g[1]+":"+g[0]:g[0]+":"+g[1]).join(" · ");
async function readJSON(route,signal){
 const response=await fetch(API+route,{signal,cache:"no-store",headers:{apikey:KEY,Accept:"application/json"}});
 if(!response.ok)throw Error("Match archive HTTP "+response.status);
 const data=await response.json();
 if(!Array.isArray(data))throw Error("Unexpected match archive format");
 return data;
}
function render(){
 const root=$("external-match-history");if(!root)return;
 root.hidden=!isValidId(selected);
 if(root.hidden)return;
 const progressEl=$("external-match-progress"),list=$("external-match-list"),
   count=$("external-match-count"),years=$("external-match-year"),more=$("external-match-more"),
   retry=$("external-match-retry");
 retry.hidden=!failed;
 if(!loaded){
  progressEl.textContent="Öffentliche Matchbelege werden geladen …";
  list.innerHTML="";count.textContent="";more.hidden=true;return;
 }
 if(failed){
  progressEl.textContent="Die historischen Einzelspiele sind gerade nicht erreichbar. Bitte erneut laden.";
  count.textContent="Der Datenstand kann derzeit nicht geprüft werden.";
  years.innerHTML='<option value="all">Alle Jahre</option>';
  list.innerHTML="";more.hidden=true;return;
 }
 const all=computeExternalStats(rows);
 const state=progress?.status||"";
 let info;
 if(state==="queued"||state==="loading"||state==="checking"){
  info="Der Quellenabgleich läuft. Bereits geprüfte Spiele bleiben sichtbar.";
 }else if(state==="awaiting_source"&&!rows.length){
  info="In der App liegen noch keine importierten Einzelmatches vor. Eine spätere Quellenprüfung ist vorgesehen.";
 }else if(Number(progress?.verified_count)>0){
  info=importCompleteness(progress,rows.length);
 }else if(rows.length){
  info=fmt(rows.length)+" einzelne Quellkarten geladen; Importvollständigkeit nicht bestätigt.";
 }else{
  info="Für dieses Profil sind in der App noch keine Einzelmatchbelege importiert.";
 }
 if(all.excluded)info+=" "+fmt(all.excluded)+" unklare oder doppelte Quellkarten wurden nicht als Spiel gezählt.";
 if(partial)info+=" Es konnten höchstens "+fmt(MAX_ROWS)+" Quellkarten geladen werden; die Historie ist möglicherweise unvollständig.";
 progressEl.textContent=info;
 const options=sourceMatchYears(rows);
 years.innerHTML='<option value="all">Alle Jahre</option>'+options.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");
 if(year!=="all"&&!options.includes(year))year="all";
 years.value=year;
 const subset=category==="all"?rows:rows.filter(r=>r.category===category);
 // Only validated results may become a displayed game or W/L count.
 const result=computeExternalStats(subset,{year,discipline});
 const filtered=result.details;
 count.textContent=filtered.length
  ?fmt(result.total)+" einzeln belegte Spiele · "+fmt(result.wins)+" Siege · "+
   fmt(result.losses)+" Niederlagen (Badhub-Einzelnachweise)"
  :"Für diese Auswahl sind in der App noch keine zählbaren Einzelspiele belegt.";
 if(result.excluded&&(year!=="all"||discipline!=="all"||category!=="all"))
  count.textContent+=" "+fmt(result.excluded)+" unklare Quellkarten nicht berücksichtigt.";
 list.innerHTML=filtered.slice(0,show).map(r=>{
  const opponent=(r.opponent_names||[]).join(" / ");
  const partner=(r.partner_names||[]).join(" / ");
  const url=safeLink(r.source_url);
  return '<article class="external-match-item">'+
   '<div class="external-match-row"><span class="external-match-result '+(r.won?"won":"lost")+'">'+(r.won?"Sieg":"Niederlage")+'</span>'+
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
 abortController?.abort();
 const ticket=++seq;
 selected=id||"";rows=[];progress=null;loaded=false;failed=false;partial=false;
 show=20;year="all";discipline="all";category="all";
 if(!isValidId(selected)){loaded=true;render();return}
 abortController=new AbortController();
 const signal=abortController.signal;
 render();
 try{
  const [status]=await readJSON("player_external_match_imports?select=dbv_id,status,cursor_offset,verified_count,rejected_count,source_count,detail,last_finished_at&dbv_id=eq."+id+"&limit=1",signal);
  const collected=[];
  for(let offset=0;offset<MAX_ROWS;offset+=PAGE_LIMIT){
   const route="player_external_match_facts?select=dbv_id,source_key,category,competition,event,discipline,round_label,match_date,match_year,player_side,winning_side,opponent_names,partner_names,games,source_url"+
    "&dbv_id=eq."+id+"&order=match_year.desc,match_date.desc.nullslast,source_key.asc&limit="+PAGE_LIMIT+"&offset="+offset;
   const batch=await readJSON(route,signal);
   collected.push(...batch);
   if(batch.length<PAGE_LIMIT)break;
  }
  if(ticket!==seq||signal.aborted)return;
  rows=collected;progress=status||null;
  partial=collected.length>=MAX_ROWS;loaded=true;render();
 }catch(error){
  if(ticket!==seq||signal.aborted||error?.name==="AbortError")return;
  console.warn("Historic match proofs unavailable:",error?.message);
  loaded=true;failed=true;render();
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
 $("external-match-retry").addEventListener("click",()=>load(selected));
 const current=()=>String(window.badmintonActivePlayerId||"");
 window.addEventListener("badminton:profile-change",e=>{
  const id=String(e.detail?.playerId||"");
  if(id!==selected){
   if(location.hash==="#historie")load(id);
   else{abortController?.abort();++seq;selected=id;rows=[];progress=null;loaded=false;}
  }
 });
 window.addEventListener("badminton:external-matches-updated",e=>{
  const id=String(e.detail?.playerId||"");
  if(id===selected&&location.hash==="#historie")load(id);
 });
 let lastVisibleRefresh=0;
 document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&location.hash==="#historie"&&
   isValidId(selected)&&Date.now()-lastVisibleRefresh>=5*60000){
   lastVisibleRefresh=Date.now();load(selected);
  }
 });
 window.addEventListener("hashchange",()=>{
  if(location.hash==="#historie")load(current());
 });
 if(location.hash==="#historie")load(current());
});

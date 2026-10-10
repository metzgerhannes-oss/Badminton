/* Public, read-only DBV results feed. Source data is never guessed or scraped client-side. */
(() => {
 "use strict";
 const BASE="https://yadexibmjmnjfmfabrug.supabase.co";
 const API_KEY="sb_publishable_WdNC1AoOLe4rqDomSVnxWw_wq64M5kE"; // Publishable (not service_role) key; safe for browsers.
 const DBV="https://dbv.turnier.de/";
 const $=id=>document.getElementById(id);
 const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const safeSource=s=>{try{const u=new URL(s);return u.protocol==="https:"&&["dbv.turnier.de","turnier.de","www.turnier.de"].includes(u.hostname)?u.href:null}catch{return null}};
 const isDbvId=s=>/^\d{2}-\d{6}$/.test(s||"");
 const dateTime=s=>{if(!s)return "Spielzeit offen";const d=new Date(s);return Number.isNaN(d.getTime())?"Spielzeit offen":new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Berlin"}).format(d)+" Uhr"};
 const statuses={unknown:"Status offen",scheduled:"Angesetzt",called:"Aufgerufen",playing:"Läuft",finished:"Beendet",cancelled:"Abgesagt",walkover:"Kampflos"};
 let currentId="",requestId=0,loading=false;
 async function get(path){
  const response=await fetch(BASE+"/rest/v1/"+path,{headers:{"apikey":API_KEY,"accept":"application/json"},cache:"no-store"});
  if(!response.ok)throw Error("Supabase "+response.status);
  return response.json();
 }
 function notice(message){
  const box=$("dbv-live-results");if(box)box.innerHTML='<p class="live-dbv-note">'+escape(message)+'</p>';
 }
 function sideLabel(parts,side){
  const names=(parts||[]).filter(p=>p.side===side).sort((a,b)=>a.player_position-b.player_position)
   .map(p=>p.players?.name||p.participant_name||"Noch offen");
  return names.length?names.join(" / "):"Noch offen";
 }
 function render(matches){
  const box=$("dbv-live-results");if(!box)return;
  if(!matches.length){notice("Für dieses Profil sind noch keine verifiziert importierten DBV-Begegnungen verfügbar. Die offiziellen Turnierlinks bleiben unten erreichbar.");return}
  box.innerHTML=matches.map(m=>{
   const sets=(m.match_games||[]).slice().sort((a,b)=>a.game_number-b.game_number)
    .filter(s=>s.side1_points!=null&&s.side2_points!=null)
    .map(s=>'<span class="live-dbv-set">'+escape(s.side1_points)+':'+escape(s.side2_points)+'</span>').join("");
   const link=safeSource(m.source_url)||safeSource(m.tournaments?.source_url);
   const checked=m.last_synced_at?new Date(m.last_synced_at):null;
   const old=checked&&(!Number.isNaN(checked.getTime()))&&(Date.now()-checked.getTime()>15*60*1000);
   const freshness=checked&&!Number.isNaN(checked.getTime())?
     ("DBV-Abgleich: "+new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Berlin"}).format(checked)+(old?" · möglicherweise veraltet":"")):
     "Noch kein bestätigter Live-Abgleich";
   return '<article class="live-dbv-match">'+
    '<div class="live-dbv-row"><strong>'+escape(m.events?.title||m.tournaments?.name||"Badminton-Begegnung")+'</strong><span>'+escape(statuses[m.status]||statuses.unknown)+'</span></div>'+
    '<div class="live-dbv-players"><span>'+escape(sideLabel(m.match_participants,1))+'</span><b>–</b><span>'+escape(sideLabel(m.match_participants,2))+'</span></div>'+
    '<div class="live-dbv-row"><span>'+escape(dateTime(m.scheduled_at))+(m.court?' · Feld '+escape(m.court):"")+'</span><span class="live-dbv-sets">'+(sets||"Sätze offen")+'</span></div>'+
    '<div class="live-dbv-row live-dbv-foot"><small>'+escape(freshness)+'</small>'+(link?'<a href="'+escape(link)+'" target="_blank" rel="noopener noreferrer">Original ↗</a>':"")+'</div></article>';
  }).join("");
 }
 async function refresh(){
  if(!isDbvId(currentId)){notice("Wähle ein Spielerprofil mit gültiger DBV-ID.");return}
  if(loading)return;
  const ticket=++requestId,dbvId=currentId;loading=true;
  const btn=$("dbv-live-refresh");if(btn)btn.disabled=true;
  notice("Offizielle Begegnungsdaten werden geprüft …");
  try{
   const players=await get("players?select=id&dbv_id=eq."+encodeURIComponent(dbvId)+"&limit=1");
   if(ticket!==requestId||dbvId!==currentId)return;
   if(!players.length){render([]);return}
   const participantRows=await get("match_participants?select=match_id&player_id=eq."+players[0].id+"&limit=200");
   if(ticket!==requestId||dbvId!==currentId)return;
   const ids=[...new Set(participantRows.map(row=>row.match_id))].filter(x=>/^[0-9a-f-]{36}$/i.test(x));
   if(!ids.length){render([]);return}
   const select="id,status,court,scheduled_at,source_url,last_synced_at,tournaments(name,source_url),events(title,age_group,discipline),match_participants(side,player_position,participant_name,players(name,dbv_id)),match_games(game_number,side1_points,side2_points,finished)";
   const matches=await get("matches?select="+encodeURIComponent(select)+"&id=in.("+ids.join(",")+")&order=scheduled_at.asc.nullslast&limit=100");
   if(ticket!==requestId||dbvId!==currentId)return;
   render(matches.filter(x=>x.status!=="cancelled"));
  }catch(error){
   if(ticket===requestId)notice("Die Live-Abfrage ist derzeit nicht erreichbar. Nutze die offiziellen DBV-Turnierlinks.");
   console.warn("Badminton live feed:",error.message);
  }finally{
   if(ticket===requestId){loading=false;if(btn)btn.disabled=false}
  }
 }
 function visible(){return location.hash==="#turniere"&&!document.hidden}
 document.addEventListener("DOMContentLoaded",()=>{
  if(!$("dbv-live-results"))return;
  $("dbv-live-refresh")?.addEventListener("click",refresh);
  window.addEventListener("badminton:profile-change",event=>{
   const next=String(event.detail?.playerId||"");
   if(next!==currentId){currentId=next;requestId++;loading=false;if(visible())refresh()}
  });
  window.addEventListener("hashchange",()=>{if(visible())refresh()});
  document.addEventListener("visibilitychange",()=>{if(visible())refresh()});
  setInterval(()=>{if(visible())refresh()},60_000);
 });
})();

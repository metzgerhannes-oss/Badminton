/** Read-only club overview. No bulk DBV lookup or access-grant expansion. */
import {loadSpvggRoster,rosterMatchesClub,rosterEsc} from "./scripts/spvgg-roster.mjs";
import {DEFAULT_CLUB,clubChoices,buildClubRows,filterClubRows} from "./scripts/club-overview-model.mjs";
const $=id=>document.getElementById(id);
let profiles=[],roster=null,rosterError=false,attempted=false,started=false;
const esc=rosterEsc;
function selection(){
 const current=$("club-overview-club")?.value||DEFAULT_CLUB;
 return clubChoices(profiles).find(x=>x===current)||DEFAULT_CLUB;
}
function updateChoices(){
 const picker=$("club-overview-club");if(!picker)return;
 const previous=picker.value||DEFAULT_CLUB;
 const choices=clubChoices(profiles);
 picker.replaceChildren(...choices.map(name=>new Option(name,name)));
 picker.value=choices.includes(previous)?previous:DEFAULT_CLUB;
}
function render(){
 const host=$("club-overview-table"),stat=$("club-overview-total"),message=$("club-overview-status");
 if(!host)return;
 const club=selection(),spvgg=rosterMatchesClub(club),rows=buildClubRows(roster,profiles,club);
 const shown=filterClubRows(rows,{
  query:$("club-overview-search")?.value||"",team:$("club-overview-team")?.value||"all",
  age:$("club-overview-age")?.value||"all",sort:$("club-overview-sort")?.value||"name"
 });
 $("club-overview-team").disabled=!spvgg;
 $("club-overview-source").textContent=spvgg
  ?"Vereinsquelle: veröffentlichte Aktivenmannschaften I–V (Saison "+(roster?.sourceSeason||"2025/26")+"); zusätzlich lokal gespeicherte Profile. Kein vollständiges DBV-Vereinsverzeichnis."
  :"Nur lokal gespeicherte Profile dieses Vereins. Ein vollständiger Vereinsimport liegt nicht vor.";
 stat.textContent=rows.length+" erfasste Namen · "+shown.length+" angezeigt";
 message.textContent=rosterError&&spvgg
  ?"Vereinsquelle nicht erreichbar; nur lokal gespeicherte Profile werden gezeigt.":(spvgg&&!attempted?"Vereinskader wird geladen …":"");
 if(spvgg&&!attempted){host.textContent="Vereinsquelle wird geladen …";return}
 if(!shown.length){host.innerHTML='<p class="club-overview-empty">Keine passenden Einträge in den verfügbaren Quellen.</p>';return}
 host.innerHTML='<table class="club-overview-table"><thead><tr>'+
  '<th scope="col">Spieler</th><th scope="col">Mannschaft</th><th scope="col">Altersklasse</th>'+
  '<th scope="col">DBV-ID</th><th scope="col">Ergebnisse</th><th scope="col">Profil</th></tr></thead><tbody>'+
  shown.map(row=>'<tr><th scope="row"><span class="club-overview-name">'+esc(row.name)+'</span>'+
   '<small>'+esc(row.source)+(row.localNameMatch?' · Namensgleichheit nicht verifiziert':'')+'</small></th>'+
   '<td>'+esc(row.teams.join(", ")||"–")+'</td>'+
   '<td>'+esc(row.ageClass||"Nicht erfasst")+'</td>'+
   '<td>'+esc(row.dbvId||"–")+'</td>'+
   '<td><span class="club-overview-missing">Keine belegten Daten in dieser Übersicht</span></td>'+
   '<td>'+(row.localPlayerId?'<button type="button" class="club-overview-profile" data-open-profile="'+esc(row.localPlayerId)+'">Profil öffnen</button>':
   '<span class="club-overview-muted">Nicht verknüpft</span>')+'</td></tr>').join("")+'</tbody></table>';
 host.querySelectorAll("[data-open-profile]").forEach(button=>button.addEventListener("click",()=>{
  window.badmintonSelectViewer?.(button.dataset.openProfile);
 }));
}
async function open(){
 if(!started)started=true;
 if(!attempted){
  // Only existing published static JSON; no Supabase request or polling.
  attempted=false;render();
  try {roster=await loadSpvggRoster()}catch{rosterError=true}
  attempted=true;
 }
 render();
}
function init(){
 if(!$("club-overview-table"))return;
 updateChoices();
 for(const id of ["club-overview-search","club-overview-team","club-overview-age","club-overview-sort","club-overview-club"]){
  const el=$(id);el?.addEventListener(id.includes("search")?"input":"change",()=>{
   if(id==="club-overview-club"){
    $("club-overview-team").value="all";$("club-overview-age").value="all";
   }
   render();
  });
 }
 $("club-overview-reset")?.addEventListener("click",()=>{
  $("club-overview-search").value="";$("club-overview-team").value="all";
  $("club-overview-age").value="all";$("club-overview-sort").value="name";render();
 });
 window.addEventListener("badminton:club-profiles",event=>{
  profiles=Array.isArray(event.detail?.players)?event.detail.players:[];
  updateChoices();if(location.hash==="#verein")render();
 });
 window.addEventListener("hashchange",()=>{if(location.hash==="#verein")void open()});
 if(location.hash==="#verein")void open();
}
document.addEventListener("DOMContentLoaded",init);

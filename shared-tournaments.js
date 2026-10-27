/** Cross-device tournament hints. Opt-in writes use a device-bound Supabase
 * anonymous Auth account with owner-only RLS. Never sync private family data.
 * Results are user reports, NOT official DBV registrations or matches. */
import {readPublicRows,SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
import {DBV_ID,communityPath,sharedItems,sharePayload,sharedKey,publicationGrantPath,hasPublicationGrant} from "./scripts/shared-tournaments.mjs";

const authRoot=SUPABASE_ROOT.replace(/rest\/v1\/$/,"auth/v1/");
const KEY="schmetterlinge.communitySession.v1";
const CONFIRMED="schmetterlinge.communityShares.v1";
const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let selected="",ticket=0,latest=[],request=null,hasRendered=false;
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||"null")||fallback}catch{return fallback}};
const getFlags=()=>read(CONFIRMED,{});
const setFlag=(id,on)=>{const flags=getFlags();if(on)flags[id]=true;else delete flags[id];localStorage.setItem(CONFIRMED,JSON.stringify(flags))};
function notify(message){for(const id of ["community-save-status","community-sync-status"]){const node=$(id);if(node){node.hidden=false;node.textContent=message}}
 window.dispatchEvent(new CustomEvent("badminton:community-feedback",{detail:{message}}));}
function headers(token){return {apikey:PUBLIC_KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"}}
async function asJson(res){const text=await res.text();let data;try{data=JSON.parse(text)}catch{data={}};if(!res.ok)throw Error(data.msg||data.error_description||data.message||"HTTP "+res.status);return data}
async function getSession(){
 let current=read(KEY,null);
 if(current?.access_token&&current.expires_at>Date.now()+60000)return current;
 if(current?.refresh_token){
  try{
   const res=await fetch(authRoot+"token?grant_type=refresh_token",{
    method:"POST",headers:{apikey:PUBLIC_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({refresh_token:current.refresh_token})
   });
   const data=await asJson(res);
   current={access_token:data.access_token,refresh_token:data.refresh_token,
    expires_at:Date.now()+Number(data.expires_in||0)*1000,
    user_id:data.user?.id||current.user_id};
   localStorage.setItem(KEY,JSON.stringify(current));
   return current;
  }catch{current=null;localStorage.removeItem(KEY)}
 }
 // Do not create a new anonymous Auth account merely to attempt a public
 // player announcement. New accounts never have independently approved grants.
 return null;
}
async function publish(bookmark){
 const session=await getSession();
 if(!session){
  setFlag(sharedKey(bookmark),false);
  throw Error("Öffentliche Meldung nur mit bereits geprüftem Verwalterzugang möglich. "+
   "Das Turnier bleibt privat auf deinem Gerät.");
 }
 const item=sharePayload(bookmark,session.user_id);
 // The public DBV directory does NOT prove this account can manage that player.
 // Check the independently approved grant before attempting any public write.
 const grantUrl=publicationGrantPath(session.user_id,bookmark.playerId);
 if(!grantUrl)throw Error("Die Spieler- oder Gerätekennung ist ungültig.");
 const grantResponse=await fetch(SUPABASE_ROOT+grantUrl,{
  method:"GET",headers:headers(session.access_token),cache:"no-store"
 });
 const grants=await asJson(grantResponse);
 if(!hasPublicationGrant(grants,bookmark.playerId)){
  setFlag(sharedKey(bookmark),false);
  throw Error("Für dieses Spielerprofil liegt noch keine geprüfte Veröffentlichungsberechtigung vor. "+
   "Das Turnier bleibt privat auf deinem Gerät. Eine DBV-Spieler-ID oder ein technisches Konto "+
   "berechtigen nicht automatisch zu einer öffentlichen Meldung im Namen dieser Person.");
 }
 const conflict="user_id,player_dbv_id,external_tournament_id";
 const res=await fetch(SUPABASE_ROOT+"user_tournament_links?on_conflict="+encodeURIComponent(conflict),{
  method:"POST",headers:{...headers(session.access_token),Prefer:"resolution=merge-duplicates,return=minimal"},
  body:JSON.stringify(item)
 });
 await asJson(res);
 setFlag(sharedKey(bookmark),true);
}
async function revoke(bookmark){
 const key=sharedKey(bookmark);
 if(!getFlags()[key])return;
 const session=await getSession();
 if(!session)throw Error("Die alte Geräteanmeldung für diese Freigabe fehlt. Ein erneuter Zugang ist zum Widerruf nötig.");
 const q=new URLSearchParams({user_id:"eq."+session.user_id,player_dbv_id:"eq."+bookmark.playerId,
  external_tournament_id:"eq."+bookmark.id});
 const res=await fetch(SUPABASE_ROOT+"user_tournament_links?"+q,{
  method:"DELETE",headers:{...headers(session.access_token),Prefer:"return=minimal"}
 });
 await asJson(res);
 setFlag(key,false);
}
function day(){
 const bits=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",
  year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const values=Object.fromEntries(bits.filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
 return values.year+"-"+values.month+"-"+values.day;
}
const fmt=v=>v?new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"short",year:"numeric",
 timeZone:"UTC"}).format(new Date(v+"T12:00:00Z")):"Termin offen";
function render(items,reason=""){
 const host=$("shared-tournaments");if(!host)return;
 const rows=sharedItems(items,selected,day());
 host.hidden=!DBV_ID.test(selected)||!rows.length;
 if(host.hidden){host.replaceChildren();return}
 host.innerHTML='<section class="shared-event-section" aria-labelledby="shared-event-heading">'+
  '<div class="shared-event-head"><h3 id="shared-event-heading">Von Nutzern gemeldete Turniere</h3></div>'+
  '<p class="shared-event-note">Gemeinschaftlich geteilte Turnierlinks · keine bestätigte Meldung oder Teilnahme. Spiele und Ergebnisse stammen ausschließlich aus belegten DBV-/Badhub-Daten.</p>'+
  (rows.length?rows.map(t=>'<article class="shared-event-row"><div><strong>'+esc(t.name)+
   '</strong><small>'+esc(t.startDate?fmt(t.startDate):"Termin offen")+
   (t.endDate&&t.endDate!==t.startDate?" – "+esc(fmt(t.endDate)):"")+
   ' · Nutzerhinweis (unbestätigt)</small></div><a href="'+esc(t.url)+
   '" target="_blank" rel="noopener noreferrer">Spielplan / Ergebnisse ↗</a></article>').join("")
   :'<p class="shared-event-empty">'+(reason||"Noch keine öffentlich geteilten Turniere für diesen Spieler.")+'</p>')+
  '</section>';
}
async function refresh(id){
 const current=++ticket;
 request?.abort();
 selected=String(id||"");
 latest=[];hasRendered=false;
 if(!DBV_ID.test(selected)){render([], "");return}
 request=new AbortController();
 render([],"Geteilte Turniere werden geprüft …");
 try{
  const {rows}=await readPublicRows(communityPath(selected),{signal:request.signal,count:false,retries:0,timeoutMs:8500});
  if(current!==ticket)return;
  latest=rows;hasRendered=true;render(latest);
  window.dispatchEvent(new Event("badminton:tournament-bookmarks"));
 }catch(err){
  if(current!==ticket||request.signal.aborted)return;
  render([],"Die geteilten Turniere sind derzeit nicht erreichbar. Lokale Turniere bleiben erhalten.");
 }
}
window.badmintonCommunityTournamentOptions=()=>sharedItems(latest,selected,day());
window.badmintonCommunity={
 isShared:bookmark=>Boolean(getFlags()[sharedKey(bookmark)]),
 refresh:()=>refresh(selected)
};
window.addEventListener("badminton:profile-change",event=>refresh(event.detail?.playerId));
window.addEventListener("badminton:community-refresh",()=>refresh(selected));
// P0 #417: an initial guest read is intentionally blocked; retry only after
// the server has verified the family session. Never grant on local profile alone.
window.addEventListener("badminton:app-access-granted",()=>
 refresh(selected||window.badmintonActivePlayerId||""));
window.addEventListener("badminton:tournament-bookmarks",()=>{if(hasRendered)render(latest)});
window.addEventListener("badminton:share-tournament",async event=>{
 const {bookmark,previous,publicShare,removed}=event.detail||{};
 if(!bookmark)return;
 try{
  if(previous&&(previous.id!==bookmark.id||previous.playerId!==bookmark.playerId))await revoke(previous);
  if(removed||!publicShare)await revoke(bookmark);
  else await publish(bookmark);
  notify(removed?"Öffentliche Freigabe entfernt.":publicShare
   ?"Turnier als Nutzerhinweis geteilt. Deine Follower können es sehen.":"Turnier bleibt privat gespeichert.");
  window.dispatchEvent(new Event("badminton:community-refresh"));
 }catch(error){
  notify("Lokal gespeichert, aber öffentliche Freigabe fehlgeschlagen: "+
   (error?.message||"Verbindung prüfen.")+" Einträge werden nicht als geteilt ausgewiesen.");
 }
});
document.addEventListener("DOMContentLoaded",()=>{
 if($("shared-tournaments"))refresh(window.badmintonActivePlayerId||"");
});

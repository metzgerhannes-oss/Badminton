/** 7 days to ACCEPT, thereafter device-bound access until explicitly revoked.
 * No credential is logged, cached in HTML or stored after redemption. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
import {getPrivateSession} from "./private-invites.js";
const $=id=>document.getElementById(id);
const status=$("player-invite-status"),panel=$("player-invite-data");
const STORE="schmetterlinge.acceptedPlayerInvite.v2";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[a-f0-9]{64}$/;
const fragment=location.hash.slice(1);
let pendingToken=fragment.startsWith("token=")&&TOKEN.test(fragment.slice(6))?fragment.slice(6):"";
const reusable=fragment.startsWith("access=")&&UUID.test(fragment.slice(7))?fragment.slice(7):"";
history.replaceState(null,"",location.pathname+location.search);
function storedId(){try{const o=JSON.parse(localStorage.getItem(STORE)||"null");return UUID.test(o?.id||"")?o.id:""}catch{return ""}}
function hide(msg){panel.hidden=true;panel.querySelector("#player-invite-matches").replaceChildren();status.textContent=msg}
function requestHeaders(session){return {apikey:PUBLIC_KEY,"Content-Type":"application/json",Accept:"application/json",Authorization:"Bearer "+session.access_token}}
async function rpc(path,args,session){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
 try{
  const response=await fetch(SUPABASE_ROOT+"rpc/"+path,{method:"POST",cache:"no-store",signal:controller.signal,
   headers:requestHeaders(session),body:JSON.stringify(args)});
  if(!response.ok)throw Error("not allowed");
  return response.json();
 }finally{clearTimeout(timer)}
}
function show(data){
 if(!data?.player||!/^[0-9]{2}-[0-9]{6}$/.test(data.player.dbv_id)||typeof data.player.name!=="string")
  return false;
 $("player-invite-name").textContent=data.player.name;
 $("player-invite-club").textContent=[data.player.club,data.player.age_class].filter(Boolean).join(" · ");
 const list=$("player-invite-matches");list.replaceChildren();
 for(const m of (Array.isArray(data.matches)?data.matches:[]).slice(0,30)){
  const li=document.createElement("li"),title=document.createElement("strong");
  title.textContent=[m.match_date,m.discipline,m.competition].filter(Boolean).join(" · ");
  li.append(title);
  const detail=document.createElement("p");
  detail.textContent=([1,2].includes(m.player_side)&&[1,2].includes(m.winning_side)
   ?(m.player_side===m.winning_side?"Sieg":"Niederlage"):"Ergebnis nicht eindeutig")+
   " · "+String(m.source_name||"Quellenbeleg");
  li.append(detail);
  try{
   const url=new URL(m.source_url);
   if(url.protocol==="https:"&&["badhub.de","www.badhub.de","dbv.turnier.de"].includes(url.hostname)){
    const a=document.createElement("a");a.href=url.href;a.target="_blank";a.rel="noopener noreferrer";
    a.referrerPolicy="no-referrer";a.textContent="Originalquelle öffnen";li.append(a);
   }
  }catch{}
  list.append(li);
 }
 if(!list.children.length){const li=document.createElement("li");li.textContent="Keine belegten Matchkarten gespeichert.";list.append(li)}
 panel.hidden=false;status.textContent="Privater Zugriff aktiv – gültig bis zum Widerruf.";return true;
}
let busy=false;let activeId=reusable||storedId();
async function reload(){
 if(busy||!activeId)return;
 busy=true;panel.hidden=true;status.textContent="Private Berechtigung wird überprüft …";
 try{
  const session=await getPrivateSession(false);
  if(!session)throw Error("missing device session");
  const data=await rpc("private_player_access_read",{p_invitation_id:activeId},session);
  if(!show(data))throw Error("not authorized");
 }catch{
  localStorage.removeItem(STORE);activeId="";
  hide("Kein Zugriff: widerrufen oder auf diesem Gerät keine gültige Sitzung vorhanden. Bitte einen neuen Einladungslink anfordern.");
 }finally{busy=false}
}
const acceptBtn=$("player-invite-accept");
acceptBtn.addEventListener("click",async()=>{
 if(!pendingToken||busy)return;
 busy=true;acceptBtn.disabled=true;status.textContent="Einladung wird einmalig angenommen …";
 try{
  // A technical anonymous account is created ONLY after explicitly pressing Accept.
  const session=await getPrivateSession(true);
  const id=await rpc("private_player_invite_accept",{p_token:pendingToken},session);
  pendingToken="";
  if(!UUID.test(id||""))throw Error("expired/redeemed/revoked");
  activeId=id;
  localStorage.setItem(STORE,JSON.stringify({id}));
  acceptBtn.hidden=true;status.textContent="Angenommen. Der Zugriff bleibt bis zum Widerruf auf diesem Gerät erhalten.";
 }catch{
  pendingToken="";acceptBtn.hidden=true;
  hide("Einladung nicht mehr annehmbar: abgelaufen, bereits verwendet oder widerrufen.");
 }finally{busy=false;acceptBtn.disabled=false}
 if(activeId)await reload();
});
if(pendingToken){
 activeId="";acceptBtn.hidden=false;
 status.textContent="Du kannst diese Einladung innerhalb von sieben Tagen nach Erstellung annehmen. Danach bleibt der Zugriff auf diesem Gerät bis zum Widerruf erhalten.";
}else if(activeId){acceptBtn.hidden=true;await reload()}
else{acceptBtn.hidden=true;hide("Auf diesem Gerät ist keine angenommene Einladung vorhanden.")}
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&activeId)reload()});

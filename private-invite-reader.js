/** Public read of exactly one consent-shared tournament; never creates an account. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
import {tokenFromFragment} from "./scripts/private-invite-utils.mjs";
const $=id=>document.getElementById(id);
const token=tokenFromFragment(location.hash);
// Clear the secret from browser address and history before any network requests.
history.replaceState(null,"",location.pathname+location.search);
const fmt=d=>new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(d+"T12:00:00Z"));
function fail(){ $("invite-status").textContent="Der Einladungslink ist ungültig, abgelaufen oder wurde widerrufen."; }
async function load(currentToken){
 if(!currentToken){fail();return}
 try{
  const r=await fetch(SUPABASE_ROOT+"rpc/private_tournament_invite_read",{
   method:"POST",cache:"no-store",
   headers:{apikey:PUBLIC_KEY,"Content-Type":"application/json"},
   body:JSON.stringify({p_token:currentToken})
  });
  if(!r.ok)throw Error("read");
  const data=await r.json();
  if(!Array.isArray(data)||data.length!==1)throw Error("invalid");
  const event=data[0];
  if(!event||typeof event.title!=="string"||event.title.length>100||
    !/^\d{4}-\d\d-\d\d$/.test(event.start_date)||!/^\d{4}-\d\d-\d\d$/.test(event.end_date)||
    Date.parse(event.expires_at)<=Date.now())throw Error("invalid");
  const source=String(event.source_url||"");
  const official=/^https:\/\/dbv\.turnier\.de\/tournament\/[0-9a-f-]{36}$/i.test(source);
  if(source!=="https://turniere.badminton.de/"&&!official)throw Error("source");
  $("invite-title").textContent=event.title;
  $("invite-dates").textContent=fmt(event.start_date)+(event.end_date===event.start_date?"":" – "+fmt(event.end_date));
  $("invite-expiry").textContent="Abrufbar bis "+new Date(event.expires_at).toLocaleDateString("de-DE");
  $("invite-source").href=source;
  $("invite-status").textContent="Einladung geprüft.";
  $("invite-data").hidden=false;
  if(official)setupLocalSave(event);
 }catch{fail()}
}
function setupLocalSave(event){
 let state;try{state=JSON.parse(localStorage.getItem("shuttleboard-v1")||"null")}catch{return}
 const players=(state?.players||[]).filter(p=>p?.id&&p?.name);
 if(!players.length)return;
 const select=$("invite-own-player");
 for(const player of players){
  const option=document.createElement("option");
  option.value=String(player.id);option.textContent=String(player.name).slice(0,80);
  select.append(option);
 }
 $("invite-save").hidden=false;
 $("invite-accept").addEventListener("click",()=>{
  try{
   const id=event.source_url.split("/").filter(Boolean).at(-1).toUpperCase();
   if(!/^[0-9A-F]{8}(-[0-9A-F]{4}){3}-[0-9A-F]{12}$/.test(id))throw Error("id");
   const playerId=select.value;
   if(!players.some(p=>p.id===playerId))throw Error("player");
   const all=Array.isArray(state.officialLinks)?state.officialLinks:[];
   if(!all.some(t=>t.id===id&&t.playerId===playerId)){
    all.push({id,url:event.source_url,name:event.title.slice(0,100),
      startDate:event.start_date,endDate:event.end_date,playerId});
   }
   state.officialLinks=all;
   localStorage.setItem("shuttleboard-v1",JSON.stringify(state));
   $("invite-status").textContent="Lokal vorgemerkt – keine bestätigte Turnierteilnahme.";
  }catch{$("invite-status").textContent="Vormerken nicht möglich. Die Einladung bleibt lesbar."}
 });
}
// Same-tab fragment navigation does not reload a static page. Recheck the server
// so a revoked link cannot be treated as still valid merely because of history.
window.addEventListener("hashchange",()=>{
 const next=tokenFromFragment(location.hash);
 history.replaceState(null,"",location.pathname+location.search);
 $("invite-data").hidden=true;
 $("invite-status").textContent="Einladung wird geprüft …";
 load(next);
});
load(token);

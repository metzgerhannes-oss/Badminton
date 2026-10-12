/** No auth or local family storage is accessed on the recipient page. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
import {tokenFromHash,DBV_EVENT_RE} from "./scripts/private-invitation.mjs";
const el=id=>document.getElementById(id);
let activeRequest=0;
const date=v=>new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(v+"T12:00:00Z"));
async function load(){
 const current=++activeRequest;
 el("invite-page-event").hidden=true;
 el("invite-page-status").hidden=false;
 el("invite-page-status").textContent="Freigabe wird geprüft …";
 const token=tokenFromHash(location.hash);
 if(!token){el("invite-page-status").textContent="Der Freigabelink ist ungültig oder unvollständig.";return;}
 // Avoid leaving the capability token in the browser's URL after parsing.
 history.replaceState(null,"",location.pathname+location.search);
 try{
  const res=await fetch(SUPABASE_ROOT+"rpc/private_tournament_invite_read",{
   method:"POST",cache:"no-store",
   headers:{apikey:PUBLIC_KEY,"Content-Type":"application/json",Accept:"application/json"},
   body:JSON.stringify({p_token:token})});
  if(!res.ok)throw Error("Freigabe nicht verfügbar");
  const data=await res.json();
  if(current!==activeRequest)return;
  const row=Array.isArray(data)?data[0]:null;
  if(!row){el("invite-page-status").textContent="Dieser Link ist abgelaufen, widerrufen oder nicht vorhanden.";return;}
  const url=String(row.source_url||"");
  if(!(DBV_EVENT_RE.test(url)||url==="https://turniere.badminton.de/"))throw Error("Ungültige Quelle");
  if(typeof row.title!=="string"||row.title.length>100||
    !/^\d{4}-\d{2}-\d{2}$/.test(row.start_date)||!/^\d{4}-\d{2}-\d{2}$/.test(row.end_date))
   throw Error("Unvollständige Turnierdaten");
  el("invite-page-status").hidden=true;
  el("invite-page-event").hidden=false;
  el("invite-page-title").textContent=row.title;
  el("invite-page-date").textContent=date(row.start_date)+(row.end_date!==row.start_date?" – "+date(row.end_date):"");
  el("invite-page-source").href=url;
  el("invite-page-expiry").textContent="Freigabe gültig bis "+new Intl.DateTimeFormat("de-DE",{dateStyle:"medium",timeStyle:"short"}).format(new Date(row.expires_at));
 }catch{if(current===activeRequest)el("invite-page-status").textContent="Die Turnierfreigabe kann derzeit nicht gelesen werden. Bitte den Absender kontaktieren.";}
}
document.addEventListener("DOMContentLoaded",load);
window.addEventListener("hashchange",load);

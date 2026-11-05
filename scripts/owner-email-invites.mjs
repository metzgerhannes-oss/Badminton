/** Owner UI for email-only invitations. The existing bearer-link controls remain
 * available for revocation under an optional legacy section. */
const API="./api/family-invites";
function el(tag,options={}){
 const node=document.createElement(tag);
 if(options.text)node.textContent=options.text;
 if(options.className)node.className=options.className;
 if(options.id)node.id=options.id;
 return node;
}
export function mountOwnerEmailInvites({card,getSession,status}){
 if(card.querySelector("#invite-email-form"))return;
 card.querySelector("#invitation-title").textContent="Personen einladen";
 const description=card.querySelector("#invitation-title + p");
 if(description)description.textContent="E-Mail-Adresse eingeben. Wir bereiten den Zugang vor und öffnen anschließend deine Mail-App mit der Einladung.";
 const form=el("form",{id:"invite-email-form",className:"invitation-email-form"});
 const label=el("label",{text:"E-Mail-Adresse"});
 label.htmlFor="invite-email-address";
 const input=el("input",{id:"invite-email-address"});
 Object.assign(input,{type:"email",required:true,autocomplete:"email",placeholder:"name@beispiel.de",maxLength:254});
 input.style.width="100%";
 input.style.maxWidth="420px";
 const actions=el("div",{className:"invitation-actions"});
 const send=el("button",{id:"invite-email-send",className:"primary-button",text:"Einladen"});
 send.type="submit";
 const revoke=el("button",{id:"invite-email-revoke",className:"outline-button",text:"Zugang widerrufen"});
 revoke.type="button";
 actions.append(send,revoke);
 form.append(label,input,actions);
 const hint=el("p",{id:"invite-email-setup",className:"small muted",
  text:"Die Mail-App öffnet einen Entwurf. Erst wenn du dort auf Senden tippst, wird die Einladung verschickt."});
 const fallback=el("a",{id:"invite-email-draft",text:"E-Mail-App öffnen"});
 fallback.hidden=true;fallback.style.display="none";fallback.className="invitation-link";
 const legacy=el("details",{className:"invitation-short-guide"});
 const summary=el("summary",{text:"Alte Einladungslinks verwalten"});
 legacy.append(summary);
 const oldActions=card.querySelector(".invitation-actions");
 const oldLink=card.querySelector("#invite-link-preview");
 const oldGuide=card.querySelector(".invitation-guide");
 const oldHelp=card.querySelector(".invitation-short-guide");
 const oldFoot=card.querySelector("p.small.muted");
 for(const node of [oldActions,oldLink,oldGuide,oldHelp,oldFoot])if(node)legacy.append(node);
 const oldStatus=card.querySelector("#invite-status");
 card.insertBefore(form,oldStatus||card.firstChild);
 card.insertBefore(hint,oldStatus||null);
 card.insertBefore(fallback,oldStatus||null);
 card.insertBefore(legacy,oldStatus?.nextSibling||null);
 let busy=false;
 async function call(action,email){
  const session=await getSession();
  if(!session?.access_token)throw Error("Die Betreiber-Sitzung fehlt.");
  const response=await fetch(API,{method:"POST",cache:"no-store",
   headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
   body:JSON.stringify({action,email})});
  const body=await response.json().catch(()=>null);
  if(!response.ok||!body){
   const errors={
    cloudflare_not_configured:"Die sichere automatische Empfängerfreigabe ist noch nicht eingerichtet.",
    cloudflare_read_denied:"Cloudflare verweigert den Zugriff auf die Freigabeliste. Bitte die API-Token-Berechtigungen prüfen.",
    cloudflare_read_failed:"Die Cloudflare-Freigabeliste konnte nicht abgerufen werden.",
    cloudflare_update_denied:"Cloudflare verweigert die Änderung der Freigabeliste. Bitte die API-Token-Berechtigungen prüfen.",
    cloudflare_update_failed:"Die Cloudflare-Freigabeliste konnte nicht aktualisiert werden.",
    supabase_invite_unavailable:"Die Supabase-Einladungsfreigabe ist nicht erreichbar.",
    database_unavailable:"Die Supabase-Freigabe konnte nicht bestätigt werden.",
    invalid_email:"Bitte eine gültige E-Mail-Adresse eingeben.",
    not_managed:"Dieser Zugang wurde nicht über die E-Mail-Einladung erstellt und kann hier nicht widerrufen werden.",
    rate_limited:"Zu viele neue Einladungen innerhalb von 24 Stunden.",

    access_denied:"Nur der bestätigte Betreiber kann Einladungen verschicken.",
    unsafe_access_policy:"Die Cloudflare-Zugriffsregel ist nicht sicher konfiguriert.",
    service_unavailable:"Der Einladungsdienst ist momentan nicht verfügbar. Bitte erneut versuchen."};
   throw Error(errors[body?.error]||"Der Einladungsdienst ist nicht erreichbar.");
  }
  return body;
 }
 form.addEventListener("submit",async event=>{
  event.preventDefault();
  if(busy||!form.reportValidity())return;
  const email=input.value.trim();
  busy=true;send.disabled=true;revoke.disabled=true;
  fallback.hidden=true;fallback.style.display="none";
  status("Zugang für den Empfänger wird eingerichtet …");
  try{
   const result=await call("invite",email);
   if(result?.prepared!==true||result.url!=="https://schmetterlinge-familie.pages.dev/")
    throw Error("Einladungsfreigabe wurde nicht bestätigt.");
   const body="Du wurdest zur privaten Badminton-App Schmetterlinge eingeladen.\n\n"+
    "Öffne "+result.url+" und melde dich mit dieser E-Mail-Adresse bei Cloudflare Access an. "+
    "Der Bestätigungscode kommt per E-Mail. Ein zusätzliches App-Passwort ist nicht nötig.";
   const mailto="mailto:"+encodeURIComponent(email)+
    "?subject="+encodeURIComponent("Einladung zu Schmetterlinge")+
    "&body="+encodeURIComponent(body);
   fallback.href=mailto;
   fallback.hidden=false;fallback.style.display="inline-block";
   status("Zugang für "+email+" freigegeben. E-Mail-Entwurf wird geöffnet – bitte dort selbst senden.","success");
   // Some browsers block asynchronous mailto navigation. The visible fallback
   // is an ordinary user-clickable link for iPhone and desktop mail clients.
   try{window.location.href=mailto;}
   catch{status("Zugang freigegeben. Bitte auf „E-Mail-App öffnen“ tippen.","success");}
  }catch(error){status(error?.message||"Einladung fehlgeschlagen.","error");}
  finally{busy=false;send.disabled=false;revoke.disabled=false}
 });
 revoke.addEventListener("click",async()=>{
  if(busy||!form.reportValidity())return;
  const email=input.value.trim();
  if(!window.confirm("App-Zugang für "+email+" widerrufen?"))return;
  busy=true;send.disabled=true;revoke.disabled=true;
  status("Zugang wird widerrufen …");
  try{
   const result=await call("revoke",email);
   if(result?.revoked!==true)throw Error("Widerruf nicht bestätigt.");
   status("Zugang für "+email+" widerrufen.","success");
   input.value="";
  }catch(error){status(error?.message||"Widerruf fehlgeschlagen.","error");}
  finally{busy=false;send.disabled=false;revoke.disabled=false}
 });
 void call("status").then(result=>{
  if(result?.ready!==true){
   send.disabled=true;
   hint.textContent="Cloudflare-Zugangsfreigabe ist noch nicht eingerichtet. Ältere Einladungslinks bleiben nutzbar.";
  }
 }).catch(()=>{
  // Offline/server errors should not turn missing configuration into a success.
  hint.textContent="Zugangsfreigabe momentan nicht prüfbar.";
 });
}

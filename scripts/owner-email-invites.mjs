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
 if(description)description.textContent="E-Mail-Adresse eingeben und Einladung versenden. Keine manuelle Cloudflare-Freigabe erforderlich.";
 const form=el("form",{id:"invite-email-form",className:"invitation-email-form"});
 const label=el("label",{text:"E-Mail-Adresse"});
 label.htmlFor="invite-email-address";
 const input=el("input",{id:"invite-email-address"});
 Object.assign(input,{type:"email",required:true,autocomplete:"email",placeholder:"name@beispiel.de",maxLength:254});
 input.style.width="100%";
 input.style.maxWidth="420px";
 const actions=el("div",{className:"invitation-actions"});
 const send=el("button",{id:"invite-email-send",className:"primary-button",text:"Einladung senden"});
 send.type="submit";
 const revoke=el("button",{id:"invite-email-revoke",className:"outline-button",text:"Zugang widerrufen"});
 revoke.type="button";
 actions.append(send,revoke);
 form.append(label,input,actions);
 const hint=el("p",{id:"invite-email-setup",className:"small muted",
  text:"Beim Öffnen bestätigt der Empfänger seine E-Mail-Adresse. Ein weiteres App-Passwort ist nicht nötig."});
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
    mail_not_configured:"Der automatische Mailversand ist noch nicht eingerichtet.",
    invalid_email:"Bitte eine gültige E-Mail-Adresse eingeben.",
    not_managed:"Dieser Zugang wurde nicht über die E-Mail-Einladung erstellt und kann hier nicht widerrufen werden.",
    rate_limited:"Zu viele neue Einladungen innerhalb von 24 Stunden.",
    email_send_failed:"Die E-Mail konnte nicht versendet werden. Es wurde keine neue Freigabe erteilt.",
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
  status("Einladung wird geprüft und versendet …");
  try{
   const result=await call("invite",email);
   if(result?.sent!==true)throw Error("Versand wurde nicht bestätigt.");
   status("Einladung an "+email+" zum Versand angenommen.","success");
   input.value="";
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
   hint.textContent="Der automatische Mailversand muss noch auf dem Server eingerichtet werden. Alte Einladungslinks bleiben nutzbar.";
  }
 }).catch(()=>{
  // Offline/server errors should not turn missing configuration into a success.
  hint.textContent="Versandstatus momentan nicht prüfbar.";
 });
}

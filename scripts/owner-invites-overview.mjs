/** Minimal owner-only metadata for issued app links; no recipient identifiers. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A server-verified revocation outranks the locally cached copy-link state.
 * Only reconcile an exact invite UUID present in the owner-only response.
 * Absence from the bounded overview never proves revocation. */
export function reconcileIssuedInvite(local,serverRows){
 if(!UUID.test(local?.id||"")||!Array.isArray(serverRows)||local?.revoked===true)return null;
 const matching=serverRows.find(row=>row?.id===local.id&&UUID.test(row?.id||""));
 return matching?.revoked_at?{...local,revoked:true}:null;
}
/** Check the *current* server-side invite status immediately before copying/sharing.
 * A bounded overview can omit older links; omission is not proof of revocation
 * and must never silently authorize sharing or issue a replacement grant. */
export function checkIssuedInviteForSharing(local,serverRows,now=Date.now()){
 if(!UUID.test(local?.id||"")||!Array.isArray(serverRows))return {status:"unverified"};
 // A stale server snapshot must never revive a locally revoked invitation.
 if(local.revoked===true)return {status:"revoked"};
 const localUntil=Date.parse(local.expires);
 if(!Number.isFinite(localUntil))return {status:"unverified"};
 const row=serverRows.find(item=>item?.id===local.id&&UUID.test(item?.id||""));
 if(!row)return {status:"unverified"};
 if(row.revoked_at)return {status:"revoked"};
 const serverUntil=Date.parse(row.redeem_until);
 if(!Number.isFinite(serverUntil))return {status:"unverified"};
 // Never extend a cached bearer link beyond either confirmed deadline.
 const until=Math.min(localUntil,serverUntil);
 const expires=new Date(until).toISOString();
 return until<=now?{status:"expired",expires}:{status:"active",expires};
}
export function mountOwnerInviteOverview({card,rpc,read,write,draw,status}){
 const section=document.createElement("section");
 section.className="invitation-overview";
 section.setAttribute("aria-label","Ausgestellte App-Einladungen");
 const title=document.createElement("h4");title.textContent="Ausgestellte Einladungen";
 const refreshButton=document.createElement("button");
 refreshButton.type="button";refreshButton.className="outline-button";
 refreshButton.textContent="Liste aktualisieren";
 const message=document.createElement("p");
 message.className="small muted";message.setAttribute("role","status");
 const list=document.createElement("ul");list.className="invitation-overview-list";
 section.append(title,refreshButton,message,list);
 card.append(section);
 let busy=false,version=0;
 async function refresh(){
  const ticket=++version;
  message.textContent="Serverstatus wird geprüft …";
  try{
   const data=await rpc("app_access_invites_overview");
   if(!Array.isArray(data))throw Error("invalid overview");
   if(ticket!==version)return;
   // A different device can revoke an invitation. Remove only the local
   // copy/share affordance for that exact server-confirmed revoked link.
   const revokedLocally=reconcileIssuedInvite(read(),data);
   if(revokedLocally){
    write(revokedLocally,{broadcast:false});
    draw();
    status("Dieser Einladungslink wurde widerrufen. Du kannst einen neuen erstellen.");
   }
   list.replaceChildren();
   for(const record of data.slice(0,50)){
    if(!UUID.test(record?.id||""))continue;
    const item=document.createElement("li");
    const stamp=document.createElement("strong");
    const issued=new Date(record.created_at);
    stamp.textContent="Link vom "+(Number.isNaN(issued.valueOf())?
     "unbekannten Datum":issued.toLocaleDateString("de-DE"));
    const details=document.createElement("span");
    const expiry=new Date(record.redeem_until);
    const expired=!Number.isNaN(expiry.valueOf())&&expiry<=Date.now();
    const revoked=Boolean(record.revoked_at);
    const accepted=Number.isInteger(record.accepted_count)&&record.accepted_count>=0?
     record.accepted_count:0;
    details.textContent=(revoked?"Widerrufen":expired?"Annahmefrist vorbei":
     "Annahme bis "+(Number.isNaN(expiry.valueOf())?"unbekannt":expiry.toLocaleDateString("de-DE")))+
     " · "+accepted+" angenommene Zugänge"+(expired&&!revoked?" (bleiben bis Widerruf aktiv)":"");
    item.append(stamp,details);
    if(!revoked){
     const revoke=document.createElement("button");
     revoke.type="button";revoke.className="outline-button";
     revoke.textContent="Link und Zugänge widerrufen";
     revoke.addEventListener("click",async()=>{
      if(busy||!window.confirm("Alle über diesen Link erteilten App-Zugänge widerrufen?"))return;
      busy=true;revoke.disabled=true;
      try{
       const ok=await rpc("app_access_invite_revoke",{p_invitation_id:record.id});
       if(ok!==true)throw Error("Widerruf nicht bestätigt");
       const local=read();
       if(local?.id===record.id){write({...local,revoked:true});draw()}
       status("Einladung und sämtliche zugehörigen Zugänge wurden widerrufen.");
      }catch(error){status(error?.message||"Widerruf fehlgeschlagen.");}
      finally{busy=false;await refresh();}
     });
     item.append(revoke);
    }
    list.append(item);
   }
   message.textContent=data.length?
    "Letzte "+data.length+" Einladungen. Annahmezahlen erfassen technische Zugänge, keine Personen.":
    "Noch keine vom Betreiber ausgestellten App-Einladungen.";
  }catch{
   if(ticket===version)message.textContent=
    "Serverübersicht derzeit nicht erreichbar; die bisherige Einladungsfunktion bleibt erhalten.";
  }
 }
 refreshButton.addEventListener("click",refresh);
 window.addEventListener("badminton:issued-invites-changed",refresh);
 refresh();
}

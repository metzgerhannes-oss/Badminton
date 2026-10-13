/** Consent-only invitation for ONE verified player's stored match cards.
 * A local DBV profile is NOT an ownership grant. All checks are server-side. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
import {freshToken} from "./scripts/private-invite-utils.mjs";
import {getPrivateSession} from "./private-invites.js";
const STORE="schmetterlinge.privatePlayerInvites.v1";
const $=id=>document.getElementById(id);
const DBV=/^[0-9]{2}-[0-9]{6}$/;
const read=()=>{
 try{
  const obj=JSON.parse(localStorage.getItem(STORE)||"{}");
  return obj&&typeof obj==="object"&&!Array.isArray(obj)?obj:{};
 }catch{return {}}
};
const save=map=>localStorage.setItem(STORE,JSON.stringify(map));
let selected=null,busy=false;
function dialog(){
 if($("private-player-dialog"))return $("private-player-dialog");
 const dlg=document.createElement("dialog");dlg.id="private-player-dialog";
 dlg.innerHTML='<div class="modal"><h2>Spielerprofil privat teilen</h2>'+
 '<p class="small">Nur ein ausdrücklich freigegebener Spieler mit bis zu 30 belegten Matchkarten. Zugang sieben Tage, jederzeit widerrufbar. Ein lokales Profil allein ist kein Berechtigungsnachweis.</p>'+
 '<p id="private-player-status" role="status" aria-live="polite"></p>'+
 '<label for="private-player-url">Einladungslink</label><input id="private-player-url" type="text" readonly autocomplete="off" spellcheck="false">'+
 '<div class="private-invite-actions"><button id="private-player-create" type="button" class="primary-button">Link erstellen</button>'+
 '<button id="private-player-copy" type="button" class="outline-button" hidden>Kopieren</button>'+
 '<button id="private-player-revoke" type="button" class="outline-button" hidden>Widerrufen</button>'+
 '<button id="private-player-close" type="button" class="subtle-button">Schließen</button></div></div>';
 document.body.append(dlg);
 $("private-player-create").addEventListener("click",create);
 $("private-player-copy").addEventListener("click",copy);
 $("private-player-revoke").addEventListener("click",revoke);
 $("private-player-close").addEventListener("click",()=>dlg.close());
 return dlg;
}
function message(text){$("private-player-status").textContent=text}
function show(record){
 const valid=record&&Date.parse(record.expires)>Date.now()&&/^[a-f0-9]{64}$/.test(record.token);
 const url=valid?new URL("./private-player.html",location.href):null;
 if(url)url.hash="token="+record.token;
 $("private-player-url").value=url?.href||"";
 $("private-player-create").hidden=Boolean(valid);
 $("private-player-copy").hidden=!valid;
 $("private-player-revoke").hidden=!valid;
}
async function rpc(name,body,token=null){
 const response=await fetch(SUPABASE_ROOT+"rpc/"+name,{
  method:"POST",cache:"no-store",headers:{
   apikey:PUBLIC_KEY,"Content-Type":"application/json",
   ...(token?{Authorization:"Bearer "+token}:{})
  },body:JSON.stringify(body)});
 if(!response.ok)throw Error("RPC "+response.status);
 return response.json();
}
function open(player){
 if(!DBV.test(player?.id||""))return;
 selected=player.id;
 const dlg=dialog(),rec=read()[selected];
 show(rec);
 message(rec&&Date.parse(rec.expires)>Date.now()?"Diese private Freigabe kann widerrufen werden.":
  "Nur unabhängig verifizierte Profilverwalter können Einladungen erstellen. Eine DBV-ID oder ein lokales Profil genügt nicht.");
 if(!dlg.open)dlg.showModal();
}
async function create(){
 if(!selected||busy)return;
 busy=true;$("private-player-create").disabled=true;
 try{
  // User actively requested a private cloud action. No account for browsing.
  const session=await getPrivateSession(true),token=freshToken();
  const result=await rpc("private_player_invite_create",{p_token:token,p_player_dbv_id:selected},session.access_token);
  const record=Array.isArray(result)?result[0]:null;
  if(!record?.invitation_id||!record?.expires_at)throw Error("not confirmed");
  const map=read();
  map[selected]={id:record.invitation_id,token,expires:record.expires_at};
  save(map);show(map[selected]);
  message("Privater Link erstellt. Empfänger benötigen kein Konto. Wer den Link besitzt, kann ihn weitergeben.");
 }catch{
  message("Freigabe nicht möglich. Zuerst muss deine Verwaltungsberechtigung für diesen Spieler unabhängig bestätigt werden. Die Daten bleiben geschützt.");
 }finally{busy=false;$("private-player-create").disabled=false}
}
async function copy(){
 const value=$("private-player-url").value;if(!value)return;
 try{
  if(!navigator.clipboard?.writeText)throw Error("clipboard");
  await navigator.clipboard.writeText(value);
  message("Link kopiert. Jeder mit dem Link kann ausschließlich den freigegebenen Spieler sehen.");
 }catch{
  $("private-player-url").focus();$("private-player-url").select();
  message("Bitte den markierten Link kopieren.");
 }
}
async function revoke(){
 if(!selected||busy)return;
 const rec=read()[selected];if(!rec)return;
 busy=true;$("private-player-revoke").disabled=true;
 try{
  const session=await getPrivateSession(false);
  if(!session)throw Error("session missing");
  const result=await rpc("private_player_invite_revoke",{p_invitation_id:rec.id},session.access_token);
  if(result!==true)throw Error("not revoked");
  const map=read();delete map[selected];save(map);show(null);
  message("Zugriff widerrufen. Bereits kopierte Informationen können nicht zurückgeholt werden.");
 }catch{message("Widerruf fehlgeschlagen. Die bestehende Sitzung wird benötigt.");}
 finally{busy=false;$("private-player-revoke").disabled=false}
}
window.addEventListener("badminton:player-private-share",e=>open(e.detail?.player));

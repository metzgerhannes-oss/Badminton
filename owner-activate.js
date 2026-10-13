/** One-use repository-owner bootstrap. Never persist or log the activation secret. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
import {getPrivateSession} from "./private-invites.js";
const pattern=/^#activate=([a-f0-9]{64})$/;
const match=pattern.exec(window.__ownerHash||"");
delete window.__ownerHash;
let token=match?.[1]||"";
const button=document.getElementById("owner-claim");
const status=document.getElementById("owner-claim-status");
if(!token){
 status.textContent="Ungültiger oder fehlender Aktivierungslink. Fordere einen neuen Administratorlink beim Eigentümer an.";
}else{
 button.disabled=false;
 status.textContent="Aktivierungslink bereit. Nur auf deinem eigenen Gerät aktivieren.";
}
let running=false;
button.addEventListener("click",async()=>{
 if(running||!token)return;
 running=true;button.disabled=true;status.textContent="Eigentümerberechtigung wird geprüft …";
 const secret=token;token="";
 try{
  const session=await getPrivateSession(true);
  if(!session?.access_token)throw Error("no session");
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
  let response;
  try{
   response=await fetch(SUPABASE_ROOT+"rpc/private_owner_bootstrap_claim",{
    method:"POST",cache:"no-store",signal:controller.signal,
    headers:{apikey:PUBLIC_KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
    body:JSON.stringify({p_token:secret})
   });
  }finally{clearTimeout(timer)}
  const ok=response.ok?await response.json():false;
  if(ok!==true)throw Error("invalid claim");
  status.textContent="Administratorzugang aktiviert. Das Gerät ist jetzt als Eigentümer bestätigt. Du kannst in den Einstellungen deine eigenen Spieler für private Einladungen freigeben.";
  button.hidden=true;
  const link=document.createElement("a");link.href="./index.html#einstellungen";
  link.textContent="Spielerberechtigungen einrichten →";
  status.append(" ",link);
 }catch{
  status.textContent="Aktivierung fehlgeschlagen oder Code bereits verwendet/abgelaufen. Kein Administratorrecht vergeben. Falls anonyme Supabase-Sitzungen deaktiviert sind, müssen diese zunächst für die App freigeschaltet werden.";
 }finally{running=false;button.disabled=true}
});
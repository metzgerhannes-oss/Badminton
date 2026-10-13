/** Read one scoped player capability without an account. Never cache the token. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
const $=id=>document.getElementById(id);
const status=$("player-invite-status");
function fail(){status.textContent="Diese Einladung ist ungültig, abgelaufen oder widerrufen."; $("player-invite-data").hidden=true}
function tokenFromHash(){
 const raw=location.hash.slice(1),candidate=raw.startsWith("token=")?raw.slice(6):raw;
 return /^[a-f0-9]{64}$/.test(candidate)?candidate:"";
}
const token=tokenFromHash();
// Remove the bearer credential from the visible location BEFORE any network request.
history.replaceState(null,"",location.pathname+location.search);
if(!token){fail()}
else{
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),6500);
 try{
  const response=await fetch(SUPABASE_ROOT+"rpc/private_player_invite_read",{
   method:"POST",cache:"no-store",signal:controller.signal,
   headers:{apikey:PUBLIC_KEY,"Content-Type":"application/json",Accept:"application/json"},
   body:JSON.stringify({p_token:token})
  });
  const data=response.ok?await response.json():null;
  if(!data?.player||!/^[0-9]{2}-[0-9]{6}$/.test(data.player.dbv_id)||typeof data.player.name!=="string")fail();
  else{
   $("player-invite-name").textContent=data.player.name;
   $("player-invite-club").textContent=[data.player.club,data.player.age_class].filter(Boolean).join(" · ");
   const list=$("player-invite-matches");
   list.replaceChildren();
   for(const match of (Array.isArray(data.matches)?data.matches:[]).slice(0,30)){
    const li=document.createElement("li"),title=document.createElement("strong");
    title.textContent=[match.match_date,match.discipline,match.competition].filter(Boolean).join(" · ");
    li.append(title);
    const description=document.createElement("p");
    const result=[1,2].includes(match.player_side)&&[1,2].includes(match.winning_side)
     ?(match.player_side===match.winning_side?"Sieg":"Niederlage"):"Ergebnis nicht eindeutig";
    description.textContent=result+" · "+String(match.source_name||"Quellenbeleg");
    li.append(description);
    try{
     const url=new URL(match.source_url);
     if(url.protocol==="https:"&&["badhub.de","www.badhub.de","dbv.turnier.de"].includes(url.hostname)){
      const a=document.createElement("a");a.href=url.href;a.target="_blank";a.rel="noopener noreferrer";
      a.referrerPolicy="no-referrer";a.textContent="Originalquelle öffnen";
      li.append(a);
     }
    }catch{}
    list.append(li);
   }
   if(!list.children.length){
    const li=document.createElement("li");li.textContent="Keine belegten Matchkarten gespeichert.";list.append(li);
   }
   $("player-invite-data").hidden=false;
   status.textContent="Einladung geprüft. Die Daten werden nur für diese Ansicht geladen.";
  }
 }catch{fail()}finally{clearTimeout(timer)}
}

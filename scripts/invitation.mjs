/** Standalone local-only invitation onboarding. No authentication or DBV ownership claim. */
export const STORE="shuttleboard-v1";
const ID=/^\d{2}-\d{6}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseDbvReference(raw){
 const input=String(raw||"").trim();
 if(!input)return {id:"",url:"",valid:false,empty:true};
 if(ID.test(input))return {id:input,url:"",valid:true,empty:false};
 let url;
 try{url=new URL(input)}catch{return {id:"",url:"",valid:false,empty:false,error:"Bitte eine DBV-Spieler-ID (z. B. 05-123456) oder einen offiziellen Spielerprofil-Link einfügen."}}
 const hosts=new Set(["dbv.turnier.de","turnier.de","www.turnier.de"]);
 if(url.protocol!=="https:"||url.username||url.password||!hosts.has(url.hostname.toLowerCase())){
  return {id:"",url:"",valid:false,empty:false,error:"Erlaubt sind nur offizielle HTTPS-Spielerprofil-Links von dbv.turnier.de."};
 }
 const match=url.pathname.match(/^\/player-profile\/([^/]+)\/?$/i);
 if(!match||!UUID.test(match[1])){
  return {id:"",url:"",valid:false,empty:false,error:"Bitte den persönlichen DBV-Spielerprofil-Link verwenden, nicht den allgemeinen Turnier- oder Ranglistenlink."};
 }
 return {id:"",url:"https://dbv.turnier.de/player-profile/"+match[1].toUpperCase(),valid:true,empty:false};
}

export function normalizeProfile(fields){
 const name=String(fields.name||"").trim().replace(/\s+/g," ").slice(0,80);
 if(!name)throw Error("Bitte den Spielernamen eingeben.");
 const parsed=parseDbvReference(fields.reference);
 const mode=fields.mode==="dbv"?"dbv":"manual";
 if(mode==="dbv"&&!parsed.valid)throw Error(parsed.error||"Bitte DBV-Spieler-ID oder Spielerprofil-Link eingeben.");
 if(mode==="manual"&&!parsed.empty&&!parsed.valid)throw Error(parsed.error||"Ungültige DBV-Angabe.");
 const age=String(fields.birthYear||"").trim();
 const birthYear=age?Number(age):undefined;
 if(age&&(!/^\d{4}$/.test(age)||!Number.isInteger(birthYear)||birthYear<1900||birthYear>new Date().getUTCFullYear()))
  throw Error("Das Geburtsjahr ist ungültig.");
 const club=String(fields.club||"").trim().replace(/\s+/g," ").slice(0,120);
 const id=parsed.id||"local-"+Date.now()+"-"+Math.random().toString(36).slice(2,8);
 return {id,name,club,birthYear,url:parsed.url};
}

const DBV_ID=/^\\d{2}-\\d{6}$/;
const comparable=value=>String(value??"").normalize("NFKC").trim().replace(/\\s+/g," ").toLocaleLowerCase("de");
function sameKnownValue(a,b){
 // A missing detail cannot disprove identity; conflicting known details can.
 return !a||!b||comparable(a)===comparable(b);
}
function matchingLocalIndex(players,profile){
 const matches=players.map((candidate,index)=>({candidate,index})).filter(({candidate})=>
  /^local-/.test(candidate.id)&&comparable(candidate.name)===comparable(profile.name)&&
  sameKnownValue(candidate.club,profile.club)&&sameKnownValue(candidate.birthYear,profile.birthYear));
 // Repair only if the confirmed player unambiguously identifies one local entry.
 return matches.length===1?matches[0].index:-1;
}
/** "confirmed" is only for an explicitly selected verified directory row.
 * Existing local profiles are not silently upgraded by matching a name alone.
 */
export function addProfileToStore(previous,profile,{confirmed=false}={}){
 const saved=previous&&typeof previous==="object"&&!Array.isArray(previous)?previous:{};
 const players=Array.isArray(saved.players)?saved.players.filter(x=>x&&typeof x.id==="string"&&typeof x.name==="string"):[];
 if(confirmed&&!DBV_ID.test(profile.id))throw Error("Der ausgewählte Spieler hat keine bestätigte DBV-ID. Bitte erneut suchen.");
 if(players.some(p=>p.id===profile.id))throw Error("Diese DBV-Spieler-ID ist bereits als eigenes Profil angelegt. Öffne die App und bearbeite sie dort.");
 const repairedIndex=confirmed?matchingLocalIndex(players,profile):-1;
 const priorId=repairedIndex>=0?players[repairedIndex].id:"";
 const nextPlayers=repairedIndex>=0
  ?players.map((p,i)=>i===repairedIndex?{...p,...profile,id:profile.id}:p)
  :[...players,profile];
 const active=confirmed?profile.id:(
  typeof saved.activeProfileId==="string"&&players.some(p=>p.id===saved.activeProfileId)
   ?saved.activeProfileId:profile.id);
 const officialLinks=Array.isArray(saved.officialLinks)?saved.officialLinks.map(link=>
  priorId&&link?.playerId===priorId?{...link,playerId:profile.id}:link):[];
 const friends=Array.isArray(saved.friends)?saved.friends.filter(p=>!confirmed||p?.id!==profile.id):[];
 return {...saved,players:nextPlayers,friends,officialLinks,
  activeProfileId:active,chosen:active,historyProfilesInitialized:true};
}

export function invitationUrl(base){
 const u=new URL("./welcome.html",base);
 u.search="";u.hash="";
 return u.href;
}

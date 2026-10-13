/** Locally add a player obtained through an already accepted, server-checked
 * invitation. Following is NOT an ownership or a cloud-access grant. */
const DBV_ID=/^[0-9]{2}-[0-9]{6}$/;
const clean=(value,limit)=>String(value||"").trim().replace(/\s+/g," ").slice(0,limit);
export function invitationFollowCandidate(player){
 const id=clean(player?.dbv_id,16);
 const name=clean(player?.name,80);
 if(!DBV_ID.test(id)||!name)return null;
 const year=Number(player.birth_year);
 return {
  id,name,club:clean(player.club,120),
  ...(Number.isInteger(year)&&year>=1900&&year<=new Date().getUTCFullYear()?{birthYear:year}:{}),
  url:""
 };
}
export function addAcceptedPlayerToLocalStore(previous,player){
 const candidate=invitationFollowCandidate(player);
 if(!candidate)return null;
 const saved=previous&&typeof previous==="object"&&!Array.isArray(previous)?previous:{};
 const own=Array.isArray(saved.players)?saved.players:[];
 if(own.some(p=>p?.id===candidate.id))return {...saved};
 const friends=Array.isArray(saved.friends)?saved.friends.filter(p=>p&&typeof p.id==="string"):[];
 const before=friends.find(x=>x.id===candidate.id);
 const merged={...before,...candidate,
  // Do not drop previously known optional details if scoped data omits them.
  birthYear:candidate.birthYear||before?.birthYear,
  club:candidate.club||before?.club||""};
 const without=friends.filter(p=>p.id!==candidate.id);
 return {...saved,friends:[merged,...without].slice(0,30)};
}

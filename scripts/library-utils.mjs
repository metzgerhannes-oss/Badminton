/** Pure, browser/Node-safe filters for verified DBV library records. */
export function normalizeText(value){
 return String(value??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("de").replace(/\s+/g," ").trim();
}
export function sortClubs(names){
 return [...new Set(names)].sort((a,b)=>a.localeCompare(b,"de",{sensitivity:"base"}));
}
export function selectPlayers(players,{query="",club="",association="all"}={}){
 const term=normalizeText(query),clubTerm=normalizeText(club);
 return players.filter(p=>{
  if(association!=="all"&&p.association!==association)return false;
  if(clubTerm&&!normalizeText(p.club).includes(clubTerm))return false;
  if(!term)return true;
  return normalizeText(p.name+" "+p.id+" "+(p.club||"")).includes(term);
 }).sort((a,b)=>(a.club||"~").localeCompare(b.club||"~","de",{sensitivity:"base"})||
      a.name.localeCompare(b.name,"de",{sensitivity:"base"})||a.id.localeCompare(b.id));
}
export function clubGroups(players){
 const groups=[];
 for(const player of players){
  const club=player.club||"";
  const last=groups[groups.length-1];
  if(last&&last.club===club)last.players.push(player);
  else groups.push({club,players:[player]});
 }
 return groups;
}

/** Only already user-selected local profiles. No private club roster or cloud listing. */
export function localLibraryPlayers(storage){
 const own=Array.isArray(storage?.players)?storage.players:[];
 const friends=Array.isArray(storage?.friends)?storage.friends:[];
 const uniq=new Map();
 for(const p of [...own,...friends]){
  const id=String(p?.id||"");
  const name=String(p?.name||"").trim();
  if(!/^\d{2}-\d{6}$/.test(id)||!name||uniq.has(id))continue;
  uniq.set(id,{id,name,club:String(p.club||""),ageClass:String(p.ageClass||p.age_class||""),
    association:String(p.association||""),birthYear:p.birthYear??p.birth_year??null,lastSeen:""});
 }
 return [...uniq.values()];
}

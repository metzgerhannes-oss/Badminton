/** Pure, privacy-safe club overview: official team names plus device-only profiles. */
import {rosterText,validateSpvggRoster,rosterMatchesClub} from "./spvgg-roster.mjs";
export const DEFAULT_CLUB="SpVgg Mössingen";
const norm=s=>rosterText(s);
const validId=id=>/^\d{2}-\d{6}$/.test(String(id||""));
export function clubChoices(profiles=[]){
 const choices=[DEFAULT_CLUB];
 for(const p of profiles){
  const club=String(p?.club||"").trim();
  if(club && !choices.some(x=>norm(x)===norm(club)))choices.push(club);
 }
 return choices;
}
export function buildClubRows(roster,profiles=[],club=DEFAULT_CLUB){
 const isSpvgg=rosterMatchesClub(club);
 const byName=new Map();
 if(isSpvgg && roster){
  validateSpvggRoster(roster);
  for(const team of roster.teams)for(const name of team.members){
   const key=norm(name);
   if(!byName.has(key))byName.set(key,{key,name,teams:[],ageClass:"",dbvId:"",source:"Vereinsquelle",local:false});
   const row=byName.get(key);
   if(!row.teams.includes(team.team))row.teams.push(team.team);
  }
 }
 for(const p of profiles){
  if(!p || !norm(p.name) || !norm(p.club) ||
   !(isSpvgg?rosterMatchesClub(p.club):norm(p.club)===norm(club)))continue;
  const name=String(p.name).trim(),key=norm(name);
  // A matching name only identifies a shared display row, NOT an official DBV mapping.
  // The device-owned profile remains a separately disclosed local reference.
  const existing=byName.get(key);
  if(existing){
   existing.local=true;
   existing.localNameMatch=true;
   if(validId(p.id)){existing.dbvId=String(p.id);existing.localPlayerId=String(p.id);}
   if(/^U(?:11|13|15|17|19|22)$/.test(p.ageClass||""))existing.ageClass=p.ageClass;
   existing.source="Vereinsquelle + lokal";
  }else{
   byName.set(key,{key,name,teams:[],ageClass:/^U(?:11|13|15|17|19|22)$/.test(p.ageClass||"")?p.ageClass:"",
    dbvId:validId(p.id)?String(p.id):"",localPlayerId:validId(p.id)?String(p.id):"",source:"Nur lokal",local:true});
  }
 }
 return [...byName.values()].sort((a,b)=>a.name.localeCompare(b.name,"de"));
}
export function filterClubRows(rows,{query="",team="all",age="all",sort="name"}={}){
 const search=norm(query);
 const items=rows.filter(row=>(!search||norm(row.name+" "+row.dbvId).includes(search))&&
  (team==="all"||row.teams.includes(team))&&
  (age==="all"||(age==="unknown"?!row.ageClass:row.ageClass===age)));
 if(sort==="team")items.sort((a,b)=>(a.teams[0]||"Z").localeCompare(b.teams[0]||"Z")||a.name.localeCompare(b.name,"de"));
 else if(sort==="age")items.sort((a,b)=>(a.ageClass||"ZZ").localeCompare(b.ageClass||"ZZ")||a.name.localeCompare(b.name,"de"));
 else items.sort((a,b)=>a.name.localeCompare(b.name,"de"));
 return items;
}

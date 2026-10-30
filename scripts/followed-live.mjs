/** Verified, bounded, family-device-only selection of public DBV player LIVE snapshots.
 * This is intentionally NOT a full-tournament feed and does not write match records. */
import {DBV_ID,radarSituation,matchdayOverview,setText,opponents,matchLabel,playerOutcome} from "./live-radar.mjs";
export const FOLLOW_LIMIT=6;
/** A different followed roster supersedes pending requests; identical events coalesce. */
export function shouldReplaceFollowedRequest(busy,activeRosterKey,nextRosterKey){
 return !busy||activeRosterKey!==nextRosterKey;
}

const txt=(v,n=110)=>typeof v==="string"?v.trim().slice(0,n):"";
export function followedRoster(groups={},limit=FOLLOW_LIMIT){
 const safeLimit=Number.isInteger(limit)&&limit>0?Math.min(6,limit):FOLLOW_LIMIT;
 const seen=new Set(),all=[];
 for(const [role,people] of [["own",groups.own],["friend",groups.friends]]){
  for(const item of Array.isArray(people)?people:[]){
   const id=txt(item?.id,20);
   if(!DBV_ID.test(id)||seen.has(id))continue;
   seen.add(id);
   all.push({id,name:txt(item.name,80)||"DBV-Spieler "+id,role});
  }
 }
 const priority=txt(groups.selected,20);
 const selected=all.find(x=>x.id===priority);
 const sorted=selected?[selected,...all.filter(x=>x.id!==priority)]:all;
 return {players:sorted.slice(0,safeLimit),remaining:Math.max(0,sorted.length-safeLimit)};
}
export function followedSnapshotPath(players){
 const ids=players?.map(x=>x.id)||[];
 if(!ids.length||ids.length>FOLLOW_LIMIT||ids.some(id=>!DBV_ID.test(id)))return null;
 return "player_live_snapshots?"+new URLSearchParams({
  select:"dbv_id,provider,source_url,checked_at,payload,last_error_at",
  dbv_id:"in.("+ids.join(",")+")",limit:String(FOLLOW_LIMIT)
 });
}
export function followedCard(person,row,now=Date.now()){
 const id=person.id;
 const status=radarSituation(row,id,now);
 const label={own:"Eigenes Profil",friend:"Gefolgt"}[person.role]||"Spieler";
 const base={id,name:person.name,role:person.role,roleLabel:label,
  kind:status.kind,tournament:"",title:status.title,detail:status.detail,
  result:"",score:"",checkedAt:status.checkedAt||null,sourceUrl:"https://badhub.de/spieler/"+id+"/live"};
 if(status.kind!=="current")return base;
 const day=matchdayOverview(row,id,now);
 if(!day)return {...base,kind:"pending",title:"Turnierstand wird geprüft",detail:""};
 const tournament=txt(day.tournament,110);
 let title="Turniertag gemeldet",detail="Die Quelle hat noch keine anstehenden Einzelspiele veröffentlicht.",score="";
 if(day.running){
  title=setText(day.running)?"Spielt gerade":"Spiel aufgerufen";
  const enemy=opponents(day.running);
  detail=matchLabel(day.running)+(enemy?" · gegen "+enemy:"")+
   (day.running.court?" · "+txt(day.running.court,35):"");
  score=setText(day.running);
 }else if(day.queue!==null){
  title=day.queue===0?"Als Nächstes":day.queue===1?"Noch ein Spiel davor":
   "Noch "+day.queue+" Spiele davor";
  detail="Wartestand laut Badhub · keine feste Startzeit";
 }else if(day.upcoming.length){
  title="Spiele angesetzt";
  const next=day.upcoming[0];const enemy=opponents(next);
  detail=matchLabel(next)+(enemy?" · gegen "+enemy:"");
 }
 const past=day.past.at(-1);
 const result=past?playerOutcome(past):null;
 return {...base,tournament,title,detail,score,
  result:result==="win"?"Letztes Ergebnis: Sieg":result==="loss"?"Letztes Ergebnis: Niederlage":"",
  kind:"current"};
}
export function followedCards(roster,rows,now=Date.now()){
 const byId=new Map((Array.isArray(rows)?rows:[])
  .filter(r=>r&&DBV_ID.test(r.dbv_id||"")).map(r=>[r.dbv_id,r]));
 return roster.map(p=>followedCard(p,byId.get(p.id)||null,now));
}

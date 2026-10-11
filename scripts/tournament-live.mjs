/** Public, verified tournament-match reader. The DBV source URLs identify one saved
 * event; all data remains subject to the coverage of the authorised importer. */
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const OFFICIAL=/^https:\/\/(?:dbv\.turnier\.de|(?:www\.)?turnier\.de)\/tournament\/([0-9a-f-]{36})\/?$/i;
export function eventId(value){
 const m=String(value||"").match(OFFICIAL);
 return m&&UUID.test(m[1])?m[1].toUpperCase():null;
}
export function tournamentPath(id){
 if(!UUID.test(id||""))return null;
 return "tournaments?"+new URLSearchParams({
  select:"id,name,source_url",source_url:"ilike.*"+id.toUpperCase()+"*",limit:"6"
 });
}
export function matchesPath(id){
 if(!UUID.test(id||""))return null;
 const select="id,tournament_id,status,court,scheduled_at,source_url,last_synced_at,events(title,age_group,discipline),match_participants(side,player_position,participant_name,players(name,dbv_id)),match_games(game_number,side1_points,side2_points,finished)";
 return "matches?"+new URLSearchParams({select,tournament_id:"eq."+id,
  order:"scheduled_at.asc.nullslast",limit:"240"});
}
export function matchTournament(rows,event){
 const id=eventId(event?.url);
 if(!id||!Array.isArray(rows))return null;
 return rows.find(x=>UUID.test(x?.id||"")&&eventId(x.source_url)===id)||null;
}
const object=v=>v&&typeof v==="object"&&!Array.isArray(v)?v:null;
const bounded=(v,n=120)=>typeof v==="string"?v.trim().slice(0,n):"";
const states=new Set(["playing","called","scheduled","finished","cancelled","walkover","unknown"]);
function validPoints(v){return Number.isInteger(v)&&v>=0&&v<=40}
export function toMatch(row,now=Date.now()){
 if(!object(row)||!UUID.test(row.id||""))return null;
 const raw=Array.isArray(row.match_participants)?row.match_participants:[];
 const names=side=>raw.filter(p=>object(p)&&p.side===side)
  .slice().sort((a,b)=>(Number(a.player_position)||0)-(Number(b.player_position)||0))
  .map(p=>bounded(object(p.players)?.name,90)||bounded(p.participant_name,90))
  .filter(Boolean).slice(0,2).join(" / ")||"Noch offen";
 const games=(Array.isArray(row.match_games)?row.match_games:[])
  .filter(g=>object(g)&&validPoints(g.side1_points)&&validPoints(g.side2_points))
  .slice(0,5).sort((a,b)=>(a.game_number||0)-(b.game_number||0))
  .map(g=>g.side1_points+":"+g.side2_points);
 const status=states.has(row.status)?row.status:"unknown";
 const checked=Date.parse(row.last_synced_at||"");
 const age=Number.isFinite(checked)?Math.max(0,now-checked):Infinity;
 const liveFresh=age<=120000;
 const label=status==="playing"?(liveFresh?"Läuft":"Stand prüfen"):
  status==="called"?(liveFresh?"Aufgerufen":"Stand prüfen"):
  status==="finished"?"Beendet":status==="walkover"?"Kampflos":
  status==="cancelled"?"Abgesagt":status==="scheduled"?"Angesetzt":"Status offen";
 const category=["playing","called"].includes(status)?"live":
  status==="finished"?"finished":status==="walkover"||status==="cancelled"?"other":"upcoming";
 const event=object(row.events);
 return {id:row.id,category,status,label,sourceFresh:liveFresh,
  checkedAt:Number.isFinite(checked)?new Date(checked).toISOString():null,
  discipline:bounded(event?.title,110)||bounded(event?.discipline,50)||"Begegnung",
  side1:names(1),side2:names(2),court:bounded(row.court,45),
  scheduledAt:Number.isFinite(Date.parse(row.scheduled_at||""))?row.scheduled_at:null,
  // A stale provisional score is not advertised as a live score.
  sets:category==="live"&&!liveFresh?[]:games,
  source:typeof row.source_url==="string"&&eventId(row.source_url)?row.source_url:null
 };
}
export function tournamentOverview(rows,eventIdValue,now=Date.now()){
 if(!UUID.test(eventIdValue||"")||!Array.isArray(rows))return [];
 const seen=new Set();
 const safe=[];
 for(const row of rows.slice(0,240)){
  if(!row||row.tournament_id!==eventIdValue||seen.has(row.id))continue;
  const item=toMatch(row,now);
  if(!item)continue;
  seen.add(row.id);safe.push(item);
 }
 const weight={live:0,upcoming:1,finished:2,other:3};
 return safe.sort((a,b)=>weight[a.category]-weight[b.category]||
  String(a.scheduledAt||"9999").localeCompare(String(b.scheduledAt||"9999"))||
  a.id.localeCompare(b.id));
}
export function filterTournament(items,{status="all",court="all"}={}){
 return items.filter(m=>(status==="all"||m.category===status)&&
  (court==="all"||m.court===court));
}
export function tournamentCounts(items){
 return {live:items.filter(x=>x.category==="live"&&x.sourceFresh).length,
  upcoming:items.filter(x=>x.category==="upcoming").length,
  finished:items.filter(x=>x.category==="finished").length,
  total:items.length};
}

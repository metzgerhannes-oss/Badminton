/** P0: read-only cohort match-source audit; logs NO player names, DBV IDs,
 * opponents, individual scores, credentials or source HTML. */
const BASE="https://yadexibmjmnjfmfabrug.supabase.co/rest/v1/";
const KEY="sb_publishable_WdNC1AoOLe4rqDomSVnxWw_wq64M5kE";
const ID=/^\d{2}-\d{6}$/;
async function load(table,select,max=12000){
 const list=[],page=400;
 for(let offset=0;offset<max;offset+=page){
  const url=new URL(table,BASE);
  url.search=new URLSearchParams({select,limit:String(page),offset:String(offset)});
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),10000);
  try{
   const response=await fetch(url,{signal:ctl.signal,cache:"no-store",
    headers:{apikey:KEY,Accept:"application/json"}});
   if(!response.ok)throw Error("REST_"+response.status);
   const data=await response.json();
   if(!Array.isArray(data)||data.length>page)throw Error("BAD_FORMAT");
   list.push(...data);
   if(data.length<page)return {data:list,truncated:false};
  }finally{clearTimeout(timer)}
 }
 return {data:list,truncated:true};
}
try{
 const [hist,imports,facts,placements]=await Promise.all([
  load("player_history_imports","dbv_id,status",500),
  load("player_external_match_imports","dbv_id,status,verified_count,cursor_offset",500),
  load("player_external_match_facts","dbv_id,source_key",10000),
  load("tournament_placements","dbv_id",5000)
 ]);
 const rows=hist.data.filter(x=>ID.test(x.dbv_id));
 const ids=[...new Set(rows.map(x=>x.dbv_id))];
 const imp=new Map(imports.data.filter(x=>ID.test(x.dbv_id)).map(x=>[x.dbv_id,x]));
 const matches=new Map(),awards=new Map();
 for(const item of facts.data)if(ID.test(item.dbv_id))matches.set(item.dbv_id,(matches.get(item.dbv_id)||0)+1);
 for(const item of placements.data)if(ID.test(item.dbv_id))awards.set(item.dbv_id,(awards.get(item.dbv_id)||0)+1);
 const categories={not_started:0,awaiting_source:0,partial:0,complete:0,error:0,other:0};
 let withMatches=0,withPlacements=0,statusBehind=0;
 for(const id of ids){
  const task=imp.get(id),key=task?.status||"not_started";
  if(key in categories)categories[key]++;else categories.other++;
  const count=matches.get(id)||0;
  if(count>0)withMatches++;
  if((awards.get(id)||0)>0)withPlacements++;
  if(count<Number(task?.verified_count||0))statusBehind++;
 }
 const summary={expected_club_profiles:13,
  tracked_history_profiles:ids.length,
  registered_sources_missing:Math.max(0,13-ids.length),
  with_match_facts:withMatches,without_match_facts:ids.length-withMatches,
  with_placements:withPlacements,import_states:categories,
  count_gap_against_import_status:statusBehind,
  total_match_facts_for_tracked:ids.reduce((n,id)=>n+(matches.get(id)||0),0),
  match_facts_truncated:facts.truncated,
  placements_truncated:placements.truncated};
 console.log("P0_CLUB_COHORT_AUDIT "+JSON.stringify(summary));
 if(ids.length!==13||facts.truncated||placements.truncated||statusBehind)process.exitCode=2;
}catch(error){
 // Error strings are intentionally whitelisted; do not include URLs/user rows.
 const code=/REST_\d{3}/.exec(String(error))?.[0]||
  (String(error).includes("AbortError")?"TIMEOUT":"UNVERIFIABLE");
 console.error("P0_CLUB_COHORT_AUDIT_FAILED "+code);
 process.exitCode=1;
}

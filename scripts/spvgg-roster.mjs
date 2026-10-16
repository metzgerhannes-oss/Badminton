/** Official SpVgg team photo captions; source backed, NOT an O19/DBV identity directory. */
export const ROSTER_URL="./data/spvgg-active-roster.json";
const VALID_TEAMS=["I","II","III","IV","V"];
const ALLOWED_SOURCE=/^https:\/\/www\.spvgg\.org\/abteilungen\/badminton\/mannschaften\/[1-5]-mannschaft$/;
export const rosterText=value=>String(value??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/ß/g,"ss").toLocaleLowerCase("de").replace(/[^a-z0-9]+/g," ").trim();
export const rosterEsc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
export function validateSpvggRoster(data){
 if(data?.schemaVersion!==1||data?.clubId!=="10777"||data?.sourceKind!=="official_club_team_photo_captions"||
    !/^20\d{2}\/\d{2}$/.test(data?.sourceSeason||"")||!Array.isArray(data.teams)||data.teams.length!==5)throw Error("Ungültiges Vereins-Kaderarchiv");
 for(let i=0;i<5;i++){
  const row=data.teams[i];
  if(row?.team!==VALID_TEAMS[i]||!ALLOWED_SOURCE.test(row?.sourceUrl||"")||
     !row.sourceUrl.endsWith("/"+(i+1)+"-mannschaft")||!Array.isArray(row.members)||
     row.members.length<5||row.members.length>35||new Set(row.members).size!==row.members.length||
     row.members.some(name=>typeof name!=="string"||name.length<3||name.length>90||
       !/^[\p{L} .'-]+$/u.test(name)))throw Error("Ungültige Vereins-Spielerliste "+VALID_TEAMS[i]);
 }
 return data;
}
let ongoing=null;
export function loadSpvggRoster({fetchImpl=fetch}={}){
 if(fetchImpl!==fetch)return fetchRoster(fetchImpl);
 if(!ongoing)ongoing=fetchRoster(fetchImpl).catch(err=>{ongoing=null;throw err});
 return ongoing;
}
async function fetchRoster(fetchImpl){
 const result=await fetchImpl(ROSTER_URL,{cache:"no-store"});
 if(!result.ok)throw Error("Vereinskader derzeit nicht abrufbar");
 return validateSpvggRoster(await result.json());
}
export function rosterMatchesClub(term){
 const q=rosterText(term);
 return !q||["spvgg mossingen","spvgg moessingen","sportvereinigung mossingen"].some(name=>name.includes(q)||q.includes(name));
}
export function rosterGroups(data,{query="",team="all"}={}){
 validateSpvggRoster(data);
 const needle=rosterText(query);
 return data.teams.filter(row=>team==="all"||row.team===team)
  .map(row=>({...row,members:row.members.filter(name=>rosterText(name).includes(needle))}))
  .filter(row=>row.members.length);
}
export function rosterHtml(data,{query="",team="all",compact=false}={}){
 const groups=rosterGroups(data,{query,team});
 const count=new Set(groups.flatMap(row=>row.members)).size;
 if(!groups.length)return '<p class="club-roster-empty">Keine passenden Spieler in den veröffentlichten Mannschaftskadern.</p>';
 return '<p class="club-roster-count">'+count+' namentlich genannte Spieler'+(team==="all"?' · Mehrfachnennungen nur einmal gezählt':'')+'</p>'+
 '<div class="club-roster-grid'+(compact?' club-roster-grid-compact':'')+'">'+groups.map(row=>
  '<section class="club-roster-team"><div class="club-roster-team-head"><h4>Aktive '+rosterEsc(row.team)+'</h4>'+
   '<a href="'+rosterEsc(row.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Vereinsquelle ↗</a></div>'+
   '<div class="club-roster-names">'+row.members.map(name=>'<span class="club-roster-name">'+rosterEsc(name)+'</span>').join("")+'</div></section>'
 ).join("")+'</div>';
}

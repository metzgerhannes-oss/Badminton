// Pure, offline-verifiable official DBV weekly ranking model.
// Never fetches a source, stores player identities or writes a log.
export const SOURCE = "https://turniere.badminton.de/ranking";
export const MAX_PAYLOAD_BYTES = 4_800_000;
export const BW_ASSOCIATION = "BAW-Baden-Württemberg";
export const DISCIPLINES = ["HE","HD","HM","DE","DD","DM"];
export const AGES = ["U09","U11","U13","U15","U17","U19","U22"];
const ID = /^[0-9]{2}-[0-9]{6}$/;
const CLUB_ID = /^[0-9]{2}-[0-9]{3,8}$/;
const isoDateParts = new Intl.DateTimeFormat("en-GB",{
  timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"
});
function berlinParts(date) {
  return Object.fromEntries(isoDateParts.formatToParts(date).map(p=>[p.type,p.value]));
}
function isoWeek(year,month,day) {
  const d=new Date(Date.UTC(year,month-1,day));
  const weekday=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()+4-weekday);
  const isoYear=d.getUTCFullYear();
  return [isoYear,Math.floor((d.getTime()-Date.UTC(isoYear,0,1))/86400000/7)+1];
}
export function officialPublication(html,nowMs=Date.now()) {
  if(typeof html!=="string"||html.length>5_000_000)throw Error("publication_page_size");
  const marker=/zuletzt\s+aktualisiert\s*:/i.exec(html);
  if(!marker)throw Error("publication_stamp_missing");
  const stamp=/(\d{2})\.(\d{2})\.(20\d{2})\s+(\d{2}):(\d{2}):(\d{2})/.exec(
    html.slice(marker.index+marker[0].length,marker.index+marker[0].length+14000));
  if(!stamp)throw Error("publication_stamp_invalid");
  const [,dd,mm,yyyy,hh,mi,ss]=stamp.map(String);
  const year=Number(yyyy),month=Number(mm),day=Number(dd),hour=Number(hh);
  const minute=Number(mi),second=Number(ss);
  const candidates=[1,2].map(offset=>new Date(Date.UTC(year,month-1,day,hour-offset,minute,second)))
    .filter(date=>{
      const p=berlinParts(date);
      return Number(p.year)===year&&Number(p.month)===month&&Number(p.day)===day&&
        Number(p.hour)===hour&&Number(p.minute)===minute&&Number(p.second)===second;
    });
  if(candidates.length!==1)throw Error("publication_timezone_ambiguous");
  const publishedAt=candidates[0];
  if(publishedAt.getTime()>nowMs+300000||publishedAt.getTime()<Date.UTC(2026,0,1))
    throw Error("publication_stamp_out_of_range");
  const [isoYear,week]=isoWeek(year,month,day);
  const label=/Rangliste\s+KW\s*(\d{1,2})\b/i.exec(html);
  if(label&&Number(label[1])!==week)throw Error("publication_week_conflict");
  return {year:isoYear,week,publishedAt:publishedAt.toISOString()};
}
function clean(value,max=130) {
  return String(value??"").trim().replace(/\s+/g," ").slice(0,max);
}
function validRow(row) {
  return row&&ID.test(clean(row.id))&&AGES.includes(clean(row.ageClass).toUpperCase())&&
    Number.isInteger(Number(row.birthYear))&&Number(row.birthYear)>=1990&&
    Number(row.birthYear)<=2100&&
    clean(clean(row.firstName)+" "+clean(row.lastName),90).length>=3&&
    DISCIPLINES.includes(clean(row.discipline).toUpperCase())&&
    Number.isFinite(Number(row.points))&&Number(row.points)>=0&&Number(row.points)<=1e9;
}
function cohortRanks(rows) {
  const groups=new Map();
  for(const r of rows) {
    const key=[r.discipline,r.gender,r.ageClass].join("|");
    if(!groups.has(key))groups.set(key,new Map());
    const players=groups.get(key),old=players.get(r.id);
    if(!old||r.points>old.points)players.set(r.id,r);
  }
  const ranks=new Map();
  for(const players of groups.values()) {
    const sorted=[...players.values()].sort((a,b)=>b.points-a.points);
    let previous=null,rank=0;
    sorted.forEach((r,index)=>{
      if(r.points!==previous)rank=index+1;
      previous=r.points;
      const key=r.id+"|"+r.discipline,old=ranks.get(key);
      if(!old||rank<old.rank)ranks.set(key,{rank,record:r});
    });
  }
  return ranks;
}
export function buildWeeklyPayload(rows,publication) {
  if(!Array.isArray(rows)||rows.length<5000||rows.length>130000)
    throw Error("source_row_coverage");
  const {year,week,publishedAt}=publication||{};
  if(!Number.isInteger(year)||year<2026||year>2100||
     !Number.isInteger(week)||week<1||week>53||
     !(publishedAt===null||(typeof publishedAt==="string"&&Number.isFinite(Date.parse(publishedAt)))))
    throw Error("invalid_publication");
  const tag=String(year)+"-KW"+String(week).padStart(2,"0");
  const byId=new Map(),conflicts=new Set(),valid=[];
  for(const raw of rows) {
    if(!validRow(raw))continue;
    const id=clean(raw.id),ageClass=clean(raw.ageClass).toUpperCase();
    const name=clean(clean(raw.firstName)+" "+clean(raw.lastName),90);
    const birthYear=Number(raw.birthYear);
    const previous=byId.get(id);
    if(previous&&(previous.name!==name||previous.ageClass!==ageClass||
      previous.birthYear!==birthYear)){conflicts.add(id);continue;}
    const club=clean(raw.club,120),clubId=clean(raw.clubId,30);
    const info={id,name,birthYear,ageClass,club:club||previous?.club||"",
      clubId:CLUB_ID.test(clubId)?clubId:(previous?.clubId||""),
      association:clean(raw.association,70)||previous?.association||"",
      lastSeen:tag};
    byId.set(id,info);
    valid.push({...raw,id,ageClass,points:Number(raw.points),
      gender:clean(raw.gender).toUpperCase(),discipline:clean(raw.discipline).toUpperCase()});
  }
  for(const id of conflicts)byId.delete(id);
  const players=[...byId.values()].sort((a,b)=>a.id.localeCompare(b.id));
  if(players.length<5000||players.length>20000||conflicts.size>200)
    throw Error("player_coverage");
  const nationwide=cohortRanks(valid.filter(r=>byId.has(r.id)));
  const regional=cohortRanks(valid.filter(r=>byId.has(r.id)&&r.association===BW_ASSOCIATION));
  let rankingTotal=0;
  for(const p of players) {
    p.rankings=[];
    for(const disc of DISCIPLINES) {
      const r=nationwide.get(p.id+"|"+disc);
      if(!r)continue;
      const rec=r.record,regionalRank=regional.get(p.id+"|"+disc);
      const tournaments=Number(rec.tournaments),overall=Number(rec.overallRank);
      if(!Number.isInteger(tournaments)||tournaments<0||tournaments>200)
        throw Error("ranking_tournament_count");
      p.rankings.push([disc,rec.points,tournaments,r.rank,regionalRank?.rank??null,
        Number.isInteger(overall)&&overall>0?overall:null]);
      rankingTotal++;
    }
  }
  if(rankingTotal<Math.max(4000,Math.floor(players.length*.8))||
    rankingTotal>players.length*6)throw Error("ranking_coverage");
  const payload={source:SOURCE,year,week,sourcePublishedAt:publishedAt,
    total:players.length,rankingTotal,players};
  const body=JSON.stringify(payload);
  if(new TextEncoder().encode(body).length>MAX_PAYLOAD_BYTES)
    throw Error("payload_size");
  return payload;
}
export function importDecision(latest,publication) {
  if(!publication||!Number.isInteger(publication.year)||!Number.isInteger(publication.week))
    throw Error("invalid_publication");
  if(!latest||!Number.isInteger(latest.year)||!Number.isInteger(latest.week))
    return "new";
  const current=publication.year*100+publication.week;
  const previous=latest.year*100+latest.week;
  if(current<previous)throw Error("publication_older_than_database");
  if(current===previous) {
    if(publication.publishedAt===null)return "unchanged";
    if(latest.sourcePublishedAt&&Date.parse(latest.sourcePublishedAt)===Date.parse(publication.publishedAt))return "unchanged";
    throw Error("publication_same_week_unverified");
  }
  return "new";
}

/**
 * The archive's *actual published HTML href*, not an inferred filename,
 * is the only permitted weekly download. /ranking may already carry next
 * week's timestamp while that XLSX has not been released into /history.
 * Return [] until a matching, visibly labelled official archive row exists.
 */
export function officialXlsxCandidates(publication,historyHtml){
 const year=publication?.year,week=publication?.week;
 if(!Number.isInteger(year)||year<2026||year>2100||
    !Number.isInteger(week)||week<1||week>53)
   throw Error("publication_invalid");
 if(typeof historyHtml!=="string"||historyHtml.length>5_000_000)
   throw Error("archive_page_invalid");
 const file="Ranking_"+year+"_KW"+String(week).padStart(2,"0")+".xlsx";
 const rows=historyHtml.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)||[];
 const matching=new Set();
 for(const row of rows){
  // The filename must be VISIBLE within the same table row as its link.
  const label=row.replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ");
  if(!label.includes(file))continue;
  const links=row.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>/gi);
  for(const link of links){
   let url;
   try{url=new URL(link[2].replace(/&amp;/gi,"&"),"https://turniere.badminton.de/ranking/history");}
   catch{continue;}
   if(url.protocol!=="https:"||url.hostname!=="turniere.badminton.de"||
      url.port||url.username||url.password||url.search||url.hash)continue;
   if(url.pathname==="/uploads/ranking/"+file)matching.add(url.href);
  }
 }
 // Duplicate or ambiguous matching rows are not silently accepted.
 return matching.size===1?[...matching]:[];
}

/** The /ranking timestamp bounds the week, not the release date of older XLSX. */
export function selectOfficialArchive(historyHtml,pagePublication) {
 if(!pagePublication||!Number.isInteger(pagePublication.year)||
    !Number.isInteger(pagePublication.week))throw Error("publication_invalid");
 if(typeof historyHtml!=="string"||historyHtml.length>5_000_000)
    throw Error("archive_page_invalid");
 const rows=historyHtml.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)||[];
 const found=new Map();
 for(const row of rows) {
   const filenames=row.match(/Ranking_(20\d{2})_KW(\d{2})\.xlsx/g)||[];
   for(const filename of filenames) {
     const m=/^Ranking_(20\d{2})_KW(\d{2})\.xlsx$/.exec(filename);
     if(!m)continue;
     const year=Number(m[1]),week=Number(m[2]);
     if(week<1||week>53||year>pagePublication.year||
       (year===pagePublication.year&&week>pagePublication.week))continue;
     const urls=officialXlsxCandidates({year,week},row);
     if(urls.length===1)found.set(String(year)+"-"+String(week).padStart(2,"0"),urls[0]);
   }
 }
 if(found.size===0)return null;
 const key=[...found.keys()].sort().at(-1);
 const [year,week]=key.split("-").map(Number);
 return {year,week,publishedAt:null,downloadUrl:found.get(key),publicationKind:"official-archive"};
}

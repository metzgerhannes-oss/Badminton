/** Source-backed DBV matchday parser. Pure, bounded, no fetch, no persistence.
 * Never infer LIVE solely from a future/elapsed scheduled time. */
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const ID=/^\d{2}-\d{6}$/;
const allowed=new Set(["ME","JE","HE","DE","SE","UE","MS","WS","MD","JD","HD","DD","WD","BD","MX","MXD","XD","GD"]);
const decode=s=>String(s??"").replace(/&#x([a-f0-9]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
 .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
 .replace(/&amp;/gi,"&").replace(/&nbsp;/gi," ").replace(/&quot;/gi,'"')
 .replace(/&#39;|&apos;/gi,"'").replace(/[\u0000-\u001f]/g," ")
 .replace(/\s+/g," ").trim();
const slug=x=>String(x).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,36);
const codeFor=x=>String(x||"").toUpperCase().match(/^([A-Z]{2,3})\b/)?.[1]||"";
function berlinInstant(day,month,year,hour,minute){
 const ms=Date.UTC(Number(year),Number(month)-1,Number(day),Number(hour),Number(minute));
 const wall=new Date(ms);
 if(wall.getUTCDate()!==Number(day)||wall.getUTCMonth()+1!==Number(month)||
  wall.getUTCHours()!==Number(hour))return null;
 const tz=new Intl.DateTimeFormat("en-US",{timeZone:"Europe/Berlin",timeZoneName:"shortOffset"});
 const label=tz.formatToParts(wall).find(p=>p.type==="timeZoneName")?.value||"";
 const off=label.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
 if(!off)return null;
 const minutes=(off[1]==="+"?1:-1)*(Number(off[2])*60+Number(off[3]||0));
 return new Date(ms-minutes*60000).toISOString();
}
function parseCard(card,{tournamentId,playerNo},seen){
 const header=card.slice(0,2500);
 const draw=header.match(/href="\/sport\/draw\.aspx\?id=[0-9a-f-]+&amp;draw=(\d{1,7})"/i);
 const event=draw&&header.match(/href="\/sport\/draw\.aspx[^"]*"[^>]*>[\s\S]*?<span class="nav-link__value">([^<]+)<\/span>/i);
 const round=header.match(/<span title="([^"]{1,90})" class="nav-link"><span class="nav-link__value">/i);
 if(!draw||!event||!round)return null;
 const title=decode(event[1]).slice(0,60),kind=codeFor(title);
 if(!allowed.has(kind)||!/^U(?:9|11|13|15|17|19|22)\b/i.test(title.split(/\s+/).slice(1).join(" ")))return null;
 const className=decode(round[1]).slice(0,75),keyPart=slug(className);
 if(!keyPart)return null;
 const headings=[...card.matchAll(/<div class="match__row( [^"]*)?">/g)];
 if(headings.length!==2)return null;
 const resultAt=card.indexOf('<div class="match__result"');
 const sides=headings.map((h,i)=>{
  const end=i===0?headings[1].index:(resultAt>h.index?resultAt:card.length);
  const raw=card.slice(h.index,end);
  const members=[...raw.matchAll(/<a\s+href="\/sport\/player\.aspx\?id=[0-9a-f-]+&amp;player=(\d{1,9})"[^>]*data-player-id="(\d{1,9})"[^>]*>[\s\S]*?<span class="nav-link__value">([^<]+)<\/span>/gi)]
   .map(m=>({local_id:Number(m[1]),name:decode(m[3]).replace(/\s+\[\d+\]$/,"").slice(0,100)}));
  return {members:members.slice(0,2),won:/\bhas-won\b/.test(h[1]||"")};
 });
 if(sides.some(s=>s.members.length>2))return null;
 const mine=sides.flatMap((s,i)=>s.members.filter(p=>p.local_id===playerNo).map(p=>i+1));
 if(mine.length!==1||sides.some(s=>s.members.some(p=>!p.name)))return null;
 const uniqueIds=sides.flatMap(s=>s.members.map(m=>m.local_id));
 if(new Set(uniqueIds).size!==uniqueIds.length)return null;
 const time=card.match(/\b(?:Mo|Di|Mi|Do|Fr|Sa|So)\s+(\d{2})\.(\d{2})\.(20\d{2})\s+(\d{2}):(\d{2})/);
 const when=time?berlinInstant(time[1],time[2],time[3],time[4],time[5]):null;
 const footer=card.match(/class="icon-marker"[\s\S]{0,600}?<span class="nav-link__value">([^<]+)<\/span>/i);
 const hall=footer?decode(footer[1]):"";
 const court=hall.match(/\s-\s(\d{1,3})$/)?.[1]||null;
 const result=resultAt>=0?card.slice(resultAt,card.indexOf('<div class="match__btn"',resultAt)>0?card.indexOf('<div class="match__btn"',resultAt):undefined):"";
 const games=[...result.matchAll(/<ul class="points">([\s\S]*?)<\/ul>/g)]
  .map(m=>[...m[1].matchAll(/<li class="points__cell[^"]*"[^>]*>\s*(\d{1,2})\s*<\/li>/g)].map(x=>Number(x[1])))
  .filter(g=>g.length===2&&g.every(n=>Number.isInteger(n)&&n>=0&&n<=40)).slice(0,5);
 const winners=sides.map((s,i)=>s.won?i+1:null).filter(Boolean);
 // Only explicit winner + valid set scores are accepted as completed.
 const finished=games.length>=2&&winners.length===1;
 const status=finished?"finished":"scheduled";
 const slotKey=draw[1]+":"+keyPart;
 const slot=(seen.get(slotKey)||0)+1;seen.set(slotKey,slot);
 const key="pv:"+playerNo+":"+draw[1]+":"+keyPart+":"+slot;
 return {source_match_id:key,source_event_id:"draw:"+draw[1],
  title,discipline:["ME","JE","HE","DE","SE","UE","WS","MS"].includes(kind)?kind==="ME"||kind==="JE"||kind==="DE"||kind==="SE"?"WS":"MS":
   ["MD","JD","HD","DD","WD","BD"].includes(kind)?kind==="MD"||kind==="JD"||kind==="DD"?"WD":"MD":"XD",
  age_group:title.match(/\bU(?:9|11|13|15|17|19|22)\b/i)?.[0]||null,
  round_label:className,scheduled_at:when,court,
  status,winning_side:finished?winners[0]:null,
  sides:sides.map(s=>s.members.map(p=>({local_id:p.local_id,name:p.name}))),
  games:finished?games.map((s,i)=>({number:i+1,side1:s[0],side2:s[1]})):[],
  player_side:mine[0],day:time?time[3]+"-"+time[2]+"-"+time[1]:null};
}
/** No match is ever associated with someone via name alone. */
export function parseDbvPlayerMatchday(html,scope){
 if(typeof html!=="string"||html.length<4000||html.length>700000)
  throw Error("dbv_html_length");
 if(!scope||!UUID.test(scope.tournamentId||"")||!ID.test(scope.dbvId||"")||
  !Number.isSafeInteger(scope.playerNo)||scope.playerNo<1||scope.playerNo>999999)
  throw Error("dbv_scope_invalid");
 if(!/<title>Player\s*-\s*/i.test(html)||!html.includes("("+scope.dbvId+")"))
  throw Error("dbv_profile_identity_missing");
 const ownUrl=new RegExp('href="/sport/player\\.aspx\\?id='+scope.tournamentId.toLowerCase()+
  '&amp;player='+scope.playerNo+'"','i');
 if(!ownUrl.test(html))throw Error("dbv_local_id_unverified");
 const parts=html.split(/<li class="match-group__item"\s*>/i).slice(1);
 if(parts.length<1||parts.length>140)throw Error("dbv_card_count_invalid");
 const seen=new Map(),rows=[];
 for(const part of parts){
  if(!/^\s*<div class="match"/.test(part))continue;
  const card=parseCard(part,scope,seen);
  if(card)rows.push(card);
 }
 if(rows.length<1||rows.length>60||new Set(rows.map(x=>x.source_match_id)).size!==rows.length)
  throw Error("dbv_personal_matches_missing_or_ambiguous");
 return rows;
}

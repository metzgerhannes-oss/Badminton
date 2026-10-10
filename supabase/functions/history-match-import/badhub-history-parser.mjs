/** Publicly rendered match-card facts from a followed player's Badhub profile.
 * This is a separately source-labelled third-party transcription, NEVER an
 * official DBV match ID. Unknown sides, walkovers and malformed scores excluded.
 * No embedded HTML is persisted or exposed. */
const VALID_ID=/^\d{2}-\d{6}$/;
const MAP={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12,
 Januar:1,Februar:2,"Mär":3,Maerz:3,März:3,April:4,Mai:5,Juni:6,Juli:7,August:8,September:9,
 Oktober:10,November:11,Dezember:12};
function plain(s){
 return String(s||"").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/g," ")
  .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
  .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim().slice(0,180);
}
function iso(y,m,d){
 const date=new Date(Date.UTC(y,m-1,d));
 return date.getUTCFullYear()===y&&date.getUTCMonth()+1===m&&date.getUTCDate()===d
  ?String(y).padStart(4,"0")+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0"):null;
}
export function tournamentStart(markup){
 const info=markup.match(/class="sp-tournament-meta"[^>]*>([\s\S]*?)<\/span>/i);
 if(!info)return null;
 const text=plain(info[1]);
 // The first day is verifiably the tournament's start, NOT the day of this match.
 const m=text.match(/(\d{1,2})\.\s*(?:[–\-]\s*\d{1,2}\.\s*)?([A-Za-zÄÖÜäöü]{3,12})\s+(20\d{2})/);
 return m?iso(Number(m[3]),MAP[m[2]]||0,Number(m[1])):null;
}
export function leagueStart(markup){
 const d=markup.match(/class="sp-date-dm"[^>]*>(\d{2})\.(\d{2})\./);
 const y=markup.match(/class="sp-date-y"[^>]*>(20\d{2})/);
 return d&&y?iso(Number(y[1]),Number(d[2]),Number(d[1])):null;
}
function players(markup){
 return [...markup.matchAll(/class="sp-name-full"[^>]*>([\s\S]*?)<\/span>/g)]
  .map(m=>plain(m[1])).filter(Boolean).slice(0,4);
}
function sides(chunk){
 const start=chunk.indexOf('class="sp-match-body"');
 const mid=chunk.indexOf('class="sp-result-col"',start);
 if(start<0||mid<0)return null;
 const left=chunk.slice(start,mid);
 const post=chunk.slice(mid);
 const rightStart=post.indexOf('class="sp-side sp-side--away');
 if(rightStart<0)return null;
 const right=post.slice(rightStart);
 const a=players(left),b=players(right);
 const ownA=left.includes("sp-player-name--self"),ownB=right.includes("sp-player-name--self");
 if(ownA===ownB||!a.length||!b.length||a.length>2||b.length>2)return null;
 const winA=/class="sp-side sp-side--winner"/.test(left);
 const winB=/class="sp-side sp-side--away sp-side--winner"/.test(right);
 if(winA===winB)return null;
 const currentSide=ownA?1:2;
 const winningSide=winA?1:2;
 // Result numbers are always printed left-to-right in the source.
 const scores=[...post.slice(0,rightStart).matchAll(/class="sp-set-score"[^>]*>([\s\S]*?)<\/div>/g)]
  .map(m=>[...m[1].matchAll(/class="sp-s(?: [^"]*)?"[^>]*>(\d{1,2})<\/span>/g)].map(x=>Number(x[1])))
  .filter(s=>s.length===2&&s.every(x=>x>=0&&x<=40));
 if(scores.length<2||scores.length>5)return null;
 const counted=[scores.filter(x=>x[0]>x[1]).length,scores.filter(x=>x[1]>x[0]).length];
 if(counted[0]+counted[1]!==scores.length || (counted[0]>counted[1]?1:2)!==winningSide)return null;
 if(scores.some(x=>x[0]===x[1]||Math.max(...x)<11))return null;
 const selfNames=currentSide===1?a:b;
 const opponents=currentSide===1?b:a;
 return {currentSide,winningSide,selfNames,opponents,
  partners:selfNames.slice(0,2),sets:scores};
}
function discipline(event){
 const c=event.split(/\s/)[0].toUpperCase();
 if(["ME","DE","HE","JE","MS","WS","SE","UE"].includes(c))return "Einzel";
 if(["DD","HD","JD","MD","WD","D","BD"].includes(c))return "Doppel";
 if(["MX","MIX","GD","XD","MXD"].includes(c))return "Mixed";
 return null;
}
const keyPart=s=>plain(s).normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
 .toLocaleLowerCase("de").replace(/[^\p{L}\p{N}]+/gu,"-").replace(/(^-|-$)/g,"").slice(0,110);
function matchSections(segment){
 const parts=segment.split(/<div class="sp-match-item\b[^>]*>/);
 return {prefix:parts.shift()||"",chunks:parts};
}
function piece(source,segment,context){
 const {prefix,chunks}=matchSections(segment);
 const matches=[];let phase=plain((prefix.match(/class="sp-t-phase-header"[^>]*>([\s\S]*?)<\/div>/)||[])[1]);
 for(const chunk of chunks){
  const nextPhase=(chunk.match(/class="sp-t-phase-header"[^>]*>([\s\S]*?)<\/div>/)||[])[1];
  const data=sides(chunk);
  if(data){
   const event=context.event||plain((chunk.match(/class="sp-match-disc[^"]*"[^>]*>([\s\S]*?)<\/span>/)||[])[1]);
   const kind=discipline(event);
   if(kind&&context.source_id){
    // Stable match identity does not depend on scores, so corrections update it.
    const playersAll=[...data.selfNames,...data.opponents].map(keyPart).sort().join(".");
    const sourceKey=[source,context.source_id,keyPart(event),keyPart(phase),playersAll].join(":").slice(0,460);
    if(sourceKey.length>20)matches.push({
     source_key:sourceKey,competition:context.title.slice(0,180),
     competition_id:context.source_id,category:source,event:event.slice(0,60),
     discipline:kind,round_label:phase.slice(0,90)||null,
     match_date:context.date,match_year:context.year,
     player_side:data.currentSide,winning_side:data.winningSide,
     opponent_names:data.opponents,
     partner_names:data.selfNames.filter(n=>keyPart(n)!==keyPart(context.playerName)),
     games:data.sets,
     source_url:context.link,
     source_name:"Badhub",source_kind:"third-party-match-card"
    });
   }
  }
  if(nextPhase)phase=plain(nextPhase);
 }
 return matches;
}
function tournamentFacts(html,playerName){
 const cards=html.split(/<div class="card sp-tournament-card">/).slice(1),all=[];
 for(const card of cards){
  const head=card.match(/class="sp-tournament-name"[^>]*>[\s\S]*?<a href="\/bwbv\/turnier\.php\?id=(\d+)"[^>]*>([\s\S]*?)<\/a>/);
  if(!head)continue;
  const date=tournamentStart(card.slice(0,650));
  const year=date?Number(date.slice(0,4)):(Number((card.slice(0,600).match(/\b20\d{2}\b/)||[])[0])||null);
  const c={source_id:head[1],title:plain(head[2]),date,year,
   link:"https://badhub.de/bwbv/turnier.php?id="+head[1],playerName};
  for(const meeting of card.split(/<div class="sp-meeting">/).slice(1)){
   const event=plain((meeting.match(/class="sp-t-event-badge"[^>]*>([\s\S]*?)<\/span>/)||[])[1]);
   all.push(...piece("tournament",meeting,{...c,event}));
  }
 }
 return all;
}
function leagueFacts(html,playerName){
 const all=[];
 const sections=html.split(/<div class="sp-meeting">/).slice(1);
 for(const meeting of sections){
  const head=meeting.match(/\/bwbv\/begegnung\.php\?id=(\d+)/);
  if(!head)continue;
  const date=leagueStart(meeting.slice(0,2100));
  if(!date)continue;
  const title=plain((meeting.match(/class="sp-group-opponent sp-gopp-line"[^>]*>([\s\S]*?)<\/span>/)||[])[1])||"Ligabegegnung";
  const ctx={source_id:head[1],title,date,year:Number(date.slice(0,4)),
   link:"https://badhub.de/bwbv/begegnung.php?id="+head[1],playerName};
  all.push(...piece("league",meeting,ctx));
 }
 return all;
}
export function parsePublicHistory(html,player,category){
 if(!VALID_ID.test(player?.dbv_id||"")||!player?.name||typeof html!=="string"||html.length>5500000)
  throw new Error("Invalid player or source document");
 if(!["league","tournament"].includes(category))throw new Error("Unknown source category");
 // Reject wrong account pages before attempting parse.
 const title=(html.match(/<title>([\s\S]*?)<\/title>/)||[])[1]||"";
 if(!keyPart(plain(title)).includes(keyPart(player.name)))throw new Error("Player-name mismatch on source page");
 const rows=category==="tournament"?tournamentFacts(html,player.name):leagueFacts(html,player.name);
 const unique=new Map();
 let invalid=0;
 for(const row of rows){
  // A result is trustworthy only when self marker/name, opponent, both sides and a winner exist.
  if(row.match_year<2000||row.match_year>2100||
      !Array.isArray(row.games)||!row.opponent_names.length) {invalid++;continue;}
  if(unique.has(row.source_key)){invalid++;continue;}
  unique.set(row.source_key,{...row,dbv_id:player.dbv_id});
 }
 return {items:[...unique.values()],duplicates_or_invalid:invalid,
  cards_seen:(html.match(/class="sp-match-item\b/g)||[]).length,category};
}

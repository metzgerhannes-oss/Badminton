import {classifyNonPlayedCard} from "./nonplayed-rounds.mjs";
import {completedMatchWinner,explicitScoringRule} from "./badminton-score-rules.mjs";
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
 const info=markup.match(/class="(?:[^"]*\s)?sp-tournament-meta(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/span>/i);
 if(!info)return null;
 const text=plain(info[1]);
 // The first day is verifiably the tournament's start, NOT the day of this match.
 const m=text.match(/(\d{1,2})\.\s*(?:[–\-]\s*\d{1,2}\.\s*)?([A-Za-zÄÖÜäöü]{3,12})\s+(20\d{2})/);
 return m?iso(Number(m[3]),MAP[m[2]]||0,Number(m[1])):null;
}
export function leagueStart(markup){
 const d=markup.match(/class="(?:[^"]*\s)?sp-date-dm(?:\s[^"]*)?"[^>]*>(\d{2})\.(\d{2})\./);
 const y=markup.match(/class="(?:[^"]*\s)?sp-date-y(?:\s[^"]*)?"[^>]*>(20\d{2})/);
 return d&&y?iso(Number(y[1]),Number(d[2]),Number(d[1])):null;
}
function players(markup){
 return [...markup.matchAll(/class="(?:[^"]*\s)?sp-name-full(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/span>/g)]
  .map(m=>plain(m[1])).filter(Boolean).slice(0,4);
}
function noteReject(counts,reason){counts[reason]=(counts[reason]||0)+1;}
function sides(chunk,counts,year,rule,allowDeclaredWinner=false){
 const start=chunk.search(/class="[^"]*\bsp-match-body\b[^"]*"/);
 const mid=start<0?-1:start+chunk.slice(start).search(/class="[^"]*\bsp-result-col\b[^"]*"/);
 if(start<0||mid<start){noteReject(counts,"missing_match_layout");return null}
 const left=chunk.slice(start,mid),post=chunk.slice(mid);
 const rightStart=post.search(/class="(?=[^"]*\bsp-side\b)(?=[^"]*\bsp-side--away\b)[^"]*"/);
 if(rightStart<0){noteReject(counts,"missing_second_side");return null}
 const right=post.slice(rightStart);
 const a=players(left),b=players(right);
 const ownA=left.includes("sp-player-name--self"),ownB=right.includes("sp-player-name--self");
 if(ownA===ownB||!a.length||!b.length||a.length>2||b.length>2){
  noteReject(counts,"missing_or_ambiguous_player");return null
 }
 const winnerClass=/class="(?=[^"]*\bsp-side\b)(?=[^"]*\bsp-side--winner\b)[^"]*"/;
 const winA=winnerClass.test(left),winB=winnerClass.test(right);
 if(winA===winB){noteReject(counts,"missing_or_ambiguous_winner");return null}
 // Badhub uses two layouts: standard result columns and youth match cards
 // with set scores elsewhere in the SAME sp-match-item.
 const readScores=markup=>[...markup.matchAll(/class="(?:[^"]*\s)?sp-set-score(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/div>/g)]
  .map(m=>[...m[1].matchAll(/class="(?:[^"]*\s)?sp-s(?:\s[^"]*)?"[^>]*>(\d{1,2})<\/span>/g)].map(x=>Number(x[1])))
  .filter(s=>s.length===2&&s.every(x=>x>=0&&x<=40));
 let scores=readScores(post.slice(0,rightStart));
 if(scores.length===0){
  const alternate=readScores(chunk);
  if(alternate.length>=(rule==="1x21"?1:2)&&alternate.length<=5)scores=alternate;
 }
 // Badhub also publishes matches as a winner in bold and a dash instead
 // of set points. Count their REPORTED OUTCOME, never invent set points.
 // The same card must name both opponents and mark exactly one winning side.
 // A printed dash inside the RESULT column and a bold, unique winner
 // are independent published result evidence when sets are not available.
 const resultColumn=post.slice(0,rightStart);
 const isDash=/(?:>|^)\s*[–—-]\s*(?=<|$)/.test(resultColumn);
 const declaredWinner=allowDeclaredWinner&&scores.length===0&&isDash;
 const completion=declaredWinner
  ?{winningSide:winA?1:2,ruleSource:"badhub-bold-no-scores"}
  :completedMatchWinner(scores,{year,rule});
 if(!completion){
  noteReject(counts,allowDeclaredWinner&&scores.length===0
   ?"unscored_with_opponent":"incomplete_or_invalid_score");
  return null;
 }
 const winningSide=winA?1:2;
 if(completion.winningSide!==winningSide){
  noteReject(counts,"winner_score_conflict");return null
 }
 const currentSide=ownA?1:2;
 return {currentSide,winningSide,selfNames:currentSide===1?a:b,
  opponents:currentSide===1?b:a,sets:scores,
  outcomeEvidence:declaredWinner?"badhub-bold-dash":null};
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
// Match semantic CSS class tokens, not their order or optional modifiers.
// Inner player/score/date/header tokens use the same exact-token discipline.
// The same selector counts source cards and splits parsed cards: divergence
// here can falsely trigger the 55% coverage guard on legitimate HTML.
const MATCH_ITEM_OPEN=/<div\b[^>]*\sclass="(?:[^"]*\s)?sp-match-item(?:\s[^"]*)?"[^>]*>/g;
const TOURNAMENT_CARD_OPEN=/<div\b[^>]*\sclass="(?:[^"]*\s)?sp-tournament-card(?:\s[^"]*)?"[^>]*>/g;
const MEETING_OPEN=/<div\b[^>]*\sclass="(?:[^"]*\s)?sp-meeting(?:\s[^"]*)?"[^>]*>/g;
// Aggregate structure only. No HTML, names, links, IDs or score values in telemetry.
const countCards=s=>(s.match(MATCH_ITEM_OPEN)||[]).length;
const emptyLayout=()=>({sections:0,meetings:0,recognized_meeting_cards:0,
 unrecognized_header_cards:0,missing_link_cards:0,missing_date_cards:0});
function matchSections(segment){
 const parts=segment.split(MATCH_ITEM_OPEN);
 return {prefix:parts.shift()||"",chunks:parts};
}
function piece(source,segment,context,counts){
 const {prefix,chunks}=matchSections(segment);
 const matches=[];let phase=plain((prefix.match(/class="(?:[^"]*\s)?sp-t-phase-header(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/div>/)||[])[1]);
 for(const chunk of chunks){
  const nextPhase=(chunk.match(/class="(?:[^"]*\s)?sp-t-phase-header(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/div>/)||[])[1];
  const nonplayed=classifyNonPlayedCard(chunk);
  // The source winner marker plus an explicit dash is valid outcome evidence,
  // although no individual sets were supplied. Other unplayed statuses remain excluded.
  if(nonplayed&&nonplayed!=="unscored_with_opponent"){
   noteReject(counts,nonplayed);continue;
  }
  const rule=explicitScoringRule(context.title+" "+(context.event||""));
  const data=sides(chunk,counts,context.year,rule,
   nonplayed==="unscored_with_opponent");
  if(data){
   const event=context.event||plain((chunk.match(/class="sp-match-disc[^"]*"[^>]*>([\s\S]*?)<\/span>/)||[])[1]);
   const kind=discipline(event);
   if(!data.selfNames.some(n=>keyPart(n)===keyPart(context.playerName))){
    noteReject(counts,"wrong_self_identity");
   }else if(!kind||!context.source_id){
    noteReject(counts,"missing_event_or_source");
   }else{
    const playersAll=[...data.selfNames,...data.opponents].map(keyPart).sort().join(".");
    const sourceKey=[source,context.source_namespace==="dbv"?"dbv-"+context.source_id:context.source_id,
     keyPart(event),keyPart(phase),playersAll].join(":").slice(0,460);
    if(sourceKey.length<=20){
     noteReject(counts,"invalid_match_identity");
    }else{
     matches.push({
      source_key:sourceKey,competition:context.title.slice(0,180),
      competition_id:context.source_id,category:source,event:event.slice(0,60),
      discipline:kind,round_label:phase.slice(0,90)||null,
      match_date:context.date,match_year:context.year,
      player_side:data.currentSide,winning_side:data.winningSide,
      opponent_names:data.opponents,
      partner_names:data.selfNames.filter(n=>keyPart(n)!==keyPart(context.playerName)),
      games:data.sets,outcome_evidence:data.outcomeEvidence,source_url:context.link,
      source_name:"Badhub",source_kind:"third-party-match-card"
     });
    }
   }
  }
  if(nextPhase)phase=plain(nextPhase);
 }
 return matches;
}
function tournamentFacts(html,playerName,counts,layout){
 // Badhub's crossfed DBV cards have additional CSS classes.
 // The formerly exact split joined entire DBV tournaments to the preceding
 // BWBV event and therefore assigned wrong year, competition and source.
 const cards=html.split(TOURNAMENT_CARD_OPEN).slice(1),all=[];
 layout.sections=cards.length;
 for(const card of cards){
  const head=card.match(/class="(?:[^"]*\s)?sp-tournament-name(?:\s[^"]*)?"[^>]*>[\s\S]*?<a href="\/(bwbv|dbv)\/turnier\.php\?id=(\d+)"[^>]*>([\s\S]*?)<\/a>/);
  if(!head){
   noteReject(counts,"unknown_tournament_header");
   layout.unrecognized_header_cards+=countCards(card);
   continue;
  }
  const date=tournamentStart(card.slice(0,650));
  const year=date?Number(date.slice(0,4)):(Number((card.slice(0,600).match(/\b20\d{2}\b/)||[])[0])||null);
  const c={source_id:head[2],source_namespace:head[1],title:plain(head[3]),date,year,
   link:"https://badhub.de/"+head[1]+"/turnier.php?id="+head[2],playerName};
  for(const meeting of card.split(MEETING_OPEN).slice(1)){
   layout.meetings++;
   layout.recognized_meeting_cards+=countCards(meeting);
   const event=plain((meeting.match(/class="(?:[^"]*\s)?sp-t-event-badge(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/span>/)||[])[1]);
   all.push(...piece("tournament",meeting,{...c,event},counts));
  }
 }
 return all;
}
function leagueFacts(html,playerName,counts,layout){
 const all=[];
 const sections=html.split(MEETING_OPEN).slice(1);
 layout.sections=sections.length;
 for(const meeting of sections){
  layout.meetings++;
  const head=meeting.match(/\/bwbv\/begegnung\.php\?id=(\d+)/);
  if(!head){layout.missing_link_cards+=countCards(meeting);continue;}
  const date=leagueStart(meeting.slice(0,2100));
  if(!date){layout.missing_date_cards+=countCards(meeting);continue;}
  layout.recognized_meeting_cards+=countCards(meeting);
  const title=plain((meeting.match(/class="sp-group-opponent sp-gopp-line"[^>]*>([\s\S]*?)<\/span>/)||[])[1])||"Ligabegegnung";
  const ctx={source_id:head[1],title,date,year:Number(date.slice(0,4)),
   link:"https://badhub.de/bwbv/begegnung.php?id="+head[1],playerName};
  all.push(...piece("league",meeting,ctx,counts));
 }
 return all;
}
export function parsePublicHistory(html,player,category){
 if(!VALID_ID.test(player?.dbv_id||"")||!player?.name||typeof html!=="string"||html.length>5500000)
  throw new Error("Invalid player or source document");
 if(!["league","tournament"].includes(category))throw new Error("Unknown source category");
 const title=(html.match(/<title>([\s\S]*?)<\/title>/)||[])[1]||"";
 if(!keyPart(plain(title)).includes(keyPart(player.name)))throw new Error("Player-name mismatch on source page");
 const rejection_reasons={},layout_stats=emptyLayout();
 const rows=category==="tournament"
  ?tournamentFacts(html,player.name,rejection_reasons,layout_stats)
  :leagueFacts(html,player.name,rejection_reasons,layout_stats);
 const unique=new Map();
 let invalid=0;
 for(const row of rows){
  if(row.match_year<2000||row.match_year>2100||!Array.isArray(row.games)||!row.opponent_names.length){
   invalid++;noteReject(rejection_reasons,"invalid_import_row");continue;
  }
  if(unique.has(row.source_key)){
   invalid++;noteReject(rejection_reasons,"duplicate_source_key");continue;
  }
  unique.set(row.source_key,{...row,dbv_id:player.dbv_id});
 }
 const cards_seen=countCards(html);
 // Sources outside recognized meeting sections are not silently exempted
 // from the strict coverage threshold; they are measured separately.
 layout_stats.outside_recognized_meetings=Math.max(0,cards_seen-layout_stats.recognized_meeting_cards);
 const rejected=Math.max(0,cards_seen-unique.size);
 const identified=Object.values(rejection_reasons).reduce((a,b)=>a+b,0);
 if(identified<rejected)rejection_reasons.unclassified_card=rejected-identified;
 // Diagnostics are aggregated by reason and never include scraped names, scores or HTML.
 return {items:[...unique.values()],duplicates_or_invalid:invalid,cards_seen,category,
  rejection_reasons,layout_stats};
}

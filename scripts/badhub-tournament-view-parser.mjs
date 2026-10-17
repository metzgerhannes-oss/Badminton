/**
 * Targeted fallback for a PUBLIC tournament's per-player results page.
 * Unlike the generic player profile, this source may contain identifiable
 * match cards even when the player's history endpoint is empty.
 *
 * Pure parser only: no network, DB writes, caches, logging or access changes.
 * Never infer matches from the rankings or podium lists.
 */
import {completedMatchWinner} from "./badminton-score-rules.mjs";
const ID=/^\d{2}-\d{6}$/;
const DATE_MONTH={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
 januar:1,februar:2,märz:3,maerz:3,april:4,mai:5,juni:6,juli:7,august:8,september:9,oktober:10,november:11,dezember:12};
const clean=s=>String(s||"").replace(/<[^>]*>/g," ").replace(/&amp;/g,"&")
 .replace(/&nbsp;/g," ").replace(/&#39;/g,"'").replace(/\s+/g," ").trim();
const slug=s=>clean(s).normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
 .toLocaleLowerCase("de").replace(/[^\p{L}\p{N}]+/gu,"-").replace(/(^-|-$)/g,"").slice(0,110);
function dateOf(text){
 const m=clean(text).match(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\s+(20\d\d)/);
 if(!m)return null;
 const month=DATE_MONTH[m[2].toLowerCase()],day=Number(m[1]),year=Number(m[3]);
 if(!month)return null;
 const d=new Date(Date.UTC(year,month-1,day));
 return d.getUTCFullYear()===year&&d.getUTCMonth()+1===month&&d.getUTCDate()===day
  ?[year,String(month).padStart(2,"0"),String(day).padStart(2,"0")].join("-"):null;
}
function discipline(event){
 const type=String(event).split(/\s/)[0].toUpperCase();
 if(["JE","ME","HE","DE","SE","UE","WS","MS"].includes(type))return "Einzel";
 if(["JD","MD","HD","DD","BD","WD"].includes(type))return "Doppel";
 if(["MXD","MX","GD","XD","MIX"].includes(type))return "Mixed";
 return null;
}
function sidePlayers(row,place,id){
 const cell=(row.match(new RegExp('<td class="td-player td-player--'+place+'">([\\s\\S]*?)<\\/td>','i'))||[])[1];
 if(!cell)return null;
 const people=[...cell.matchAll(/<a href="\?id=\d+&amp;player=([^"]+)"[^>]*>[\s\S]*?<span class="name-full">([^<]+)<\/span>/g)]
  .map(m=>({id:m[1],name:clean(m[2])}));
 if(people.length<1||people.length>2||people.some(p=>!p.name))return null;
 if(new Set(people.map(p=>slug(p.name))).size!==people.length)return null;
 if(people.filter(p=>p.id===id).length>1)return null;
 return people;
}
export function parseTournamentPlayerView(html,player,{tournamentId}={}){
 if(!player||!ID.test(player.dbv_id||"")||typeof player.name!=="string"||
    typeof html!=="string"||html.length<100||html.length>950000||
    !/^\d{1,9}$/.test(String(tournamentId||"")))throw Error("Invalid public tournament view");
 const hero=(html.match(/class="staffel-hero__name"[^>]*>([^<]+)<\/h1>/i)||[])[1];
 if(!hero||slug(hero)!==slug(player.name))throw Error("Tournament player identity mismatch");
 const heading=(html.match(/class="staffel-hero__back"[^>]*>([\s\S]*?)<\/a>/i)||[])[1];
 const competition=clean(heading).replace(/^←\s*/,"").slice(0,180);
 const sourceId=String(tournamentId);
 if(!competition||!new RegExp('href="\\?id='+sourceId+'"').test(html))
  throw Error("Tournament id or heading mismatch");
 const dates=[...html.matchAll(/class="vc-stat__val"[^>]*>([^<]+)<\/span>/g)].map(x=>dateOf(x[1])).filter(Boolean);
 if(!dates.length)throw Error("Tournament date not verified");
 const matchDate=dates[0],matchYear=Number(matchDate.slice(0,4));
 const sourceUrl="https://badhub.de/bwbv/turnier.php?id="+sourceId;
 const all=[],reasons={},seen=new Map();
 const reject=why=>{reasons[why]=(reasons[why]||0)+1;};
 let currentEvent="",currentRound="",seenCards=0;
 const token=/<div class="tm-phase-label"[^>]*>([^<]+)<\/div>|<div class="tm-group-header[^"]*"[^>]*>([^<]+)<\/div>|<tr class="bericht-row won--(home|guest)"[^>]*>([\s\S]*?)<\/tr>/gi;
 for(const t of html.matchAll(token)){
  if(t[1]){
   const phase=clean(t[1]);if(phase!=="KO-Phase")currentEvent=phase;
   currentRound="";continue;
  }
  if(t[2]){currentRound=clean(t[2]);continue;}
  seenCards++;
  if(seenCards>150)throw Error("Tournament player page unusually large");
  const event=currentEvent,kind=discipline(event),round=currentRound;
  const home=sidePlayers(t[4],"home",sourceId),guest=sidePlayers(t[4],"guest",sourceId);
  if(!kind||!round||!home||!guest){reject("missing_event_or_parties");continue;}
  const mineHome=home.find(p=>p.id===player.dbv_id),
        mineGuest=guest.find(p=>p.id===player.dbv_id);
  if(Boolean(mineHome)===Boolean(mineGuest)||
    slug((mineHome||mineGuest)?.name)!==slug(player.name)){reject("identity_mismatch");continue;}
  if(new Set([...home,...guest].map(p=>slug(p.name))).size!==home.length+guest.length){
   reject("duplicate_players");continue;
  }
  const participantSide=mineHome?1:2,sourceWinner=t[3]==="home"?1:2;
  const gameScores=[...t[4].matchAll(/class="set-score"[^>]*>(\d{1,2}):(\d{1,2})<\/span>/g)]
    .map(m=>[Number(m[1]),Number(m[2])]);
  // No score, bye, walkover or winner mismatch means NO played match fact.
  if(!gameScores.length||/(?:\bBYE\b|\bWalkover\b|\bspielfrei\b|\bAufgabe\b|\bFreilos\b)/i.test(t[4])){
   reject("not_played_or_no_scores");continue;
  }
  const result=completedMatchWinner(gameScores,{year:matchYear});
  if(!result||result.winningSide!==sourceWinner){reject("winner_score_conflict");continue;}
  const self=mineHome?home:guest,others=mineHome?guest:home;
  if((kind==="Einzel"&&(self.length!==1||others.length!==1))||
     (kind!=="Einzel"&&(self.length!==2||others.length!==2))){
   reject("invalid_discipline_sides");continue;
  }
  const pair=[...home,...guest].map(p=>slug(p.name)).sort().join(".");
  const key="tournament:"+sourceId+":"+slug(event)+":"+slug(round)+":"+pair;
  if(key.length<21||key.length>460) {reject("bad_source_key");continue;}
  if(seen.has(key)){reject("duplicate_source_key");seen.get(key).duplicate=true;continue;}
  const item={dbv_id:player.dbv_id,source_key:key,
   source_name:"Badhub",source_kind:"third-party-match-card",
   category:"tournament",competition,competition_id:sourceId,
   event,discipline:kind,round_label:round,match_date:matchDate,match_year:matchYear,
   player_side:participantSide,winning_side:sourceWinner,
   opponent_names:others.map(x=>x.name),
   partner_names:self.filter(x=>x.id!==player.dbv_id).map(x=>x.name),
   games:gameScores,outcome_evidence:null,source_url:sourceUrl};
  seen.set(key,{item,duplicate:false});
 }
 for(const {item,duplicate} of seen.values())if(!duplicate)all.push(item);
 return {items:all,cards_seen:seenCards,rejection_reasons:reasons,
  source_url:sourceUrl,coverage:"tournament_only_not_career"};
}

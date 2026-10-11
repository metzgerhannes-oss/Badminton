/**
 * Badhub/DBV match verification: use the reported set scores and source winner.
 * Do NOT reject played matches by imposing generic point caps or deuce rules:
 * youth tournaments use different and historical set formats.
 * A marked BYE, walkover, retirement or DQ is handled independently before this.
 */
export const MATCH_RULES=Object.freeze({
 "3x21":{label:"3 × 21",gamesToWin:2,points:21},
 "3x15":{label:"3 × 15",gamesToWin:2,points:15},
 "5x11":{label:"5 × 11",gamesToWin:3,points:11},
 "1x21":{label:"1 × 21",gamesToWin:1,points:21},
 "youth3x11":{label:"Jugend 3 × 11",gamesToWin:2,points:11},
 "legacy3x15":{label:"Historisch 3 × 15",gamesToWin:2,points:15}
});
export function completedMatchWinner(games,{rule=null}={}){
 if(!Array.isArray(games)||games.length<1||games.length>5)return null;
 if(!games.every(g=>Array.isArray(g)&&g.length===2&&
  g.every(v=>Number.isSafeInteger(v)&&v>=0&&v<=99)&&g[0]!==g[1]))return null;
 const announced=rule==null?null:MATCH_RULES[rule];
 if(rule!==null&&!announced)return null;
 const wins=[0,0];
 for(const g of games)wins[g[0]>g[1]?0:1]++;
 const winner=wins[0]>wins[1]?1:wins[1]>wins[0]?2:null;
 if(winner===null)return null;
 // 2 won sets are the norm. 5×11 explicitly needs 3. Without an explicit
 // header, 3-0/3-1/3-2 short-set results also reveal 3 won sets.
 // Never silently treat a solitary set as a match without an explicit 1×21.
 const short3=games.length===3&&wins[winner-1]===3&&
   games.every(g=>Math.max(...g)<=15);
 const inferredThree=games.length>=4||short3;
 const required=announced?.gamesToWin||(inferredThree?3:2);
 if(games.length<required||games.length>required*2-1)return null;
 const counts=[0,0];
 for(let i=0;i<games.length;i++){
  const side=games[i][0]>games[i][1]?0:1;
  counts[side]++;
  if(counts[side]===required){
   // No phantom sets after the match-winning set.
   if(i!==games.length-1)return null;
   return {winningSide:side+1,format:announced?.points??null,
    ruleId:rule??null,ruleSource:announced?"explicit":"set-results",
    setsWon:[counts[0],counts[1]]};
  }
 }
 return null;
}
/** Only literal source rule declarations are treated as authoritative.
 * Years, age groups and scores are never treated as a documented rule.
 */
export function explicitScoringRule(text){
 const s=String(text||"").replace(/\s+/g," ").toLowerCase();
 const formats=[
  [/\b(?:5\s*[x×]\s*11|best\s+of\s+five.{0,35}11|3\s+gewinnsätze.{0,25}11)\b/,"5x11"],
  [/\b(?:3\s*[x×]\s*21|best\s+of\s+three.{0,35}21)\b/,"3x21"],
  [/\b(?:3\s*[x×]\s*15|best\s+of\s+three.{0,35}15)\b/,"3x15"],
  [/\b(?:1\s*[x×]\s*21|ein\s+gewinnsatz.{0,25}21)\b/,"1x21"]
 ];
 const found=formats.filter(([re])=>re.test(s)).map(([,id])=>id);
 return found.length===1?found[0]:null;
}

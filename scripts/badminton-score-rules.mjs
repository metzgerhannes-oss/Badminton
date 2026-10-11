/**
 * DBV/BWF scoring rules, edition 2026/27, Appendix 3 and Bundesliga rules.
 * A score alone proves neither the tournament's configured rules nor whether a
 * walkover/retirement occurred. Require separate source disposition checks.
 *
 * The 2027 rollout affects tournament defaults, NOT already played results.
 */
export const MATCH_RULES=Object.freeze({
 "3x21":{label:"3 × 21",gamesToWin:2,maxGames:3,points:21,cap:30},
 "3x15":{label:"3 × 15",gamesToWin:2,maxGames:3,points:15,cap:21},
 "5x11":{label:"5 × 11",gamesToWin:3,maxGames:5,points:11,cap:15},
 "1x21":{label:"1 × 21",gamesToWin:1,maxGames:1,points:21,cap:30},
 "youth3x11":{label:"Jugend 3 × 11",gamesToWin:2,maxGames:3,points:11,cap:15},
 "legacy3x15":{label:"Historisch 3 × 15 ohne Verlängerung",gamesToWin:2,maxGames:3,points:15,cap:15}
});
function finishedGame(pair,rule){
 if(!Array.isArray(pair)||pair.length!==2||!pair.every(Number.isSafeInteger))return false;
 const high=Math.max(...pair),low=Math.min(...pair);
 const {points,cap}=rule;
 if(low<0||high===low||high>cap)return false;
 if(rule===MATCH_RULES.legacy3x15)return high===15&&low<15;
 if(high===points)return low<=points-2;
 if(high<points||low<points-1)return false;
 // Two-point lead until the upper cap. At the cap, the last point wins.
 if(high<cap)return high-low===2;
 return high-low===1||high-low===2;
}
function verify(games,id){
 const rule=MATCH_RULES[id];
 if(!rule||!Array.isArray(games)||games.length<rule.gamesToWin||games.length>rule.maxGames)return null;
 if(!games.every(g=>finishedGame(g,rule)))return null;
 const wins=[0,0];
 for(let i=0;i<games.length;i++){
  const side=games[i][0]>games[i][1]?0:1;
  wins[side]++;
  // A played match must STOP when the required winning set was reached.
  if(wins[side]===rule.gamesToWin){
   if(i!==games.length-1)return null;
   return {winningSide:side+1,format:rule.points,ruleId:id,
    ruleSource:"score-inferred"};
  }
 }
 return null;
}
/** sourceRule must be a documented rule identifier; infer only when it is absent.
 * Never infer 1×21 from an isolated score: it could be an unfinished 3×21.
 */
export function completedMatchWinner(games,{rule=null,year=null}={}){
 if(rule!=null){
  const result=verify(games,rule);
  return result?{...result,ruleSource:"explicit"}:null;
 }
 if(!Array.isArray(games)||games.length<2)return null;
 // Preserve evidence of local youth best-of-three to 11, but never pretend
 // that it establishes which format the tournament officially advertised.
 for(const id of ["5x11","3x21","3x15","youth3x11"]){
  const result=verify(games,id);
  if(result)return result;
 }
 return null;
}
/** Trust a rule only when explicitly advertised in source header text. */
export function explicitScoringRule(text){
 const s=String(text||"").replace(/\s+/g," ").toLowerCase();
 const formats=[
  [/\b(?:5\s*[x×]\s*11|best\s+of\s+five.{0,35}11|3\s+gewinnsätze.{0,25}11)\b/,"5x11"],
  [/\b(?:3\s*[x×]\s*21|best\s+of\s+three.{0,35}21)\b/,"3x21"],
  [/\b(?:3\s*[x×]\s*15|best\s+of\s+three.{0,35}15)\b/,"3x15"],
  [/\b(?:1\s*[x×]\s*21|ein\s+gewinnsatz.{0,25}21)\b/,"1x21"]
 ];
 const found=formats.filter(([pattern])=>pattern.test(s)).map(([,id])=>id);
 return found.length===1?found[0]:null;
}

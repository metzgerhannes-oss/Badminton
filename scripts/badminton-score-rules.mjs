/** Completed badminton match rules. Shortened 11/15-point youth tournaments
 * are attested by BWBV; unknown or scoreless cards remain excluded. */
export function completedMatchWinner(games){
 if(!Array.isArray(games)||games.length<2||games.length>3)return null;
 const validPointPair=x=>Array.isArray(x)&&x.length===2&&x.every(Number.isInteger)&&
  x.every(n=>n>=0&&n<=30)&&x[0]!==x[1];
 if(!games.every(validPointPair))return null;
 const winScores=games.map(g=>Math.max(...g));
 const short=winScores.every(n=>n===11)?11:winScores.every(n=>n===15)?15:null;
 const classic=games.every(g=>{
  const hi=Math.max(...g),lo=Math.min(...g);
  if(hi===21)return lo<=19;
  if(hi>=22&&hi<=29)return hi-lo===2;
  return hi===30&&(lo===28||lo===29);
 });
 if(!short&&!classic)return null;
 const wins1=games.filter(g=>g[0]>g[1]).length;
 const wins2=games.filter(g=>g[1]>g[0]).length;
 if(Math.max(wins1,wins2)!==2)return null;
 return {winningSide:wins1===2?1:2,format:short||21};
}

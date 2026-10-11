/** Result-based badminton score verification.
 * The DBV adopted best-of-three games to 15 for individual tournaments
 * from 4 Jan 2027; earlier 11/15 youth variants remain possible.
 * A bye / walkover without two completed games is not a played match.
 */
export function completedMatchWinner(games,{year=null}={}){
 if(!Array.isArray(games)||games.length<2||games.length>5)return null;
 const pair=x=>Array.isArray(x)&&x.length===2&&x.every(Number.isInteger)&&
  x.every(n=>n>=0&&n<=30)&&x[0]!==x[1];
 if(!games.every(pair))return null;
 const completed21=([a,b])=>{
  const hi=Math.max(a,b),lo=Math.min(a,b);
  return hi===21?lo<=19:hi>=22&&hi<=29?hi-lo===2:hi===30&&lo===29;
 };
 const completed15=([a,b],legacy=false)=>{
  const hi=Math.max(a,b),lo=Math.min(a,b);
  if(hi===15)return lo<=13||(legacy&&lo===14);
  if(hi>=16&&hi<=20)return hi-lo===2;
  return hi===21&&lo===20;
 };
 const wins=games.reduce((w,g)=>(w[g[0]>g[1]?0:1]++,w),[0,0]);
 const short11=games.every(g=>Math.max(...g)===11);
 const matchWinner=wins[0]>wins[1]?1:2;
 const wonGames=wins[matchWinner-1];
 const lastWinner=games.at(-1)[0]>games.at(-1)[1]?1:2;
 if(lastWinner!==matchWinner)return null;
 if(short11){
  // Best of five to 11: 3-0, 3-1 and 3-2 are valid.
  // Historical local best-of-three to 11 remains supported.
  if(wonGames===3&&games.length>=3&&games.length<=5)
   return {winningSide:matchWinner,format:11};
  if(wonGames===2&&games.length>=2&&games.length<=3)
   return {winningSide:matchWinner,format:11};
  return null;
 }
 if(games.length>3||wonGames!==2)return null;
 const modern15=games.every(g=>completed15(g));
 // Historical shortened tournament sets could stop at 15:14.
 // Never apply this compatibility exception to 2027+ results.
 const hasExtended15=games.some(g=>{
  const hi=Math.max(...g),lo=Math.min(...g);
  return hi>=16&&hi<=20||(hi===21&&lo===20);
 });
 const legacy15=Number(year)<2027&&!hasExtended15&&games.every(g=>completed15(g,true));
 const classic21=games.every(completed21);
 if(!modern15&&!legacy15&&!classic21)return null;
 const format=modern15||legacy15?15:21;
 return {winningSide:matchWinner,format};
}

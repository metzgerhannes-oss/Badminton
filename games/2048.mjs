/** Offline 2048 challenge: 4x4, 180 seconds, deterministic injectable RNG. */
export const SIDE=4;
export const DURATION_MS=180000;
export const MODE_VERSION=1;
const clampRandom=random=>{const n=Number(random());return Number.isFinite(n)?Math.max(0,Math.min(0.999999999999,n)):0};
export const emptyBoard=()=>Array.from({length:SIDE},()=>Array(SIDE).fill(0));
export function spawnTile(board,random=Math.random){
 const empty=[];
 for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++)if(board[y][x]===0)empty.push({x,y});
 if(!empty.length)return board.map(row=>row.slice());
 const index=Math.floor(clampRandom(random)*empty.length),tile=empty[index];
 const next=board.map(row=>row.slice());next[tile.y][tile.x]=clampRandom(random)<.9?2:4;
 return next;
}
export function canMove(board){
 for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){
  if(board[y][x]===0)return true;
  if(x<SIDE-1&&board[y][x]===board[y][x+1])return true;
  if(y<SIDE-1&&board[y][x]===board[y+1][x])return true;
 }
 return false;
}
export function newGame(random=Math.random){
 const board=spawnTile(spawnTile(emptyBoard(),random),random);
 return {board,score:0,over:false,reason:""};
}
function collapse(line){
 const values=line.filter(x=>x!==0),merged=[];let gained=0;
 for(let i=0;i<values.length;i++){
  if(i+1<values.length&&values[i]===values[i+1]){
   const value=values[i]*2;merged.push(value);gained+=value;i++;
  }else merged.push(values[i]);
 }
 while(merged.length<SIDE)merged.push(0);
 return {line:merged,gained};
}
export function moveGame(state,direction,random=Math.random){
 if(state.over||!["up","down","left","right"].includes(direction))return state;
 const board=emptyBoard();let gained=0,changed=false;
 for(let index=0;index<SIDE;index++){
  const cells=Array.from({length:SIDE},(_,step)=>{
   if(direction==="left")return {x:step,y:index};
   if(direction==="right")return {x:SIDE-1-step,y:index};
   if(direction==="up")return {x:index,y:step};
   return {x:index,y:SIDE-1-step};
  });
  const values=cells.map(({x,y})=>state.board[y][x]);
  const result=collapse(values);gained+=result.gained;
  cells.forEach(({x,y},step)=>{board[y][x]=result.line[step];if(values[step]!==result.line[step])changed=true});
 }
 if(!changed)return state;
 const next=spawnTile(board,random),over=!canMove(next);
 return {board:next,score:state.score+gained,over,reason:over?"no-moves":""};
}

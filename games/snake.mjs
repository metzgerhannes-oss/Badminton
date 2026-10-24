/** Fixed Snake mode v1: 20x20, 120 seconds, 10 points per food. Pure/offline. */
export const SIZE=20;
export const DURATION_MS=120000;
export const STEP_MS=150;
export const MODE_VERSION=1;
const DIR={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
const same=(a,b)=>a.x===b.x&&a.y===b.y;
export function placeFood(snake,random=Math.random){
 const free=[];
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
  const cell={x,y};if(!snake.some(part=>same(part,cell)))free.push(cell);
 }
 if(!free.length)return null;
 const n=Number(random());
 const index=Math.min(free.length-1,Math.max(0,Math.floor((Number.isFinite(n)?n:0)*free.length)));
 return free[index];
}
export function newSnake(random=Math.random){
 const snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}];
 return {snake,food:placeFood(snake,random),direction:"right",queued:"right",
  turnQueued:false,score:0,over:false,reason:""};
}
export function turnSnake(state,direction){
 if(state.over||state.turnQueued||!Object.hasOwn(DIR,direction))return state;
 const previous=DIR[state.direction],next=DIR[direction];
 if(previous.x+next.x===0&&previous.y+next.y===0)return state;
 return {...state,queued:direction,turnQueued:true};
}
export function stepSnake(state,random=Math.random){
 if(state.over)return state;
 const direction=state.queued;
 const head={x:state.snake[0].x+DIR[direction].x,y:state.snake[0].y+DIR[direction].y};
 const eating=Boolean(state.food&&same(head,state.food));
 const body=eating?state.snake:state.snake.slice(0,-1);
 if(head.x<0||head.x>=SIZE||head.y<0||head.y>=SIZE)
  return {...state,over:true,reason:"wall"};
 if(body.some(part=>same(part,head)))
  return {...state,over:true,reason:"body"};
 const snake=[head,...state.snake.slice(0,eating?undefined:-1)];
 const food=eating?placeFood(snake,random):state.food;
 return {...state,snake,food,score:state.score+(eating?10:0),
  direction,queued:direction,turnQueued:false,over:eating&&!food,reason:eating&&!food?"board-full":""};
}

/** Pure Pong Solo: 90s, fixed bot speed, no network or sport records. */
export const WIDTH=400,HEIGHT=240,DURATION_MS=90000,MODE_VERSION=1;
export const PADDLE_HEIGHT=58,PADDLE_WIDTH=10,BALL_RADIUS=7;
const LEFT=18,RIGHT=WIDTH-LEFT-PADDLE_WIDTH;
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const ball=()=>({ballX:WIDTH/2,ballY:HEIGHT/2,vx:-4.2,vy:1.7});
export function newPong(){return {playerY:(HEIGHT-PADDLE_HEIGHT)/2,botY:(HEIGHT-PADDLE_HEIGHT)/2,...ball(),score:0,misses:0};}
export function movePaddle(s,y){return {...s,playerY:clamp(y,0,HEIGHT-PADDLE_HEIGHT)};}
export function tickPong(s,dt=16){
 const scale=clamp(Number.isFinite(dt)?dt:0,0,32)/16;if(!scale)return s;
 let {playerY,botY,ballX,ballY,vx,vy,score,misses}=s;
 const target=clamp(ballY-PADDLE_HEIGHT/2,0,HEIGHT-PADDLE_HEIGHT);
 botY=clamp(botY+clamp(target-botY,-2.6*scale,2.6*scale),0,HEIGHT-PADDLE_HEIGHT);
 const prev=ballX;ballX+=vx*scale;ballY+=vy*scale;
 if(ballY-BALL_RADIUS<0){ballY=BALL_RADIUS+(BALL_RADIUS-ballY);vy=Math.abs(vy)}
 if(ballY+BALL_RADIUS>HEIGHT){ballY=HEIGHT-BALL_RADIUS-(ballY+BALL_RADIUS-HEIGHT);vy=-Math.abs(vy)}
 if(vx<0&&prev-BALL_RADIUS>=LEFT+PADDLE_WIDTH&&ballX-BALL_RADIUS<=LEFT+PADDLE_WIDTH
  &&ballY>=playerY-BALL_RADIUS&&ballY<=playerY+PADDLE_HEIGHT+BALL_RADIUS){
  ballX=LEFT+PADDLE_WIDTH+BALL_RADIUS;vx=Math.abs(vx);
  vy=clamp(vy+(ballY-playerY-PADDLE_HEIGHT/2)*.035,-3.8,3.8);score++;
 }
 if(vx>0&&prev+BALL_RADIUS<=RIGHT&&ballX+BALL_RADIUS>=RIGHT
  &&ballY>=botY-BALL_RADIUS&&ballY<=botY+PADDLE_HEIGHT+BALL_RADIUS){
  ballX=RIGHT-BALL_RADIUS;vx=-Math.abs(vx);
  vy=clamp(vy+(ballY-botY-PADDLE_HEIGHT/2)*.018,-3.8,3.8);
 }
 if(ballX+BALL_RADIUS<0){misses++;({ballX,ballY,vx,vy}=ball())}
 if(ballX-BALL_RADIUS>WIDTH){({ballX,ballY,vx,vy}=ball())}
 return {playerY,botY,ballX,ballY,vx,vy,score,misses};
}

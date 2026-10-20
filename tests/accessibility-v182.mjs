import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [css,html,sw,release]=await Promise.all(
 ["accessibility-v182.css","index.html","sw.js","app-release.js"].map(p=>readFile(p,"utf8")));
const color=hex=>{
 const rgb=hex.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)/255);
 return rgb.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)
  .reduce((sum,v,i)=>sum+[.2126,.7152,.0722][i]*v,0);
};
const ratio=(a,b)=>{
 const x=color(a.replace("#","")),y=color(b.replace("#",""));
 return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
};
for(const [name,fg,bg,min] of [
 ["Navy main text","#f3f9ff","#122e50",4.5],
 ["Navy secondary text","#d2e5f8","#122e50",4.5],
 ["Navy links","#b4e7ff","#122e50",4.5],
 ["Pale empty-state text","#183b5c","#edf7ff",4.5],
 ["Pale secondary text","#355673","#edf7ff",4.5],
 ["Navy positive movement","#90efbf","#122e50",4.5],
 ["Navy negative movement","#ffc3c8","#122e50",4.5],
 ["Navy input placeholder","#d0e3f8","#193b60",4.5]
 ]){
 const contrast=ratio(fg,bg);
 assert.ok(contrast>=min,name+" contrast "+contrast.toFixed(2)+" < "+min);
 console.log(name+": "+contrast.toFixed(2)+":1");
}
assert.match(html,/accessibility-v182\.css/);
for(const section of ["ASSETS","SHELL_ASSETS","ESSENTIAL"]){
 assert.match(sw,new RegExp("const "+section+"=\\[[^;]*accessibility-v182\\.css"));
}
assert.match(release,/version:"v182"/);
assert.match(sw,/schmetterlinge-shell-v182/);
assert.match(css,/@media\(min-width:1080px\)/);
assert.match(css,/@media\(max-width:350px\)/);
assert.match(css,/min-width:1600px/);
assert.match(css,/font-size:max\(16px,1rem\)/);
assert.doesNotMatch(css,/(?:fetch\s*\(|supabase|localStorage|@import\s+url)/i);
console.log("v182 contrast tokens, PWA offline and responsive safeguards validated.");

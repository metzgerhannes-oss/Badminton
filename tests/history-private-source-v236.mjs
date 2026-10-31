import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [history,css,source,worker]=await Promise.all([
 "history.js","contrast-v189.css","scripts/private-trophy-source.mjs","sw.js"
].map(path=>readFile(path,"utf8")));
const failure=history.slice(history.indexOf('if(state.state!=="ready")'),
 history.indexOf("// All sourced placements"));
assert.ok(failure.length>200,"Private failure branch must exist");
assert.match(failure,/showChronicle\(false\)/);
assert.match(failure,/source\.hidden=false;source\.textContent=notice/);
assert.match(failure,/state\.state==="unavailable"/);
assert.match(failure,/retry\.textContent="Erneut laden"/);
assert.match(failure,/requestPrivateTrophies\(lastPlayer,\{force:true\}\)/);
assert.match(failure,/timeline\.innerHTML=""/);
assert.doesNotMatch(failure,/Geschützte Turnierhistorie/,"Avoid duplicate warning inside an unreadable card");
assert.match(history,/showChronicle\(true\)/,"A ready source must restore filters and chronicle");
assert.match(css,/#view-historie \.history-filters label\{color:#24465c!important\}/);
assert.match(css,/#view-historie \.empty h3\{color:#f3f9ff!important\}/);
assert.match(css,/#view-historie #history-filters\[hidden\]/);
assert.match(source,/setTimeout\(\(\)=>abort\.abort\(\),11000\)/);
assert.match(source,/getPrivateSession\(false\)/,"No identity creation on ordinary reads");
assert.match(worker,/schmetterlinge-shell-v236/);
assert.doesNotMatch(history,/service_role|localStorage\.setItem/);

function luminance(hex){
 const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255);
 return rgb.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)
 .reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
}
const contrast=(a,b)=>{const [hi,lo]=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (hi+.05)/(lo+.05)};
assert.ok(contrast("#193c58","#f7fcff")>=4.5,"Private status ink must be WCAG AA");
assert.ok(contrast("#24465c","#d9ecfb")>=4.5,"Filter labels must be WCAG AA");
assert.ok(contrast("#f3f9ff","#121d33")>=4.5,"Dark cards require pale titles");
console.log("v236 history state + mobile contrast: validated");

import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [legacy,design,shell,components,html,sw]=await Promise.all([
 "styles.css","design-v2.css","app-shell.css","ui-components.css","index.html","sw.js"
].map(path=>readFile(path,"utf8")));

// Identical selectors under identical media conditions: earlier declarations
// cannot affect Chromium/WebKit when the later property wins the cascade.
const targets=new Set([
 ":root","body",".topbar",".brand",".brand small",".bottom-nav",
 ".bottom-nav a",".bottom-nav a span",".bottom-nav a small",
 ".bottom-nav a[aria-current=page]",".brand>span",
 ".local-shortcut-actions",".dashboard-source",".dashboard-source a",
 ".focused-profile",".ranking-tile.ranking-compact",
 ".ranking-compact .ranking-top",".ranking-bw-title",".ranking-de-row",
 ".ranking-compact-footer",".ranking-dialog",".ranking-dialog-stats>div",
 ".focus-switcher-options",
 '.focus-switcher-options button:hover,.focus-switcher-options button[aria-current="true"]',
 ".upcoming-tournament-info small","#view-start .match-stats-note",
 ".external-match-filters select",".external-match-item strong",".external-match-row"
]);
function rules(css){
 const out=[];
 function walk(start,end,condition){
  let cursor=start;
  while(cursor<end){
   const open=css.indexOf("{",cursor);
   if(open<0||open>=end)break;
   let depth=1,close=open+1;
   while(close<end&&depth){
    if(css[close]==="{")depth++;
    else if(css[close]==="}")depth--;
    close++;
   }
   assert.equal(depth,0,"Malformed stylesheet");
   const selector=css.slice(cursor,open).replace(/\/\*[\s\S]*?\*\//g,"")
     .split("}").pop().trim();
   const body=css.slice(open+1,close-1);
   if(selector.startsWith("@media")||selector.startsWith("@supports"))
    walk(open+1,close-1,condition+"|"+selector);
   else if(targets.has(selector))out.push({selector,condition,body});
   cursor=close;
  }
 }
 walk(0,css.length,"root");
 return out;
}
function properties(body){
 const out=[];
 const re=/([a-zA-Z-]+)\s*:\s*([^;]*)(?:;|$)/g;
 let match;
 while((match=re.exec(body))!==null)if(match[2].trim())
  out.push([match[1],match[2].trim()]);
 return out;
}
for(const [name,css] of [["legacy",legacy],["design-v2",design]]){
 const seen=new Map;
 for(const rule of rules(css)){
  const key=rule.condition+"#"+rule.selector;
  const props=seen.get(key)||new Set();
  for(const [property] of properties(rule.body)){
   assert.ok(!props.has(property),
    name+": redundant "+rule.selector+" / "+property+" in "+rule.condition);
   props.add(property);
  }
  seen.set(key,props);
 }
 assert.doesNotMatch(css,/[^{};]+\{\s*\}/,"No empty selector blocks in "+name);
}
assert.match(legacy,/\.topbar\{display:flex;align-items:center/);
assert.match(legacy,/\.page\{display:none\}\.page\.active\{display:block\}/);
assert.match(legacy,/clip-path:none!important/);
assert.match(legacy,/mask:none!important;-webkit-mask:none!important/);
assert.match(legacy,/width:94px!important;height:94px!important/);
assert.match(design,/#view-start \.match-stats-note\{font-size:12px/);
assert.match(shell,/\.bottom-nav a\{width:25%!important/);
assert.match(components,/\.focused-profile\{margin:5px 0 23px/);
assert.deepEqual([...html.matchAll(/data-page="([^"]+)"/g)].map(x=>x[1]),
 ["start","turniere","live","spieler","berichte"]);
assert.match(sw,/schmetterlinge-shell-v84/);
console.log("v70 CSS cascade: redundant same-scope declarations removed; app chrome, logo, cards and screens preserved.");

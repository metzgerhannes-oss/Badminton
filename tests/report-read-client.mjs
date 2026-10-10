import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
const [source,html,articles,sources]=await Promise.all([
 readFile("reports.js","utf8"),readFile("index.html","utf8"),
 readFile("data/report-articles.json","utf8"),readFile("data/report-sources.json","utf8")
]);
assert.match(source,/import \{readPublicRows\} from "\.\/scripts\/supabase-read\.mjs"/);
assert.match(source,/readPublicRows\(path,\{count:false\}\)/);
assert.doesNotMatch(source,/fetch\(URL\+"\/rest\/v1\//);
assert.match(html,/<script type="module" src="\.\/reports\.js"><\/script>/);
assert.match(source,/Promise\.allSettled\(/);
assert.match(source,/const approved=getResult\(3\)\?\.articles\|\|\[\]/);
assert.match(source,/const staticSources=getResult\(4\)\?\.sources\|\|\[\]/);
assert.match(source,/if\(a\.status!=="verified"/);
assert.match(source,/if\(ticket!==mentionRequest\|\|dbv!==profileId\)return/);
// Exercise the actual report controller with a disconnected Supabase;
// reviewed GitHub records must still be rendered, not counted as confirmed matches.
const elements=new Map();
for(const id of ["report-list","report-count","report-source-list","report-refresh",
 "report-scope","report-category","report-search"]){
 elements.set(id,{innerHTML:"",textContent:"",disabled:false,
  value:id==="report-scope"?"mentions":id==="report-category"?"all":"",
  addEventListener(){}});
}
const localFiles={
 "./data/report-articles.json":JSON.parse(articles),
 "./data/report-sources.json":JSON.parse(sources)
};
let networkRequests=0;
const context=vm.createContext({
 URL,Intl,console,Map,Set,
 document:{getElementById:id=>elements.get(id)||null,addEventListener(name,handler){
  if(name==="DOMContentLoaded")handler();
 }},
 window:{badmintonActivePlayerId:"05-070879",badmintonActiveClub:"SpVgg Mössingen",
  addEventListener(){}},
 location:{hash:"#berichte"},
 readPublicRows:async()=>{networkRequests++;throw new Error("Supabase offline")},
 fetch:async path=>{
  assert.ok(Object.hasOwn(localFiles,path),"Fallback may fetch only approved local JSON");
  return {ok:true,json:async()=>localFiles[path]};
 }
});
vm.runInContext(source.replace(/^import[^\n]+\n/gm,""),context,{filename:"reports.js"});
await new Promise(resolve=>setTimeout(resolve,35));
assert.ok(networkRequests>=3,"The regular public DB checks were attempted");
assert.match(elements.get("report-list").innerHTML,/55\. BWBV-Meisterschaft/);
assert.match(elements.get("report-list").innerHTML,/Originalbericht öffnen/);
assert.match(elements.get("report-source-list").innerHTML,/SpVgg Mössingen/);
assert.equal(elements.get("report-refresh").disabled,false);
console.log("Reports public GET client: reviewed local articles stay visible during database outage.");

import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
const [code,html,sources]=await Promise.all([
 readFile("reports.js","utf8"),readFile("index.html","utf8"),readFile("data/report-sources.json","utf8")
]);
assert.match(code,/rpc\/app_access_reports_read/);
assert.match(code,/getPrivateSession\(false\)/);
assert.doesNotMatch(code,/get\("articles\?/);
assert.match(html,/<script type="module" src="\.\/reports\.js"><\/script>/);
const elements=new Map(),events=new Map();
for(const id of ["report-list","report-count","report-source-list","report-refresh",
 "report-scope","report-category","report-search"]){
 elements.set(id,{innerHTML:"",textContent:"",disabled:false,
  value:id==="report-scope"?"mentions":id==="report-category"?"all":"",
  addEventListener(name,handler){events.set(id+":"+name,handler)}});
}
const articles=[
 {id:"report-1",title:"Meisterschaft Test",url:"https://spvgg.org/test-1",
  published_on:"2026-10-01",club_id:"spvgg-moessingen",summary:"Beleg",
  report_sources:{name:"SpVgg",category:"club"},named:true},
 {id:"report-2",title:"Vereinsbericht Test",url:"https://spvgg.org/test-2",
  published_on:"2026-09-01",club_id:"spvgg-moessingen",summary:"",
  report_sources:{name:"SpVgg",category:"club"},named:false}
];
let requests=[],member=true;
const context=vm.createContext({
 URL,Intl,console,Map,Set,AbortController,setTimeout,clearTimeout,
 document:{getElementById:id=>elements.get(id)||null,addEventListener(name,handler){
  if(name==="DOMContentLoaded")handler();
 }},
 window:{badmintonActivePlayerId:"05-070879",badmintonActiveClub:"SpVgg Mössingen",
  badmintonAppAccess:{shellAllowed:true,get allowed(){return member},
   getAccessToken:async()=> "member-token"},addEventListener(){}},
 localStorage:{getItem:key=>key==="schmetterlinge.acceptedPlayerInvite.v3"
    ?'["11111111-2222-4333-8444-555555555555"]'
    :key==="schmetterlinge.acceptedPlayerInviteBindings.v1"
    ?'{"11111111-2222-4333-8444-555555555555":"05-070879"}':null},
 getPrivateSession:async()=>({access_token:"player-token"}),
 SUPABASE_ROOT:"https://test.supabase.co/rest/v1/",PUBLIC_KEY:"safe-test-key",
 location:{hash:"#berichte"},
 fetch:async(url,options)=>{
  if(url==="./data/report-sources.json")return {ok:true,json:async()=>JSON.parse(sources)};
  assert.match(url,/rpc\/app_access_reports_read$/);
  assert.equal(options.method,"POST");
  assert.match(options.headers.Authorization,/Bearer /);
  requests.push(JSON.parse(options.body));
  return {ok:true,json:async()=>({
   scope:member?"member":"player",articles:member?articles:articles.slice(0,1)
  })};
 }
});
vm.runInContext(code.replace(/^import[^\n]+\n/gm,""),context,{filename:"reports.js"});
await new Promise(resolve=>setTimeout(resolve,75));
assert.equal(requests.length,1);
assert.equal(requests[0].p_player_dbv_id,"05-070879");
assert.equal(requests[0].p_invitation_id,null);
assert.match(elements.get("report-list").innerHTML,/Meisterschaft Test/);
assert.doesNotMatch(elements.get("report-list").innerHTML,/Vereinsbericht Test/);
assert.equal(elements.get("report-count").textContent,"1 Bericht");
elements.get("report-scope").value="club";
events.get("report-scope:change")();
assert.match(elements.get("report-list").innerHTML,/Vereinsbericht Test/);
assert.equal(elements.get("report-count").textContent,"2 Berichte");
member=false;
events.get("report-refresh:click")();
await new Promise(resolve=>setTimeout(resolve,75));
assert.equal(requests.at(-1).p_invitation_id,"11111111-2222-4333-8444-555555555555");
assert.equal(elements.get("report-count").textContent,"1 Bericht");
assert.doesNotMatch(elements.get("report-list").innerHTML,/Vereinsbericht Test/);
console.log("Reports v157: member and narrow invitation filtering passed.");

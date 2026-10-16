import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
const [original,team,sql,html,sw]=await Promise.all([
 "follow-import.js","teams.js","database/follow-team-import-v158.sql","index.html","sw.js"
].map(path=>readFile(path,"utf8")));
assert.match(original,/app_access_history_demand/);
assert.match(original,/history-match-import/);
assert.match(original,/badminton:friend-followed/);
assert.match(original,/badminton:own-profile-added/);
assert.match(original,/badminton:app-access-granted/);
assert.match(team,/app_access_team_demand/);
assert.match(team,/app_access_reports_read/);
assert.match(team,/articleClub=team.club_id==="10777"/);
assert.match(sql,/public\.app_access_is_member\(\)/);
assert.match(sql,/last_completed_at/);
assert.match(sql,/limit p_max/);
assert.match(html,/id="team-detail-reports"/);
assert.match(html,/src="\.\/follow-import\.js"/);
assert.match(sw,/"\.\/follow-import\.js"/);

const events=new Map(),data=new Map(),requests=[],copy=[
 {id:"05-070879",name:"P"},{id:"05-071969",name:"C"}
];
data.set("shuttleboard-v1",JSON.stringify({players:[copy[0]],friends:[copy[1]]}));
const window={
 badmintonActivePlayerId:"05-070879",
 badmintonAppAccess:{allowed:true,getAccessToken:async()=>"invited-test-token"},
 addEventListener(n,cb){events.set(n,cb)},
 dispatchEvent(){}};
const document={addEventListener(n,cb){if(n==="DOMContentLoaded")setTimeout(cb,0)}};
const context=vm.createContext({
 window,document,localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},
 fetch:async(url,opt)=>{
  requests.push({url,body:JSON.parse(opt.body),headers:opt.headers});
  return {ok:true,json:async()=>({accepted:true,queued:true})};
 },
 CustomEvent:class CustomEvent{constructor(name,options){this.type=name;this.detail=options.detail}},
 AbortController,setTimeout,clearTimeout,Date,JSON,Promise,
 SUPABASE_ROOT:"https://test.supabase.co/rest/v1/",PUBLIC_KEY:"test_publishable"
});
vm.runInContext(original.replace(/^import[^\n]+\n/gm,""),context,{filename:"follow-import.js"});
await new Promise(resolve=>setTimeout(resolve,1400));
const history=requests.filter(r=>r.url.endsWith("/app_access_history_demand"));
assert.equal(history.length,2,"Both saved player IDs are registered at first authorized launch");
assert.deepEqual(new Set(history.map(r=>r.body.p_player_dbv_id)),new Set(copy.map(p=>p.id)));
assert.ok(history.every(r=>r.headers.Authorization==="Bearer invited-test-token"));
assert.ok(requests.every(r=>!JSON.stringify(r.body).includes("friends")));
assert.equal(requests.filter(r=>r.url.includes("history-match-import")).length,2);
events.get("badminton:app-access-granted")();
await new Promise(resolve=>setTimeout(resolve,30));
assert.equal(requests.filter(r=>r.url.endsWith("/app_access_history_demand")).length,2,
 "Repeated grant must not cause duplicate imports");
window.badmintonAppAccess.allowed=false;
copy.push({id:"05-061350",name:"S"});
data.set("shuttleboard-v1",JSON.stringify({players:[copy[0]],friends:copy.slice(1)}));
events.get("badminton:friend-followed")({detail:{playerId:"05-061350"}});
await new Promise(resolve=>setTimeout(resolve,60));
assert.equal(requests.filter(r=>r.url.endsWith("/app_access_history_demand")).length,2,
 "Uninvited visitors cannot import");
window.badmintonAppAccess.allowed=true;
events.get("badminton:friend-followed")({detail:{playerId:"05-061350"}});
await new Promise(resolve=>setTimeout(resolve,120));
assert.equal(requests.filter(r=>r.url.endsWith("/app_access_history_demand")).length,3);
console.log("v158: automatic bounded member imports, reuse, team demands and report linkage passed.");

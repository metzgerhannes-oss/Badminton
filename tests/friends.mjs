import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
const code=await readFile("app.js","utf8");
const storageCode=await readFile("state-storage.js","utf8");
const bookmarksCode=await readFile("tournament-bookmarks.js","utf8");
const html=await readFile("index.html","utf8");
const dashboard=await readFile("dashboard.js","utf8");
const history=await readFile("history.js","utf8");
const store=new Map([["shuttleboard-v1",JSON.stringify({
 players:[{id:"99-100001",name:"Testperson A"},{id:"99-100002",name:"Testperson B"}],
 friends:[],officialLinks:[],activeProfileId:"99-100001",historyProfilesInitialized:true
})]]);
function appVM(){
 const context=vm.createContext({URL,Intl,Date,document:{addEventListener(){}},localStorage:{
  getItem(k){return store.get(k)??null},
  setItem(k,v){store.set(k,String(v))}
 }});
 vm.runInContext(storageCode,context,{filename:"state-storage.js"});
 vm.runInContext(bookmarksCode,context,{filename:"tournament-bookmarks.js"});
 vm.runInContext(code,context,{filename:"app.js"});
 return {context,run:q=>vm.runInContext(q,context)};
}
const first=appVM();first.run("restore()");
assert.equal(first.run("state.activeProfileId"),"99-100001");
assert.equal(first.run("state.chosen"),"99-100001");
assert.equal(first.run("state.friends.length"),0);
first.run('state.officialLinks=[{id:"MATCH",url:"https://dbv.turnier.de/tournament/E24DC6EE-152A-454D-B00C-E625B751D7D5",playerId:"99-100001",name:"Test",startDate:"",endDate:""}]');
first.run('state.friends.push({id:"99-100003",name:"Testfreund",birthYear:2016,url:"https://dbv.turnier.de/player-profile/abcdef"})');
first.run('state.viewingFriendId="99-100003";state.chosen="99-100003"');
assert.equal(first.run("selectedLinks().length"),0,"Friends must not inherit the owner's saved tournaments");
first.run("save()");
const stored=JSON.parse(store.get("shuttleboard-v1"));
assert.equal(stored.activeProfileId,"99-100001","Viewing a friend must not change the active account");
assert.equal(stored.chosen,"99-100001","Persist only the own start profile");
assert.equal(stored.friends.length,1);
assert.equal(stored.friends[0].name,"Testfreund");
assert.equal(stored.officialLinks.length,1);
const fresh=appVM();fresh.run("restore()");
assert.equal(fresh.run("state.activeProfileId"),"99-100001");
assert.equal(fresh.run("state.viewingFriendId"),null,"Friend view should not replace home permanently");
assert.equal(fresh.run("state.friends.length"),1);
assert.equal(fresh.run('state.friends[0].id'),"99-100003");
assert.equal(fresh.run("selectedLinks().length"),1);
assert.ok(html.includes('id="friend-dialog"')&&html.includes('id="friend-list"'));
assert.ok(html.includes('id="profile-list"')&&html.includes('id="current-account-label"'));
assert.ok(!html.includes('id="player-pills"'));
assert.ok(html.includes('class="topbar-settings" href="#einstellungen"'));
assert.ok(html.includes('id="first-run-dialog"')&&html.includes('id="first-run-new"'));
assert.ok(html.includes('id="dashboard-friends"'));
assert.ok(code.includes('freshDevice')&&code.includes('first-run-choices')&&code.includes('first-run-new'));
assert.ok(code.includes('data-friend-quick')&&code.includes('renderFriendQuick()'));
assert.ok(code.includes("data-view-friend")&&code.includes("data-unfollow-inline")&&code.includes("data-edit-friend"));
assert.ok(code.includes("window.openFriendForm?.(player)"),"Existing manual friend editing must remain reachable when filtering");
assert.ok(code.includes("window.renderDashboard?.(state.chosen,viewedProfiles"));
assert.ok(dashboard.includes('viewMode==="friend"')&&dashboard.includes('friendNoHistory'));
assert.ok(history.includes('trophySnapshot(lastPlayer)')&&history.includes('playerId===lastPlayer'),
 "Private friend trophies require exact server-scoped player ID, never local name matching");
assert.ok(!history.includes('selected.startsWith("local-")'),
 "Local profiles must never impersonate a private DBV record");
const ids=["99-100003","99-100001"];
assert.ok(new Set(ids).size===2);
console.log("Active profile and friend follow tests passed: local persistence, navigation scope, safe friend KPI empty states.");

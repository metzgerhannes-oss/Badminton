import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
const [source,app,html]=await Promise.all([
 readFile("state-storage.js","utf8"),
 readFile("app.js","utf8"),
 readFile("index.html","utf8")
]);
const store=new Map();
const ctx=vm.createContext({localStorage:{
 getItem:key=>store.get(key)||null,
 setItem:(key,value)=>store.set(key,value)
}});
vm.runInContext(source,ctx,{filename:"state-storage.js"});
const api=ctx.SchmetterlingeStorage;
assert.equal(api.STORE,"shuttleboard-v1");
assert.equal(api.SCHEMA_VERSION,1,"Existing user devices must keep local storage schema");
const owned=[{id:"05-111111",name:"Mein erstes Profil"},{id:"05-222222",name:"Mein zweites Profil"}];
const friends=[{id:"05-333333",name:"Freund A"},{id:"05-444444",name:"Freund B"}];
const state={players:owned.map(x=>({...x})),friends:friends.map(x=>({...x})),
 officialLinks:[],activeProfileId:"05-111111",viewingFriendId:null,chosen:"05-111111"};
assert.equal(api.selectFriend(state,"05-333333"),true);
assert.equal(state.activeProfileId,"05-111111","Viewing a friend never replaces the own home profile");
assert.equal(state.viewingFriendId,"05-333333");
assert.equal(state.chosen,"05-333333");
api.showOwn(state);
assert.equal(state.viewingFriendId,null);
assert.equal(state.activeProfileId,"05-111111");
assert.equal(state.chosen,"05-111111");
api.selectFriend(state,"05-333333");
assert.equal(api.selectOwn(state,"05-222222"),true);
assert.equal(state.activeProfileId,"05-222222");
assert.equal(state.viewingFriendId,null);
assert.equal(state.chosen,"05-222222");
assert.equal(api.selectFriend(state,"invalid"),false);
assert.equal(api.selectOwn(state,"05-333333"),false);
assert.equal(state.activeProfileId,"05-222222");
assert.equal(state.viewingFriendId,null);
assert.equal(api.unfollow(state,"invalid"),false);
assert.equal(state.friends.length,2);
assert.equal(api.selectFriend(state,"05-444444"),true);
assert.equal(api.unfollow(state,"05-333333"),true);
assert.equal(state.viewingFriendId,"05-444444","Removing another friend does not change the active friend");
assert.equal(api.unfollow(state,"05-444444"),true);
assert.equal(state.viewingFriendId,null,"Removing the viewed friend returns to own context");
assert.equal(state.chosen,"05-222222");
assert.equal(state.activeProfileId,"05-222222");
assert.equal(state.players.length,2);
api.save(state);
assert.equal(store.size,1,"Only the original local device key may be used");
const saved=JSON.parse(store.get("shuttleboard-v1"));
assert.equal(saved.activeProfileId,"05-222222");
assert.equal(saved.chosen,"05-222222");
assert.equal(saved.players.length,2);
assert.equal(saved.friends.length,0);
assert.match(app,/SchmetterlingeStorage\.selectOwn\(state,id\)/);
assert.match(app,/SchmetterlingeStorage\.showOwn\(state\)/);
assert.match(app,/SchmetterlingeStorage\.selectFriend\(state,id\)/);
assert.match(app,/SchmetterlingeStorage\.unfollow\(state,/);
assert.ok(html.indexOf('src="./state-storage.js"')<html.indexOf('src="./app.js"'),
 "State transitions must load before the classic controller");
assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest/);
console.log("Local profile transition contract: Home, friend switching, invalid IDs and unfollow preserved.");

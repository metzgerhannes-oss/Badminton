import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const [html,app,storage,bookmarks,css]=await Promise.all([
 "index.html","app.js","state-storage.js","tournament-bookmarks.js","design-v2.css"
].map(path=>readFile(path,"utf8")));
const actions=html.match(/id="dashboard-friends-manage"/g)||[];
assert.equal(actions.length,1,"Exactly one manage link in the Home friends header");
assert.match(html,/id="dashboard-add-friend"[^>]*href="#spieler"/,"Home + is a direct follow shortcut");
assert.match(html,/id="dashboard-friends-manage"[^>]*href="#spieler" hidden/);
assert.match(css,/\.dashboard-friends-links a\[hidden\]\{display:none!important\}/);
assert.match(app,/el\("dashboard-add-friend"\)\?\.addEventListener/);
const root={innerHTML:"",querySelectorAll(){return [];}},manage={hidden:true};
const ctx=vm.createContext({URL,Intl,Date,document:{
 addEventListener(){},
 getElementById(id){return id==="dashboard-friends"?root:id==="dashboard-friends-manage"?manage:null;}
}});
vm.runInContext(storage,ctx,{filename:"state-storage.js"});
vm.runInContext(bookmarks,ctx,{filename:"tournament-bookmarks.js"});
vm.runInContext(app,ctx,{filename:"app.js"});
const run=script=>vm.runInContext(script,ctx);
run("renderFriendQuick()");
assert.equal(manage.hidden,true,"Manage shortcut must be hidden without friends");
assert.match(root.innerHTML,/Noch keine Freunde/);
assert.doesNotMatch(root.innerHTML,/friend-quick-add/,"Only Home heading offers the follow shortcut");
run('state.players=[{id:"05-111111",name:"Eigen"}];state.activeProfileId="05-111111";state.friends=[{id:"05-222222",name:"Gast"}]');
run("renderFriendQuick()");
assert.equal(manage.hidden,false,"Management visible only when friends exist");
assert.doesNotMatch(root.innerHTML,/friend-quick-add/,"No redundant add action when showing friends");
assert.match(root.innerHTML,/data-friend-quick="05-222222"/);
// Home shows at most three shortcuts, even with the maximum 30 followed profiles.
run('state.friends=Array.from({length:30},(_,i)=>({id:"05-"+String(222222+i),name:"Freund "+i}));state.viewingFriendId=null;renderFriendQuick()');
assert.equal((root.innerHTML.match(/data-friend-quick=/g)||[]).length,3);
assert.match(root.innerHTML,/\+27 weitere/);
assert.match(root.innerHTML,/class="friend-quick-more" href="#spieler"/);
assert.doesNotMatch(root.innerHTML,/data-friend-quick="05-222225"/);
run('state.viewingFriendId="05-222251";renderFriendQuick()');
assert.equal((root.innerHTML.match(/data-friend-quick=/g)||[]).length,3);
assert.match(root.innerHTML,/data-is-own="true"/,"Viewing a friend must offer return to own");
assert.match(root.innerHTML,/data-friend-quick="05-222251"/,"Selected friend stays accessible");
assert.match(root.innerHTML,/\+28 weitere/);
run('state.viewingFriendId=null');
run("state.friends=[];renderFriendQuick()");
assert.equal(manage.hidden,true,"Removing the last friend must hide Alle anzeigen");
console.log("Home friend UX v62: exactly one contextual entry, existing friend switching intact.");

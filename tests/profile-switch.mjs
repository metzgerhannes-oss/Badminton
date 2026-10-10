import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const script=await readFile("app.js","utf8");
const storageScript=await readFile("state-storage.js","utf8");
const styles=await readFile("styles.css","utf8");
const store=new Map();
const header={innerHTML:"",querySelectorAll:()=>[]};
const context=vm.createContext({
 URL,Intl,Date,
 localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))},
 document:{addEventListener(){},getElementById:id=>id==="focused-profile"?header:null}
});
vm.runInContext(storageScript,context,{filename:"state-storage.js"});
vm.runInContext(script,context,{filename:"app.js"});
const run=q=>vm.runInContext(q,context);

run("renderFocusHeader()");
assert.match(header.innerHTML,/class="focus-switcher"/,"Two own profiles should show a top switcher");
assert.match(header.innerHTML,/data-switch-profile="05-070879"/);
assert.match(header.innerHTML,/data-switch-profile="05-071969"/);
assert.match(header.innerHTML,/aria-current="true"/,"Selected player identified accessibly");
assert.ok(!header.innerHTML.includes('href="#einstellungen">Wechseln'),"Should not redirect to settings to change players");

assert.equal(run('setActiveProfile("05-071969")'),true);
assert.equal(run("state.activeProfileId"),"05-071969");
assert.equal(run("state.chosen"),"05-071969");
assert.equal(JSON.parse(store.get("shuttleboard-v1")).activeProfileId,"05-071969");
run("renderFocusHeader()");
assert.match(header.innerHTML,/Charlotte Metzger/);
assert.match(header.innerHTML,/class="focus-switcher"/);

run('state.viewingFriendId="05-123456"');
run("renderFocusHeader()"); // Friend not saved: safe missing-profile fallback.
assert.doesNotMatch(header.innerHTML,/class="focus-switcher"/);
run('state.viewingFriendId=null');
run('state.players=state.players.filter(p=>p.id==="05-071969")');
run("renderFocusHeader()");
assert.doesNotMatch(header.innerHTML,/class="focus-switcher"/,"One own profile must have no switcher");
assert.doesNotMatch(header.innerHTML,/>Wechseln</,"One profile must not show a switch button");
const before=run("state.activeProfileId");
assert.equal(run('setActiveProfile("invalid")'),false);
assert.equal(run("state.activeProfileId"),before,"Unknown profile cannot be selected");
assert.ok(styles.includes(".focus-switcher-options")&&styles.includes(".focus-switcher>summary"));
assert.ok(styles.includes("focus-visible"),"Keyboard accessible focus");
console.log("Top profile switching passed: 2+ visible, single hidden, valid and persistent selection, invalid blocked.");

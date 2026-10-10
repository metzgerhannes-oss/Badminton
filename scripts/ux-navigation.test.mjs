import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const file=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const html=file("index.html");
const app=file("app.js");
const router=file("router.js");
const library=file("library.js");
const css=file("design-v2.css");
const dashboard=file("dashboard.js");
const history=file("history.js");
const sw=file("sw.js");

test("four focused main destinations; settings in header; history remains reachable",()=>{
 const links=[...html.matchAll(/data-page="([^"]+)"/g)].map(x=>x[1]);
 assert.deepEqual(links,["start","turniere","spieler","berichte"]);
 assert.match(html,/class="topbar-settings" href="#einstellungen"/);
 assert.match(html,/href="#historie"/);
 assert.match(html,/href="#turniere">← Turniertag/);
 assert.match(router,/page==="historie"\?"turniere":page/);
 assert.match(css,/\.bottom-nav a\{width:25%!important/);
});

test("single follow/search route; profiles live under Spieler, not Einstellungen",()=>{
 assert.doesNotMatch(html,/src="\.\/friend-search\.js"/);
 assert.doesNotMatch(html,/id="friend-search"/);
 assert.equal((html.match(/id="library-search"/g)||[]).length,1);
 for(const id of ["add-player","add-friend","add-friend-manual","friend-list","profile-list"]){
  assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1);
  assert.ok(html.indexOf('id="'+id+'"')<html.indexOf('id="view-einstellungen"'));
 }
 assert.match(html,/href="#spieler">Verwalten/);
});

test("empty default library state and explicit search/filter criteria",()=>{
 const match=library.match(/function hasCriteria\(\)\{[\s\S]*?\n\}/);
 assert.ok(match,"hasCriteria function present");
 const get=new Function("$","ageChoice",match[0]+"\nreturn hasCriteria;");
 const forms=[
  [{},false],
  [{"library-search":"Sarah"},true],
  [{"library-club":"Mössingen"},true],
  [{"library-age":"U13"},true],
  [{"library-association":"BAW"},true],
  [{"library-search":"  ","library-age":"all","library-association":"all"},false]
 ];
 for(const [fields,result] of forms){
  const has=get(id=>({value:fields[id]??""}),()=>fields["library-age"]??"all");
  assert.equal(has(),result,JSON.stringify(fields));
 }
 assert.match(library,/async function load\(\)\{\s*if\(!hasCriteria\(\)\)/);
 assert.match(library,/async function loadBackup\(\)\{\s*if\(!hasCriteria\(\)\)/);
 assert.match(library,/if\(!hasCriteria\(\)\)\{showIdle\(\);return;\}/);
 assert.doesNotMatch(library,/if\(location\.hash==="#spieler"\)load\(\)/);
 assert.match(library,/library-reset/);
 assert.match(html,/class="library-message library-idle"/);
});

test("Home and friends use one profile navigation mechanism",()=>{
 assert.match(app,/function navigateHome\(\)/);
 assert.match(app,/routeTo\("start"\)/);
 assert.match(app,/window\.badmintonSelectViewer\(b\.dataset\.friendQuick\)/);
 assert.match(app,/window\.badmintonSelectViewer\(friend\.id\)/);
 assert.match(app,/window\.badmintonSelectViewer\(button\.dataset\.switchProfile\)/);
 assert.match(router,/data-current-view/);
});

test("neutral user-facing wording and changed PWA cache",()=>{
 assert.doesNotMatch(dashboard,/Familien-Datenbasis/);
 assert.doesNotMatch(history,/in unserer kuratierten DBV-Chronik/);
 assert.match(sw,/schmetterlinge-shell-v55/);
 assert.doesNotMatch(sw,/\.\/friend-search\.js/);
});

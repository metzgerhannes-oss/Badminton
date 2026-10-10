import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
const code=await readFile("router.js","utf8");
const html=await readFile("index.html","utf8");
const sw=await readFile("sw.js","utf8");
const state={page:"historie"}, seen={scroll:0,focus:0,render:0};
const attr=()=>({attrs:{},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]}});
const pages=["start","historie","turniere","spieler","berichte","einstellungen"].map(name=>({...attr(),id:"view-"+name,classList:{active:false,toggle(k,yes){this.active=yes}}}));
const tabs=["start","turniere","spieler","berichte"].map(name=>({...attr(),dataset:{page:name}}));
const app=attr(),settings=attr();
const heading={setAttribute(){},focus(options){assert.equal(options.preventScroll,true);seen.focus++}};
const document={
 title:"",
 querySelector(q){
  if(q===".app")return app;
  if(q===".topbar-settings")return settings;
  if(q.startsWith("#view-"))return heading;
  return null;
 },
 querySelectorAll(q){
  if(q===".page")return pages;
  if(q===".bottom-nav a")return tabs;
  return [];
 }
};
const location={hash:"#start"};
const window={scrollTo(o){assert.equal(o.top,0);seen.scroll++}};
const ctx=vm.createContext({document,location,window,state,seen});
vm.runInContext(code,ctx,{filename:"router.js"});
const run=script=>vm.runInContext(script,ctx);
run("SchmetterlingeRouter.renderPage(state)");
assert.equal(document.title,"Turnierhistorie · Schmetterlinge");
assert.equal(app.attrs["data-current-view"],"historie");
assert.equal(tabs.find(x=>x.dataset.page==="turniere").attrs["aria-current"],"page");
assert.equal(tabs.filter(x=>x.attrs["aria-current"]==="page").length,1);
assert.equal(pages.find(x=>x.id==="view-historie").classList.active,true);
state.page="einstellungen";
run("SchmetterlingeRouter.renderPage(state)");
assert.equal(settings.attrs["aria-current"],"page");
assert.equal(tabs.filter(x=>x.attrs["aria-current"]==="page").length,0);
state.page="start";run("SchmetterlingeRouter.renderPage(state)");
assert.equal(settings.attrs["aria-current"],undefined);
assert.equal(tabs.find(x=>x.dataset.page==="start").attrs["aria-current"],"page");
run('SchmetterlingeRouter.routeTo(state,"start",()=>{seen.render++})');
assert.equal(seen.render,1,"Same-route Home must still render");
assert.equal(seen.focus,1,"Same-route navigation focuses new heading");
assert.equal(seen.scroll,1,"Same-route navigation scrolls to top");
run('SchmetterlingeRouter.routeTo(state,"turniere",()=>{seen.render++})');
assert.equal(state.page,"turniere");
assert.equal(location.hash,"#turniere");
assert.equal(seen.render,1,"Changing hash uses existing native hashchange render");
state.page="bad-route";run("SchmetterlingeRouter.renderPage(state)");
assert.equal(document.title,"Übersicht · Schmetterlinge");
assert.match(html,/<script defer src="\.\/router\.js"><\/script>/);
assert.match(sw,/\.\/router\.js/);
assert.match(sw,/schmetterlinge-shell-v52/);
console.log("Router v41: four tabs, history alias, settings, focus/scroll, same-hash Home, deep-link fallback.");

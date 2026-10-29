import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
const code=await readFile("router.js","utf8");
const html=await readFile("index.html","utf8");
const sw=await readFile("sw.js","utf8");
const state={page:"historie"}, seen={scroll:0,focus:0,render:0};
const attr=()=>({attrs:{},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]}});
const pages=["start","historie","turniere","spieler","mannschaft","berichte","einstellungen"].map(name=>({...attr(),id:"view-"+name,classList:{active:false,toggle(k,yes){this.active=yes}}}));
const tabs=["start","spieler","turniere","mannschaft"].map(name=>({...attr(),dataset:{page:name}}));
const app=attr(),settings=attr(),liveLink={...attr(),hidden:true};
const heading={setAttribute(){},focus(options){assert.equal(options.preventScroll,true);seen.focus++}};
const document={
 title:"",
 addEventListener(){},
 querySelector(q){
  if(q===".app")return app;
  if(q===".topbar-settings")return settings;
  if(q==="#live-nav-tab")return liveLink;
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
const window={scrollY:0,addEventListener(){},scrollTo(o){assert.equal(o.top,0);seen.scroll++}};
const ctx=vm.createContext({document,location,window,state,seen,requestAnimationFrame:callback=>callback()});
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
state.page="live";liveLink.hidden=false;
run("SchmetterlingeRouter.renderPage(state)");
assert.equal(document.title,"Live-Matches · Schmetterlinge");
assert.equal(app.attrs["data-current-view"],"live");
assert.equal(pages.find(x=>x.id==="view-turniere").classList.active,true);
assert.equal(tabs.find(x=>x.dataset.page==="turniere").attrs["aria-current"],"page");
assert.equal(liveLink.attrs["aria-current"],"page","Today context link is current while deep-linked into #live");
liveLink.hidden=true;run("SchmetterlingeRouter.renderPage(state)");
assert.equal(tabs.find(x=>x.dataset.page==="turniere").attrs["aria-current"],"page");
state.page="berichte";run("SchmetterlingeRouter.renderPage(state)");
assert.equal(tabs.filter(x=>x.attrs["aria-current"]==="page").length,0,"Reports are a context route with no extra main tab");
assert.equal(liveLink.attrs["aria-current"],undefined);
state.page="mannschaft";run("SchmetterlingeRouter.renderPage(state)");
assert.equal(document.title,"Mannschaft · Schmetterlinge");
assert.equal(pages.find(x=>x.id==="view-mannschaft").classList.active,true);
assert.equal(tabs.find(x=>x.dataset.page==="mannschaft").attrs["aria-current"],"page");
state.page="bad-route";run("SchmetterlingeRouter.renderPage(state)");
assert.equal(document.title,"Übersicht · Schmetterlinge");
assert.match(html,/<script defer src="\.\/router\.js"><\/script>/);
assert.match(sw,/\.\/router\.js/);
assert.match(sw,/schmetterlinge-shell-v[1-9][0-9]*/);
console.log("Router v41: four tabs, history alias, settings, focus/scroll, same-hash Home, deep-link fallback.");

// Duplicate-route painting regression: direct tab taps must render synchronously
// exactly once, while native Back/Forward and bookmarked tournament deep links
// must still render and focus the genuinely changed URL.
const appSource=await readFile("app.js","utf8");
const navigationStart=appSource.indexOf("function navigatePrimary(");
const navigationEnd=appSource.indexOf("\nfunction navigateHome()",navigationStart);
const nativeStart=appSource.indexOf(' window.addEventListener("hashchange",()=>{');
const nativeEnd=appSource.indexOf("\n const playerDialog=",nativeStart);
assert.ok(navigationStart>0&&navigationEnd>navigationStart&&
 nativeStart>navigationEnd&&nativeEnd>nativeStart,"Navigation and native hash handler must be present");
const callbacks={};const routeCounters={render:0,focus:0,route:0,own:0};
const navLocation={hash:"#start"};
const navState={page:"start",players:[{id:"99-000001"}],friends:[],viewingFriendId:null};
const navigationScope=vm.createContext({
 location:navLocation,state:navState,
 window:{addEventListener(name,callback){callbacks[name]=callback}},
 SchmetterlingeRouter:{renderPage(){routeCounters.route++}},
 SchmetterlingeStorage:{showOwn(){routeCounters.own++}},
 render(){routeCounters.render++},
 focusCurrentView(){routeCounters.focus++},
 el:()=>null,pendingFollowSearchFocus:false
});
vm.runInContext('let lastRenderedHash=location.hash||"#start";\n'+
 appSource.slice(navigationStart,navigationEnd)+"\n"+
 appSource.slice(nativeStart,nativeEnd),navigationScope,{filename:"navigation-hash-regression.js"});
const navigate=page=>vm.runInContext('navigatePrimary("'+page+'")',navigationScope);
navigate("spieler");
assert.equal(navLocation.hash,"#spieler");
assert.equal(routeCounters.render,1,"Tab click must render immediately");
callbacks.hashchange();
assert.equal(routeCounters.render,1,"Following native hashchange must not paint the same tab twice");
assert.equal(routeCounters.focus,1,"Following native hashchange must not steal iPhone keyboard focus");
navLocation.hash="#turniere/dbv-calendar-999987/99-000001";
callbacks.hashchange();
assert.equal(navState.page,"turniere");
assert.equal(routeCounters.render,2,"Exact Home-to-tournament hash deep link must still render");
navLocation.hash="#start";
callbacks.hashchange();
assert.equal(navState.page,"start");
assert.equal(routeCounters.render,3,"Browser Back must render and restore the prior view");
navigate("start");
assert.equal(routeCounters.own,1,"Repeat Home tap must still restore the own profile");
assert.equal(routeCounters.render,4,"Same-tab Home tap must paint when no hashchange fires");
navigate("turniere");
callbacks.hashchange();
assert.equal(routeCounters.render,5,"Normal route navigation must paint once per click");
console.log("P1 navigation: one synchronous paint per tab, deep-link and browser Back preserved.");

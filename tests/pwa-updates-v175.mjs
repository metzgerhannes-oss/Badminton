import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const [script,style,html,welcome,app,welcomeJs,worker,release]=await Promise.all([
 "pwa-update.js","pwa-update.css","index.html","welcome.html",
 "app.js","welcome.js","sw.js","app-release.js"
].map(f=>readFile(f,"utf8")));
for(const page of [html,welcome]){
 assert.match(page,/<script defer src="\.\/pwa-update\.js"><\/script>/);
 assert.match(page,/<link rel="stylesheet" href="\.\/pwa-update\.css">/);
}
assert.match(app,/SchmetterlingePwaUpdate\?\.initialize\(\)/);
assert.match(welcomeJs,/SchmetterlingePwaUpdate\?\.initialize\(\)/);
const deployed=release.match(/version:"(v\d+)"/)?.[1];
assert.ok(deployed,"A deployed version is required for cache upgrades");
assert.ok(worker.includes("schmetterlinge-shell-"+deployed),"PWA cache and release must match");
assert.match(release,/version:"v183"/);
assert.match(script,/updateViaCache:"none"/);
assert.match(script,/cache:"no-store"/);
assert.match(script,/location\.replace\(next\.href\)/);
assert.match(style,/focus-visible/);
assert.doesNotMatch(script,/localStorage|indexedDB|caches\.delete|supabase|setInterval|auth\/v1/i);
for(const name of ["ASSETS","SHELL_ASSETS","ESSENTIAL"]){
 const m=worker.match(new RegExp("const "+name+"=(\\[[^\\n]+\\]);"));
 assert.ok(m,name+" exists");
 for(const path of ["./pwa-update.js","./pwa-update.css"])
  assert.ok(JSON.parse(m[1]).includes(path),name+" contains "+path);
}

function harness({online=true,current="v174",offered="v175",stampedVersion=null}={}){
 let requests=[],nodes=[],navigated=null,registerCount=0,workerChecks=0;
 const listeners={};
 const makeNode=(tag)=>({
  tag,children:[],attrs:{},events:{},
  setAttribute(k,v){this.attrs[k]=v},
  append(...list){this.children.push(...list)},
  addEventListener(name,cb){this.events[name]=cb}
 });
 const doc={body:{append:node=>nodes.push(node)},getElementById:()=>null,
  querySelector:selector=>selector==="[data-app-version]"&&stampedVersion
    ?{textContent:stampedVersion,getAttribute:key=>key==="data-release-build"?"mock-pages-sha":null}
    :null,
  createElement:makeNode,addEventListener:(name,cb)=>{listeners["doc:"+name]=cb}};
 const nav={onLine:online,serviceWorker:{
  async register(path,opts){registerCount++;assert.equal(path,"./sw.js");assert.equal(opts.updateViaCache,"none");
   return {update:async()=>{workerChecks++}}},
  addEventListener:(name,cb)=>{listeners["worker:"+name]=cb}
 }};
 const loc={protocol:"https:",hostname:"metzgerhannes-oss.github.io",
  href:"https://metzgerhannes-oss.github.io/Badminton/index.html#spieler",
  replace(url){navigated=url}};
 const win={SchmetterlingeRelease:{version:current},addEventListener:(name,cb)=>{listeners["window:"+name]=cb}};
 const response={ok:true,text:async()=>'{version:"'+offered+'", build:"pages-10", commit:"abcd"}'};
 const fetchStub=async(url,opts)=>{requests.push({url,opts});if(!online)throw Error("offline");return response};
 vm.runInNewContext(script,{window:win,document:doc,navigator:nav,location:loc,URL,Date,Promise,AbortController,setTimeout,clearTimeout,fetch:fetchStub});
 return {win,doc,nav,loc,requests,nodes,listeners,
  get navigated(){return navigated},get registerCount(){return registerCount},get workerChecks(){return workerChecks}};
}
const settle=()=>new Promise(r=>setTimeout(r,20));
{
 const h=harness();h.win.SchmetterlingePwaUpdate.initialize();
 await settle();
 assert.equal(h.registerCount,1);
 assert.equal(h.requests.length,1,"One static release request per app start");
 assert.equal(h.requests[0].opts.cache,"no-store");
 assert.equal(h.nodes.length,1,"Prompt required for newer release");
 assert.equal(h.nodes[0].attrs.role,"status");
 const button=h.nodes[0].children[1];
 assert.equal(button.textContent,"Jetzt aktualisieren");
 await button.events.click();
 assert.equal(h.workerChecks,1);
 const url=new URL(h.navigated);
 assert.equal(url.hash,"#spieler");
 assert.equal(url.searchParams.get("app-update"),"v175");
 assert.ok(url.searchParams.get("fresh"));
 assert.doesNotMatch(url.search,/appinvite|token|secret/i);
 await h.win.SchmetterlingePwaUpdate.checkNow();
 assert.equal(h.requests.length,1,"No background polling within six hours");
}
{
 const h=harness({current:"v175",offered:"v175"});
 h.win.SchmetterlingePwaUpdate.initialize();
 await settle();assert.equal(h.nodes.length,0,"No banner when already updated");
}
{
 // Reproduces the user's iPhone symptom: Pages-stamped DOM is older than
 // the version loaded by JS from cache/network. Trust deployed HTML.
 const h=harness({current:"v175",offered:"v175",stampedVersion:"v174"});
 h.win.SchmetterlingePwaUpdate.initialize();
 await settle();
 assert.equal(h.nodes.length,1,"Old installed Pages HTML must prompt for an update");
}
{
 const h=harness({online:false});
 h.win.SchmetterlingePwaUpdate.initialize();
 await settle();assert.equal(h.nodes.length,0,"Offline never shows an unusable update");
}
console.log("PWA v175: update prompt on new release only, route preserved, no data deletion or background polling.");

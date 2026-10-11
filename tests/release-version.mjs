import assert from "node:assert/strict";
import {readFile, mkdtemp, writeFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {execFileSync} from "node:child_process";
import vm from "node:vm";

const [app, welcome, shell, sw, css, release, pageWorkflow] = await Promise.all([
  "index.html","welcome.html","app-shell.css","sw.js","app-shell.css","app-release.js",".github/workflows/pages.yml"
].map(p=>readFile(p,"utf8")));
const r=release.match(/\{version:"(v[1-9][0-9]*)", build:"source", commit:""\}/);
assert.ok(r, "Release source must have an explicit monotonically updated vNN number");
const version=r[1];
assert.match(sw,new RegExp("schmetterlinge-shell-"+version+"\\b"));
assert.match(sw,/"\.\/app-release\.js"/);
assert.match(app,/<script defer src="\.\/app-release\.js"><\/script>/);
assert.match(welcome,/<script defer src="\.\/app-release\.js"><\/script>/);
assert.match(app,/class="app-version-badge"[^>]*data-app-version/);
assert.match(welcome,/data-app-version/);
assert.match(app,/id="app-build-info"/);
assert.match(app,/<div class="topbar-actions">/);
assert.match(shell,/\.topbar-actions\{/);
assert.match(css,/\.app-version-badge\{/);
assert.match(pageWorkflow,/node scripts\/stamp-release\.mjs/);

// Browser runtime: display precisely the JS shipped with the current shell,
// without fetching a possibly newer network release on an older iPhone PWA.
const badges=Array.from({length:2},()=>({textContent:"",attributes:{},
 setAttribute(k,v){this.attributes[k]=v},title:""}));
const build={textContent:""};
const doc={readyState:"complete",querySelectorAll:()=>badges,getElementById:id=>id==="app-build-info"?build:null};
const win={};
vm.runInNewContext(release,{window:win,document:doc});
assert.equal(win.SchmetterlingeRelease.version,version);
assert.ok(badges.every(b=>b.textContent===version));
assert.equal(badges[0].attributes["aria-label"],"App-Version "+version);
assert.match(build.textContent,/lokaler Quellstand/);

// Simulate Pages deployment in an isolated directory (no source modifications).
const temp=await mkdtemp(join(tmpdir(),"schmetterlinge-release-"));
try{
  await Promise.all([
    writeFile(join(temp,"app-release.js"),release),
    writeFile(join(temp,"sw.js"),sw),
    writeFile(join(temp,"index.html"),app),
    writeFile(join(temp,"welcome.html"),welcome)
  ]);
  const sha="1234567890abcdef1234567890abcdef12345678";
  const stamp=resolve("scripts/stamp-release.mjs");
  execFileSync(process.execPath,[stamp],{cwd:temp,
    env:{...process.env,GITHUB_SHA:sha,GITHUB_RUN_NUMBER:"203"}});
  const [builtJs,builtSw,builtApp,builtWelcome]=await Promise.all(["app-release.js","sw.js","index.html","welcome.html"].map(p=>readFile(join(temp,p),"utf8")));
  assert.match(builtJs,new RegExp('version:"'+version+'", build:"pages-203", commit:"'+sha+'"'));
  assert.ok(builtSw.includes('const CACHE="schmetterlinge-shell-'+version+'-'+sha.slice(0,10)+'"'),
    "Each deployment must change the worker bytes and thus refresh the PWA");
  assert.match(builtApp,/data-app-version data-release-build="1234567890abcdef/);
  assert.match(builtWelcome,/data-app-version data-release-build="1234567890abcdef/);
  assert.match(builtApp,/id="app-build-info" data-release-build="1234567890abcdef/);
  assert.match(builtApp,/pages-203 · Commit 1234567890abcdef/);
  const lockedBadge={textContent:"v87",title:"",getAttribute:key=>key==="data-release-build"?sha:null};
  const lockedInfo={textContent:"Version v87 · Build pages-203",getAttribute:key=>key==="data-release-build"?sha:null};
  const lockedDoc={readyState:"complete",querySelectorAll:()=>[lockedBadge],
    getElementById:id=>id==="app-build-info"?lockedInfo:null};
  // A later network response must not relabel an older HTML shell.
  vm.runInNewContext(builtJs,{window:{},document:lockedDoc});
  assert.equal(lockedBadge.textContent,"v87");
  assert.equal(lockedInfo.textContent,"Version v87 · Build pages-203");
  const builtBadge={textContent:"",attributes:{},setAttribute(k,v){this.attributes[k]=v}};
  const builtInfo={textContent:""};
  const builtDoc={readyState:"complete",querySelectorAll:()=>[builtBadge],
    getElementById:id=>id==="app-build-info"?builtInfo:null};
  vm.runInNewContext(builtJs,{window:{},document:builtDoc});
  assert.match(builtInfo.textContent,/pages-203/);
  assert.match(builtInfo.textContent,new RegExp(sha));
}finally{await rm(temp,{recursive:true,force:true})}
console.log("Release badge "+version+": persistent on app/welcome, build/commit stamped per Pages deployment, offline cache refreshed.");

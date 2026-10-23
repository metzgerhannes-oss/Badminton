/** Offline contract for v189: explicit WCAG 2.2 AA color pairs, scoped PWA cache and unchanged Home. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [css,index,welcome,wiki,sw,release] = await Promise.all(
 ["contrast-v189.css","index.html","welcome.html","wiki.html","sw.js","app-release.js"].map(p=>readFile(p,"utf8")));
const toRgb=value=>{
 const hex=value.replace(/^#/,"");
 assert.match(hex,/^[0-9a-f]{6}$/i);
 return [0,2,4].map(pos=>parseInt(hex.slice(pos,pos+2),16)/255);
};
const luminance=value=>{
 const [r,g,b]=toRgb(value).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
 return .2126*r+.7152*g+.0722*b;
};
const contrast=(a,b)=>{
 const [l,h]=[luminance(a),luminance(b)].sort((a,b)=>a-b);
 return (h+.05)/(l+.05);
};
const pairs=[
 ["Pale form placeholder","#425f76","#f7fcff",4.5],
 ["Dialog notes on palest gradient","#304f68","#e7f5ff",4.5],
 ["Light card supporting text","#344f66","#f7fcff",4.5],
 ["Navy secondary text","#d6ebfb","#142e4b",4.5],
 ["Navy search input labels","#f2f9ff","#173e60",4.5],
 ["Wiki supporting text","#35546d","#caeafb",4.5],
 ["Welcome search helper text","#d9efff","#0b263f",4.5],
 ["Wiki filter ink","#234c66","#f5fbff",4.5],
 ["Wiki active filter","#ffffff","#0c628f",4.5],
 ["Disabled wiki navigation","#49677d","#e3f2fc",4.5],
 ["Focus ring on dark","#91dbff","#142e4b",3],
 ["Focus ring on pale","#0a669b","#f7fcff",3]
];
for(const [label,fg,bg,required] of pairs){
 assert.ok(contrast(fg,bg)>=required,label+": "+contrast(fg,bg).toFixed(2)+":1");
 assert.ok(css.includes(fg)&&css.includes(bg),"Explicit audited color pairing: "+label);
}
assert.match(css,/\.app \.page:not\(#view-start\)/,"Home excluded from application page overrides");
assert.doesNotMatch(css,/(^|\n)\s*(?:#view-start|\.focused-profile|\.dashboard-ranking-grid|\.topbar)\s*\{/,
 "Do not rewrite Home visuals");
for(const page of [index,welcome,wiki])
 assert.match(page,/<link rel="stylesheet" href="\.\/contrast-v189\.css">/,
 "Audit palette must be loaded on every UI shell");
for(const key of ["ASSETS","SHELL_ASSETS","ESSENTIAL"]){
 const match=sw.match(new RegExp("const "+key+"=(\\[[^\\n]+\\]);"));
 assert.ok(match,key+" exists");
 assert.ok(JSON.parse(match[1]).includes("./contrast-v189.css"),
  "New styling must survive offline PWA upgrade: "+key);
}
assert.match(sw,/schmetterlinge-shell-v189/);
assert.match(release,/version:"v189"/);
assert.match(index,/App-Version v189/);
assert.match(welcome,/App-Version v189/);
assert.doesNotMatch(css,/@import|url\(|font-face/i,"No font/CDN/network dependencies");
console.log(pairs.length+" audited color/background pairs meet AA; PWA and non-Home scoping valid.");

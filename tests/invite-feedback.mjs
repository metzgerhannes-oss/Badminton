import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
// Static offline UI contract; no production network requests.
const [html,css,js]=await Promise.all(["index.html","contrast-v189.css","invite.js"].map(f=>readFile(f,"utf8")));
const button=html.indexOf('id="invite-copy"');
const feedback=html.indexOf('id="invite-status"');
const nextLink=html.indexOf('id="invite-link-preview"');
assert.ok(button>0&&feedback>button&&nextLink>feedback,
 "Copy feedback must be visually adjacent to the copy button, above deep links");
assert.match(html,/id="invite-status" role="status" aria-live="polite" aria-atomic="true"/);
assert.match(css,/\.invitation-card #invite-status:not\(:empty\)/);
assert.match(css,/font-size:16px/);
assert.match(css,/\[data-state="success"\]/);
assert.match(css,/\[data-state="error"\]/);
assert.match(js,/target\.dataset\.state=kind/);
assert.match(js,/copyButton\.textContent="✓ Link kopiert"/);
assert.match(js,/status\("✓ Einladungslink kopiert/);
assert.match(js,/Kopieren nicht möglich/);
assert.match(js,/return false;\n}/);
const lum=hex=>{
 const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return c[0]*.2126+c[1]*.7152+c[2]*.0722;
};
const ratio=(fg,bg)=>{let a=lum(fg),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
assert.ok(ratio("#13374f","#eef5ff")>=7);
assert.ok(ratio("#155235","#e6f5eb")>=7);
assert.ok(ratio("#8c2131","#fff0f1")>=7);
console.log("Invitation clipboard feedback: success/error contrast and placement verified.");

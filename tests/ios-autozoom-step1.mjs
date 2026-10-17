import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
for(const file of ["follow-ux.css","welcome.css"]){
 const css=await readFile(file,"utf8");
 assert.match(css,/@media \(max-width: 767px\) and \(pointer: coarse\)/);
 assert.match(css,/font-size: 16px !important/);
 assert.match(css,/touch-action: manipulation/);
 assert.doesNotMatch(css,/user-scalable\s*=\s*no|maximum-scale\s*=\s*1|gesturestart/);
}
for(const file of ["index.html","welcome.html"]){
 const html=await readFile(file,"utf8");
 assert.match(html,/width=device-width,initial-scale=1,viewport-fit=cover/);
 assert.doesNotMatch(html,/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/);
 assert.match(html,/<span[^>]*data-app-version[^>]*>v164<\/span>/);
}
console.log("iOS Step 1: input focus zoom prevented; intentional pinch zoom preserved.");

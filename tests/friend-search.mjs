import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {normalizeFriendSearch,friendSearchUrl,asFriendCandidate,classifyFriendCandidate,SEARCH_LIMIT} from "../scripts/friend-search.mjs";

assert.equal(normalizeFriendSearch("  Sarah    Storz "),"Sarah Storz");
assert.equal(normalizeFriendSearch("  05-061350  "),"05-061350");
assert.equal(friendSearchUrl("x"),null);
assert.equal(SEARCH_LIMIT,30);
const link=new URL(friendSearchUrl("Sarah Storz"));
assert.equal(link.pathname,"/rest/v1/players");
assert.match(link.searchParams.get("or"),/Sarah Storz/);
const sarah=asFriendCandidate({dbv_id:"05-061350",name:"Sarah Storz",club:"SpVgg. Mössingen",birth_year:2010,age_class:"U17"});
assert.equal(sarah.id,"05-061350");
assert.equal(sarah.birthYear,2010);
assert.equal(classifyFriendCandidate(sarah,{own:[],following:[]}),"available");
assert.equal(classifyFriendCandidate(sarah,{own:[],following:["05-061350"]}),"following");
assert.equal(classifyFriendCandidate(sarah,{own:["05-061350"],following:[]}),"own");

const html=await readFile("index.html","utf8");
const app=await readFile("app.js","utf8");
const library=await readFile("library.js","utf8");
const sw=await readFile("sw.js","utf8");
for(const id of ["library-search","library-results","add-friend","add-friend-manual","dashboard-add-friend","friend-list"]){
 assert.match(html,new RegExp('id="'+id+'"'));
}
assert.equal((html.match(/id="library-search"/g)||[]).length,1);
assert.ok(!html.includes('src="./friend-search.js"'));
assert.ok(!html.includes('id="friend-search"'));
assert.match(app,/badmintonLibraryToggleFollow/);
assert.match(app,/add-friend-manual/);
assert.match(library,/data-library-toggle/);
assert.match(sw,/schmetterlinge-shell-v60/);
console.log("Friend search uses one library search path, with correct DBV identity handling and manual ID fallback.");

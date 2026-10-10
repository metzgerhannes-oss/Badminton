import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {normalizeFriendSearch,friendSearchUrl,asFriendCandidate,classifyFriendCandidate,SEARCH_LIMIT} from "../scripts/friend-search.mjs";

assert.equal(normalizeFriendSearch("  Sarah    Storz "),"Sarah Storz");
assert.equal(normalizeFriendSearch("  Müller, Meier (Test) "),"Müller Meier Test");
assert.equal(normalizeFriendSearch("  05-061350  "),"05-061350");
assert.equal(friendSearchUrl("x"),null,"One-letter search must not scan public directory");
assert.equal(SEARCH_LIMIT,30);

const query=new URL(friendSearchUrl("Sarah Storz"));
assert.equal(query.hostname,"yadexibmjmnjfmfabrug.supabase.co");
assert.equal(query.pathname,"/rest/v1/players");
assert.equal(query.searchParams.get("limit"),"30");
assert.match(query.searchParams.get("or"),/name\.ilike\.\*Sarah Storz\*/);
assert.match(query.searchParams.get("select"),/club/);
assert.match(query.searchParams.get("select"),/age_class/);
const idQuery=new URL(friendSearchUrl("05-061350"));
assert.match(idQuery.searchParams.get("or"),/dbv_id\.eq\.05-061350/);
assert.ok(!friendSearchUrl("Sarah),or=(dbv_id.eq.05-070879").includes("),or="),"PostgREST grammar injection disallowed");
assert.ok(!friendSearchUrl("Sarah*").includes("Sarah**"),"Untrusted wildcard characters disallowed");

const sarah=asFriendCandidate({
 dbv_id:"05-061350",name:"Sarah Storz",club:"SpVgg. Mössingen",birth_year:2010,
 age_class:"U17",association:"BAW-Baden-Württemberg"
});
assert.equal(sarah.id,"05-061350");
assert.equal(sarah.club,"SpVgg. Mössingen");
assert.equal(sarah.birthYear,2010);
assert.equal(sarah.ageClass,"U17");
assert.equal(sarah.url,"","The DBV profile UUID must not be fabricated");
assert.equal(asFriendCandidate({dbv_id:"local-123",name:"Test"}),null);
assert.equal(asFriendCandidate({dbv_id:"05-123456",name:"  "}),null);
assert.equal(classifyFriendCandidate(sarah,{own:[],following:[]}),"available");
assert.equal(classifyFriendCandidate(sarah,{own:[],following:["05-061350"]}),"following");
assert.equal(classifyFriendCandidate(sarah,{own:["05-061350"],following:[]}),"own");

const index=await readFile("index.html","utf8");
const app=await readFile("app.js","utf8");
const search=await readFile("friend-search.js","utf8");
const css=await readFile("design-v2.css","utf8");
const sw=await readFile("sw.js","utf8");
for(const id of ["friend-search","friend-search-status","friend-search-results",
 "add-friend","add-friend-manual","dashboard-add-friend","friend-list"]){
 assert.match(index,new RegExp('id="'+id+'"'),"Missing accessible friends UI: "+id);
}
assert.match(index,/src="\.\/friend-search\.js"/);
assert.match(index,/Sarah Storz oder 05-061350/);
assert.match(app,/window\.badmintonLibraryToggleFollow/);
assert.match(app,/el\("add-friend-manual"\)/);
assert.match(app,/el\("dashboard-add-friend"\)/);
assert.match(search,/window\.badmintonLibraryToggleFollow\?\.\(candidate\)/);
assert.match(search,/window\.addEventListener\("badminton:friends-changed"/);
assert.match(search,/data-friend-follow/);
assert.match(search,/backupAll\(\)/);
assert.match(css,/\.friend-search-input/);
assert.match(css,/max-height:405px/);
assert.match(sw,/friend-search\.js/);
assert.match(sw,/scripts\/friend-search\.mjs/);
assert.match(sw,/schmetterlinge-shell-v29/);
console.log("Friend text search: sanitized DBV queries, Sarah Storz identity, duplicate/own controls, Home entry and PWA verified.");

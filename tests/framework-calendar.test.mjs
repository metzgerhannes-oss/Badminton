import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const sandbox=vm.createContext({URL,Date,Intl,Set});
vm.runInContext(readFileSync(new URL("../tournament-bookmarks.js",import.meta.url),"utf8"),sandbox);
const bookmarks=sandbox.SchmetterlingeBookmarks;
const bwSource="https://bwbv.de/wp-content/uploads/2026/03/Termine-2026_2027_Jugend.pdf";
const valid={id:"bwbv-2027-c-1",source:"bwbv-framework",url:bwSource,
 playerId:"05-123456",name:"1. BWBV/C-RLT Jugend",startDate:"2027-01-16",endDate:"2027-01-17",place:""};

test("official 2027 planning date is a private bookmark, not a DBV tournament UUID",()=>{
 const item=bookmarks.normalizeBookmark(valid);
 assert.ok(item);
 assert.equal(item.id,"bwbv-2027-c-1");
 assert.equal(item.source,"bwbv-framework");
 assert.equal(item.place,"");
 assert.equal(item.url,bwSource);
 assert.equal(bookmarks.hasTournamentToday({players:[{id:valid.playerId}],officialLinks:[item]},"2027-01-16"),false);
});

test("only the seven source-validated framework entries can be saved",()=>{
 for(const changes of [
  {id:"bwbv-2027-c-99"},{id:"dbv-calendar-987"},{source:"example"},
  {url:"https://example.com/anything"},{url:"javascript:alert(1)"},
  {playerId:"all"},{startDate:"2026-01-16"},{startDate:"2027-02-30"},
  {startDate:"2027-01-23"},{endDate:"2027-01-24"},
  {url:"https://www.badminton.de/news/badminton/turniervergabe-nachwuchsveranstaltungen-2027-1/"},
  {endDate:"2027-01-15"}
 ])assert.equal(bookmarks.normalizeBookmark({...valid,...changes}),null);
});

test("saved framework event is visible only for the selected personal profile",()=>{
 const item=bookmarks.normalizeBookmark({...valid,place:"Reutlingen"});
 const state={officialLinks:[item],viewingFriendId:null,activeProfileId:"05-123456"};
 assert.equal(bookmarks.visible(state).length,1);
 assert.equal(bookmarks.visible(state)[0].place,"Reutlingen");
 state.activeProfileId="05-654321";
 assert.equal(bookmarks.visible(state).length,0);
 state.activeProfileId="05-123456";
 state.viewingFriendId="05-654321";
 assert.equal(bookmarks.visible(state).length,0);
});

test("existing imported DBV records retain their venue and cannot trigger game-day",()=>{
 const item=bookmarks.normalizeBookmark({id:"dbv-calendar-234",source:"dbv-calendar",
  url:"https://turniere.badminton.de/",playerId:"05-123456",
  name:"Test event",startDate:"2027-01-16",endDate:"2027-01-17",place:"Mössingen"});
 assert.equal(item.place,"Mössingen");
 assert.equal(bookmarks.hasTournamentToday({players:[{id:"05-123456"}],officialLinks:[item]},"2027-01-16"),false);
});

test("verified Reutlingen 2026 result preserves venue and DBV UUID",()=>{
 const direct=bookmarks.normalizeBookmark({url:"https://dbv.turnier.de/tournament/52b3b803-279b-48cf-8143-f5078f5236db",
  name:"1. C-RLT BAW Einzel/Doppel U11–U19",playerId:"05-123456",
  startDate:"2026-01-17",endDate:"2026-01-18",place:"Reutlingen"});
 assert.equal(direct.id,"52B3B803-279B-48CF-8143-F5078F5236DB");
 assert.equal(direct.place,"Reutlingen");
});

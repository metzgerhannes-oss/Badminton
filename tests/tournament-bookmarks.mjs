import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile("tournament-bookmarks.js","utf8");
const context=vm.createContext({URL,Intl,Date});
vm.runInContext(source,context,{filename:"tournament-bookmarks.js"});
const bookmarks=context.SchmetterlingeBookmarks;
const id="E24DC6EE-152A-454D-B00C-E625B751D7D5";
const url="https://dbv.turnier.de/tournament/"+id;

assert.equal(bookmarks.parseDbvTournamentLink(url+"?foo=bar").url,url);
assert.equal(bookmarks.parseDbvTournamentLink("https://evil.example/tournament/"+id),null);
assert.equal(bookmarks.parseDbvTournamentLink("https://dbv.turnier.de.evil.example/tournament/"+id),null);
assert.equal(bookmarks.parseDbvTournamentLink("javascript:alert(1)"),null);
assert.equal(bookmarks.parseDbvTournamentLink("https://dbv.turnier.de/player/"+id),null);
assert.equal(bookmarks.validDate("2026-02-30"),"","February 30 must not be silently rolled forward");
assert.equal(bookmarks.validDate("2026-02-29"),"");
assert.equal(bookmarks.validDate("2028-02-29"),"2028-02-29");
assert.equal(bookmarks.validDate("2026-13-01"),"");
assert.equal(bookmarks.validDate(""),"");
const normalized=bookmarks.normalizeBookmark({url,name:"",playerId:"05-070879",startDate:"2026-02-30",endDate:"2028-02-29"});
assert.equal(normalized.name,"DBV-Turnier E24DC6EE");
assert.equal(normalized.startDate,"","Invalid stored dates must be cleared on restore");
assert.equal(normalized.endDate,"2028-02-29");
assert.equal(bookmarks.normalizeBookmark({url:"http://dbv.turnier.de/tournament/"+id}),null);
assert.equal(bookmarks.localDay(new Date("2026-10-10T22:30:00Z")),"2026-10-11","Berlin local day must be used for match dates");
assert.equal(bookmarks.localDay(new Date("2026-12-31T23:30:00Z")),"2027-01-01");
assert.equal(bookmarks.phase({startDate:"2026-10-11",endDate:"2026-10-12"},"2026-10-11")[1],"today");
assert.equal(bookmarks.phase({startDate:"2026-10-10",endDate:"2026-10-11"},"2026-10-11")[1],"today");
assert.equal(bookmarks.phase({startDate:"2026-10-10",endDate:""},"2026-10-11")[1],"past");
assert.equal(bookmarks.phase({startDate:"",endDate:""},"2026-10-11")[1],"unknown");

const owned=[
 {id:"future",name:"Future",playerId:"05-070879",startDate:"2026-10-15",endDate:""},
 {id:"past",name:"Past",playerId:"all",startDate:"2026-10-01",endDate:""},
 {id:"today",name:"Today",playerId:"05-070879",startDate:"2026-10-11",endDate:""},
 {id:"unknown",name:"Unknown",playerId:"all",startDate:"",endDate:""},
 {id:"other",name:"Other player",playerId:"05-071969",startDate:"2026-10-11",endDate:""}
];
const state={activeProfileId:"05-070879",viewingFriendId:null,officialLinks:owned};
assert.deepEqual(Array.from(bookmarks.sorted(state,"2026-10-11"),p=>p.id),["today","future","unknown","past"],
 "Same sorting and ownership filter as the legacy tournament view");
assert.equal(bookmarks.visible({...state,viewingFriendId:"05-123456"}).length,0,
 "Friend views must not inherit private tournament bookmarks");
assert.deepEqual(owned.map(p=>p.id),["future","past","today","unknown","other"],
 "Sorting must not mutate saved local bookmark order");
assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|localStorage|service_role|supabaseUrl/i);
console.log("Tournament bookmarks v61: official URL, strict calendar dates, Berlin day, own/friend boundaries and stable sort verified.");

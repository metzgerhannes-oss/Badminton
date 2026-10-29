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
const manualWithVenue=bookmarks.normalizeBookmark({url,playerId:"05-070879",name:"3. D-RLT Gomaringen",
 startDate:"2026-11-22",endDate:"2026-11-22",deadline:"2026-11-15",
 place:"Sport- und Kulturhalle, Haydnstraße 22, 72810 Gomaringen"});
assert.equal(manualWithVenue.startDate,"2026-11-22","Event start must never be replaced by registration deadline");
assert.equal(manualWithVenue.deadline,"2026-11-15","Meldeschluss is separate from game day");
assert.match(manualWithVenue.place,/Haydnstraße 22/);
assert.equal(bookmarks.normalizeBookmark({...manualWithVenue,deadline:"2026-11-31"}).deadline,"",
 "Invalid deadlines must not be persisted");


const calendar={
 source:"dbv-calendar",id:"dbv-calendar-44094",url:"https://turniere.badminton.de/",
 name:"Norddeutsche Meisterschaften U13-U19",playerId:"05-070879",
 startDate:"2026-11-06",endDate:"2026-11-08"
};
assert.equal(bookmarks.normalizeBookmark(calendar).id,calendar.id,"Official calendar IDs may be bookmarked privately without inventing tournament UUIDs");
assert.equal(bookmarks.normalizeBookmark(calendar).source,"dbv-calendar");
assert.equal(bookmarks.normalizeBookmark({...calendar,deadline:"2026-10-31"}).deadline,"2026-10-31");
const officialRow={key:"dbv-calendar-44094",url,hasDirectLink:true,
 title:"3. D-RLT BAW SW U11-U19 Gomaringen",start:"2026-11-22",end:"2026-11-22",
 deadline:"2026-11-15",place:"Sport- und Kulturhalle, Haydnstraße 22, Gomaringen"};
const correct=bookmarks.normalizeBookmark({url,name:"3. D-RLT Gomaringen",
 startDate:"2026-11-22",endDate:"2026-11-22",playerId:"05-070879"});
const enriched=bookmarks.reconcileOfficialMetadata(correct,[officialRow]);
assert.equal(enriched.status,"matched");
assert.match(enriched.updated.place,/Haydnstraße 22/);
assert.equal(enriched.updated.deadline,"2026-11-15");
assert.equal(enriched.updated.startDate,"2026-11-22");
assert.equal(correct.place,"","Source reconciliation must never mutate the original stored object");
const wrongDate=bookmarks.reconcileOfficialMetadata(
 {...correct,startDate:"2026-11-15"},[officialRow]);
assert.equal(wrongDate.status,"matched","Official DBV date overrides legacy local registration deadline");
assert.equal(wrongDate.updated.startDate,"2026-11-22");
assert.equal(wrongDate.updated.deadline,"2026-11-15");
assert.equal(wrongDate.sourceCorrected,true);
assert.deepEqual(Array.from(bookmarks.describeOfficialChanges({...correct,startDate:"2026-11-15"},wrongDate.updated)),
 ["Titel/Kategorie","Spieltag","Austragungsort","Meldeschluss"],
 "The UI must explicitly name corrected game date, venue and separate registration deadline");
assert.deepEqual(Array.from(bookmarks.describeOfficialChanges(correct,correct)),[],
 "No invented corrections when verified DBV metadata already matches");
const wrongCategory=bookmarks.reconcileOfficialMetadata({...correct,name:"3. E-RLT Gomaringen"},
 [officialRow]);
assert.equal(wrongCategory.status,"matched","An independently verified SAME UUID identifies the event");
assert.equal(wrongCategory.updated.name,officialRow.title,"DBV title/category beats legacy E-RLT");
assert.equal(wrongCategory.updated.playerId,correct.playerId,"Player association is not source metadata");
assert.equal(bookmarks.reconcileOfficialMetadata({...correct,name:"3. E-RLT Gomaringen"},[
 {...officialRow,url:"https://dbv.turnier.de/tournament/CCCCCCCC-1111-4222-8333-444444444444"}
]).status,"unverified","Different verified UUID must never overwrite another event");
assert.equal(bookmarks.reconcileOfficialMetadata(correct,[{...officialRow,hasDirectLink:false}]).status,
 "unverified","A generic calendar URL cannot verify a tournament UUID");
assert.equal(bookmarks.reconcileOfficialMetadata(correct,[officialRow,officialRow]).status,
 "unverified","Ambiguous duplicate sources must not update private records");
assert.equal(bookmarks.reconcileOfficialMetadata(correct,[{...officialRow,url:"https://turniere.badminton.de/",hasDirectLink:false,place:"Gomaringen"}]).status,
 "unverified","Venue-only matches are forbidden");
const calendarMatch=bookmarks.reconcileOfficialMetadata(bookmarks.normalizeBookmark(calendar),[
 {key:calendar.id,url:"https://turniere.badminton.de/",hasDirectLink:false,
  title:calendar.name,start:calendar.startDate,end:calendar.endDate,
  place:"Lübeck",deadline:"2026-10-31"}]);
assert.equal(calendarMatch.status,"matched","An exact imported DBV calendar ID identifies its own event");
assert.equal(calendarMatch.updated.place,"Lübeck");
assert.equal(calendarMatch.updated.deadline,"2026-10-31");
assert.equal(bookmarks.reconcileOfficialMetadata(bookmarks.normalizeBookmark(calendar),
 [{...officialRow,key:"dbv-calendar-00000"}]).status,"unverified",
 "Another DBV calendar ID must not overwrite this event");

assert.equal(bookmarks.normalizeBookmark({...calendar,id:"dbv-calendar-OTHER"}),null);
assert.equal(bookmarks.normalizeBookmark({...calendar,url:"https://example.com/"}),null);
assert.equal(bookmarks.normalizeBookmark({...calendar,playerId:"all"}),null,"Calendar entries must be linked to one real own profile");
assert.equal(bookmarks.normalizeBookmark({...calendar,endDate:"2026-10-04"}),null);
const withCalendar={players:[{id:"05-070879"}],officialLinks:[bookmarks.normalizeBookmark({...calendar,startDate:"2026-10-11",endDate:"2026-10-11"})]};
assert.equal(bookmarks.hasTournamentToday(withCalendar,"2026-10-11"),false,
 "Merely planning a calendar event must not unlock live matchday or imply confirmed participation");

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
assert.equal(bookmarks.hasTournamentToday({...state,players:[{id:"05-070879"},{id:"05-071969"}]},"2026-10-11"),true,
 "Any locally owned participant may activate the matchday tab");
assert.equal(bookmarks.hasTournamentToday({...state,players:[{id:"05-123456"}],officialLinks:[owned[4]]},"2026-10-11"),false,
 "Following-only or unrelated profiles cannot activate a tournament bookmark");
assert.equal(bookmarks.hasTournamentToday({...state,players:[{id:"05-070879"}]},"2026-10-12"),false,
 "Tab disappears the next day without matching dates");
assert.equal(bookmarks.hasTournamentToday({...state,players:[{id:"05-070879"}],officialLinks:[{playerId:"all",startDate:"2026-10-10",endDate:"2026-10-12"}]},"2026-10-11"),true,
 "Multi-day tournament is active throughout its stated range");
assert.deepEqual(owned.map(p=>p.id),["future","past","today","unknown","other"],
 "Sorting must not mutate saved local bookmark order");
assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|localStorage|service_role|supabaseUrl/i);

const appSource=await readFile("app.js","utf8");
const prefillStart=appSource.indexOf("function prefillVerifiedTournamentForm(form){");
const prefillEnd=appSource.indexOf("\nfunction openTournamentForm(",prefillStart);
assert.ok(prefillStart>=0&&prefillEnd>prefillStart,"Verified tournament form helper must exist");
function testPrefill(rows,link){
 const note={hidden:true,textContent:""};
 const values={url:link,playerId:"05-070879",name:"3. E-RLT Gomaringen",
  startDate:"2026-11-15",endDate:"2026-11-15",place:"",deadline:""};
 const fields=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{value}]));
 const form={values,elements:{namedItem:key=>fields[key]||null}};
 class MockFormData{constructor(source){this.source=source}get(key){return this.source.values[key]||""}}
 const scope=vm.createContext({el:key=>key==="tournament-official-source"?note:null,
  FormData:MockFormData,parseDbvTournamentLink:bookmarks.parseDbvTournamentLink,
  normalizeBookmark:bookmarks.normalizeBookmark,SchmetterlingeBookmarks:bookmarks,
  verifiedCalendarRows:rows});
 vm.runInContext(appSource.slice(prefillStart,prefillEnd),scope);
 scope.prefillVerifiedTournamentForm(form);
 return {note,fields};
}
const noCalendarPrefill=testPrefill([],url);
assert.equal(noCalendarPrefill.note.hidden,false,"Unavailable official data must not silently look verified");
assert.match(noCalendarPrefill.note.textContent,/nicht verfügbar.*ungeprüft/);
assert.equal(noCalendarPrefill.fields.startDate.value,"2026-11-15","Unverified form must not change the date");
const otherUuid="CCCCCCCC-1111-4222-8333-444444444444";
const wrongIdentityPrefill=testPrefill([{...officialRow,url:"https://dbv.turnier.de/tournament/"+otherUuid}],url);
assert.equal(wrongIdentityPrefill.note.hidden,false,"Unmatched UUID needs explicit feedback");
assert.match(wrongIdentityPrefill.note.textContent,/nicht eindeutig bestätigt.*ungeprüft/);
assert.equal(wrongIdentityPrefill.fields.place.value,"","Wrong UUID must never inject a venue");
const genericCalendarPrefill=testPrefill([{...officialRow,url:"https://turniere.badminton.de/",hasDirectLink:false}],url);
assert.match(genericCalendarPrefill.note.textContent,/nicht eindeutig bestätigt.*ungeprüft/,
 "A generic DBV calendar landing page is not proof of a tournament UUID");
assert.equal(genericCalendarPrefill.fields.startDate.value,"2026-11-15",
 "Unverified calendar landing pages must not silently overwrite the event date");
const matchedPrefill=testPrefill([officialRow],url);
assert.equal(matchedPrefill.note.hidden,false);
assert.match(matchedPrefill.note.textContent,/Spieltag.*Meldeschluss/);
assert.equal(matchedPrefill.fields.startDate.value,"2026-11-22","Only verified UUID corrects the game date");
assert.equal(matchedPrefill.fields.deadline.value,"2026-11-15","Registration deadline stays separate");
assert.equal(testPrefill([officialRow],"https://invalid.example/").note.hidden,true);


// #386: A calendar reminder without a turnier.de UUID must have a local,
// optional venue editor while preserving the actual official key and game day.
const venueCalendar=bookmarks.normalizeBookmark({
 source:"dbv-calendar",id:"dbv-calendar-44094",
 url:"https://turniere.badminton.de/",name:"Synthetischer Kalendertermin",
 playerId:"99-000001",startDate:"2026-11-22",endDate:"2026-11-22",
 deadline:"2026-11-15",place:""
});
const typed=bookmarks.updateLocalCalendarVenue(venueCalendar,"  Sporthalle Musterort  ");
assert.ok(typed,"Manual venue correction should accept safe local text");
assert.equal(typed.place,"Sporthalle Musterort");
assert.equal(venueCalendar.place,"","Manual correction must not mutate original record");
for(const key of ["id","url","source","name","playerId","startDate","endDate","deadline"])
 assert.equal(typed[key],venueCalendar[key],"Manually entered venue must preserve local calendar identity: "+key);

assert.equal(bookmarks.updateLocalCalendarVenue(typed,"").place,"",
 "User may clear an incorrect manually entered venue");
assert.equal(bookmarks.updateLocalCalendarVenue(venueCalendar,"X".repeat(121)),null);
assert.equal(bookmarks.updateLocalCalendarVenue(venueCalendar,"Broken\\nLocation"),null);
assert.equal(bookmarks.updateLocalCalendarVenue(bookmarks.normalizeBookmark({
 url,playerId:"99-000001",name:"Direct UUID"}),"Wrong venue"),null,
 "A verified turnier.de link must use its existing full editor");
const officialCalendarVenue=bookmarks.reconcileOfficialMetadata(typed,[{
 key:venueCalendar.id,url:"https://turniere.badminton.de/",hasDirectLink:false,
 title:venueCalendar.name,start:venueCalendar.startDate,end:venueCalendar.endDate,
 deadline:venueCalendar.deadline,place:"DBV offiziell bestätigte Halle"
}]);
assert.equal(officialCalendarVenue.status,"matched");
assert.equal(officialCalendarVenue.updated.place,"DBV offiziell bestätigte Halle",
 "Later exact calendar key confirmation must supersede a manually entered venue");
const [venueMarkup,appVenueSource]=await Promise.all([
 readFile("index.html","utf8"),readFile("app.js","utf8")
]);
assert.match(venueMarkup,/id="tournament-venue-dialog"/);
assert.match(venueMarkup,/id="tournament-venue-form"/);
assert.match(venueMarkup,/id="tournament-venue-place"[^>]*name="place"/);
assert.match(appVenueSource,/data-edit-venue-id=/);
assert.match(appVenueSource,/updateLocalCalendarVenue\\(current,raw\\)/);
assert.doesNotMatch(appVenueSource,/updateLocalCalendarVenue\\([^)]*url/i,
 "A venue-only edit must never infer new official UUIDs");

console.log("Tournament bookmarks v61: official URL, strict calendar dates, Berlin day, own/friend boundaries and stable sort verified.");

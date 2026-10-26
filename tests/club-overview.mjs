import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {clubChoices,buildClubRows,filterClubRows,DEFAULT_CLUB} from "../scripts/club-overview-model.mjs";
const official={schemaVersion:1,clubId:"10777",sourceSeason:"2025/26",sourceKind:"official_club_team_photo_captions",
 teams:["I","II","III","IV","V"].map((team,i)=>({team,sourceUrl:"https://www.spvgg.org/abteilungen/badminton/mannschaften/"+(i+1)+"-mannschaft",
 members:i===0?["Spieler Eins","Spieler Zwei","Spieler Drei","Spieler Vier","Spieler Fünf"]:["Spieler Eins",...Array.from({length:5},(_,j)=>"Testname "+ "ABCDE"[i] +" "+"ABCDE"[j])]}))};
const profiles=[{id:"05-123456",name:"Jugend Muster",club:"SpVgg Mössingen"},
 {id:"05-654321",name:"Spieler Eins",club:"SpVgg Mössingen"},
 {id:"05-333333",name:"Anderes Kind",club:"Anderer Verein"}];
const rows=buildClubRows(official,profiles,DEFAULT_CLUB);
const sameName=rows.filter(r=>r.name==="Spieler Eins");
assert.equal(sameName.length,2,"A name-only match is not a verified identity");
const rosterEntry=sameName.find(r=>r.source==="Vereinsquelle");
const deviceEntry=sameName.find(r=>r.source==="Nur lokal");
assert.ok(rosterEntry&&deviceEntry,"Source and local player remain separate");
assert.equal(rosterEntry.teams.length,5,"All official roster memberships retained");
assert.equal(rosterEntry.dbvId,"","Never copy local DBV ID into an unverified roster caption");
assert.equal(rosterEntry.localPlayerId,undefined,"No wrong-player navigation from an official roster caption");
assert.equal(rosterEntry.ageClass,"","Never copy local youth age to an unknown roster person");
assert.equal(deviceEntry.dbvId,"05-654321","Keep locally-owned identity on separate device row");
assert.equal(deviceEntry.teams.length,0,"Never infer team membership solely by name");
assert.equal(deviceEntry.localNameMatch,true,"Warn that the name is not verified");
assert.equal(rows.find(r=>r.name==="Jugend Muster").source,"Nur lokal","No games needed to appear");
assert.equal(rows.find(r=>r.name==="Jugend Muster").ageClass,"","Never infer age class from birth year");
assert.equal(rows.length,27,"All source names and separate local profiles shown without caps");
assert.deepEqual(filterClubRows(rows,{team:"I"}).map(r=>r.name).sort(),["Spieler Eins","Spieler Fünf","Spieler Vier","Spieler Zwei","Spieler Drei"].sort());
assert.equal(filterClubRows(rows,{query:"05-123456"}).length,1);
assert.equal(filterClubRows(rows,{age:"unknown"}).length,rows.length);
assert.deepEqual(clubChoices(profiles),[DEFAULT_CLUB,"Anderer Verein"]);
assert.equal(buildClubRows(official,profiles,"Anderer Verein").length,1);
assert.equal(buildClubRows(null,[],DEFAULT_CLUB).length,0);
const homonyms=buildClubRows(official,[...profiles,
 {id:"05-999999",name:"Spieler Eins",club:"SpVgg Mössingen",ageClass:"U15"}],DEFAULT_CLUB);
const same=homonyms.filter(r=>r.name==="Spieler Eins");
assert.equal(same.length,3,"Two local homonyms must never collapse into official club roster identity");
assert.deepEqual(same.filter(r=>r.local).map(r=>r.dbvId).sort(),["05-654321","05-999999"]);
assert.equal(same.find(r=>r.source==="Vereinsquelle").dbvId,"");
const [html,css,worker]=await Promise.all(["index.html","club-overview.css","sw.js"].map(f=>readFile(f,"utf8")));
assert.match(html,/id="view-verein"/);
assert.match(html,/data-page="verein"/);
assert.match(css,/@media\(min-width:1080px\)/);
assert.match(css,/\.bottom-nav \.desktop-club-nav\{display:flex!important\}/);
assert.match(worker,/\.\/club-overview\.js/);
console.log("Desktop club: roster completeness, deduplication, search/filter, offline assets and desktop-only navigation passed.");

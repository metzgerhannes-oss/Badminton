import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {clubChoices,buildClubRows,filterClubRows,DEFAULT_CLUB} from "../scripts/club-overview-model.mjs";
const official={schemaVersion:1,clubId:"10777",sourceSeason:"2025/26",sourceKind:"official_club_team_photo_captions",
 teams:["I","II","III","IV","V"].map((team,i)=>({team,sourceUrl:"https://www.spvgg.org/abteilungen/badminton/mannschaften/"+(i+1)+"-mannschaft",
 members:i===0?["Spieler Eins","Spieler Zwei","Spieler Drei","Spieler Vier","Spieler Fünf"]:["Spieler Eins",...Array.from({length:5},(_,j)=>"Testname "+i+" "+j)]}))};
const profiles=[{id:"05-123456",name:"Jugend Muster",club:"SpVgg Mössingen"},
 {id:"05-654321",name:"Spieler Eins",club:"SpVgg Mössingen"},
 {id:"05-333333",name:"Anderes Kind",club:"Anderer Verein"}];
const rows=buildClubRows(official,profiles,DEFAULT_CLUB);
assert.equal(rows.filter(r=>r.name==="Spieler Eins").length,1,"Team names never duplicated");
assert.equal(rows.find(r=>r.name==="Spieler Eins").teams.length,5,"All memberships retained");
assert.equal(rows.find(r=>r.name==="Spieler Eins").localNameMatch,true,"Name-only pairing marked provisional");
assert.equal(rows.find(r=>r.name==="Jugend Muster").source,"Nur lokal","No games needed to appear");
assert.equal(rows.find(r=>r.name==="Jugend Muster").ageClass,"","Never infer age class from birth year");
assert.equal(rows.length,26,"All names and local players shown without a 12/40 cap");
assert.deepEqual(filterClubRows(rows,{team:"I"}).map(r=>r.name).sort(),["Spieler Eins","Spieler Fünf","Spieler Vier","Spieler Zwei","Spieler Drei"].sort());
assert.equal(filterClubRows(rows,{query:"05-123456"}).length,1);
assert.equal(filterClubRows(rows,{age:"unknown"}).length,rows.length);
assert.deepEqual(clubChoices(profiles),[DEFAULT_CLUB,"Anderer Verein"]);
assert.equal(buildClubRows(official,profiles,"Anderer Verein").length,1);
assert.equal(buildClubRows(null,[],DEFAULT_CLUB).length,0);
const [html,css,worker]=await Promise.all(["index.html","club-overview.css","sw.js"].map(f=>readFile(f,"utf8")));
assert.match(html,/id="view-verein"/);
assert.match(html,/data-page="verein"/);
assert.match(css,/@media\(min-width:1080px\)/);
assert.match(css,/\.bottom-nav \.desktop-club-nav\{display:flex!important\}/);
assert.match(worker,/\.\/club-overview\.js/);
console.log("Desktop club: roster completeness, deduplication, search/filter, offline assets and desktop-only navigation passed.");

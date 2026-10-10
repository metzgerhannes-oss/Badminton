import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ownAgeClass,matchEventClass,classifyMatchAge,ageContextBreakdown}
 from "../scripts/match-age-context.mjs";

const ext=(source_key,event,won,match_year=2026,category="tournament")=>({
 source_key,event,match_year,category,won,match_date:match_year+"-06-01"
});
test("youth classes depend on year of competition, not today's ranking",()=>{
 assert.equal(ownAgeClass(2016,2026),"U11");
 assert.equal(ownAgeClass(2014,2026),"U13");
 assert.equal(ownAgeClass(2010,2026),"U17");
 assert.equal(ownAgeClass(2010,2024),"U15");
 assert.equal(ownAgeClass(2018,2026),"U9");
 assert.equal(ownAgeClass(2007,2026),"U22");
 assert.equal(ownAgeClass(2000,2026),null);
 assert.equal(ownAgeClass(null,2026),null);
 assert.equal(ownAgeClass(2016,2014),null);
});
test("only an unambiguous event's U-class can determine classification",()=>{
 assert.equal(matchEventClass("ME U17"),"U17");
 assert.equal(matchEventClass("MxD U 19"),"U19");
 assert.equal(matchEventClass("JE U11 [SG]"),"U11");
 assert.equal(matchEventClass("ME U13 / U15"),null);
 assert.equal(matchEventClass("2. D-RLT U11-U19"),null);
 assert.equal(matchEventClass("DD A"),null);
 assert.equal(matchEventClass("DE"),null);
});
test("one year can have own and higher tournaments; league is not inferred",()=>{
 assert.deepEqual(classifyMatchAge(ext("a","ME U17",true),2010),{
  category:"own",own:"U17",event:"U17",year:2026
 });
 assert.equal(classifyMatchAge(ext("b","ME U19",false),2010).category,"higher");
 assert.equal(classifyMatchAge(ext("c","DD",false,2026,"league"),2010).category,"unclassified");
 assert.equal(classifyMatchAge(ext("d","ME U17/U19",false),2010).category,"unclassified");
 assert.equal(classifyMatchAge(ext("e","ME U15",false),2010).category,"unclassified");
 assert.equal(classifyMatchAge(ext("f","ME U15",false,2024),2010).category,"own");
 assert.equal(classifyMatchAge(ext("g","ME U17",false,2024),2010).category,"higher");
 assert.equal(classifyMatchAge(ext("h","ME U19",false,2026),null).category,"unclassified");
 assert.equal(classifyMatchAge({event_code:"MS U15",match_date:"2024-10-09"},2010,{official:true}).category,"own");
 assert.equal(classifyMatchAge({event_code:"MD U17",match_date:"2024-10-09"},2010,{official:true}).category,"higher");
});
test("optional filter preserves actual wins/losses; no double counting",()=>{
 const details=[
  ext("a","ME U17",false),ext("b","ME U19",false),
  ext("c","ME U19",true),ext("d","DE",false,2026,"league"),
  ext("e","ME U17",true)
 ];
 const base={details,total:details.length,wins:2,losses:3,excluded:2};
 const all=ageContextBreakdown(base,2010);
 assert.deepEqual({total:all.total,wins:all.wins,losses:all.losses}, {total:5,wins:2,losses:3});
 assert.deepEqual(all.buckets,{own:{wins:1,losses:1},higher:{wins:1,losses:1},unclassified:{wins:0,losses:1}});
 assert.equal(all.excluded,2);
 assert.equal(all.details.length,5);
 assert.equal(ageContextBreakdown(base,2010,{filter:"own"}).rate,50);
 assert.equal(ageContextBreakdown(base,2010,{filter:"higher"}).losses,1);
 assert.equal(ageContextBreakdown(base,2010,{filter:"unclassified"}).total,1);
 assert.equal(ageContextBreakdown(base,2010,{filter:"own"}).total+
  ageContextBreakdown(base,2010,{filter:"higher"}).total+
  ageContextBreakdown(base,2010,{filter:"unclassified"}).total,all.total);
 assert.equal(ageContextBreakdown({details:[]},2010,{filter:"own"}).rate,null);
});
test("frontend consumes database birth year and marks individual proofs",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const js=readFileSync(new URL("../stats.js",import.meta.url),"utf8");
 const sw=readFileSync(new URL("../sw.js",import.meta.url),"utf8");
 assert.match(html,/id="match-stats-age"/);
 assert.match(html,/id="match-stats-age-summary"/);
 assert.match(js,/queryBirthYear/);
 assert.match(js,/ageContextBreakdown/);
 assert.match(js,/match-stats-age.*addEventListener/);
 assert.match(js,/AK nicht zuordenbar/);
 assert.match(sw,/scripts\/match-age-context\.mjs/);
});

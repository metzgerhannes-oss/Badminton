import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
const [html,controller,radar,event,app,css,sw]=await Promise.all([
 "index.html","matchday-view.js","live-radar.js","tournament-live.js","app.js","app-shell.css","sw.js"
].map(file=>readFile(file,"utf8")));
const count=(value,text)=>(value.match(new RegExp(text,"g"))||[]).length;
assert.equal(count(html,'id="matchday-switch"'),1);
assert.equal(count(html,'data-matchday-view="mine"'),1);
assert.equal(count(html,'data-matchday-view="all"'),1);
assert.equal(count(html,'id="live-tournament-links"'),1);
assert.equal(count(html,'id="tournament-live-filters"'),1);
assert.match(html,/<script defer src="\.\/matchday-view\.js"><\/script>/);
assert.doesNotMatch(app,/function renderLiveTournamentLinks\(/,"Duplicate external-link renderer removed");
assert.match(radar,/badmintonMatchdayMode!=="all"/,"Personal vendor watch stops when full event is active");
assert.match(event,/badmintonMatchdayMode==="all"/,"Full-event read is lazy");
assert.match(event,/badminton:matchday-mode/);
assert.match(event,/sourceHost\.replaceChildren\(\)/,"Exactly one event link, not every saved event");
assert.match(event,/sourceId=eventId\(chosen\?\.url\)/,"External source link must be validated");
assert.match(css,/data-matchday-mode="mine".*live-tournament-follow/);
assert.match(css,/data-matchday-mode="all".*live-dbv/);
assert.match(css,/data-current-view="turniere".*live-tournament-follow/);
assert.match(sw,/matchday-view\.js/);
const events={},attributes={},calls=[];
const buttons=["mine","all"].map(mode=>({
 dataset:{matchdayView:mode},addEventListener(name,fn){events[mode+":"+name]=fn},
 setAttribute(name,value){attributes[mode+":"+name]=value}
}));
const appEl={setAttribute(name,value){attributes["app:"+name]=value}};
const document={
 addEventListener(name,fn){events["doc:"+name]=fn},
 querySelector(selector){return selector===".app"?appEl:null},
 querySelectorAll(selector){return selector==="[data-matchday-view]"?buttons:[]}
};
const location={hash:"#live"};
const window={
 addEventListener(name,fn){events["window:"+name]=fn},
 dispatchEvent(event){calls.push(event.detail)}
};
class CustomEvent{constructor(type,{detail}){this.type=type;this.detail=detail}}
vm.runInNewContext(controller,{window,document,location,CustomEvent});
events["doc:DOMContentLoaded"]();
assert.equal(window.badmintonMatchdayMode,"mine");
assert.equal(attributes["mine:aria-pressed"],"true");
assert.equal(attributes["all:aria-pressed"],"false");
events["all:click"]();
assert.equal(window.badmintonMatchdayMode,"all");
assert.equal(attributes["all:aria-pressed"],"true");
assert.equal(attributes["mine:aria-pressed"],"false");
assert.equal(calls.at(-1).mode,"all");
location.hash="#turniere";events["window:hashchange"]();
assert.equal(calls.at(-1).live,false);
location.hash="#live";events["window:hashchange"]();
assert.equal(window.badmintonMatchdayMode,"mine","Every new entry into LIVE starts at My Games");
console.log("Simplified LIVE: two exclusive views, single source link, lazy data and initial state.");

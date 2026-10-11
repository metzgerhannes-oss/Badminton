import assert from "node:assert/strict";
import {classifyNonPlayedCard} from "../scripts/nonplayed-rounds.mjs";
const card=(result,opponent="Other")=>'<div class="sp-match-body">'+
 '<div class="sp-side sp-side--home"><span class="sp-name-full">Self</span></div>'+
 '<div class="sp-result-col">'+result+'</div>'+
 '<div class="sp-side sp-side--away">'+
 (opponent?'<span class="sp-name-full">'+opponent+'</span>':"")+'</div></div>';
const match='<div class="sp-set-score"><span class="sp-s">21</span><span class="sp-s">14</span></div>';
assert.equal(classifyNonPlayedCard(card("<span>BYE</span>")),"confirmed_bye_rast");
for(const word of ["Rast","Rust","Freilos","Spielfrei"])
 assert.equal(classifyNonPlayedCard(card("",word)),"confirmed_bye_rast");
assert.equal(classifyNonPlayedCard(card("<span>W.O.</span>")),"marked_walkover");
assert.equal(classifyNonPlayedCard(card("","")),"unscored_without_opponent");
assert.equal(classifyNonPlayedCard(card("")),"unscored_with_opponent");
assert.equal(classifyNonPlayedCard(card(match+match,"Rust")),null,
 "A normally scored match against a player named Rust must remain countable");
assert.equal(classifyNonPlayedCard(card(match+"<span>BYE</span>")),"conflicting_bye_with_scores");
assert.equal(classifyNonPlayedCard(card(match+match)),null);
assert.equal(classifyNonPlayedCard(""),null);
console.log("Nonplayed BYE/Rast and scoreless/WO categories cannot become wins.");

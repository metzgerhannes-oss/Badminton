import assert from "node:assert/strict";
import {readBoundedText,PayloadTooLargeError} from "../supabase/functions/history-match-import/bounded-request.mjs";
import {readFile} from "node:fs/promises";
import {reconcileMatchBatch,selectUnstoredScoreless,assessMatchCardCoverage} from "../supabase/functions/history-match-import/source-availability.mjs";
const cards=["new","old-1","old-2","old-3"].map(source_key=>({source_key}));
const before=["old-1","old-2","old-3"];
const first=reconcileMatchBatch(cards,before,2);
assert.deepEqual(first.selected.map(x=>x.source_key),["new"],"A new source card before the old cursor must be imported");
assert.equal(first.remaining_eligible,0);
assert.equal(first.progress,4);
assert.equal(first.finished,true);
const fresh=reconcileMatchBatch(cards,[],2);
assert.deepEqual(fresh.selected.map(x=>x.source_key),["new","old-1"]);
assert.equal(fresh.remaining_eligible,2);
assert.equal(fresh.finished,false);
const second=reconcileMatchBatch(cards,["new","old-1"],2);
assert.deepEqual(second.selected.map(x=>x.source_key),["old-2","old-3"]);
assert.equal(second.remaining_eligible,0);
assert.equal(second.finished,true);
const shortened=reconcileMatchBatch(cards.slice(0,2),["old-1","old-2","old-3"]);
assert.equal(shortened.remaining_eligible,0);
assert.equal(shortened.progress,2);
assert.throws(()=>reconcileMatchBatch([cards[0],cards[0]],[]),/duplicate/);
assert.throws(()=>reconcileMatchBatch(cards,[],121),/invalid/);
const scorelessCards=[
 {source_key:"old-dash",outcome_evidence:"badhub-bold-dash"},
 {source_key:"new-dash",outcome_evidence:"badhub-bold-dash"},
 {source_key:"normal",outcome_evidence:"score"},
 {source_key:"new-dash-2",outcome_evidence:"badhub-bold-dash"}
];
assert.deepEqual(selectUnstoredScoreless(scorelessCards,new Set(["old-dash"])).map(x=>x.source_key),
 ["new-dash","new-dash-2"],"Known scoreless facts must not be rewritten or counted as new");
assert.deepEqual(selectUnstoredScoreless(scorelessCards,new Set(["old-dash","new-dash","new-dash-2"])),[],
 "Repeated on-demand import must produce no redundant scoreless upserts");
assert.throws(()=>selectUnstoredScoreless(scorelessCards,null),/invalid/);
// A 120-card batch must never write 120 regular cards PLUS unbounded scoreless.
const large=[...Array.from({length:125},(_,i)=>({source_key:`normal-${i}`})),
 ...Array.from({length:8},(_,i)=>({source_key:`dash-${i}`,outcome_evidence:"badhub-bold-dash"}))];
const priority=reconcileMatchBatch(large,[],120);
assert.equal(priority.selected.length,120,"Quota applies to all evidence combined");
assert.deepEqual(priority.selected.slice(0,8).map(x=>x.source_key),
 Array.from({length:8},(_,i)=>`dash-${i}`),"New scoreless cards take priority");
assert.equal(priority.remaining_eligible,13,"Remaining reflects actual unpersisted keys");
assert.equal(priority.progress,120);
assert.equal(priority.finished,false);
const after=reconcileMatchBatch(large,priority.selected.map(x=>x.source_key),120);
assert.equal(after.selected.length,13);
assert.equal(after.remaining_eligible,0);
assert.equal(after.finished,true);
// Third-party HTML can omit or lie about Content-Length: bound actual bytes.
const unicode=new TextEncoder().encode("äöü");
const chunks=new ReadableStream({start(controller){
 controller.enqueue(unicode.slice(0,1));controller.enqueue(unicode.slice(1));controller.close();
}});
assert.equal(await readBoundedText(new Response(chunks),unicode.byteLength),"äöü");
assert.equal(await readBoundedText(new Response("12345"),5),"12345");
let cancelled=false;
const endless=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(3));},
 cancel(){cancelled=true;}});
await assert.rejects(readBoundedText(new Response(endless),5),PayloadTooLargeError);
assert.equal(cancelled,true,"Oversized response stream must be cancelled");
await assert.rejects(readBoundedText(new Response("ok",{headers:{"content-length":"99"}}),5),PayloadTooLargeError);
let rejectedHeaderStreamCancelled=false;
const rejectedHeaderStream=new ReadableStream({
 start(controller){controller.enqueue(new Uint8Array([65,66]));},
 cancel(){rejectedHeaderStreamCancelled=true;}
});
await assert.rejects(readBoundedText(new Response(rejectedHeaderStream,{
 headers:{"content-length":"999"}
}),5),PayloadTooLargeError);
assert.equal(rejectedHeaderStreamCancelled,true,
 "Oversized Content-Length must cancel upstream HTML before body consumption");
await assert.rejects(readBoundedText(new Response("ok",{headers:{"content-length":"oops"}}),5),/invalid_content_length/);
await assert.rejects(readBoundedText(new Response(null),5),/invalid_source_body/);
const edge=await readFile("supabase/functions/history-match-import/index.ts","utf8");
assert.match(edge,/if\(!\(await isInvitedMember\(req\)\)\)/,"Membership gate remains mandatory");
assert.match(edge,/return readBoundedText\(res,5500000\)/,"External HTML must use a bounded stream");
const externalSource=edge.slice(edge.indexOf("async function source("),edge.indexOf("Deno.serve("));
assert.doesNotMatch(externalSource,/await res\.text\(\)/,"Do not buffer unbounded external HTML");
assert.match(edge,/const storedKeys=await readStoredSourceKeys\(id\)/);
assert.match(edge,/const batch=reconcileMatchBatch\(all,storedKeys,120\)/);
assert.match(edge,/const scoreless=written\.filter\(row=>row\.outcome_evidence===\"badhub-bold-dash\"\)/);
assert.doesNotMatch(edge,/all\.slice\(start,start\+120\)/,"Old cursor must not skip reordered source matches");
assert.match(edge,/on_conflict=dbv_id,source_key/,"Upserts remain idempotent");
console.log("Synthetic source-key reconciliation, reorder backfill, pagination guard and auth gate verified.");


// #199: Historical provider pages may include many explicit BYEs/WO/retirements.
// Do not classify these as played matches or as parser-layout failures.
const coverageRows=n=>Array.from({length:n},(_,i)=>({source_key:"synthetic-match-"+i}));
const coverage=(raw,valid,reasons={})=>[{cards_seen:raw,
 items:coverageRows(valid),rejection_reasons:reasons}];
const legitimate=assessMatchCardCoverage(coverage(100,30,
 {confirmed_bye_rast:25,marked_walkover:20}));
assert.deepEqual({acceptable:legitimate.acceptable,potential:legitimate.potentialPlayed,
 nonplayed:legitimate.nonplayed,required:legitimate.required},
 {acceptable:true,potential:55,nonplayed:45,required:30},
 "Documented nonplayed cards cannot make a successful parse look broken");
assert.equal(assessMatchCardCoverage(coverage(100,30,
 {unclassified_card:45})).acceptable,false,
 "Unclassified layout drift must remain a hard error");
assert.equal(assessMatchCardCoverage(coverage(100,30,
 {conflicting_bye_with_scores:45,conflicting_walkover_with_scores:10})).acceptable,false,
 "Conflicting scores cannot be treated as a safe unplayed status");
assert.equal(assessMatchCardCoverage(coverage(100,30,
 {marked_retirement:20,marked_disqualification:25})).acceptable,true,
 "Explicit retirements and disqualifications are not played matches");
assert.equal(assessMatchCardCoverage(coverage(5,0,{confirmed_bye_rast:5})).acceptable,true,
 "A source page containing only verified BYEs does not have a broken layout");
assert.equal(assessMatchCardCoverage(coverage(100,30,
 {confirmed_bye_rast:70,unclassified_card:30})).nonplayed,70);
assert.equal(assessMatchCardCoverage(coverage(20,20)).acceptable,true,
 "The parser gate must evaluate original parsed cards, not later KO-quarantined matches");
const independentSources=[coverage(100,20)[0],coverage(200,200)[0]];
assert.equal(assessMatchCardCoverage(independentSources).acceptable,false,
 "A healthy league source must not conceal tournament parser layout drift");
assert.throws(()=>assessMatchCardCoverage(coverage(100,30,
 {confirmed_bye_rast:71})),/invalid_source_coverage_count/,
 "Nonplayed reasons may never exceed the cards actually excluded");
assert.equal(assessMatchCardCoverage([
 coverage(100,30,{confirmed_bye_rast:45})[0],
 coverage(200,150,{marked_walkover:20})[0]
]).acceptable,true,"Two independently healthy source categories remain accepted");
assert.throws(()=>assessMatchCardCoverage(coverage(10,11)),/invalid_source_coverage_count/);
assert.throws(()=>assessMatchCardCoverage(coverage(10,3,
 {confirmed_bye_rast:-1})),/invalid_source_coverage_reason/);
assert.throws(()=>assessMatchCardCoverage(coverage(10,3,
 {marked_walkover:"5"})),/invalid_source_coverage_reason/);
// Index must apply source quality before storage/reconciliation, preserving all guards.
const sourceCode=await readFile("supabase/functions/history-match-import/index.ts","utf8");
assert.match(sourceCode,/const coverage=assessMatchCardCoverage\(parsed\)/);
assert.match(sourceCode,/if\(!coverage\.acceptable\)/);
assert.match(sourceCode,/const guarded=excludeContradictoryRounds/);
assert.match(sourceCode,/const storedKeys=await readStoredSourceKeys\(id\)/);
assert.ok(sourceCode.indexOf("assessMatchCardCoverage(parsed)")<
 sourceCode.indexOf("readStoredSourceKeys(id);"),
 "Never read/write persisted keys before the source quality gate");

// #199/#131: Offline synthetic provider HTML with reordered CSS class tokens.
// The source-card count and parser must recognize the SAME cards; modifiers
// alone must not create a phantom match. No real names, IDs or network access.
const {parsePublicHistory:parseEdgeHistory}=await import("../supabase/functions/history-match-import/badhub-history-parser.mjs");
const syntheticPlayer={dbv_id:"99-000001",name:"Alex Beispiel"};
const syntheticScores='<div class="sp-result-col">'+
 '<div class="sp-set-score"><span class="sp-s">21</span><span class="sp-s">18</span></div>'+
 '<div class="sp-set-score"><span class="sp-s">21</span><span class="sp-s">13</span></div></div>';
const syntheticMatch='<div class="sp-match-item--won sp-match-item">'+
 '<div class="sp-match-body"><div class="sp-side sp-side--winner">'+
 '<span class="sp-player-name--self"><span class="sp-name-full">Alex Beispiel</span></span></div>'+
 syntheticScores+'<div class="sp-side sp-side--away">'+
 '<span class="sp-name-full">Jamie Beispiel</span></div></div></div>';
const syntheticHtml='<title>Alex Beispiel – Spielerprofil</title>'+
 '<div class="sp-tournament-card card"><strong class="sp-tournament-name">'+
 '<a href="/bwbv/turnier.php?id=777">Synthetisches Turnier</a></strong>'+
 '<span class="sp-tournament-meta">3.–4. Oct 2026</span>'+
 '<div class="compact sp-meeting"><span class="sp-t-event-badge">ME U17</span>'+
 '<div class="sp-t-phase-header">Finale</div>'+syntheticMatch+'</div></div>';
const reordered=parseEdgeHistory(syntheticHtml,syntheticPlayer,"tournament");
assert.equal(reordered.cards_seen,1,"Reordered CSS class tokens must count exactly one match card");
assert.equal(reordered.items.length,1,"Reordered CSS class tokens must preserve sourced result");
assert.equal(assessMatchCardCoverage([reordered]).acceptable,true);
const conventionalHtml=syntheticHtml
 .replace('sp-tournament-card card','card sp-tournament-card')
 .replace('compact sp-meeting','sp-meeting')
 .replace('sp-match-item--won sp-match-item','sp-match-item sp-match-item--won');
const conventional=parseEdgeHistory(conventionalHtml,syntheticPlayer,"tournament");
assert.equal(conventional.cards_seen,1);
assert.deepEqual(reordered.items,conventional.items,
 "Changing only class-token order must never change persisted source identity");
const modifierOnly=parseEdgeHistory(syntheticHtml.replace(
 'sp-match-item--won sp-match-item','sp-match-item--won'),syntheticPlayer,"tournament");
assert.equal(modifierOnly.cards_seen,0,"CSS modifier alone is not a source card");
assert.equal(modifierOnly.items.length,0,"CSS modifier alone cannot fabricate a result");

// #199/#131: Provider may reorder/add CSS tokens inside a correctly
// recognized match card. The count, parsed result and source key must agree.
// No live provider request, actual player identity or synthetic extra match.
const reorderedInnerDetails=syntheticHtml
 .replace('class="sp-tournament-name"','class="featured sp-tournament-name"')
 .replace('class="sp-tournament-meta"','class="subtle sp-tournament-meta"')
 .replace('class="sp-t-event-badge"','class="badge sp-t-event-badge"')
 .replace('class="sp-t-phase-header"','class="heading sp-t-phase-header"')
 .replaceAll('class="sp-name-full"','class="name sp-name-full"')
 .replaceAll('class="sp-set-score"','class="result sp-set-score"')
 .replaceAll('class="sp-s"','class="point sp-s"');
const reorderedDetails=parseEdgeHistory(reorderedInnerDetails,syntheticPlayer,"tournament");
assert.equal(reorderedDetails.cards_seen,1);
assert.equal(reorderedDetails.items.length,1,
 "Additional/reordered inner CSS tokens must not silently drop a played match");
assert.deepEqual(reorderedDetails.items,reordered.items,
 "CSS token order must not alter a sourced match identity or its result");
assert.equal(assessMatchCardCoverage([reorderedDetails]).acceptable,true);
const misleadingModifier=parseEdgeHistory(syntheticHtml.replace(
 'class="sp-name-full"','class="sp-name-full--alias"'),syntheticPlayer,"tournament");
assert.equal(misleadingModifier.cards_seen,1);
assert.equal(misleadingModifier.items.length,0,
 "A similarly prefixed modifier must not masquerade as the exact player-name class");
assert.equal(assessMatchCardCoverage([misleadingModifier]).acceptable,false,
 "An unparsed played card must remain quarantined, not reported as complete");

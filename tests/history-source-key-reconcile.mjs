import assert from "node:assert/strict";
import {readBoundedText,PayloadTooLargeError} from "../supabase/functions/history-match-import/bounded-request.mjs";
import {readFile} from "node:fs/promises";
import {reconcileMatchBatch,selectUnstoredScoreless} from "../supabase/functions/history-match-import/source-availability.mjs";
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

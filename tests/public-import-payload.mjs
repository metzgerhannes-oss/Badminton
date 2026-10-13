import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PayloadTooLargeError,readBoundedJson} from "../supabase/functions/history-match-import/bounded-request.mjs";

const url="https://example.invalid/functions/v1/history-match-import";
const make=(body,headers={})=>new Request(url,{method:"POST",body,headers});
assert.deepEqual(await readBoundedJson(make('{"dbv_id":"05-070879"}')),{dbv_id:"05-070879"});
const exact=JSON.stringify({value:"x".repeat(1024-12)});
assert.equal(Buffer.byteLength(exact),1024);
assert.deepEqual(await readBoundedJson(make(exact)),{value:"x".repeat(1024-12)});
await assert.rejects(readBoundedJson(make("x".repeat(1025))),PayloadTooLargeError);
await assert.rejects(readBoundedJson(make("x",{"content-length":"1025"})),PayloadTooLargeError);
await assert.rejects(readBoundedJson(make("x",{"content-length":"bad"})),SyntaxError);
await assert.rejects(readBoundedJson(make("not json")),SyntaxError);
assert.deepEqual(await readBoundedJson(make("{}",{"content-length":"1"})),{}); // Validate actual streamed bytes, not the hint.
// Streaming uploads with no Content-Length cannot circumvent the byte limit.
let cancelled=false;
const stream=new ReadableStream({
 start(controller){
  controller.enqueue(new TextEncoder().encode('{"a":"'));
  controller.enqueue(new Uint8Array(1025).fill(65));
 },
 cancel(){cancelled=true;}
});
await assert.rejects(readBoundedJson(make(stream)),PayloadTooLargeError);
assert.equal(cancelled,true);
// A unicode code point may span multiple stream chunks.
const unicode=new TextEncoder().encode('{"name":"ä"}');
const fragmented=new ReadableStream({
 start(controller){controller.enqueue(unicode.slice(0,10));controller.enqueue(unicode.slice(10));controller.close();}
});
assert.deepEqual(await readBoundedJson(make(fragmented)),{name:"ä"});
// The public Edge entrypoint must use the bounded reader and reject before RPC claims.
const code=await readFile("supabase/functions/history-match-import/index.ts","utf8");
assert.match(code,/readBoundedJson\(req,1024\)/);
assert.match(code,/PayloadTooLargeError/);
assert.match(code,/respond\(413,\{error:"payload_too_large"\}/);
assert.ok(code.indexOf("readBoundedJson(req,1024)")<code.indexOf('rpc/claim_external_match_import'));
assert.doesNotMatch(code,/req\.json\(\)/);
assert.match(code,/claim_external_match_import/);
console.log("Public import request budget: bytes, streams, unicode, headers and early refusal verified.");

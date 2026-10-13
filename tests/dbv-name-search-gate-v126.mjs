import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [sql, welcome, friends, search] = await Promise.all([
  "database/dbv_name_search_private_gate_v126.sql",
  "welcome.js",
  "friend-search.js",
  "scripts/invitation-search.mjs"
].map(file => readFile(file,"utf8")));

// The proposed migration must never reopen the 9k-player table.
assert.match(sql,/enabled boolean not null default false/i);
assert.match(sql,/gate\.enabled and gate\.approved_at is not null/);
assert.match(sql,/revoke all on function public\.search_dbv_name_v1\(text\) from public, anon, authenticated/i);
assert.match(sql,/revoke all on private_content\.dbv_name_search_policy from public, anon, authenticated/i);
assert.doesNotMatch(sql,/grant\s+select\s+on\s+public\.players/i);
assert.doesNotMatch(sql,/grant\s+execute/i);

// Only narrow, deliberately requested, minimal identity results.
assert.match(sql,/char_length\(q\) < 3 or char_length\(q\) > 70/);
assert.match(sql,/returns table\(dbv_id text, name text, club text\)/);
assert.match(sql,/limit 10\s*;/);
assert.doesNotMatch(sql,/returns table\([^)]*birth_year/i);
assert.doesNotMatch(sql,/\boffset\s+[0-9]+/i);

// A 403 means privacy restriction; never imply a normal "no result".
assert.match(search,/error\?\.status===401\|\|error\?\.status===403/);
assert.match(welcome,/source==="restricted"/);
assert.match(welcome,/noch nicht freigeschaltet/);
assert.match(friends,/response\.status===401\|\|response\.status===403/);
assert.match(friends,/source="restricted"/);
console.log("DBV name search v126 staged securely, with no public table grants.");

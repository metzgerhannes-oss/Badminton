import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

// Static safety contract only: does NOT simulate PostgreSQL transactions or
// replace an explicitly triggered real read-only post-deploy catalog audit.
const sql=await readFile("database/dbv-identity-quota-f03.sql","utf8");
const client=await readFile("scripts/targeted-player-search.mjs","utf8");
const onboarding=await readFile("scripts/invitation-search.mjs","utf8");

for(const pattern of [
  /CREATE TABLE IF NOT EXISTS private_content\.dbv_identity_search_quota/,
  /singleton boolean PRIMARY KEY/,
  /minute_requests integer NOT NULL/,
  /day_requests integer NOT NULL/,
  /ENABLE ROW LEVEL SECURITY/,
  /REVOKE ALL ON TABLE private_content\.dbv_identity_search_quota FROM PUBLIC, anon, authenticated/,
  /LANGUAGE plpgsql VOLATILE SECURITY DEFINER/,
  /SET search_path = ''/,
  /ON CONFLICT \(singleton\) DO UPDATE SET/,
  /bucket\.minute_requests < 60/,
  /bucket\.day_requests < 1200/,
  /RETURNING true INTO admitted/,
  /IF admitted IS DISTINCT FROM true THEN/,
  /RAISE SQLSTATE 'PGRST'/,
  /'status', 429/,
  /'Retry-After'/,
  /verified_at IS NOT NULL AND p\.last_ranking_week IS NOT NULL/,
  /LIMIT 12/,
  /GRANT EXECUTE ON FUNCTION public\.search_dbv_player_identity\(text,text,text,text\)/,
]){
  assert.match(sql,pattern,"Server quota SQL contract: "+pattern);
}
assert.match(sql,/IF q !~ '\^\[\[:alpha:\]\[:digit:\] -\]\{3,70\}\$' THEN RETURN/);
assert.match(sql,/p\.name ILIKE \('%' \|\| q \|\| '%'\)/);
assert.doesNotMatch(sql,/GRANT (?:ALL|SELECT) ON (?:TABLE )?public\.players/i);
assert.doesNotMatch(sql,/(?:ip_address|client_ip|user_agent|device_id|user_id|dbv_id\s+text\s+NOT NULL)/i,
  "Quota row must not store identifiable client or player information");
assert.match(client,/if\(response\.status===429\)/,"Client handles HTTP 429");
assert.match(client,/DEFAULT_RATE_WAIT_MS=30000,MAX_RATE_WAIT_MS=300000/);
assert.match(onboarding,/if\(error\?\.status===429\)/);
assert.match(onboarding,/return \{players:combine\(\[\]\),source:onDevice\.length\?"rate-limited-device"/);
console.log("F03 DBV quota SQL safety contract: atomic global limits, no identifiers, 429, no public table access");

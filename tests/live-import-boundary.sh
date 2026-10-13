#!/usr/bin/env bash
# Explicit, harmless production smoke test for locked-down personal-data importer.
# Uses only a public publishable key and deliberately synthetic ID, no real player records or secrets.
set -euo pipefail
endpoint="https://yadexibmjmnjfmfabrug.supabase.co/functions/v1/history-match-import"
send() {
  local expected="$1";shift
  local actual
  actual="$(curl --silent --show-error --location-trusted --max-time 20 \
    --output /dev/null --write-out '%{http_code}' "$@" "$endpoint")"
  if [[ "$actual" != "$expected" ]];then
    echo "Import boundary smoke failed: expected HTTP $expected, received $actual" >&2
    exit 1
  fi
}
# The handler must reject unsupported methods without touching DB quotas.
send 405 --request GET
# Invalid JSON must be rejected before any service-RPC call.
send 400 --request POST --header 'Content-Type: application/json' --data-binary 'not-json'
# Old vulnerable versions returned 400 for this malformed oversized body.
# The new byte-bounded reader must return HTTP 413 before parsing.
oversized="$(printf '%01200d' 0 | tr '0' 'x')"
send 413 --request POST --header 'Content-Type: application/json' --data-binary "$oversized"
# A syntactically valid *synthetic* ID cannot start any private history job:
# guard runs BEFORE claim_external_match_import and all Badhub fetches.
public_key="sb_publishable_WdNC1AoOLe4rqDomSVnxWw_wq64M5kE"
send 403 --request POST --header 'Content-Type: application/json' \
  --header "apikey: $public_key" \
  --data-binary '{"dbv_id":"99-999999"}'
echo "Private importer boundary: GET=405, invalid JSON=400, oversize=413, synthetic valid ID=403."

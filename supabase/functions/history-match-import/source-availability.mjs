/** Preserve verifiable partial matches when one independently checked Badhub source is unavailable.
 * This is exclusively a result classifier; it neither fetches nor authorizes sources. */
export function assessSourceAvailability(outcomes){
 if(!Array.isArray(outcomes)||outcomes.length!==2)
  throw Error("Expected tournament and league source results");
 const categories=[{name:"Turnier",kind:"tournament"},{name:"Liga",kind:"league"}];
 const available=[],missing=[];
 outcomes.forEach((entry,i)=>{
  if(entry?.status==="fulfilled"&&typeof entry.value==="string")
   available.push({category:categories[i].kind,html:entry.value});
  else missing.push(categories[i].name);
 });
 return {available,missing};
}
export function importStatusForBatch(finished,excluded,missing){
 return finished&&excluded===0&&Array.isArray(missing)&&missing.length===0
  ?"complete":"partial";
}

/** A refresh of a previously evidenced player with zero NEW cards must not
 * reclassify recorded results as never having had a match source.
 * Pure classifier: the caller must query one actual persisted fact (not an
 * import cursor/count, which can be stale) before using this result.
 */
export function missingSourceStatus(hasStoredMatchFact){
 return hasStoredMatchFact===true?"partial":"awaiting_source";
}

/** Pure, source-key based reconciliation of one authorized player's freshly parsed cards.
 * Old numeric cursors are not completeness proof when new source cards sort before them.
 * This helper performs no network requests and never estimates missing matches. */
export function reconcileMatchBatch(rows,storedKeys,batchSize=120){
 if(!Array.isArray(rows)||!(Array.isArray(storedKeys)||storedKeys instanceof Set)||
    !Number.isInteger(batchSize)||batchSize<1||batchSize>120)
  throw Error("invalid_reconciliation_input");
 const known=new Set(storedKeys),seen=new Set(),missing=[];
 let present=0;
 for(const row of rows){
  const key=row?.source_key;
  if(typeof key!=="string"||!key||seen.has(key))throw Error("invalid_or_duplicate_source_key");
  seen.add(key);
  if(known.has(key))present++;
  else missing.push(row);
 }
 const selected=missing.slice(0,batchSize);
 const progress=present+selected.length;
 return {selected,progress,remaining_eligible:missing.length-selected.length,
  finished:progress===rows.length};
}

/** Backfill only previously unseen scoreless evidence. Rewriting already
 * persisted facts on every on-demand refresh wastes quota and makes the
 * response's 'stored' count falsely suggest new evidence. */
export function selectUnstoredScoreless(rows,storedKeys){
 if(!Array.isArray(rows)||!(Array.isArray(storedKeys)||storedKeys instanceof Set))
  throw Error("invalid_scoreless_input");
 const known=new Set(storedKeys);
 return rows.filter(row=>row?.outcome_evidence==="badhub-bold-dash"&&!known.has(row.source_key));
}

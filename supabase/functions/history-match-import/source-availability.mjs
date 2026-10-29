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
 // A newly evidenced scoreless card may precede the old cursor. Prioritize
 // it inside the SAME bounded batch, never append extra writes beyond quota.
 const scoreless=selectUnstoredScoreless(rows,known);
 const priorityKeys=new Set(scoreless.map(row=>row.source_key));
 const selected=scoreless.concat(missing.filter(row=>!priorityKeys.has(row.source_key))).slice(0,batchSize);
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


/** Validate source-parser yield without treating explicitly NON-PLAYED cards
 * or later quarantine decisions as evidence that HTML parsing failed.
 * Only documented, unambiguously unplayed source statuses reduce the
 * denominator. Ambiguous or unclassified source cards NEVER get a discount.
 * This is a pure, offline-testable guard: it neither fetches nor persists.
 */
export function assessMatchCardCoverage(parsed){
 if(!Array.isArray(parsed)||parsed.length<1||parsed.length>2)
  throw Error("invalid_source_coverage_input");
 const knownUnplayed=["confirmed_bye_rast","marked_walkover",
  "marked_retirement","marked_disqualification"];
 let sourceCards=0,parsedCards=0,documentedUnplayed=0,sourceCoverageOk=true;
 const identities=new Set();
 for(const result of parsed){
  if(!Number.isSafeInteger(result?.cards_seen)||result.cards_seen<0||
     !Array.isArray(result?.items)||!result.rejection_reasons||
     typeof result.rejection_reasons!=="object")
   throw Error("invalid_source_coverage_input");
  sourceCards+=result.cards_seen;
  parsedCards+=result.items.length;
  if(!Number.isSafeInteger(sourceCards)||!Number.isSafeInteger(parsedCards))
   throw Error("invalid_source_coverage_input");
  for(const row of result.items){
   if(typeof row?.source_key!=="string"||!row.source_key)
    throw Error("invalid_source_coverage_identity");
   identities.add(row.source_key);
  }
  let sourceUnplayed=0;
  for(const kind of knownUnplayed){
   const n=result.rejection_reasons[kind]??0;
   if(!Number.isSafeInteger(n)||n<0)throw Error("invalid_source_coverage_reason");
   sourceUnplayed+=n;
   if(!Number.isSafeInteger(sourceUnplayed))
    throw Error("invalid_source_coverage_reason");
  }
  // Never allow exclusions from one source to mask parser drift in another.
  if(result.items.length>result.cards_seen||
     sourceUnplayed>result.cards_seen-result.items.length)
   throw Error("invalid_source_coverage_count");
  const sourceIdentities=new Set(result.items.map(row=>row.source_key));
  const sourcePotential=result.cards_seen-sourceUnplayed;
  if(sourceIdentities.size<Math.floor(sourcePotential*0.55))
   sourceCoverageOk=false;
  documentedUnplayed+=sourceUnplayed;
  if(!Number.isSafeInteger(documentedUnplayed))
   throw Error("invalid_source_coverage_reason");
 }
 if(parsedCards>sourceCards)throw Error("invalid_source_coverage_count");
 const nonplayed=documentedUnplayed;
 const potentialPlayed=sourceCards-nonplayed;
 // The old 55% floor applies independently to each available source;
 // an intact league parser cannot conceal a broken tournament parser.
 const required=Math.floor(potentialPlayed*0.55);
 return {acceptable:sourceCoverageOk&&identities.size>=required,sourceCards,
  parsedCards:identities.size,nonplayed,potentialPlayed,required};
}

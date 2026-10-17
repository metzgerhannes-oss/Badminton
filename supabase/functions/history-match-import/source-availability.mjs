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

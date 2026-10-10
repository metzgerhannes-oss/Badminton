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

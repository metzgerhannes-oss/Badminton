/** Reject an entire tournament event if its source assigns multiple knockout
 * matches to a single player in the same round. Group-stage matches are
 * intentionally exempt. This never manufactures results or deletes source HTML.
 * A later, independently verified result can be reviewed separately.
 */
const KNOCKOUT=/^(?:achtelfinale|viertelfinale|halbfinale|finale|\d+[.]\/\d+[.]\s*platz)$/i;
const phase=s=>String(s||"").trim().toLocaleLowerCase("de").replace(/\s+/g," ");
function eventKey(row){
 if(row?.category!=="tournament"||typeof row.source_key!=="string")return null;
 const fields=row.source_key.split(":");
 if(fields[0]!=="tournament"||!fields[1])return null;
 return fields[1]+"|"+phase(row.event);
}
export function excludeContradictoryRounds(rows){
 const input=Array.isArray(rows)?rows:[];
 const count=new Map(),flagged=new Set();
 for(const row of input){
  const group=eventKey(row),round=phase(row?.round_label);
  if(!group||!KNOCKOUT.test(round))continue;
  const key=group+"|"+round;
  const n=(count.get(key)||0)+1;count.set(key,n);
  if(n>1)flagged.add(group);
 }
 const accepted=input.filter(r=>!flagged.has(eventKey(r)));
 return {accepted,excluded:input.length-accepted.length,affectedEvents:flagged.size};
}

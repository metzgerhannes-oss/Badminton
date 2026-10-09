/** Only verified first–fourth places become trophy-cabinet awards. */
export const TROPHY_PLACES = Object.freeze([1,2,3,4]);
export function summarizeTrophies(entries) {
  const counts = {1:0,2:0,3:0,4:0};
  const seen = new Set();
  const results = [];
  if (!Array.isArray(entries)) return {counts,total:0,results};
  for (const r of entries) {
    if (!r || r.verified !== true || !Number.isInteger(r.place) || !TROPHY_PLACES.includes(r.place)
      || typeof r.id !== "string" || !r.id.trim() || seen.has(r.id)) continue;
    seen.add(r.id);
    counts[r.place] += 1;
    results.push(r);
  }
  results.sort((a,b) => a.place - b.place || String(b.date).localeCompare(String(a.date))
    || String(a.id).localeCompare(String(b.id)));
  return {counts,total:results.length,results};
}

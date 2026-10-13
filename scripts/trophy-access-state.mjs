/** Availability is not the same thing as a verified sporting result.
 * The public privacy placeholder must never become a zero-trophy claim. */
export function trophyAccessState(feed,failed=false) {
  if(failed)return "unavailable";
  if(feed==null)return "loading";
  if(feed.privacyMode==="private")return "protected";
  return Array.isArray(feed.results)?"ready":"unavailable";
}
export function trophyAccessMessage(state) {
  if(state==="loading")return "Auszeichnungen werden geprüft. Noch keine Zahl verfügbar.";
  if(state==="protected")return "Die Platzierungen sind privat geschützt und in dieser Ansicht noch nicht berechtigt angebunden. Der Strich bedeutet unbekannt, nicht 0.";
  if(state==="unavailable")return "Die Platzierungsquelle ist derzeit nicht verfügbar. Daraus lässt sich keine Anzahl von Auszeichnungen ableiten.";
  return "";
}

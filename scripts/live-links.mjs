/** Public deep links into Badhub's real turnier-day display. No scores fabricated. */
export const LIVE_PROVIDER="Badhub";
export function badhubLiveUrl(dbvId){
 return typeof dbvId==="string" && /^\d{2}-\d{6}$/.test(dbvId)
   ? "https://badhub.de/spieler/"+dbvId+"/live" : null;
}
export function badhubCareerUrl(dbvId){
 return typeof dbvId==="string" && /^\d{2}-\d{6}$/.test(dbvId)
   ? "https://badhub.de/spieler/"+dbvId+"?saison=all&src=gesamt" : null;
}

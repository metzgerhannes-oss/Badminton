/** UI status from actual source responses. Never confuse a failed request with
 * an authoritative empty result. Pure, fixture-testable product-domain logic. */
export function matchAvailability({officialFailed=false,externalFailed=false}={}){
 if(officialFailed&&externalFailed)return {
  retry:true,emptyNote:"Spielstatistik gerade nicht erreichbar.",
  detail:"Beide Ergebnisquellen waren bei der Abfrage nicht erreichbar. Es lässt sich nicht feststellen, wie viele Spiele bereits erfasst sind."
 };
 if(officialFailed)return {
  retry:true,emptyNote:"Spielstatistik derzeit nur teilweise abrufbar.",
  detail:"Die offizielle Matchquelle war vorübergehend nicht erreichbar. Die verfügbaren Badhub-Einzelbelege sind kein vollständiger Ersatz."
 };
 if(externalFailed)return {
  retry:true,emptyNote:"Spielstatistik derzeit nur teilweise abrufbar.",
  detail:"Die Badhub-Einzelbelege waren vorübergehend nicht erreichbar. Eine leere offizielle Datenbank beweist nicht, dass ein Spieler keine Matches hat."
 };
 return {
  retry:false,emptyNote:"Noch keine einzeln belegten Spiele verfügbar.",
  detail:""
 };
}

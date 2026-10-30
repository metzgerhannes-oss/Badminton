/** A BYE/Rast advances a draw without being a played badminton match.
 * Blank opponent slots without a printed label remain unverified. */
const isolated=(s,re)=>new RegExp(">\\s*(?:"+re+")\\s*<","i").test(s);
export function classifyNonPlayedCard(card){
 if(typeof card!=="string")return null;
 const start=card.search(/class="[^"]*\bsp-match-body\b/);
 if(start<0)return null;
 const body=card.slice(start);
 const result=body.search(/class="[^"]*\bsp-result-col\b/);
 const away=body.search(/class="(?=[^"]*\bsp-side\b)(?=[^"]*\bsp-side--away\b)[^"]*"/);
 if(result<0||away<0)return null;
 // Bound the away slot: later tournament markup can contain unrelated names.
 const awayEnd=body.indexOf("</div>",away);
 const center=body.slice(result,away);
 const other=body.slice(away,awayEnd>=0?awayEnd+6:undefined);
 // Match scores can occur outside the printed result column.
 // Match exact semantic class tokens regardless of optional CSS modifiers/order.
 // Check only this match card, then let the full score validator decide.
 const scores=[...card.matchAll(/class="(?:[^"]*\s)?sp-set-score(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/div>/g)]
  .map(m=>[...m[1].matchAll(/class="(?:[^"]*\s)?sp-s(?:\s[^"]*)?"[^>]*>(\d{1,2})<\/span>/g)])
  .filter(items=>items.length===2).length;
 const bye="BYE|RAST|RUST|FREILOS|SPIELFREI";
 const walkover="W[.]?O[.]?|WALKOVER|KAMPFLOS";
 const retirement="AUFGABE|RETIRED|RETIREMENT|ABBRUCH";
 const disqualified="DISQUALIFIKATION|DISQUALIFIZIERT|DISQUALIFIED";
 // The result column can explicitly mark a BYE even with contradictory scores.
 // An opponent's surname ("Rust", "Rast") never overrides a scored match.
 if(isolated(center,bye)||(!scores&&isolated(other,bye)))
  return scores?"conflicting_bye_with_scores":"confirmed_bye_rast";
 if(isolated(center,retirement)||(!scores&&isolated(other,retirement)))
  return "marked_retirement";
 if(isolated(center,disqualified)||(!scores&&isolated(other,disqualified)))
  return "marked_disqualification";
 if(isolated(center,walkover)||(!scores&&isolated(other,walkover)))
  return scores?"conflicting_walkover_with_scores":"marked_walkover";
 if(scores)return null;
 const opponent=/class="(?:[^"]*\s)?sp-name-full(?:\s[^"]*)?"/.test(other);
 return opponent?"unscored_with_opponent":"unscored_without_opponent";
}

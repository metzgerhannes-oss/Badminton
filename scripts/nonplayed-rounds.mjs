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
 const center=body.slice(result,away),other=body.slice(away);
 const scores=(center.match(/class="[^"]*\bsp-set-score\b/g)||[]).length;
 const bye="BYE|RAST|RUST|FREILOS|SPIELFREI";
 const walkover="W[.]?O[.]?|WALKOVER|KAMPFLOS|AUFGABE";
 // The result column can explicitly mark a BYE even with contradictory scores.
 // An opponent's surname ("Rust", "Rast") never overrides a scored match.
 if(isolated(center,bye)||(!scores&&isolated(other,bye)))
  return scores?"conflicting_bye_with_scores":"confirmed_bye_rast";
 if(isolated(center,walkover)||(!scores&&isolated(other,walkover)))
  return scores?"conflicting_walkover_with_scores":"marked_walkover";
 if(scores)return null;
 const opponent=/class="[^"]*\bsp-name-full\b/.test(other);
 return opponent?"unscored_with_opponent":"unscored_without_opponent";
}

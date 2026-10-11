/**
 * Dated DBV profile totals are comparison snapshots, not live match data.
 * Do not infer individual results or a missing-match count from their difference.
 */
export const dbvMatchReferences=Object.freeze({
 "05-070879":{
  playerName:"Philipp Metzger",
  capturedOn:"2026-10-11",
  sourceName:"DBV-Spielerprofil · Mein Profil",
  sourceType:"user-provided-screenshot",
  career:{total:60,wins:26,losses:34},
  years:{"2026":{total:49,wins:21,losses:28}}
 }
});
const validTotals=x=>x&&Number.isSafeInteger(x.total)&&Number.isSafeInteger(x.wins)&&
 Number.isSafeInteger(x.losses)&&x.total>=0&&x.wins>=0&&x.losses>=0&&
 x.total===x.wins+x.losses;
export function getDbvMatchReference(id,{year="all",discipline="all",ageClass="all",category="all"}={}){
 if(discipline!=="all"||ageClass!=="all"||category!=="all")return null;
 const snapshot=dbvMatchReferences[id];
 if(!snapshot||!/^20\d{2}-\d\d-\d\d$/.test(snapshot.capturedOn))return null;
 const totals=year==="all"?snapshot.career:snapshot.years?.[String(year)];
 if(!validTotals(totals))return null;
 return {...totals,period:year==="all"?"Karriere":"Jahr "+year,
  capturedOn:snapshot.capturedOn,sourceName:snapshot.sourceName,
  sourceType:snapshot.sourceType,playerName:snapshot.playerName};
}
export function compareDbvMatchReference(reference,observed,{readFailed=false}={}){
 if(!reference)return null;
 if(readFailed||!validTotals(observed))return "unknown";
 if(reference.total!==observed.total||reference.wins!==observed.wins||
    reference.losses!==observed.losses)return "mismatch";
 return "counts-match-unverified";
}
export function dbvReferenceMessage(reference,observed,options={}){
 const comparison=compareDbvMatchReference(reference,observed,options);
 if(!reference)return "";
 if(comparison==="unknown")
  return "Der Stand der Einzelbelege ist derzeit nicht zuverlässig abrufbar. Ein Abgleich ist nicht möglich.";
 if(comparison==="mismatch")
  return "Der angezeigte Einzelbeleg-Teilbestand ("+observed.total+
   " Spiele; "+observed.wins+" Siege, "+observed.losses+
   " Niederlagen) weicht von diesem DBV-Profilstand ab. "+
   "Die Differenz ist kein Nachweis für eine bestimmte Zahl fehlender Spiele; "+
   "mehrfach erfasste oder nicht eindeutig zugeordnete Quellkarten sind möglich.";
 return "Die Summen stimmen mit diesem DBV-Profilstand überein. "+
  "Eine vollständige, einzeln bestätigte Karrierehistorie ist damit noch nicht nachgewiesen.";
}

/** Snapshot of the public Badhub career header, supplied on 11.10.2026.
 * This is an aggregate, not 62 independently audited match facts. */
export const badhubMatchReferences=Object.freeze({
 "05-070879":{
  playerName:"Philipp Metzger",capturedOn:"2026-10-11",
  sourceName:"Badhub · Turnier-Profil (Screenshot)",
  sourceUrl:"https://badhub.de/spieler/05-070879?saison=all&src=gesamt",
  career:{total:62,wins:26,losses:36}
 }
});
export function getBadhubMatchReference(id,{year="all",discipline="all",ageClass="all",category="all"}={}){
 if(year!=="all"||discipline!=="all"||ageClass!=="all"||category!=="all")return null;
 const snapshot=badhubMatchReferences[id];
 return snapshot&&validTotals(snapshot.career)?{...snapshot.career,
  capturedOn:snapshot.capturedOn,sourceName:snapshot.sourceName,sourceUrl:snapshot.sourceUrl,
  sourceType:"user-provided-screenshot",period:"Karriere"}:null;
}

/**
 * Human-confirmed clarification for historical Badhub source cards.
 * The source winner is now confirmed individually by Badhub's bold winner
 * marker in each of four named match cards. No set scores are invented.
 * This historical annotation alone does not create database facts.
 */
export const reportedPlayedWithoutScores=Object.freeze({
 "05-070879":{
  confirmedOn:"2026-10-11",
  count:4,
  confirmation:"user-reported-played",
  issue:"source-result-incomplete",
  evidence:"4 Badhub match cards with a printed dash and one bold winner: 1 Sieg, 3 Niederlagen; no scores",
  individualOutcomesVerified:true
 }
});
export function getReportedPlayedWithoutScores(id,{year="all",discipline="all",category="all"}={}){
 if(year!=="all"||discipline!=="all"||category!=="all")return null;
 const entry=reportedPlayedWithoutScores[id];
 return entry&&entry.confirmation==="user-reported-played"&&
  Number.isSafeInteger(entry.count)&&entry.count>0?{...entry}:null;
}

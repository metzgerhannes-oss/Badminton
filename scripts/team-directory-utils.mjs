/** Pure helpers for the read-only nuLiga teams directory. */
export const TEAM_FOLLOWS_KEY="schmetterlinge-followed-teams-v1";
export function normalizeFollows(raw){
 if(!Array.isArray(raw))return [];
 return [...new Set(raw.filter(x=>typeof x==="string"&&/^nuliga:[0-9]{3,7}:[1-9][0-9]?$/.test(x)))].slice(0,50);
}
export function normalizeTeamText(value){
 return String(value??"").toLocaleLowerCase("de").normalize("NFKD")
  .replace(/[\u0300-\u036f]/g,"").replace(/ß/g,"ss").replace(/[^a-z0-9]+/g," ").trim();
}
export function filterTeamRows(rows,search="",season=""){
 const words=normalizeTeamText(search).split(" ").filter(Boolean);
 return (Array.isArray(rows)?rows:[]).filter(row=>{
  if(season&&row.season!==season)return false;
  const hay=normalizeTeamText([row.club_name,row.team_label,row.league_name].join(" "));
  return words.every(word=>hay.includes(word));
 });
}
export function officialTeamUrl(raw){
 try{
  const u=new URL(String(raw));
  if(u.protocol!=="https:"||!["bwbv-badminton.liga.nu","badminton.liga.nu"].includes(u.hostname))return "";
  if(!/\/cgi-bin\/WebObjects\/nuLigaBADDE\.woa\/(?:[0-9]+\/)?wa\/(?:clubTeams|groupPage|clubMeetings|clubMeetingReport|groupMeetingReport)$/.test(u.pathname))return "";
  return u.href;
 }catch{return ""}
}
export function displayTeamName(team){return String(team?.club_name||"")+" "+String(team?.team_label||"")}
export function tablePoints(row){
 const a=row?.points_for,b=row?.points_against;
 return Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&b>=0?a+":"+b:"–";
}
export function confirmedResult(row){
 if(!["finished","forfeit"].includes(row?.status))return "";
 const a=row?.home_score,b=row?.away_score;
 return Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&b>=0?a+":"+b:"";
}

/** Fail-closed, dependency-free test selection. Browser QA always blocks production API access.
 * R0: docs/fixtures only; R1: UI and calendar; R2: identity/security/storage/CI.
 * Unknown files and changed policy are R2. Force full on manual/daily runs.
 */
import {execFileSync} from "node:child_process";
import {appendFileSync} from "node:fs";
import {pathToFileURL} from "node:url";

const FULL=[
 /^\.github\/workflows\//,
 /^scripts\/ci-test-tier\.mjs$/,
 /^tests\/ci-test-tier\.mjs$/,
 /^supabase\//,/^database\//,
 /^(?:package(?:-lock)?\.json|playwright\.config\.(?:mjs|js|ts)|index\.html|app\.js)$/,
 /^tests\/e2e\/(?:.*(?:invite|access|auth|backup|pwa|session|revocation|private|network|publication|scope).*)\.spec\.mjs$/,
 /^tests\/(?:.*(?:access|auth|invite|backup|private|security|network|scope|pwa|consent|session|storage|supabase|rls|rpc).*)\.(?:mjs|js)$/,
 /^tests\/(?:browser-qa-supabase-isolation|private-player-scope-isolation|private-trophy-revocation-race|private-rpc-error-classification)\.mjs$/,
 /^(?:app-access|private-.*|owner-.*|player-access|state-storage|welcome|backup|app-security|invite|consented-player-data|player-data-status|shared-tournaments|sw)\.js$/,
 /^scripts\/(?:private-|owner-|local-backup|auth-|player-access|shared-tournaments)/,
 /^\.(?:env|npmrc)/,
 /(?:secrets?|credentials?|tokens?)(?:\.|\/)/i,
];
const LOW=[
 /^docs\//,/^(?:README|LICENSE|CHANGELOG|CONTRIBUTING)(?:\.|$)/,
 /^tests\/(?!e2e\/)[^/]+\.(?:mjs|js|json)$/,
 /^data\/(?:test|fixtures?)\//,
 /\.(?:md|mdx|txt)$/i,
];
const UI=[
 /^(?:tests\/e2e\/.*\.spec\.mjs)$/,
 /^locales\//,
 /^scripts\/(?:dbv-calendar|match-age-context|trophy-stats|upcoming-tournaments|ux-navigation|wiki-|i18n-)/,
 /^[a-z0-9_-]+\.(?:js|mjs|css|html|svg|json|webmanifest|png|jpg|jpeg|webp)$/i,

];
export function classify(files,{eventName="pull_request"}={}){
 if(eventName==="schedule"||eventName==="workflow_dispatch")return {tier:"full",risk:"R2",reason:"periodic/manual full regression"};
 if(!Array.isArray(files)||!files.length)return {tier:"full",risk:"R2",reason:"missing diff, fail closed"};
 const normalized=files.map(p=>String(p||"").replaceAll("\\","/"));
 if(normalized.some(p=>FULL.some(re=>re.test(p))))return {tier:"full",risk:"R2",reason:"security, persistence, infrastructure or CI change"};
 if(normalized.every(p=>LOW.some(re=>re.test(p))))return {tier:"none",risk:"R0",reason:"documentation or synthetic non-browser tests only"};
 if(normalized.every(p=>LOW.some(re=>re.test(p))||UI.some(re=>re.test(p))))return {tier:"smoke",risk:"R1",reason:"UI/calendar/content change"};
 return {tier:"full",risk:"R2",reason:"unclassified path, fail closed"};
}

function changedFiles(){
 const base=process.env.CI_BASE_SHA||"";
 const head=process.env.CI_HEAD_SHA||"HEAD";
 if(!/^[0-9a-f]{40}$/i.test(base)||/^0{40}$/.test(base))throw Error("No usable base SHA");
 if(head!=="HEAD"&&!/^[0-9a-f]{40}$/i.test(head))throw Error("No usable head SHA");
 const result=execFileSync("git",["diff","--name-only","--no-renames",base,head],{encoding:"utf8",timeout:15000});
 return result.split(/\r?\n/).filter(Boolean);
}
function main(){
 let files=null;
 try{files=changedFiles()}catch(error){console.error("Tier selection falling back to full: "+error.message)}
 const result=classify(files,{eventName:process.env.GITHUB_EVENT_NAME||"pull_request"});
 console.error("Browser QA tier "+result.tier+" ("+result.risk+"): "+result.reason+"; "+(files?.length??"unknown")+" files");
 const output="tier="+result.tier+"\nrisk="+result.risk+"\n";
 if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,output);
 else process.stdout.write(output);
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)main();

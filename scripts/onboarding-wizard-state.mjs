/** Device-local onboarding state. No names, tokens or profiles are stored here. */
export const WIZARD_KEY="schmetterlinge.setupWizard.v1";
export const STEP_COUNT=4;
export function parseStep(value){
 return typeof value==="string"&&/^[0-3]$/.test(value)?Number(value):null;
}
export function nextStep(value){
 const step=parseStep(String(value));
 return step===null||step===STEP_COUNT-1?null:step+1;
}
export function isFirstProfile(previous,stored,id){
 return !Array.isArray(previous?.players)||previous.players.length===0
  ? Array.isArray(stored?.players)&&stored.players.some(player=>player?.id===id)
  : false;
}

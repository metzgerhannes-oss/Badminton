/** Choose a safe first-run order without uploading any player data. */
export function shouldOfferInstallationFirst({standalone=false,hasProfiles=false,installationRequested=false}={}){
 return installationRequested || (!standalone && !hasProfiles);
}

import assert from "node:assert/strict";
import {shouldOfferInstallationFirst} from "../scripts/welcome-flow.mjs";

// A new Safari visitor must install before storing a first local profile:
assert.equal(shouldOfferInstallationFirst({standalone:false,hasProfiles:false}),true);
// The Home Screen web app creates its profile in its own persistent storage:
assert.equal(shouldOfferInstallationFirst({standalone:true,hasProfiles:false}),false);
// Existing Safari profiles are never wiped or reset by onboarding:
assert.equal(shouldOfferInstallationFirst({standalone:false,hasProfiles:true}),false);
// The installation help remains available on demand:
assert.equal(shouldOfferInstallationFirst({standalone:true,hasProfiles:true,installationRequested:true}),true);
console.log("Welcome installation-first ordering: OK");

import {defineConfig} from "@playwright/test";
import releaseConfig from "../playwright.config.mjs";
// A separate, opt-in benchmark: never makes the ordinary R2 browser suite slower.
export default defineConfig({
 ...releaseConfig,
 testDir:".",
 testMatch:"appstart-baseline.spec.mjs",
 timeout:180000,
 fullyParallel:false,
 workers:1,
 reporter:"list",
 use:{...releaseConfig.use,trace:"off",screenshot:"off",video:"off"}
});

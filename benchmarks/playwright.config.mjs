import {defineConfig} from "@playwright/test";
import releaseConfig from "../playwright.config.mjs";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"..");
// A separate, opt-in benchmark: never makes the ordinary R2 browser suite slower.
export default defineConfig({
 ...releaseConfig,
 testDir:".",
 testMatch:"appstart-baseline.spec.mjs",
 timeout:180000,
 fullyParallel:false,
 workers:1,
 reporter:"list",
 webServer:{...releaseConfig.webServer,cwd:ROOT},
 use:{...releaseConfig.use,trace:"off",screenshot:"off",video:"off"}
});

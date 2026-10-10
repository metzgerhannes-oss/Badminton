import {defineConfig} from "@playwright/test";

export default defineConfig({
  testDir:"./tests/e2e",
  timeout:30000,
  expect:{timeout:10000},
  retries:process.env.CI?1:0,
  workers:process.env.CI?2:undefined,
  reporter:process.env.CI?[["list"],["html",{outputFolder:"playwright-report",open:"never"}]]:"list",
  use:{
    baseURL:"http://127.0.0.1:4173",
    screenshot:"only-on-failure",
    trace:"retain-on-failure",
    video:"retain-on-failure",
    serviceWorkers:"block",
    locale:"de-DE",
    timezoneId:"Europe/Berlin",
    reducedMotion:"reduce"
  },
  projects:[
    {name:"small-chromium",use:{browserName:"chromium",viewport:{width:375,height:667},
      deviceScaleFactor:2,isMobile:true,hasTouch:true}},
    {name:"mobile-webkit",use:{browserName:"webkit",viewport:{width:390,height:844},
      deviceScaleFactor:3,isMobile:true,hasTouch:true}}
  ],
  webServer:{
    command:"python3 -m http.server 4173 --bind 127.0.0.1",
    url:"http://127.0.0.1:4173",
    reuseExistingServer:!process.env.CI,
    timeout:30000
  }
});

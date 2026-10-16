/** Browser QA network contract: all Supabase API families are fulfilled locally.
 * Any real request (or CORS failure) makes this test fail, rather than falling back.
 */
import {test,expect} from "./supabase-isolated.fixture.mjs";

const ROOT="https://yadexibmjmnjfmfabrug.supabase.co";
const ENDPOINTS=[
  "/rest/v1/__qa_never_created?select=id",
  "/auth/v1/user",
  "/functions/v1/__qa_never_deployed",
  "/storage/v1/object/public/__qa_not_a_bucket/probe"
];

test("Supabase Data, Auth, Functions and Storage are intercepted without production egress",async({page})=>{
  await page.goto("/",{waitUntil:"domcontentloaded"});
  const results=await page.evaluate(async urls=>{
    return Promise.all(urls.map(async url=>{
      const response=await fetch(url,{cache:"no-store"});
      return {
        status:response.status,
        marker:response.headers.get("X-Schmetterlinge-Mock"),
        text:await response.text()
      };
    }));
  },ENDPOINTS.map(path=>ROOT+path));

  for(const result of results){
    expect(result.status).toBe(401);
    expect(result.marker).toBe("browser-qa-no-live-supabase");
    expect(result.text).toContain("non-mocked Supabase request blocked");
  }
});

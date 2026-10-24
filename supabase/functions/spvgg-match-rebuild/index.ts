/** Disabled former SpVgg staging endpoint.
 * Repository source no longer embeds named-player allowlists.
 * Supabase Edge deployments must be verified separately in the Badminton
 * project: changing this file does not change a deployed function.
 */
Deno.serve((_req:Request)=>new Response(
 JSON.stringify({ok:false,error:"reconciliation_disabled"}),
 {status:410,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}}
));

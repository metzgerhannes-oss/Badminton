/** Serializes an existing session refresh/sign-up. One promise per page load.
 * Callers share the same attempt instead of reusing a refresh token concurrently.
 */
export function createAuthSingleflight(work){
 let inFlight=null;
 return function run(create=false){
  if(inFlight)return inFlight;
  let task;
  try{task=Promise.resolve(work(create))}
  catch(error){return Promise.reject(error)}
  inFlight=task;
  void task.then(()=>{if(inFlight===task)inFlight=null},
                 ()=>{if(inFlight===task)inFlight=null});
  return task;
 };
}

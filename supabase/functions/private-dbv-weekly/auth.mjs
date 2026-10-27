// Pure constant-time scheduler-token comparison; no network or logging.
export async function tokenMatches(expected,supplied,cryptoApi=globalThis.crypto) {
  if(typeof expected!=="string"||typeof supplied!=="string"||
    expected.length<32||expected.length>256||
    supplied.length<32||supplied.length>256)return false;
  const bytes=new TextEncoder();
  const [a,b]=await Promise.all([
    cryptoApi.subtle.digest("SHA-256",bytes.encode(expected)),
    cryptoApi.subtle.digest("SHA-256",bytes.encode(supplied))
  ]);
  const x=new Uint8Array(a),y=new Uint8Array(b);
  let diff=0;
  for(let i=0;i<x.length;i++)diff|=x[i]^y[i];
  return diff===0;
}

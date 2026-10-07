// The live account feature supplies this in-memory verifier. Saves are never authority.
let verify=()=>false;
export const authorizedPaidTack=item=>verify(item);
export function setPaidTackVerifier(fn){verify=typeof fn==='function'?fn:()=>false;}

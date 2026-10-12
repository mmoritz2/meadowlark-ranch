/* A world actor can be removed or rebuilt while its breed is downloading.
 * Track the exact body group and request; a late result may populate the shared
 * breed cache, but it cannot install or clear a newer actor's request. */
export function worldHorseCanDress(actor,parts){
 return !!(actor&&parts?.group&&!actor.disposed&&actor.rigRetiredGroup!==parts.group&&(!actor.parts||actor.parts===parts));
}
export function beginWorldHorseLoad(actor,parts){
 const request={parts,group:parts.group};
 actor.rigLoadRequest=request;actor.rigPending=true;
 return request;
}
export function settleWorldHorseLoad(actor,request){
 if(actor.rigLoadRequest!==request)return false;
 actor.rigLoadRequest=null;actor.rigPending=false;
 return worldHorseCanDress(actor,request.parts)&&!!request.group.parent;
}
export function retireWorldHorse(actor){
 actor.rigRetiredGroup=actor.parts?.group||null;
 actor.rigLoadRequest=null;actor.rigPending=false;
 actor.rigTried=false;actor.rigRetryAt=0;
}

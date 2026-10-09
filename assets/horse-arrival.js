// One startup gate for optional scenery. Slow loading never opens the gate by
// timeout; an actual failure releases a terminal outcome so scenery can settle.
export function createHorseArrival(schedule=fn=>requestAnimationFrame(()=>requestAnimationFrame(fn))) {
 let ticket=null,settled=false,resolve;
 const ready=new Promise(done=>{resolve=done;});
 const finish=outcome=>{if(settled)return false;settled=true;resolve(outcome);return true;};
 return {
  ready,
  get settled(){return settled;},
  begin(next){ticket=next;},
  mounted(request,isCurrent){
   if(settled||request!==ticket||!isCurrent())return false;
   // Let the curtain and current screen present before optional decode work.
   // A breed switch during these frame opportunities invalidates the old signal.
   schedule(()=>{if(request===ticket&&isCurrent())finish({status:'ready'});});
   return true;
  },
  failed(request){return request===ticket&&finish({status:'failed'});},
 };
}

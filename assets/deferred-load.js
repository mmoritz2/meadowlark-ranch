// Share one completion promise without starting optional asset work at boot.
export function createDeferredLoad(load) {
 let started=false,resolve,reject;
 const ready=new Promise((yes,no)=>{resolve=yes;reject=no;});
 return {
  ready,
  start(){
   if(!started){
    started=true;
    try{Promise.resolve(load()).then(resolve,reject);}catch(error){reject(error);}
   }
   return ready;
  },
  get started(){return started;},
 };
}

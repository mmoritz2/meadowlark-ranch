// Grounded mounted bodies follow the terrain after a horizontal correction.
// Flight, jumps and on-foot absolute height retain their existing caller path.
export function resolveGroundedContact(solidWorld,position,{heightAt,previous=null,radius=.55,bottomOffset=.38,topOffset=2.65}={}){
 if(!solidWorld?.resolve||typeof heightAt!=='function'||!Number.isFinite(position?.x+position?.z)||!(radius>0)||!Number.isFinite(radius+bottomOffset+topOffset)||topOffset<=bottomOffset)throw new TypeError('Valid grounded collision inputs required');
 const slab=point=>{
  const height=heightAt(point.x,point.z);
  if(!Number.isFinite(height))throw new TypeError('Finite grounded collision height required');
  return {bottom:height+bottomOffset,top:height+topOffset,radius};
 };
 let contacts=0,calls=0;
 for(let pass=0;pass<4;pass++){
  const x=position.x,z=position.z;
  const hits=solidWorld.resolve(position,{...slab(position),previous});
  calls++;contacts+=hits;
  // Zero contacts as well as zero motion certifies clearance; incompatible
  // contact pushes can cancel without producing a genuinely clear pose.
  if(hits===0&&position.x===x&&position.z===z)return {contacts,calls,converged:true,restoredPrevious:false};
 }
 // A cap is not permission to leave an overlap or teleport to an untested pose.
 // Certify the former grounded position separately at its own current height.
 // No prior sweep is needed for this point-in-time clearance probe.
 if(previous&&Number.isFinite(previous.x+previous.z)){
  const probe={x:previous.x,z:previous.z};
  const hits=solidWorld.resolve(probe,slab(probe));calls++;
  if(hits===0&&probe.x===previous.x&&probe.z===previous.z){
   position.x=previous.x;position.z=previous.z;
   return {contacts,calls,converged:true,restoredPrevious:true};
  }
 }
 // Initial overlap with no certified exit remains explicit for the caller.
 return {contacts,calls,converged:false,restoredPrevious:false};
}

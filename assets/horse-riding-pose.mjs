const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Pose targets only. The authored horse animation and saddle contacts own the
// skeleton; these values keep the rider's seat in the same gait and turn.
export function sampleMountedSeat({gait='stand',phase=0,speed=0,turn=0,yawRate=0,western=false,bareback=false}={}){
 const v=Math.abs(Number(speed)||0),p=(Number(phase)||0)*Math.PI*2;
 const family=String(gait).replace(/(Left|Right)$/,'');
 const moving=v>.08||family==='walk';
 const base={stand:.055,rest:.055,walk:.065,trot:.105,canter:.17,gallop:.28,jump:.21}[family]??.065;
 const beat=Math.max(0,Math.sin(p));
 const post=family==='trot'&&!western&&!bareback;
 const follow=family==='canter'?Math.sin(p)*.018:family==='gallop'?Math.sin(p)*.025:moving?Math.sin(p)*.009:0;
 const bank=mountedHorseBank({speed:v,yawRate});
 return {lean:base+follow,postRise:post?beat*beat*.105:0,postLean:post?beat*.12:0,
  side:bank*.25+clamp(Number(turn)||0,-1,1)*.018*Math.min(1,v/2),moving,family};
}
// A broad fast turn needs balance; holding a rein at a halt does not. Limit the
// whole-body bank so an ordinary turn cannot tip a planted hoof far into turf.
export function mountedHorseBank({speed=0,yawRate=0}={}){
 if(!Number.isFinite(speed)||!Number.isFinite(yawRate))return 0;
 return clamp(Math.atan(Math.abs(speed)*yawRate/9.81)*.24,-.085,.085);
}

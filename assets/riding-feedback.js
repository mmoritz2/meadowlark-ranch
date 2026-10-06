/* Input and contact timing are independent of animation poses and travel speed. */
export function createJumpBuffer(seconds=.18){
 let held=false,remaining=0,mount=null;
 return {
  update({pressed=false,blocked=false,canStart=true,dt=0,mountKey=''}){
   if(mount!==null&&mount!==mountKey){held=pressed;remaining=0;}mount=mountKey;
   remaining=Math.max(0,remaining-Math.max(0,Number(dt)||0));
   if(blocked){remaining=0;held=pressed;return false;}
   if(pressed&&!held)remaining=seconds;
   held=pressed;return remaining>0&&canStart;
  },
  consume(){remaining=0;},
  reset(){held=false;remaining=0;mount=null;},
  get remaining(){return remaining;}
 };
}

const FALLBACK={
 walk:{HL:0,FL:.25,HR:.5,FR:.75},trot:{FL:0,HR:0,FR:.5,HL:.5},
 canterLeft:{HR:0,HL:.24,FR:.24,FL:.48},canterRight:{HL:0,HR:.24,FL:.24,FR:.48},
 gallopLeft:{HR:0,HL:.16,FR:.38,FL:.55},gallopRight:{HL:0,HR:.16,FL:.38,FR:.55},
 run:{HL:0,HR:.12,FL:.5,FR:.62}
};
// Verified against tools/dragon-motions/build-black-dragon.py. Its run uses
// diagonal pairs, unlike the generic four-beat run. Match the source kind and
// authored clip names so recolored Black Dragon variants share these timings.
const BLACK_DRAGON_CONTACTS={
 walk:{clip:'DragonWalk',stanceFraction:.73,footOffsets:{FL:0,HL:.25,FR:.5,HR:.75}},
 run:{clip:'DragonRun',stanceFraction:.52,footOffsets:{FL:0,HR:0,FR:.5,HL:.5}}
};
const cycle=n=>((n%1)+1)%1;
export function contactPattern(profile,gait,lead='left',reverse=false){
 const key=['canter','gallop'].includes(gait)?gait+(lead==='right'?'Right':'Left'):gait;
 const record=profile?.nativeGaits?.[key],known=BLACK_DRAGON_CONTACTS[key];
 const authored=profile?.nativeKind==='black-dragon'&&record?.clip===known?.clip?known:null;
 const offsets=record?.footOffsets||record?.offsets||authored?.footOffsets||FALLBACK[key];
 if(!offsets)return [];
 const groups=new Map();
 for(const [foot,offset]of Object.entries(offsets))if(['FL','FR','HL','HR'].includes(foot)&&Number.isFinite(offset)){
  // Playing a walk backward turns the forward liftoff into touchdown.
  const phase=cycle(offset+(reverse&&key==='walk'?(record?.stanceFraction??authored?.stanceFraction??0):0));if(!groups.has(phase))groups.set(phase,[]);groups.get(phase).push(foot);
 }
 return [...groups].map(([phase,feet])=>({phase,feet})).sort((a,b)=>a.phase-b.phase);
}

export function createHoofContacts(){
 let previous=null,wasAir=false;
 return {
  update({phase=0,gait='stand',lead='left',profile,grounded=true,active=true,speed=0,reverse=false,dt=0,mountKey=''}){
   if(!active){previous=null;wasAir=false;return {contacts:[],landed:false};}
   // Paused/invalid frames establish the new baseline without replaying a
   // landing later or producing a sound/dust impact at zero elapsed time.
   if(!(dt>0)||!Number.isFinite(dt)||dt>.25){previous=null;wasAir=!grounded;return {contacts:[],landed:false};}
   const landed=wasAir&&grounded;wasAir=!grounded;
   if(!grounded||speed<.2||!Number.isFinite(phase)){previous=null;return {contacts:[],landed};}
   const key=mountKey+'|'+gait+'|'+lead+'|'+reverse,p=cycle(phase),pattern=contactPattern(profile,gait,lead,reverse);
   if(!pattern.length||!previous||previous.key!==key){previous={key,p};return {contacts:[],landed};}
   const advance=cycle(reverse?previous.p-p:p-previous.p),contacts=[];
   // A discontinuity is a seek/rebase, not a burst of missed hoof strikes.
   if(advance>0&&advance<=.5){
    for(const point of pattern){const distance=cycle(reverse?previous.p-point.phase:point.phase-previous.p);
     if(distance>1e-8&&distance<=advance+1e-8)contacts.push({...point,at:distance/advance});
    }
   }
   previous={key,p};return {contacts:contacts.sort((a,b)=>a.at-b.at),landed};
  },
  reset(){previous=null;wasAir=false;}
 };
}

export function ridingSurface({waterDepth=0,pathDistance=Infinity,arena=false,bridge=false}={}){
 if(bridge)return 'wood';
 if(waterDepth>.03)return 'water';
 return arena||pathDistance<3?'soil':'grass';
}

/* A short filtered impact, with a softer body on turf and a clearer clop on
   timber. Uses the game's existing audio context, mute switch and volume. */
const noiseBuffers=new WeakMap();
export function playHoofImpact(context,{surface='soil',strength=1,volume=1,alternate=false,delay=0}={}){
 if(!context||!(volume>0))return;
 const t=context.currentTime+Math.max(0,delay),water=surface==='water',wood=surface==='wood',grass=surface==='grass';
 let noise=noiseBuffers.get(context);
 if(!noise){noise=context.createBuffer(1,Math.ceil(context.sampleRate*.12),context.sampleRate);const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;noiseBuffers.set(context,noise);}
 const amount=Math.max(.35,Math.min(1.4,strength))*volume,source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
 source.buffer=noise;filter.type='lowpass';filter.frequency.value=water?1700:wood?2800:grass?650:1300;filter.Q.value=.5;
 gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime((water?.06:grass?.025:.055)*amount,t+.003);gain.gain.exponentialRampToValueAtTime(.0001,t+(water?.1:.055));
 source.connect(filter);filter.connect(gain);gain.connect(context.destination);source.start(t);source.stop(t+.12);
 const osc=context.createOscillator(),body=context.createGain(),pitch=(wood?185:grass?78:105)*(alternate?1.12:.94);
 osc.type='sine';osc.frequency.setValueAtTime(pitch,t);osc.frequency.exponentialRampToValueAtTime(pitch*.48,t+.065);
 body.gain.setValueAtTime((water?.016:.075)*amount,t);body.gain.exponentialRampToValueAtTime(.0001,t+.075);osc.connect(body);body.connect(context.destination);osc.start(t);osc.stop(t+.085);
}

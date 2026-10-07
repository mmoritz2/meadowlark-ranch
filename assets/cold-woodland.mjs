// The existing Hollowpeak and Frostpine climate envelopes, sampled without RNG.
// Site coordinates and collision records belong to the original world planting.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const hash=(x,z,k=0)=>{const n=Math.sin(x*127.1+z*311.7+k*74.7)*43758.5453;return n-Math.floor(n);};
function noise(x,z){
 const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
 const sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);
 return mix(mix(hash(ix,iz),hash(ix+1,iz),sx),mix(hash(ix,iz+1),hash(ix+1,iz+1),sx),sz);
}
export function coldWoodlandWeights(x,z){
 const hollow=1-smooth(88,158,Math.hypot(x+160,z+210));
 const frost=1-smooth(80,128,Math.hypot(x+300,z+320));
 const alpine=1-smooth(.65,1.10,Math.hypot((x+150)/100,(z+333)/92));
 return {hollow,frost,alpine,weight:Math.max(hollow,frost,alpine)};
}
// Adult stands and their regeneration share patches of soil and shelter. A
// little site variation retains irregular edges without alternating unrelated
// adult/sapling silhouettes at every neighbouring trunk.
export function coldWoodlandProfile({x,z,height,source,elevation=0,grade=0}){
 const weights=coldWoodlandWeights(x,z),weight=weights.weight;
 if(weight<=.08)return null;
 const influence=smooth(.08,.48,weight),micro=hash(x,z,173);
 const shelter=clamp(1-smooth(14,36,elevation)*.60-smooth(.20,.65,grade)*.25,.20,1);
 const age=noise(x/37+41,z/37-19),mature=height>=6.8&&age+micro*.04>.35+(1-shelter)*.13;
 const regeneration=noise(x/24-17,z/24+63);
 const variant=Math.min(2,Math.floor(regeneration*3));
 const target=mature?'mature-pine':'pine-'+variant;
 // A sparse mixed margin joins the older planting; the snowy cores are all
 // evergreen. The input source survives untouched outside this compact support.
 const replace=weight>.35||micro<influence;
 const selected=replace?target:source;
 // Broadleaf crowns surviving in the mixed thaw margin retain their original
 // dimensions. Only an actual evergreen substitution receives conifer growth.
 if(!/^(mature-pine|pine-[012])$/.test(selected))return {...weights,source:selected,height,crownWidth:1,shelter,age};
 const adult=selected==='mature-pine';
 const treeHeight=adult?clamp(height*(1.02+.10*shelter)+(hash(x,z,179)-.5)*.8,9,16)
  :clamp(height*(.73+.11*shelter)+(hash(x,z,181)-.5)*.55,5.2,10.6);
 const width=adult?.86+hash(x,z,183)*.14:.95+hash(x,z,183)*.10;
 return {...weights,source:selected,height:mix(height,treeHeight,influence),crownWidth:mix(1,width,influence),shelter,age};
}

// Pasture stops under continuous winter cover. The compact thaw margin retains
// gradually shorter, sparser dry blades; ordinary meadows remain byte-exact.
export function coldPastureCover(x,z){
 return 1-smooth(.08,.60,coldWoodlandWeights(x,z).weight);
}
const WINTER_COVER=Object.freeze({
 tuft:{floor:0,size:.50,tint:'#c1b99b',amount:.88},
 petal:{floor:0,size:1,tint:'#ffffff',amount:0},
 brack:{floor:0,size:.52,tint:'#b8b49d',amount:.86},
 reed:{floor:.18,size:.66,tint:'#c4bfaa',amount:.80},
 scrub:{floor:.18,size:.50,tint:'#aab2a2',amount:.76},
 juni:{floor:.24,size:.54,tint:'#b3bba9',amount:.72},
 sage:{floor:.16,size:.56,tint:'#c1bca7',amount:.82},
});
export function coldCoverProfile(x,z,kind){
 const change=WINTER_COVER[kind],weight=coldWoodlandWeights(x,z).weight;
 if(!change||weight<=.08)return null;
 const pasture=coldPastureCover(x,z),winter=1-pasture;
 return {weight,pasture,density:kind==='petal'?0:change.floor+(1-change.floor)*pasture,
  size:1-winter*(1-change.size),tint:change.tint,tintAmount:winter*change.amount};
}

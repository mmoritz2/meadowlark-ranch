// Original basic riding appearance. These are renderer presets, not catalog or
// inventory entries: no ownership, prices, bonuses or save writes are supplied.
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const design={starterBasic:true,leather:'#48372b',cloth:'#ded6bd',metal:'#aaa28d',accent:'#725743',lining:'#c8bda5',pattern:'plain',trim:'plain',ornament:'none',variant:0};
export const BASIC_RIDING_TACK=freeze(Object.fromEntries([['saddle','roper'],['pad','square'],['bridle','classic']].map(([slot,profile])=>[slot,{id:'ranch_basic_'+slot,slot,visualOnly:true,design:{...design,profile}}])));
export function withBasicRidingTack(horse,equipped={}){
 if(!horse||horse.foal||horse.egg)return equipped;
 const out={...equipped};
 for(const [slot,piece]of Object.entries(BASIC_RIDING_TACK)){
  // An explicit saved slot, including invalid or unauthorized gear, must not
  // acquire a replacement. Valid equipped objects retain their exact identity.
  if(!out[slot]&&!Object.prototype.hasOwnProperty.call(horse.gear||{},slot))out[slot]=piece;
 }
 return out;
}
export const isBasicRidingTack=piece=>!!piece&&BASIC_RIDING_TACK[piece.slot]===piece;
// Extra renderer resources must not advance world layout/constructor randomness.
// The original catalog path uses its original stream. Scope is synchronous and
// always restored; an increasing private serial keeps new resource UUIDs unique.
let constructionSerial=0;
export function withBasicTackConstruction(piece,make){
 if(!isBasicRidingTack(piece))return make();
 let seed=(0x6f18a294^Math.imul(++constructionSerial,0x9e3779b1))>>>0;
 const previous=Math.random;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 try{return make();}finally{Math.random=previous;}
}

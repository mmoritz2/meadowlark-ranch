// Equipment adds to trained stats; training caps never remove equipment bonuses.
export const TACK_STATS=['speed','stamina','jump','accel','agility'];
export const TACK_SLOTS=['saddle','pad','bridle','shoes'];
const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const zeros=()=>Object.fromEntries(TACK_STATS.map(k=>[k,0]));

export function tackPieceStats(item){
 const bonus=item?.bonus||{},keys=TACK_STATS.filter(k=>bonus[k]!=null);
 const primary=keys.includes(item?.primary)?item.primary:keys.reduce((best,k)=>best==null||number(bonus[k])>number(bonus[best])?k:best,null);
 const secondary=keys.includes(item?.secondary)&&item.secondary!==primary?item.secondary:null;
 const level=Math.max(1,Math.min(8,Math.floor(number(item?.lvl,1)||1)));
 // Every paid level gives a visible gain; existing levels never lose a bonus.
 return Object.fromEntries(keys.map(k=>[k,Math.max(0,number(bonus[k]))+(k===primary?(level-1)*.5:0)+(k===secondary?(level-1)*.25:0)]));
}

export function tackStatTotals(horse,inventory=[],sets={},resolveSet=item=>item.set){
 const base=zeros(),gear=zeros(),setStats=zeros(),tack=zeros(),total=zeros(),setCounts={},seen=new Set();
 for(const k of TACK_STATS)base[k]=number(horse?.stats?.[k],3);
 for(const slot of TACK_SLOTS){
  const id=horse?.gear?.[slot];
  if(id==null||seen.has(id))continue;
  const item=inventory.find(piece=>piece.id===id&&piece.slot===slot);
  if(!item)continue;
  seen.add(id);
  const bonus=tackPieceStats(item);
  for(const k of TACK_STATS)gear[k]+=bonus[k]||0;
  const set=resolveSet(item);
  if(set&&sets[set])setCounts[set]=(setCounts[set]||0)+1;
 }
 for(const [name,count]of Object.entries(setCounts)){
  const bonus=count>=4?sets[name].four:count>=2?sets[name].two:null;
  for(const k of TACK_STATS)setStats[k]+=Math.max(0,number(bonus?.[k]));
 }
 for(const k of TACK_STATS){tack[k]=gear[k]+setStats[k];total[k]=base[k]+tack[k];}
 return {base,gear,sets:setStats,tack,total,setCounts};
}

export const formatTackStat=value=>String(Math.round(number(value)*100)/100);

// Preserve the familiar trained-stat range, then taper large equipment totals.
// Raw equipped totals still qualify for events and are shown in the locker.
export function ridingStatValue(value){
 const v=Math.max(1,number(value,3));
 return v<=10?v:10+12*(1-Math.exp(-(v-10)/12));
}
export function tackRidingPerformance(stats){
 const stat=k=>ridingStatValue(stats?.[k]),stamina=Math.max(1,number(stats?.stamina,3));
 return {
  speed:.82+.036*stat('speed'),accel:.75+.06*stat('accel'),
  agility:.80+.05*stat('agility'),jump:.92+.016*stat('jump'),
  // Even the best equipment spends stamina; it cannot turn drain into regen.
  staminaDrain:stamina<=10?1-.06*(stamina-3):.18+.40/(1+(stamina-10)/8)
 };
}

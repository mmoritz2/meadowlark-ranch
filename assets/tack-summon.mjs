// Earned-coin rewards only. Callers provide the random roll inside G.save.sync.
import {TACK_PIECES,TACK_SLOTS,ownedTackPiece,grantEarnedTackPiece} from './tack-collection.mjs';
export const TACK_SUMMON_COST=200;
export const TACK_SUMMON_POOL=Object.freeze(TACK_PIECES.filter(piece=>!piece.premiumProduct&&!piece.free&&piece.currency==='coins'&&piece.priceCoins>0));
const validSlot=slot=>slot==='all'||TACK_SLOTS.includes(slot);
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const counter=value=>value==null?0:Number.isSafeInteger(value)&&value>=0&&value<Number.MAX_SAFE_INTEGER?value:null;
export function getTackSummonPool(save,slot='all'){
 if(!validSlot(slot))return [];
 return TACK_SUMMON_POOL.filter(piece=>(slot==='all'||piece.slot===slot)&&!ownedTackPiece(save,piece.id));
}
export function summonTackPiece(save,{slot='all',roll}={}){
 const fail=(code,details={})=>({ok:false,changed:false,code,...details});
 if(!record(save)||(save.tack!=null&&!Array.isArray(save.tack))||(save.stats!=null&&!record(save.stats))||(save.tackSummon!=null&&!record(save.tackSummon)))return fail('invalid-save');
 if(!validSlot(slot))return fail('invalid-slot');
 if(!Number.isFinite(roll)||roll<0||roll>=1)return fail('invalid-roll');
 const count=counter(save.tackSummon?.count),statCount=counter(save.stats?.tackSummons);
 if(count===null||statCount===null)return fail('invalid-save');
 const pool=getTackSummonPool(save,slot),poolSize=pool.length;
 if(!poolSize)return fail('complete',{cost:TACK_SUMMON_COST,poolSize});
 if(!Number.isFinite(save.coins)||save.coins<TACK_SUMMON_COST)return fail('insufficient-coins',{cost:TACK_SUMMON_COST,needed:TACK_SUMMON_COST,poolSize});
 const piece=pool[Math.floor(roll*poolSize)],grant=grantEarnedTackPiece(save,piece.id);
 if(!grant.ok||!grant.changed)return fail(grant.code);
 // All validation precedes this commit; grant uses the boutique's exact schema.
 save.coins-=TACK_SUMMON_COST;
 save.tackSummon={...save.tackSummon,count:count+1,lastCatalogId:piece.id};
 save.stats={...save.stats,tackSummons:statCount+1};
 return {ok:true,changed:true,code:'summoned',item:grant.item,piece,cost:TACK_SUMMON_COST,poolSize};
}

// Client packet hygiene for voluntary, host-simulated practice. This protocol
// does not authenticate a rider or grant currency, solo records or rally credit.
export const HERD_TTL = 45000;
export const HERD_LIFETIME = 45 * 60 * 1000;
export const HERD_INPUT_MAX_AGE = 1800;
export const HERD_MEMBER_MAX_AGE = 6000;
export const HERD_BOUNDS = Object.freeze({x1:-110, x2:-33, z1:-45, z2:25});
export const HERD_PEN = Object.freeze({x:-44, z:-8, r:7.5});
export const HERD_NAMES = Object.freeze(['Juniper','Maple','Pepper','Willow','Comet']);
const FUTURE_SKEW = 2000;
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const finite = v => typeof v === 'number' && Number.isFinite(v);
const integer = v => Number.isSafeInteger(v) && v >= 0;
const sameFields = (a,b,keys) => keys.every(k => a?.[k] === b?.[k]);
const fresh = (at,now,maxAge=HERD_TTL) => finite(now) && now > 0 && finite(at) && at > 0 && at <= now + FUTURE_SKEW && now-at <= maxAge;
const rows = v => v instanceof Map ? [...v.values()] : Array.isArray(v) ? v : object(v) ? Object.values(v) : [];
const inside = (x,z,padding=0) => finite(x) && finite(z) && x >= HERD_BOUNDS.x1-padding && x <= HERD_BOUNDS.x2+padding && z >= HERD_BOUNDS.z1-padding && z <= HERD_BOUNDS.z2+padding;
export const safeHerdId = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,96}$/.test(v) && !['__proto__','prototype','constructor'].includes(v);
export function cleanHerdName(v,n=14) {
 return typeof v === 'string' ? v.replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,Number.isInteger(n)&&n>0?Math.min(n,96):14) : '';
}
function rosterOf(v) {
 if (!Array.isArray(v) || v.length < 1 || v.length > 4) return null;
 const ids = new Set(), slots = new Set(), result = [];
 for (const p of v) {
  if (!object(p) || !safeHerdId(p.id) || !cleanHerdName(p.name) || typeof p.ready !== 'boolean' || !integer(p.slot) || p.slot > 3 || ids.has(p.id) || slots.has(p.slot)) return null;
  ids.add(p.id); slots.add(p.slot); result.push({id:p.id,name:cleanHerdName(p.name),ready:p.ready,slot:p.slot});
 }
 return result.sort((a,b)=>a.slot-b.slot);
}
function context(session,now,states) {
 if (!object(session) || !safeHerdId(session.sid) || !safeHerdId(session.hostId) || !safeHerdId(session.code) || !states.includes(session.status) || !finite(session.expiresAt) || session.expiresAt <= now || !fresh(session.at,now)) return null;
 const roster=rosterOf(session.roster);return roster?.some(p=>p.id===session.hostId&&p.slot===0)?roster:null;
}
function envelope(m,kind,session,now,maxAge=HERD_TTL) {
 return object(m) && m.kind === kind && safeHerdId(m.id) && m.sid === session.sid && (m.code == null || m.code === session.code) && fresh(m.at,now,maxAge);
}

export function validateHerdSession(sid,m,{now,code,known}={}) {
 if (!object(m) || m.kind !== 'session' || !safeHerdId(sid) || m.sid !== sid || !safeHerdId(code) || m.code !== code || !safeHerdId(m.hostId) || m.id !== m.hostId || !sid.startsWith(m.hostId+'-') || !cleanHerdName(m.n) || !integer(m.rev) || m.rev < 1 || !fresh(m.at,now)) return null;
 if (!finite(m.createdAt) || m.createdAt <= 0 || m.createdAt > m.at || now-m.createdAt > HERD_LIFETIME || !finite(m.expiresAt) || m.expiresAt <= now || m.expiresAt <= m.at || m.expiresAt > m.at+HERD_TTL || m.expiresAt > m.createdAt+HERD_LIFETIME) return null;
 if (!['waiting','riding','finished','cancelled'].includes(m.status) || m.runId != null && m.runId !== sid) return null;
 const roster = rosterOf(m.roster);
 if (!roster || !roster.some(p=>p.id===m.hostId&&p.slot===0)) return null;
 if (m.startAt != null && (!finite(m.startAt) || m.startAt < m.createdAt || m.startAt > m.expiresAt)) return null;
 if (known) {
  if (!sameFields(m,known,['sid','hostId','code','createdAt']) || m.rev <= known.rev || m.at < known.at) return null;
  if (['finished','cancelled'].includes(known.status) && m.status !== known.status || known.status === 'riding' && m.status === 'waiting') return null;
  if (known.startAt != null && m.startAt !== known.startAt) return null;
  if (known.status !== 'waiting') {
   // Leaving can remove a rider; a running slot cannot be reassigned to someone else.
   for (const p of roster) if (!known.roster?.some(old=>old.id===p.id&&old.slot===p.slot)) return null;
  }
 }
 return {kind:'session',id:m.id,n:cleanHerdName(m.n),hostId:m.hostId,code,sid,runId:sid,rev:m.rev,at:m.at,createdAt:m.createdAt,expiresAt:m.expiresAt,status:m.status,roster,...(m.startAt == null ? {} : {startAt:m.startAt})};
}

export function validateHerdMember(m,{now,session,known}={}) {
 const roster = context(session,now,['waiting','riding']);
 if (!roster || !envelope(m,'member',session,now) || !cleanHerdName(m.n) || !integer(m.rev) || m.rev < 1 || typeof m.ready !== 'boolean' || typeof m.left !== 'boolean' || m.left && m.ready) return null;
 if (!roster.some(p=>p.id===m.id) && (session.status !== 'waiting' || roster.length >= 4)) return null;
 if (known && (known.id !== m.id || known.sid !== m.sid || m.rev <= known.rev || m.at < known.at)) return null;
 return {kind:'member',id:m.id,n:cleanHerdName(m.n),sid:m.sid,rev:m.rev,at:m.at,ready:m.ready,left:m.left};
}

export function validateHerdFrame(m,{now,session,lastSeq=0,known}={}) {
 if (!context(session,now,['riding','finished']) || !envelope(m,'frame',session,now) || m.id !== session.hostId || !integer(m.seq) || !integer(lastSeq) || m.seq <= lastSeq || !object(m.state)) return null;
 const s = m.state;
 if (s.startupWaiting !== undefined && typeof s.startupWaiting !== 'boolean') return null;
 const startupWaiting = s.startupWaiting === true;
 if (startupWaiting && (!s.active || s.finished || s.countdown !== 3 || s.elapsed !== 0 || s.penned !== 0)) return null;
 if (s.host !== true || s.sessionId !== session.sid || typeof s.active !== 'boolean' || typeof s.finished !== 'boolean' || typeof s.paused !== 'boolean' || !finite(s.countdown) || s.countdown < 0 || s.countdown > 10 || !finite(s.elapsed) || s.elapsed < 0 || s.elapsed > HERD_LIFETIME/1000 || s.total !== 5 || !integer(s.penned) || s.penned > 5 || !Array.isArray(s.horses) || s.horses.length !== 5 || !sameFields(s.pen,HERD_PEN,['x','z','r'])) return null;
 if (s.bounds != null && !sameFields(s.bounds,HERD_BOUNDS,['x1','x2','z1','z2'])) return null;
 if (session.status === 'finished' && !s.finished || s.penned === 5 && !s.finished || !s.active && !s.finished) return null;
 const names = new Set(), horses = [];
 for (const h of s.horses) {
  if (!object(h) || !HERD_NAMES.includes(h.name) || names.has(h.name) || !inside(h.x,h.z) || !finite(h.heading) || !finite(h.phase) || h.phase < 0 || typeof h.penned !== 'boolean') return null;
  if (h.penned && Math.hypot(h.x-HERD_PEN.x,h.z-HERD_PEN.z) > HERD_PEN.r + .01) return null;
  names.add(h.name); horses.push({name:h.name,x:h.x,z:h.z,heading:h.heading,phase:h.phase,penned:h.penned});
 }
 if (horses.filter(h=>h.penned).length !== s.penned) return null;
 const prior = known?.state || known;
 if (prior) {
  // Startup can release once; a later frame cannot restart the initial hold.
  // Missing legacy flags mean released, just as the sanitized default does.
  if (startupWaiting && (prior.startupWaiting !== true || s.countdown !== prior.countdown)) return null;
  if (prior.sessionId !== s.sessionId || s.elapsed < prior.elapsed || s.penned < prior.penned || prior.finished && !s.finished) return null;
  if (prior.horses?.some(old=>old.penned&&!horses.some(h=>h.name===old.name&&h.penned))) return null;
 }
 const state = {host:true,sessionId:s.sessionId,active:s.active,startupWaiting,countdown:s.countdown,elapsed:s.elapsed,penned:s.penned,total:5,finished:s.finished,paused:s.paused,horses,pen:{...HERD_PEN},...(s.bounds == null ? {} : {bounds:{...HERD_BOUNDS}})};
 return {kind:'frame',id:m.id,n:cleanHerdName(m.n)||session.n,sid:m.sid,seq:m.seq,at:m.at,state};
}

export function validateHerdInput(m,{now,session,lastSeq=0}={}) {
 const roster = context(session,now,['riding']);
 if (!roster || !envelope(m,'input',session,now,HERD_INPUT_MAX_AGE) || !integer(m.seq) || !integer(lastSeq) || m.seq <= lastSeq || !inside(m.x,m.z,12) || typeof m.active !== 'boolean' || !roster.some(p=>p.id===m.id&&p.ready)) return null;
 // The twelve-metre approach margin includes riders stepping outside the pasture
 // fence; it never expands the legal horse simulation or pen bounds.
 return {kind:'input',id:m.id,n:cleanHerdName(m.n),sid:m.sid,seq:m.seq,at:m.at,x:m.x,z:m.z,active:m.active};
}

/** Inputs are a Map, list or ID-keyed object; no missing rider is synthesized. */
export function herdPressureSources(inputs,{now,roster,selfId,maxAge=HERD_INPUT_MAX_AGE}={}) {
 const admitted = rosterOf(roster), unique = new Map();
 if (!admitted || !finite(now) || !finite(maxAge) || maxAge < 0 || selfId != null && !admitted.some(p=>p.id===selfId)) return [];
 for (const input of rows(inputs)) {
  const member = admitted.find(p=>p.id===input?.id&&p.ready);
  if (!member || typeof input.active !== 'boolean' || !integer(input.seq) || !finite(input.at) || !inside(input.x,input.z,12)) continue;
  const old = unique.get(input.id);
  if (!old || input.seq > old.seq || input.seq === old.seq && input.at > old.at) unique.set(input.id,input);
 }
 return admitted.filter(p=>{const i=unique.get(p.id);return i?.active===true&&fresh(i.at,now,Math.min(maxAge,HERD_INPUT_MAX_AGE));}).map(p=>{const i=unique.get(p.id);return {id:p.id,x:i.x,z:i.z,slot:p.slot};});
}

/** Only the host starts; members is a Map, list or ID-keyed sanitized-message object. */
export function canStartHerd(session,members,{now,selfId}={}) {
 const roster = context(session,now,['waiting']);
 if (!roster || selfId !== session.hostId || roster.length < 2) return false;
 const unique = new Map();
 for (const m of rows(members)) {
  if (!object(m) || !safeHerdId(m.id) || m.sid !== session.sid || !integer(m.rev) || m.rev < 1) continue;
  const old=unique.get(m.id);if(!old||m.rev>old.rev)unique.set(m.id,m);
 }
 return roster.every(p=>{const m=unique.get(p.id);return p.ready&&m?.ready===true&&m.left===false&&fresh(m.at,now,HERD_MEMBER_MAX_AGE);});
}

function resultProof(v) {
 if (!object(v) || !safeHerdId(v.runId) || v.total !== 5 || v.penned !== 5 || !finite(v.elapsed) || v.elapsed <= 0 || v.elapsed > HERD_LIFETIME/1000 || !finite(v.at) || v.at <= 0 || !Array.isArray(v.participants) || v.participants.length < 2 || v.participants.length > 4) return null;
 const participants = v.participants.map(n=>cleanHerdName(n));
 if (participants.some(n=>!n)) return null;
 return {runId:v.runId,elapsed:v.elapsed,total:5,penned:5,participants,at:v.at};
}
/** Takes only s.clubHerdRecords, returns a detached record and exact saved receipt. */
export function herdRecordResult(saved,result) {
 const proof = resultProof(result);if(!proof)return null;
 const old = object(saved) ? saved : {}, receipts = {};
 for (const [id,r] of Object.entries(object(old.receipts)?old.receipts:{})) {
  const p=resultProof(r);
  if (safeHerdId(id)&&p?.runId===id&&r.saved===true&&typeof r.newBest==='boolean'&&finite(r.bestTime)&&r.bestTime>0)receipts[id]={...p,newBest:r.newBest,bestTime:r.bestTime,saved:true};
 }
 const save = {plays:integer(old.plays)?old.plays:0,bestTime:finite(old.bestTime)&&old.bestTime>0?old.bestTime:null,lastRunId:safeHerdId(old.lastRunId)?old.lastRunId:null,receipts};
 if (Object.hasOwn(receipts,proof.runId)) {
  const prior=receipts[proof.runId];
  if (!sameFields(prior,proof,['elapsed','total','penned']) || JSON.stringify(prior.participants)!==JSON.stringify(proof.participants)) return null;
  return {save,receipt:{...prior,participants:prior.participants.slice()},deduped:true};
 }
 const newBest=save.bestTime===null||proof.elapsed<save.bestTime,bestTime=newBest?proof.elapsed:save.bestTime;
 const receipt={...proof,newBest,bestTime,saved:true};
 save.plays++;save.bestTime=bestTime;save.lastRunId=proof.runId;save.receipts[proof.runId]=receipt;
 const keep=Object.entries(save.receipts).sort((a,b)=>b[1].at-a[1].at).slice(0,100);
 // Always keep the just-recorded receipt even if a client clock changed.
 if (!keep.some(([id])=>id===proof.runId)) keep[keep.length-1]=[proof.runId,receipt];
 save.receipts=Object.fromEntries(keep);
 return {save,receipt:{...receipt,participants:receipt.participants.slice()},deduped:false};
}

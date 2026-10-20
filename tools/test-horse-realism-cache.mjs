import {normalizeRidingFoundationAuditSource} from './riding-foundation-source-guard.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {normalizeHorseRealismCacheSource as inverse} from './horse-realism-cache-source-guard.cjs';
const root=new URL('../',import.meta.url),read=f=>normalizeRidingFoundationAuditSource(fs.readFileSync(new URL(f,root),'utf8'),f);
const contract=JSON.parse(read('tools/fixtures/horse-realism-579b5cf/cache-changes.json'));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const importURLs=f=>[...read(f).matchAll(/(?:\bfrom\s*|\bimport\s*)['"]([^'"]+)['"]/g)].map(m=>new URL(m[1],new URL(f,root)));
const moduleURLs=(f,name)=>importURLs(f).filter(u=>u.pathname.endsWith('/'+name));
const exact=(f,name)=>{const urls=[...new Set(moduleURLs(f,name).map(String))];assert.equal(urls.length,1,f+' has one module identity for '+name);return urls[0];};
test('all 20 cache edges are current once and preserve complete incoming parent source',()=>{
 assert.equal(contract.changes.length,20);assert.equal(Object.keys(contract.beforeSHA256).length,11);
 for(const [file,hash]of Object.entries(contract.beforeSHA256)){
  const source=read(file);for(const c of contract.changes.filter(c=>c.file===file)){assert.equal(source.split(c.after).length-1,c.occurrences);assert.equal(source.includes(c.before),false);}
  assert.equal(sha(inverse(source,file)),hash,file+' changed imports only');
 }
});
test('Ranch, studios, portrait capture and LOD share the exact controller and loader URL',()=>{
 const hero=exact('ranch3d.html','game-hero-horse.js'),breed=exact('ranch3d.html','breed-models.js');
 for(const file of ['breeds.html','assets/tack-studio.js','review/native-draft-legs/review.html','review/horse-quality/capture.js']){
  assert.equal(exact(file,'game-hero-horse.js'),hero,file);assert.equal(exact(file,'breed-models.js'),breed,file);
 }
 assert.equal(exact('assets/world-horse-lod.mjs','game-hero-horse.js'),hero);
 assert.equal(exact('hero-horse.html','breed-models.js'),breed);
 assert(hero.endsWith('?v='+contract.release+'-native-riding-locks-1'));
 assert.equal(exact('assets/game-hero-horse.js','native-riding-groom.mjs'),exact('assets/native-flowing-groom.js','native-riding-groom.mjs'));
 for(const file of ['breeds.html','assets/world-horse-lod.mjs'])assert.equal(exact(file,'native-horse-motion.js'),exact('assets/game-hero-horse.js','native-horse-motion.js'));
});
test('all changed renderer children and external script parents carry the release tag',()=>{
 for(const [file,name]of [['assets/breed-models.js','native-horse-materials.js'],['assets/breed-models.js','native-equestrian-groom.js'],['assets/game-hero-horse.js','native-flowing-groom.js'],['assets/game-hero-horse.js','native-draft-feathers.js'],['ranch3d.html','world-horse-lod.mjs']])assert.equal(new URL(exact(file,name)).searchParams.get('v').startsWith(contract.release),true,file+' → '+name);
 assert.equal(exact('assets/breed-models.js','native-horse-materials.js'),exact('review/horse-quality/capture.js','native-horse-materials.js'));
 for(const [file,child]of [['tack-studio.html','assets/tack-studio.js'],['review/horse-quality/capture.html','./capture.js']]){
  const src=[...read(file).matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m=>m[1]).filter(s=>s.startsWith(child+'?'));
  assert.equal(src.length,1);assert(new URL(src[0],new URL(file,root)).searchParams.get('v').startsWith(contract.release));
 }
});
test('aliases reject missing, unknown, duplicate and mixed import declarations',()=>{
 for(const c of contract.changes){const raw=read(c.file);
  for(const candidate of [raw.replace(c.after,''),raw.replace(c.after,c.after.slice(0,-1)+'-unknown'+c.after.slice(-1)),raw+'\n// duplicate '+c.after,raw+'\n// mixed '+c.before])assert.throws(()=>inverse(candidate,c.file),c.file+' '+c.before);
 }
});
test('cache approval never certifies unrelated edits or touches unknown binary data',()=>{
 for(const [file,hash]of Object.entries(contract.beforeSHA256))assert.notEqual(sha(inverse(read(file)+'\n// unrelated owner change',file)),hash);
 const bytes=Buffer.from([0,255,192,128]);assert.equal(inverse(bytes,'unrelated.bin'),bytes);
});

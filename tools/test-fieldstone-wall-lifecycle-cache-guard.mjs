import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeFieldstoneWallCacheSource as normalizeFieldstoneWallSource} from './fieldstone-wall-cache-source-guard.cjs';
import {normalizeGrassRibbonSource,normalizeGrassRibbonTestSource} from './grass-ribbon-source-guard.cjs';
const normalizeFieldstoneWallCacheSource=(source,file)=>normalizeFieldstoneWallSource(normalizeGrassRibbonSource(source,file),file);
const contract=JSON.parse(fs.readFileSync(new URL('./fixtures/fieldstone-wall-a78ed79/contract.json',import.meta.url),'utf8'));
const file='assets/features/world-paths.js',row=contract.files[file],sha=s=>createHash('sha256').update(s).digest('hex');
test('actual fieldstone lifecycle owner call is present exactly once and restores the complete original route owner',()=>{
 const source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 assert.equal(row.ownerSourceChanges.length,1);const c=row.ownerSourceChanges[0];
 assert.equal(source.split(c.after).length,2);assert.equal(source.split(c.before).length,1);
 const original=normalizeFieldstoneWallCacheSource(source,file);
 assert.equal(sha(original),row.a78RawSHA256,'Every other original route, gate, placement and renderer byte survives');
 const prior=source.replace(c.after,c.before);
 assert.equal(sha(normalizeFieldstoneWallCacheSource(prior,file)),row.a78RawSHA256,'Already-reviewed V1call is still exact');
});
test('unknown wall array, malformed lifecycle call, duplicate/mixed call and unrelated route drift cannot normalize',()=>{
 const source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),c=row.ownerSourceChanges[0];
 for(const [reason,candidate]of [
  ['unreviewed wall owner',source.replace(c.after,c.after.replace('walls:W.walls','walls:G.otherWalls'))],
  ['malformed lifecycle call',source.replace(c.after,c.after.replace('installCoursedFieldWalls','installUnreviewedFieldWalls'))],
  ['missing lifecycle call',source.replace(c.after,'')],
  ['duplicate approved call',source+'\n'+c.after],
  ['mixed previous/current call',source+'\n'+c.before],
  ['unrelated route source change',source+'\n// independently unreviewed route owner change'],
 ])assert.throws(()=>normalizeFieldstoneWallCacheSource(candidate,file),reason);
});

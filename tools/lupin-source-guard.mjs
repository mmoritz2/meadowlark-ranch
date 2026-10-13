import {normalizeCoyoteMacroSource} from './coyote-macroform-source-guard.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const fixture=new URL('./fixtures/lupin-e8b5cf4/',import.meta.url),contract=JSON.parse(fs.readFileSync(new URL('source-changes.json',fixture)));
// Exact reviewed geometry/cache additions only. Historical whole-body fixtures
// continue to compare every original planning, shader, RNG and physical byte.
export function normalizeLupinSource(source,file){
 source=normalizeCoyoteMacroSource(source,file);
 for(const c of contract.sourceChanges.filter(c=>c.file===file)){
  if(source.includes(c.after)){assert.equal(source.split(c.after).length,2,'Exactly one lupin/cache literal '+file);source=source.replace(c.after,c.before);}
  else assert.equal(source.split(c.before).length,2,'Expected original or exact lupin/cache literal '+file);
 }
 if(file===contract.factory.file&&source.includes(contract.factory.afterMarker)){
  const at=source.indexOf(contract.factory.afterMarker),tail=source.slice(at);
  assert.equal(crypto.createHash('sha256').update(tail).digest('hex'),contract.factory.afterSHA256,'Only the complete approved lupin prototype may be restored');
  const old=fs.readFileSync(new URL('../lupin-original-e8b5cf4.mjs',fixture),'utf8');source=source.slice(0,at)+old.slice(old.indexOf(contract.factory.beforeMarker));
 }
 return source;
}

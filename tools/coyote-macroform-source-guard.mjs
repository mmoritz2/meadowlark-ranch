import {normalizeStarterTackSource} from './starter-tack-source-guard.cjs';
import fs from 'node:fs';import assert from 'node:assert/strict';
const changes=JSON.parse(fs.readFileSync(new URL('./fixtures/coyote-macro-8042555/source-changes.json',import.meta.url)));
// Restore only the reviewed numeric shape/decision islands and exact cache
// literals. Historical whole-body SHA fixtures still test everything else.
export function normalizeCoyoteMacroSource(source,file){
 source=normalizeStarterTackSource(source,file);
 const edits=changes.filter(c=>c.file===file);
 if(!edits.length||!source.includes('coyote-macroform'))return source;
 // The macroRaw callback correction composes with the preceding new binding;
 // restore in the inverse authoring order instead of matching a broad regex.
 for(const c of [...edits].reverse()){assert.equal(source.split(c.after).length,2,'Exactly one approved Coyote macro change '+file+': '+c.after.slice(0,90));source=source.replace(c.after,c.before);}
 return source;
}

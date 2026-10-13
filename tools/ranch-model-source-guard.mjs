import fs from 'node:fs';import assert from 'node:assert/strict';
const contract=JSON.parse(fs.readFileSync(new URL('./fixtures/ranch-model-b5d22a6/fieldstone-contract.json',import.meta.url)));
// Only exact reviewed model/cache literals are restored. All planning, UUID,
// source constructors, shaders, colliders and unrelated source remain tested.
export function normalizeRanchModelSource(source,file){for(const c of contract.approvedNewSourceChanges.filter(c=>c.file===file)){assert.equal(source.split(c.after).length,2,'Exactly one approved ranch model/cache addition: '+file+':'+c.after.slice(0,90));source=source.replace(c.after,c.before);}return source;}

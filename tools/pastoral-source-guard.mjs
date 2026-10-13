import fs from'node:fs';import assert from'node:assert/strict';
const approved=JSON.parse(fs.readFileSync(new URL('./fixtures/pastoral-7fbd127/approved-combined-source-changes.json',import.meta.url)));
// Restore only exact reviewed owner hooks/cache/prototype literals before an
// older complete-body regression. The new behavior has separate actual-path
// tests; no planning, constructor, shader or unrelated body is skipped here.
export function normalizePastoralSource(source,file){for(const c of approved.reverseChanges.filter(c=>c.file===file)){assert.equal(source.split(c.after).length,2,'Exactly one approved pastoral addition: '+file+':'+c.after.slice(0,80));source=source.replace(c.after,c.before);}return source;}

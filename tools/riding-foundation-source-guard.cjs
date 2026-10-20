// Exact latest riding-foundation input leaf. Never imported by gameplay.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/riding-foundation-1402878/contract.json',sha=b=>crypto.createHash('sha256').update(b).digest('hex'),baseRoot=path.join(__dirname,'..'),declaration=fs.readFileSync(path.join(baseRoot,fixture));
assert.equal(sha(declaration),'04efd9b27d06014fd75f384cd300c4f2b87fcffe24df3cc48bbc345595e95fb8','Exact approved riding foundation declaration');const contract=JSON.parse(declaration);
function normalizeRidingFoundationAuditSource(source,file){const row=contract.files[file]||contract.observers[file];if(!row)return source;const hash=sha(source);if(hash===row.beforeSHA256)return source;
 const buffer=Buffer.isBuffer(source),text=buffer?source.toString('utf8'):source;if(!row.changes?.some(c=>text.includes(c.after))&&!contract.changes.some(c=>c.file===file&&text.includes(c.after)))return source;
 assert.equal(hash,row.afterSHA256,'Whole approved riding foundation body '+file);let parent=text;const rows=row.changes||contract.changes.filter(c=>c.file===file);
 for(const c of rows.toReversed()){assert.equal(parent.split(c.after).length-1,c.occurrences,'Unique riding inverse '+file);assert.equal(parent.replace(c.after,'').split(c.before).length-1,0,'No mixed riding parent/current '+file);parent=parent.replace(c.after,c.before);}
 assert.equal(sha(parent),row.beforeSHA256,'Whole exact140 riding parent '+file);return buffer?Buffer.from(parent):parent;
}
function assertRidingFoundationCurrent(source,file){const row=contract.files[file]||contract.observers[file]||contract.addedFiles[file];assert(row,'Declared riding subject '+file);assert.equal(sha(source),row.afterSHA256||row.sha256,'Whole current riding subject '+file);return true;}
function normalizeRidingFoundationFixtureChanges(diff,{rootDir=baseRoot}={}){const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate riding fixture paths');const kept=rows.filter(f=>{if(f!==fixture)return true;assert.equal(sha(fs.readFileSync(path.join(rootDir,f))),sha(declaration),'Exact named riding fixture');return false;});return kept.length?kept.join('\n')+'\n':'';}
module.exports={normalizeRidingFoundationAuditSource,assertRidingFoundationCurrent,normalizeRidingFoundationFixtureChanges};

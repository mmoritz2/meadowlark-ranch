// Exact current Loon leaf; no older guard imports and no weak normalization.
const {normalizeChalkScourSource,assertChalkScourCurrent,normalizeChalkScourFixtureChanges}=require('./chalk-scour-source-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/loon-lake-0d867b4/source-contract.json',sha=b=>crypto.createHash('sha256').update(b).digest('hex'),baseRoot=path.join(__dirname,'..'),declaration=fs.readFileSync(path.join(baseRoot,fixture));
assert.equal(sha(declaration),'f5a13e11a20f4ff6c65ab40ff99fa546f6db4dc72ef1d1b66b834e254acd4109','Exact Loon source declaration');const contract=JSON.parse(declaration);
function normalizeLoonLakeSource(source,file){
 source=normalizeChalkScourSource(source,file);
 const row=contract.files[file]||contract.observers[file];if(!row)return source;const hash=sha(source);if(hash===row.beforeSHA256)return source;
 const buffer=Buffer.isBuffer(source),text=buffer?source.toString('utf8'):source;if(hash!==row.afterSHA256&&!contract.markers.some(m=>text.includes(m)))return source;
 assert.equal(hash,row.afterSHA256,'Whole approved Loon owner '+file);let parent=text;
 for(const e of [...row.changes].reverse()){assert.equal(parent.split(e.after).length-1,e.occurrences,'Counted Loon inverse '+file);parent=parent.replaceAll(e.after,e.before);}
 assert.equal(sha(parent),row.beforeSHA256,'Whole exact0d867b4 parent '+file);return buffer?Buffer.from(parent):parent;
}
function assertLoonLakeCurrent(read,{rootDir=baseRoot}={}){
 const actual=typeof read==='function'?read:file=>fs.readFileSync(path.join(rootDir,file));
 assertChalkScourCurrent(actual,{rootDir});
 const raw=file=>normalizeChalkScourSource(actual(file),file);
 for(const[f,row]of Object.entries({...contract.files,...contract.observers}))assert.equal(sha(raw(f)),row.afterSHA256,'Actual raw Loon owner '+f);
 for(const[f,row]of Object.entries(contract.addedFiles))assert.equal(sha(raw(f)),row.sha256,'Actual raw added Loon helper/test '+f);
 for(const[f,h]of Object.entries({...contract.parentFixtureSHA256,...contract.newFixtureSHA256}))assert.equal(sha(raw(f)),h,'Exact current Loon fixture '+f);return true;
}
function normalizeLoonLakeFixtureChanges(diff,{rootDir=baseRoot}={}){
 diff=normalizeChalkScourFixtureChanges(diff,{rootDir});
 const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate Loon fixture');const allowed={...contract.newFixtureSHA256,[fixture]:sha(declaration)};
 const kept=rows.filter(f=>{if(!Object.hasOwn(allowed,f))return true;assert.equal(sha(fs.readFileSync(path.join(rootDir,f))),allowed[f],'Exact new Loon fixture '+f);return false;});return kept.length?kept.join('\n')+'\n':'';
}
module.exports={normalizeLoonLakeSource,assertLoonLakeCurrent,normalizeLoonLakeFixtureChanges};

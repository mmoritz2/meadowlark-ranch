// snow-village-1: exact newest inverse and raw current certification before fine-pasture history.
const {normalizeSnowVillageSource,assertSnowVillageCurrent,normalizeSnowVillageFixtureChanges}=require('./snow-village-source-guard.cjs');
// Exact fine-pasture-1 inverse. Inapplicability is never source certification.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/fine-pasture-cd4b62d/source-contract.json',sha=b=>crypto.createHash('sha256').update(b).digest('hex'),baseRoot=path.join(__dirname,'..'),declaration=fs.readFileSync(path.join(baseRoot,fixture));
assert.equal(sha(declaration),'410fa887ac162b5e7db301b1774d450a0a671dc81b29271e83209fa262830d83','Exact fine pasture declaration');const contract=JSON.parse(declaration);
function normalizeFinePastureSource(source,file){
 source=normalizeSnowVillageSource(source,file);
 const row=contract.files[file]||contract.observers[file];if(!row)return source;
 const hash=sha(source);if(hash===row.beforeSHA256)return source;
 const buffer=Buffer.isBuffer(source),text=buffer?source.toString('utf8'):source;
 if(hash!==row.afterSHA256&&!contract.markers.some(m=>text.includes(m)))return source;
 assert.equal(hash,row.afterSHA256,'Whole approved fine pasture owner '+file);let parent=text;
 for(const c of row.changes.toReversed()){assert.equal(parent.split(c.after).length-1,c.occurrences,'Counted Ribbon inverse '+file);parent=parent.replaceAll(c.after,c.before);}
 assert.equal(sha(parent),row.beforeSHA256,'Whole exactcd4b62d parent '+file);return buffer?Buffer.from(parent):parent;
}
function assertFinePastureCurrent(read,{rootDir=baseRoot}={}){
 const raw=typeof read==='function'?read:file=>fs.readFileSync(path.join(rootDir,file));
 assertSnowVillageCurrent(raw,{rootDir});
 const current=file=>normalizeSnowVillageSource(raw(file),file);
 for(const[f,row]of Object.entries({...contract.files,...contract.observers}))assert.equal(sha(current(f)),row.afterSHA256,'Actual raw fine pasture owner '+f);
 for(const[f,row]of Object.entries(contract.addedFiles))assert.equal(sha(current(f)),row.sha256,'Actual raw added fine pasture owner '+f);
 for(const[f,v]of Object.entries({...contract.parentFixtureSHA256,...contract.newFixtureSHA256}))assert.equal(sha(current(f)),v,'Exact Ribbon fixture '+f);return true;
}
function normalizeFinePastureFixtureChanges(diff,{rootDir=baseRoot}={}){
 diff=normalizeSnowVillageFixtureChanges(diff,{rootDir});
 const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate Ribbon fixture');const allowed={...contract.newFixtureSHA256,[fixture]:sha(declaration)};
 const kept=rows.filter(f=>{if(!Object.hasOwn(allowed,f))return true;assert.equal(sha(fs.readFileSync(path.join(rootDir,f))),allowed[f],'Exact new Ribbon fixture '+f);return false;});return kept.length?kept.join('\n')+'\n':'';
}
module.exports={normalizeFinePastureSource,assertFinePastureCurrent,normalizeFinePastureFixtureChanges};

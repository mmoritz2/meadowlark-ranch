// Exact Frostpine inverse. Inapplicability is never current-source certification.
const {normalizeLoonLakeSource,assertLoonLakeCurrent,normalizeLoonLakeFixtureChanges}=require('./loon-lake-source-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/snow-village-f2ecb9c/source-contract.json',sha=b=>crypto.createHash('sha256').update(b).digest('hex'),baseRoot=path.join(__dirname,'..'),declaration=fs.readFileSync(path.join(baseRoot,fixture));
assert.equal(sha(declaration),'82367573f7469d96f4988c4cabd62842db53ee4e54a5687f728655a63745e966','Exact snow village declaration');const contract=JSON.parse(declaration);
function normalizeSnowVillageSource(source,file){
 source=normalizeLoonLakeSource(source,file);
 const row=contract.files[file]||contract.observers[file];if(!row)return source;const hash=sha(source);if(hash===row.beforeSHA256)return source;
 const buffer=Buffer.isBuffer(source),text=buffer?source.toString('utf8'):source;if(hash!==row.afterSHA256&&!contract.markers.some(m=>text.includes(m)))return source;
 assert.equal(hash,row.afterSHA256,'Whole approved snow village owner '+file);let parent=text;
 for(const c of row.changes.toReversed()){assert.equal(parent.split(c.after).length-1,c.occurrences,'Counted snow village inverse '+file);parent=parent.replaceAll(c.after,c.before);}
 assert.equal(sha(parent),row.beforeSHA256,'Whole exactf2ecb9c parent '+file);return buffer?Buffer.from(parent):parent;
}
function assertSnowVillageCurrent(read,{rootDir=baseRoot}={}){
 const raw=typeof read==='function'?read:file=>fs.readFileSync(path.join(rootDir,file));
 assertLoonLakeCurrent(raw,{rootDir});
 const current=file=>normalizeLoonLakeSource(raw(file),file);
 for(const[f,row]of Object.entries({...contract.files,...contract.observers}))assert.equal(sha(current(f)),row.afterSHA256,'Actual raw snow village owner '+f);
 for(const[f,row]of Object.entries(contract.addedFiles))assert.equal(sha(current(f)),row.sha256,'Actual raw added snow village owner '+f);
 for(const[f,h]of Object.entries({...contract.parentFixtureSHA256,...contract.newFixtureSHA256}))assert.equal(sha(current(f)),h,'Exact snow village fixture '+f);return true;
}
function normalizeSnowVillageFixtureChanges(diff,{rootDir=baseRoot}={}){
 diff=normalizeLoonLakeFixtureChanges(diff,{rootDir});
 const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate snow fixture');const allowed={...contract.newFixtureSHA256,[fixture]:sha(declaration)};
 const kept=rows.filter(f=>{if(!Object.hasOwn(allowed,f))return true;assert.equal(sha(fs.readFileSync(path.join(rootDir,f))),allowed[f],'Exact new snow fixture '+f);return false;});return kept.length?kept.join('\n')+'\n':'';
}
module.exports={normalizeSnowVillageSource,assertSnowVillageCurrent,normalizeSnowVillageFixtureChanges};

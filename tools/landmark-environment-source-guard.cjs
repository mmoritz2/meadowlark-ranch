// Exact landmark-environment-1 inverse. Inapplicability is never source certification.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/landmark-environment-7989c92/source-contract.json',sha=b=>crypto.createHash('sha256').update(b).digest('hex'),baseRoot=path.join(__dirname,'..'),declaration=fs.readFileSync(path.join(baseRoot,fixture));
assert.equal(sha(declaration),'e9651cf68fe1f77e274ff4801e3694112363ac870b686cf4bddddf421d851e49','Exact landmark source declaration');const contract=JSON.parse(declaration);
function normalizeLandmarkEnvironmentSource(source,file){
 const row=contract.files[file]||contract.observers[file];if(!row)return source;
 const hash=sha(source);if(hash===row.beforeSHA256)return source;
 const buffer=Buffer.isBuffer(source),text=buffer?source.toString('utf8'):source;
 if(hash!==row.afterSHA256&&!contract.markers.some(m=>text.includes(m)))return source;
 assert.equal(hash,row.afterSHA256,'Whole approved landmark owner '+file);let parent=text;
 for(const c of row.changes.toReversed()){assert.equal(parent.split(c.after).length-1,c.occurrences,'Counted landmark inverse '+file);parent=parent.replaceAll(c.after,c.before);}
 assert.equal(sha(parent),row.beforeSHA256,'Whole exact7989 parent '+file);return buffer?Buffer.from(parent):parent;
}
function assertLandmarkEnvironmentCurrent(read,{rootDir=baseRoot}={}){
 const current=typeof read==='function'?read:file=>fs.readFileSync(path.join(rootDir,file));
 for(const[f,row]of Object.entries({...contract.files,...contract.observers}))assert.equal(sha(current(f)),row.afterSHA256,'Actual raw landmark owner '+f);
 for(const[f,row]of Object.entries(contract.addedFiles))assert.equal(sha(current(f)),row.sha256,'Actual raw added landmark owner '+f);
 for(const[f,v]of Object.entries({...contract.parentFixtureSHA256,...contract.newFixtureSHA256}))assert.equal(sha(current(f)),v,'Exact landmark fixture '+f);return true;
}
function normalizeLandmarkEnvironmentFixtureChanges(diff,{rootDir=baseRoot}={}){
 const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate landmark fixture');const allowed={...contract.newFixtureSHA256,[fixture]:sha(declaration)};
 const kept=rows.filter(f=>{if(!Object.hasOwn(allowed,f))return true;assert.equal(sha(fs.readFileSync(path.join(rootDir,f))),allowed[f],'Exact new landmark fixture '+f);return false;});return kept.length?kept.join('\n')+'\n':'';
}
module.exports={normalizeLandmarkEnvironmentSource,assertLandmarkEnvironmentCurrent,normalizeLandmarkEnvironmentFixtureChanges};

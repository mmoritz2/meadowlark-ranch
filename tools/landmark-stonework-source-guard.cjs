// landmark-environment-1: exact laterowner inverse before Wrenfell history.
const {normalizeLandmarkEnvironmentSource,normalizeLandmarkEnvironmentFixtureChanges}=require('./landmark-environment-source-guard.cjs');
// Exact landmark-stonework-1 inverse. Inapplicability is never source certification.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/landmark-stonework-5b6c7c4/source-contract.json',sha=b=>crypto.createHash('sha256').update(b).digest('hex'),baseRoot=path.join(__dirname,'..'),declaration=fs.readFileSync(path.join(baseRoot,fixture));
assert.equal(sha(declaration),'54677b236c3d9647672ca8adaa62008d48450c124bb0c4b1f85acc0e3e80e8d3','Exact landmark source declaration');const contract=JSON.parse(declaration);
function normalizeLandmarkStoneworkSource(source,file){
 source=normalizeLandmarkEnvironmentSource(source,file);
 const row=contract.files[file]||contract.observers[file];if(!row)return source;
 const hash=sha(source);if(hash===row.beforeSHA256)return source;
 const buffer=Buffer.isBuffer(source),text=buffer?source.toString('utf8'):source;
 if(hash!==row.afterSHA256&&!text.includes(contract.marker))return source;
 assert.equal(hash,row.afterSHA256,'Whole approved landmark owner '+file);let parent=text;
 for(const c of row.changes.toReversed()){assert.equal(parent.split(c.after).length-1,c.occurrences,'Counted landmark inverse '+file);parent=parent.replaceAll(c.after,c.before);}
 assert.equal(sha(parent),row.beforeSHA256,'Whole exact5b6 parent '+file);return buffer?Buffer.from(parent):parent;
}
function assertLandmarkStoneworkCurrent(read,{rootDir=baseRoot}={}){
 const raw=typeof read==='function'?read:file=>fs.readFileSync(path.join(rootDir,file)),current=file=>normalizeLandmarkEnvironmentSource(raw(file),file);
 for(const[f,row]of Object.entries({...contract.files,...contract.observers}))assert.equal(sha(current(f)),row.afterSHA256,'Actual raw landmark owner '+f);
 for(const[f,row]of Object.entries(contract.addedFiles))assert.equal(sha(current(f)),row.sha256,'Actual raw added landmark owner '+f);
 for(const[f,v]of Object.entries({...contract.parentFixtureSHA256,...contract.newFixtureSHA256}))assert.equal(sha(current(f)),v,'Exact landmark fixture '+f);return true;
}
function normalizeLandmarkStoneworkFixtureChanges(diff,{rootDir=baseRoot}={}){
 diff=normalizeLandmarkEnvironmentFixtureChanges(diff,{rootDir});
 const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate landmark fixture');const allowed={...contract.newFixtureSHA256,[fixture]:sha(declaration)};
 const kept=rows.filter(f=>{if(!Object.hasOwn(allowed,f))return true;assert.equal(sha(fs.readFileSync(path.join(rootDir,f))),allowed[f],'Exact new landmark fixture '+f);return false;});return kept.length?kept.join('\n')+'\n':'';
}
module.exports={normalizeLandmarkStoneworkSource,assertLandmarkStoneworkCurrent,normalizeLandmarkStoneworkFixtureChanges};

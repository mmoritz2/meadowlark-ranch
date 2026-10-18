// ribbon-falls-2: exact source inverse before published route-ground history.
const {normalizeRibbonFallsSource,normalizeRibbonFallsFixtureChanges}=require('./ribbon-falls-source-guard.cjs');
// Exact route-ground-2 inverse. Inapplicability is never source certification.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/route-ground-4f3cdcd/source-contract.json',sha=b=>crypto.createHash('sha256').update(b).digest('hex'),baseRoot=path.join(__dirname,'..'),declaration=fs.readFileSync(path.join(baseRoot,fixture));
assert.equal(sha(declaration),'ee7ffebd1ea816f289f7683e3e70ae178a39b93df4a5157d3e908d8ffa5df972','Exact connected terrain declaration');const contract=JSON.parse(declaration);
function normalizeRouteGroundSource(source,file){
 source=normalizeRibbonFallsSource(source,file);
 const row=contract.files[file]||contract.observers[file];if(!row)return source;
 const hash=sha(source);if(hash===row.beforeSHA256)return source;
 const buffer=Buffer.isBuffer(source),text=buffer?source.toString('utf8'):source;
 if(hash!==row.afterSHA256&&!contract.markers.some(m=>text.includes(m)))return source;
 assert.equal(hash,row.afterSHA256,'Whole approved connected terrain owner '+file);let parent=text;
 for(const c of row.changes.toReversed()){assert.equal(parent.split(c.after).length-1,c.occurrences,'Counted regional inverse '+file);parent=parent.replaceAll(c.after,c.before);}
 assert.equal(sha(parent),row.beforeSHA256,'Whole exact4f3cdcd parent '+file);return buffer?Buffer.from(parent):parent;
}
function assertRouteGroundCurrent(read,{rootDir=baseRoot}={}){
 const raw=typeof read==='function'?read:file=>fs.readFileSync(path.join(rootDir,file)),current=file=>normalizeRibbonFallsSource(raw(file),file);
 for(const[f,row]of Object.entries({...contract.files,...contract.observers}))assert.equal(sha(current(f)),row.afterSHA256,'Actual raw connected terrain owner '+f);
 for(const[f,row]of Object.entries(contract.addedFiles))assert.equal(sha(current(f)),row.sha256,'Actual raw added connected terrain owner '+f);
 for(const[f,v]of Object.entries({...contract.parentFixtureSHA256,...contract.newFixtureSHA256}))assert.equal(sha(current(f)),v,'Exact regional fixture '+f);return true;
}
function normalizeRouteGroundFixtureChanges(diff,{rootDir=baseRoot}={}){
 diff=normalizeRibbonFallsFixtureChanges(diff,{rootDir});
 const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate regional fixture');const allowed={...contract.newFixtureSHA256,[fixture]:sha(declaration)};
 const kept=rows.filter(f=>{if(!Object.hasOwn(allowed,f))return true;assert.equal(sha(fs.readFileSync(path.join(rootDir,f))),allowed[f],'Exact new regional fixture '+f);return false;});return kept.length?kept.join('\n')+'\n':'';
}
module.exports={normalizeRouteGroundSource,assertRouteGroundCurrent,normalizeRouteGroundFixtureChanges};

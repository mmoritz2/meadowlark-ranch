// barleyfold-farm-wall-1: exact parent view before the fields authority.
const {normalizeBarleyfoldWallSource,normalizeBarleyfoldWallFixtureChanges}=require('./barleyfold-wall-source-guard.cjs');
// Exact countryside-fields-1 inverse. A no-op is not source certification.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/countryside-fields-c8cfa9c/source-contract.json',sha=b=>crypto.createHash('sha256').update(b).digest('hex'),baseRoot=path.join(__dirname,'..'),declaration=fs.readFileSync(path.join(baseRoot,fixture));
assert.equal(sha(declaration),'ddd875b118357f0692700ec0c46983354a6916d0f944cd891a2163939163650f','Exact fields source declaration');const contract=JSON.parse(declaration);
function normalizeCountrysideFieldsSource(source,file){
 source=normalizeBarleyfoldWallSource(source,file);
 const row=contract.files[file]||contract.observers[file];if(!row)return source;
 const hash=sha(source);if(hash===row.beforeSHA256)return source;
 const buffer=Buffer.isBuffer(source),text=buffer?source.toString('utf8'):source;
 if(hash!==row.afterSHA256&&!text.includes(contract.marker))return source;
 assert.equal(hash,row.afterSHA256,'Whole approved fields owner '+file);let parent=text;
 for(const c of row.changes.toReversed()){assert.equal(parent.split(c.after).length-1,c.occurrences,'Counted fields inverse '+file);parent=parent.replaceAll(c.after,c.before);}
 assert.equal(sha(parent),row.beforeSHA256,'Whole exact C8 fields parent '+file);return buffer?Buffer.from(parent):parent;
}
function assertCountrysideFieldsCurrent(read,{rootDir=baseRoot}={}){
 const raw=typeof read==='function'?read:file=>fs.readFileSync(path.join(rootDir,file)),current=file=>normalizeBarleyfoldWallSource(raw(file),file);
 for(const[f,row]of Object.entries({...contract.files,...contract.observers}))assert.equal(sha(current(f)),row.afterSHA256,'Actual raw fields owner '+f);
 for(const[f,row]of Object.entries(contract.addedFiles))assert.equal(sha(current(f)),row.sha256,'Actual raw added fields owner '+f);
 for(const[f,h]of Object.entries({...contract.parentFixtureSHA256,...contract.newFixtureSHA256}))assert.equal(sha(current(f)),h,'Exact fields fixture '+f);return true;
}
function normalizeCountrysideFieldsFixtureChanges(diff,{rootDir=baseRoot}={}){
 diff=normalizeBarleyfoldWallFixtureChanges(diff,{rootDir});
 const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate fields fixture');const allowed={...contract.newFixtureSHA256,[fixture]:sha(declaration)};
 const kept=rows.filter(f=>{if(!Object.hasOwn(allowed,f))return true;assert.equal(sha(fs.readFileSync(path.join(rootDir,f))),allowed[f],'Exact new fields fixture '+f);return false;});return kept.length?kept.join('\n')+'\n':'';
}
module.exports={normalizeCountrysideFieldsSource,assertCountrysideFieldsCurrent,normalizeCountrysideFieldsFixtureChanges};

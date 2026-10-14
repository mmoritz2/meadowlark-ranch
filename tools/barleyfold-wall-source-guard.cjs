// Exact barleyfold-farm-wall-1 inverse. Inapplicability is not source certification.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/barleyfold-wall-3173712/source-contract.json',sha=b=>crypto.createHash('sha256').update(b).digest('hex'),baseRoot=path.join(__dirname,'..'),declaration=fs.readFileSync(path.join(baseRoot,fixture));
assert.equal(sha(declaration),'12fbd830de353c12ca8f8ffcef08dc2b7e27bf700b258a5b444a79e4e08679a4','Exact Barleyfold source declaration');const contract=JSON.parse(declaration);
function normalizeBarleyfoldWallSource(source,file){
 const row=contract.files[file]||contract.observers[file];if(!row)return source;
 const hash=sha(source);if(hash===row.beforeSHA256)return source;
 const buffer=Buffer.isBuffer(source),text=buffer?source.toString('utf8'):source;
 if(hash!==row.afterSHA256&&!text.includes(contract.marker))return source;
 assert.equal(hash,row.afterSHA256,'Whole approved Barleyfold owner '+file);let parent=text;
 for(const c of row.changes.toReversed()){assert.equal(parent.split(c.after).length-1,c.occurrences,'Counted Barleyfold inverse '+file);parent=parent.replaceAll(c.after,c.before);}
 assert.equal(sha(parent),row.beforeSHA256,'Whole exact317 parent '+file);return buffer?Buffer.from(parent):parent;
}
function assertBarleyfoldWallCurrent(read,{rootDir=baseRoot}={}){
 const current=typeof read==='function'?read:file=>fs.readFileSync(path.join(rootDir,file));
 for(const[f,row]of Object.entries({...contract.files,...contract.observers}))assert.equal(sha(current(f)),row.afterSHA256,'Actual raw Barleyfold owner '+f);
 for(const[f,row]of Object.entries(contract.addedFiles))assert.equal(sha(current(f)),row.sha256,'Actual raw added Barleyfold owner '+f);
 for(const[f,h]of Object.entries(contract.parentFixtureSHA256))assert.equal(sha(current(f)),h,'Exact prior Barleyfold fixture '+f);return true;
}
function normalizeBarleyfoldWallFixtureChanges(diff,{rootDir=baseRoot}={}){
 const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate Barleyfold fixture');
 const kept=rows.filter(f=>{if(f!==fixture)return true;assert.equal(sha(fs.readFileSync(path.join(rootDir,f))),sha(declaration),'Exact new Barleyfold fixture');return false;});return kept.length?kept.join('\n')+'\n':'';
}
module.exports={normalizeBarleyfoldWallSource,assertBarleyfoldWallCurrent,normalizeBarleyfoldWallFixtureChanges};

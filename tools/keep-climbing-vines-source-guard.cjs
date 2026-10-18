// Exact current Keep climbing vines leaf; no older guard imports and no weak normalization.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/keep-vines-95db0ef/source-contract.json',sha=b=>crypto.createHash('sha256').update(b).digest('hex'),baseRoot=path.join(__dirname,'..'),declaration=fs.readFileSync(path.join(baseRoot,fixture));
assert.equal(sha(declaration),'0c576354af12884c1d3f32e534c636c8b5b5f0abd7c4f474332c3ab1792678d1','Exact Keep climbing vines source declaration');const contract=JSON.parse(declaration);
function normalizeKeepClimbingVinesSource(source,file){
 const row=contract.files[file]||contract.observers[file];if(!row)return source;const hash=sha(source);if(hash===row.beforeSHA256)return source;
 const buffer=Buffer.isBuffer(source),text=buffer?source.toString('utf8'):source;if(hash!==row.afterSHA256&&!contract.markers.some(m=>text.includes(m)))return source;
 assert.equal(hash,row.afterSHA256,'Whole approved Keep climbing vines owner '+file);let parent=text;
 for(const e of [...row.changes].reverse()){assert.equal(parent.split(e.after).length-1,e.occurrences,'Counted Keep climbing vines inverse '+file);parent=parent.replaceAll(e.after,e.before);}
 assert.equal(sha(parent),row.beforeSHA256,'Whole exact95db0ef parent '+file);return buffer?Buffer.from(parent):parent;
}
function assertKeepClimbingVinesCurrent(read,{rootDir=baseRoot}={}){
 const raw=typeof read==='function'?read:file=>fs.readFileSync(path.join(rootDir,file));
 for(const[f,row]of Object.entries({...contract.files,...contract.observers}))assert.equal(sha(raw(f)),row.afterSHA256,'Actual raw Keep climbing vines owner '+f);
 for(const[f,row]of Object.entries(contract.addedFiles))assert.equal(sha(raw(f)),row.sha256,'Actual raw added Keep climbing vines helper/test '+f);
 for(const[f,h]of Object.entries({...contract.parentFixtureSHA256,...contract.newFixtureSHA256}))assert.equal(sha(raw(f)),h,'Exact current Keep climbing vines fixture '+f);return true;
}
function normalizeKeepClimbingVinesFixtureChanges(diff,{rootDir=baseRoot}={}){
 const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate Keep climbing vines fixture');const allowed={...contract.newFixtureSHA256,[fixture]:sha(declaration)};
 const kept=rows.filter(f=>{if(!Object.hasOwn(allowed,f))return true;assert.equal(sha(fs.readFileSync(path.join(rootDir,f))),allowed[f],'Exact new Keep climbing vines fixture '+f);return false;});return kept.length?kept.join('\n')+'\n':'';
}
module.exports={normalizeKeepClimbingVinesSource,assertKeepClimbingVinesCurrent,normalizeKeepClimbingVinesFixtureChanges};

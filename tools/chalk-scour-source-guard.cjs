// Exact current Chalk scour leaf; no older guard imports and no weak normalization.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/chalk-scour-d60aac1/source-contract.json',sha=b=>crypto.createHash('sha256').update(b).digest('hex'),baseRoot=path.join(__dirname,'..'),declaration=fs.readFileSync(path.join(baseRoot,fixture));
assert.equal(sha(declaration),'df95f667ed95f021e344d7814c4d5f582cf538509893e799c62406161584eaac','Exact Chalk scour source declaration');const contract=JSON.parse(declaration);
function normalizeChalkScourSource(source,file){
 const row=contract.files[file]||contract.observers[file];if(!row)return source;const hash=sha(source);if(hash===row.beforeSHA256)return source;
 const buffer=Buffer.isBuffer(source),text=buffer?source.toString('utf8'):source;if(hash!==row.afterSHA256&&!contract.markers.some(m=>text.includes(m)))return source;
 assert.equal(hash,row.afterSHA256,'Whole approved Chalk scour owner '+file);let parent=text;
 for(const e of [...row.changes].reverse()){assert.equal(parent.split(e.after).length-1,e.occurrences,'Counted Chalk scour inverse '+file);parent=parent.replaceAll(e.after,e.before);}
 assert.equal(sha(parent),row.beforeSHA256,'Whole exactd60aac1 parent '+file);return buffer?Buffer.from(parent):parent;
}
function assertChalkScourCurrent(read,{rootDir=baseRoot}={}){
 const raw=typeof read==='function'?read:file=>fs.readFileSync(path.join(rootDir,file));
 for(const[f,row]of Object.entries({...contract.files,...contract.observers}))assert.equal(sha(raw(f)),row.afterSHA256,'Actual raw Chalk scour owner '+f);
 for(const[f,row]of Object.entries(contract.addedFiles))assert.equal(sha(raw(f)),row.sha256,'Actual raw added Chalk scour helper/test '+f);
 for(const[f,h]of Object.entries({...contract.parentFixtureSHA256,...contract.newFixtureSHA256}))assert.equal(sha(raw(f)),h,'Exact current Chalk scour fixture '+f);return true;
}
function normalizeChalkScourFixtureChanges(diff,{rootDir=baseRoot}={}){
 const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate Chalk scour fixture');const allowed={...contract.newFixtureSHA256,[fixture]:sha(declaration)};
 const kept=rows.filter(f=>{if(!Object.hasOwn(allowed,f))return true;assert.equal(sha(fs.readFileSync(path.join(rootDir,f))),allowed[f],'Exact new Chalk scour fixture '+f);return false;});return kept.length?kept.join('\n')+'\n':'';
}
async function loadPublishedChalkDown({rootDir=baseRoot}={}){
 const read=f=>fs.readFileSync(path.join(rootDir,f),'utf8'),data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
 const helper=normalizeChalkScourSource(read('assets/chalk-downland.mjs'),'assets/chalk-downland.mjs');
 let owner=normalizeChalkScourSource(read('assets/chalk-down.js'),'assets/chalk-down.js');
 for(const[f,s]of[['assets/chalk-downland.mjs',helper],['assets/chalk-down.js',owner]])assert.equal(sha(s),contract.files[f].beforeSHA256,'Published Chalk factory '+f);
 const edge="'./chalk-downland.mjs?v=landmark-fields-1'";assert.equal(owner.split(edge).length-1,1,'One historical Chalk helper import');owner=owner.replace(edge,JSON.stringify(data(helper)));return import(data(owner));
}
module.exports={normalizeChalkScourSource,assertChalkScourCurrent,normalizeChalkScourFixtureChanges,loadPublishedChalkDown};

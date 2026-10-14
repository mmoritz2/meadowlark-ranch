const {normalizeNorthFormalNorthSource,normalizeNorthFormalNorthObserver,normalizeNorthFormalFixtureChanges}=require('./north-formal-composition-source-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const dir=path.join(__dirname,'fixtures/north-rim-planar-22b72cc'),contract=JSON.parse(fs.readFileSync(path.join(dir,'contract.json'))),changes=JSON.parse(fs.readFileSync(path.join(dir,'source-changes.json'))),observers=JSON.parse(fs.readFileSync(path.join(dir,'observer-changes.json'))),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function undoNorthRimSource(source,file){
 source=normalizeNorthFormalNorthSource(source,file);
 const row=contract.files[file];if(!row)return source;
 const marked=source.includes('coyote-macroform-5')||(file==='assets/coyote-macroform.mjs'&&source.includes('function northPlanarDrop('));
 if(sha(source)!==row.candidateSHA256&&!marked)return source;
 assert.equal(sha(source),row.candidateSHA256,'Entire accepted NorthV3 source/cache owner '+file);
 for(const c of changes.toReversed().filter(c=>c.file===file)){assert.equal(source.split(c.after).length,2,'One exact NorthV3 source/cache group '+file);source=source.replace(c.after,c.before);}
 assert.equal(sha(source),row.baselineSHA256,'Entire22b prior NorthV3 owner restored '+file);return source;
}
function undoNorthRimObserverSource(source,file){
 source=normalizeNorthFormalNorthObserver(source,file);
 const row=observers[file];if(!row)return source;
 if(sha(source)===row.beforeSHA256)return source;
 if(!row.changes.some(c=>source.includes(c.after)))return source;
 assert.equal(sha(source),row.afterSHA256,'Entire accepted NorthV3 history observer '+file);
 for(const c of row.changes.toReversed()){assert.equal(source.split(c.after).length,2,'One exact NorthV3 observer seam '+file);source=source.replace(c.after,c.before);}
 assert.equal(sha(source),row.beforeSHA256,'Entire pinned previous observer restored '+file);return source;
}
function undoNorthRimFixtureChanges(diff){
 diff=normalizeNorthFormalFixtureChanges(diff);
 const file='tools/fixtures/north-rim-planar-22b72cc/added-fixture-sha.json',text=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 assert.equal(sha(text),'22d33eff0fdde272fb069e36bdd5841a861b5b101483906348dcc76a9d88ddc6','Exact new NorthV3 fixture registry');
 const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate fixture diff paths');
 const allowed={...JSON.parse(text).approvedAddedFixtureSHA256,[file]:'22d33eff0fdde272fb069e36bdd5841a861b5b101483906348dcc76a9d88ddc6'};
 const rest=rows.filter(f=>{if(!Object.hasOwn(allowed,f))return true;assert.equal(sha(fs.readFileSync(path.join(__dirname,'..',f))),allowed[f],'Exact named new NorthV3 fixture '+f);return false;});
 return rest.length?rest.join('\n')+'\n':'';
}
module.exports={undoNorthRimSource,undoNorthRimObserverSource,undoNorthRimFixtureChanges};

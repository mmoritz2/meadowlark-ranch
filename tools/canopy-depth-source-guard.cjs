const {normalizeLeafCameraClearanceAuditSource,normalizeLeafCameraClearanceFixtureChanges}=require('./leaf-camera-clearance-source-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/canopy-depth-8f5ad05/contract.json',sha=s=>crypto.createHash('sha256').update(s).digest('hex'),text=fs.readFileSync(path.join(__dirname,'..',fixture),'utf8');
assert.equal(sha(text),'c68b308774c0807cec57c6fad36d40bdbe35e9b2d988caf9869a7efa976c5e69','Exact approved canopy source declaration');const contract=JSON.parse(text);
// Pure source/observer history only. Actual runtime and behavior tests retain
// their current modules, geometry, resources, layout and selector functions.
function view(source,file,kind){source=normalizeLeafCameraClearanceAuditSource(source,file);const row=contract[kind][file];if(!row)return source;const hash=sha(source);if(hash===row.beforeSHA256)return source;
 if(!row.changes.some(c=>source.includes(c.after)))return source;
 assert.equal(hash,row.afterSHA256,'Whole current approved canopy '+kind+' owner '+file);
 for(const c of row.changes.toReversed()){assert.equal(source.split(c.after).length-1,c.occurrences,'One exact canopy history group '+file);source=source.replace(c.after,c.before);}
 assert.equal(sha(source),row.beforeSHA256,'Whole exact pre-canopy owner restored '+file);return source;}
const normalizeCanopyDepthSource=(s,f)=>view(s,f,'files'),normalizeCanopyDepthObserver=(s,f)=>view(s,f,'observers'),normalizeCanopyDepthAuditSource=(s,f)=>normalizeCanopyDepthObserver(normalizeCanopyDepthSource(s,f),f);
function assertCanopyDepthCurrent(source,file){source=normalizeLeafCameraClearanceAuditSource(source,file);const row=contract.files[file]||contract.observers[file]||contract.addedFiles[file];assert(row,'Declared current canopy owner '+file);assert.equal(sha(source),row.afterSHA256||row.sha256,'Whole current approved canopy body '+file);return true;}
function normalizeCanopyDepthFixtureChanges(diff){diff=normalizeLeafCameraClearanceFixtureChanges(diff);const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate canopy fixture paths');const kept=rows.filter(file=>{if(file!==fixture)return true;assert.equal(sha(fs.readFileSync(path.join(__dirname,'..',file))),sha(text),'Exact named canopy fixture');return false;});return kept.length?kept.join('\n')+'\n':'';}
module.exports={normalizeCanopyDepthSource,normalizeCanopyDepthObserver,normalizeCanopyDepthAuditSource,assertCanopyDepthCurrent,normalizeCanopyDepthFixtureChanges};

const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/leaf-camera-clearance-0f9cd99/contract.json',sha=s=>crypto.createHash('sha256').update(s).digest('hex'),text=fs.readFileSync(path.join(__dirname,'..',fixture),'utf8');
assert.equal(sha(text),'3c9c30690568740a3c95c484a8fd12767460e2fbcdd4fae9110910b785b0502b','Exact approved leaf camera clearance declaration');const contract=JSON.parse(text);
// Source/assertion history only. Runtime and shader tests inspect current raw files.
function view(source,file,kind){const row=contract[kind][file];if(!row)return source;const hash=sha(source);if(hash===row.beforeSHA256)return source;
 if(!row.changes.some(c=>source.includes(c.after)))return source;
 assert.equal(hash,row.afterSHA256,'Whole current approved leaf camera clearance '+kind+' owner '+file);
 for(const c of row.changes.toReversed()){assert.equal(source.split(c.after).length-1,c.occurrences,'One exact leaf camera clearance history group '+file);source=source.replace(c.after,c.before);}
 assert.equal(sha(source),row.beforeSHA256,'Whole exact pre-clearance owner restored '+file);return source;}
const normalizeLeafCameraClearanceSource=(s,f)=>view(s,f,'files'),normalizeLeafCameraClearanceObserver=(s,f)=>view(s,f,'observers'),normalizeLeafCameraClearanceAuditSource=(s,f)=>normalizeLeafCameraClearanceObserver(normalizeLeafCameraClearanceSource(s,f),f);
function assertLeafCameraClearanceCurrent(source,file){const row=contract.files[file]||contract.observers[file]||contract.addedFiles[file];assert(row,'Declared current leaf camera clearance owner '+file);assert.equal(sha(source),row.afterSHA256||row.sha256,'Whole current approved leaf camera clearance body '+file);return true;}
function normalizeLeafCameraClearanceFixtureChanges(diff){const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate leaf camera clearance fixture paths');const kept=rows.filter(file=>{if(file!==fixture)return true;assert.equal(sha(fs.readFileSync(path.join(__dirname,'..',file))),sha(text),'Exact named leaf camera clearance fixture');return false;});return kept.length?kept.join('\n')+'\n':'';}
module.exports={normalizeLeafCameraClearanceSource,normalizeLeafCameraClearanceObserver,normalizeLeafCameraClearanceAuditSource,assertLeafCameraClearanceCurrent,normalizeLeafCameraClearanceFixtureChanges};

const {normalizeOutcropClearanceAuditSource,normalizeOutcropClearanceFixtureChanges}=require('./outcrop-clearance-source-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/grazed-natural-6e91739/contract.json',sha=s=>crypto.createHash('sha256').update(s).digest('hex'),text=fs.readFileSync(path.join(__dirname,'..',fixture),'utf8');
assert.equal(sha(text),'06e7295694ba5f78961ab136ca9d32c44d0b6bc430c741402f6142cd09831242','Exact approved fine grazed turf declaration');const contract=JSON.parse(text);
// Complete-source history only. New geometry/wind/controller tests use actual
// current production modules; the old14-leaf profile has an explicit adapter.
function view(source,file,kind){source=normalizeOutcropClearanceAuditSource(source,file);const row=contract[kind][file];if(!row)return source;const hash=sha(source);if(hash===row.beforeSHA256)return source;
 if(!row.changes.some(c=>source.includes(c.after)))return source;
 assert.equal(hash,row.afterSHA256,'Whole current approved fine grazed turf '+kind+' owner '+file);
 for(const c of row.changes.toReversed()){assert.equal(source.split(c.after).length-1,c.occurrences,'Exact fine grazed turf history group '+file);source=source.replace(c.after,c.before);}
 assert.equal(sha(source),row.beforeSHA256,'Whole exact6e9 fine turf parent restored '+file);return source;}
const normalizeGrazedNaturalSource=(s,f)=>view(s,f,'files'),normalizeGrazedNaturalObserver=(s,f)=>view(s,f,'observers'),normalizeGrazedNaturalAuditSource=(s,f)=>normalizeGrazedNaturalObserver(normalizeGrazedNaturalSource(s,f),f);
function assertGrazedNaturalCurrent(source,file){source=normalizeOutcropClearanceAuditSource(source,file);const row=contract.files[file]||contract.observers[file]||contract.addedFiles[file];assert(row,'Declared current fine grazed turf owner '+file);assert.equal(sha(source),row.afterSHA256||row.sha256,'Whole current approved fine grazed turf body '+file);return true;}
function normalizeGrazedNaturalFixtureChanges(diff){diff=normalizeOutcropClearanceFixtureChanges(diff);const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate fine grazed turf fixture paths');const kept=rows.filter(file=>{const expected=file===fixture?sha(text):contract.addedFixtureSHA256[file];if(!expected)return true;assert.equal(sha(fs.readFileSync(path.join(__dirname,'..',file))),expected,'Exact named fine grazed turf fixture');return false;});return kept.length?kept.join('\n')+'\n':'';}
module.exports={normalizeGrazedNaturalSource,normalizeGrazedNaturalObserver,normalizeGrazedNaturalAuditSource,assertGrazedNaturalCurrent,normalizeGrazedNaturalFixtureChanges};

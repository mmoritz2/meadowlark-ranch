const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/broadleaf-depth-60cb73c/contract.json',sha=s=>crypto.createHash('sha256').update(s).digest('hex'),text=fs.readFileSync(path.join(__dirname,'..',fixture),'utf8');
assert.equal(sha(text),'141a1805a5951a51fe9c5ce719b1b5e9932f1dfc177ba83d0d51ef70bd1060a3','Exact approved projected middle crown declaration');const contract=JSON.parse(text);
// Whole-source history only. Actual projection/model/history tests import raw code.
function view(source,file,kind){const row=contract[kind][file];if(!row)return source;if(Buffer.isBuffer(source)){const original=source.toString('utf8'),restored=view(original,file,kind);return restored===original?source:Buffer.from(restored);}const hash=sha(source);if(hash===row.beforeSHA256)return source;
 if(!row.changes.some(c=>source.includes(c.after)))return source;
 assert.equal(hash,row.afterSHA256,'Whole current approved projected crown '+kind+' owner '+file);
 for(const c of row.changes.toReversed()){assert.equal(source.split(c.after).length-1,c.occurrences,'Exact projected crown history group '+file);source=source.replace(c.after,c.before);}
 assert.equal(sha(source),row.beforeSHA256,'Whole exact60cb parent restored '+file);return source;}
const normalizeBroadleafDepthSource=(s,f)=>view(s,f,'files'),normalizeBroadleafDepthObserver=(s,f)=>view(s,f,'observers'),normalizeBroadleafDepthAuditSource=(s,f)=>normalizeBroadleafDepthObserver(normalizeBroadleafDepthSource(s,f),f);
function assertBroadleafDepthCurrent(source,file){const row=contract.files[file]||contract.observers[file]||contract.addedFiles[file];assert(row,'Declared current projected crown owner '+file);assert.equal(sha(source),row.afterSHA256||row.sha256,'Whole current approved projected crown body '+file);return true;}
function normalizeBroadleafDepthFixtureChanges(diff){const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate projected crown fixture paths');const kept=rows.filter(file=>{const expected=file===fixture?sha(text):contract.addedFixtureSHA256[file];if(!expected)return true;assert.equal(sha(fs.readFileSync(path.join(__dirname,'..',file))),expected,'Exact named projected crown fixture');return false;});return kept.length?kept.join('\n')+'\n':'';}
module.exports={normalizeBroadleafDepthSource,normalizeBroadleafDepthObserver,normalizeBroadleafDepthAuditSource,assertBroadleafDepthCurrent,normalizeBroadleafDepthFixtureChanges};

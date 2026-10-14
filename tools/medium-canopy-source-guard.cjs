const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/medium-canopy-08d4/source-contract.json',sha=s=>crypto.createHash('sha256').update(s).digest('hex'),text=fs.readFileSync(path.join(__dirname,'..',fixture),'utf8');
assert.equal(sha(text),'80bb196caf297ba8dee543d3c899d3b730a4b1cd39613de94397f97be46ca4f7','Exact approved Island medium source declaration');const contract=JSON.parse(text);
// Whole-source history only. Raw current runtime/model/lifecycle tests never use this view.
function view(source,file,kind){const row=contract[kind][file];if(!row)return source;if(Buffer.isBuffer(source)){const old=source.toString('utf8'),restored=view(old,file,kind);return restored===old?source:Buffer.from(restored);}const hash=sha(source);if(hash===row.beforeSHA256)return source;
 if(!row.changes.some(c=>source.includes(c.after)))return source;
 assert.equal(hash,row.afterSHA256,'Whole current approved Island medium '+kind+' owner '+file);
 for(const c of row.changes.toReversed()){assert.equal(source.split(c.after).length-1,c.occurrences,'Exact Island medium history group '+file);source=source.replaceAll(c.after,c.before);}
 assert.equal(sha(source),row.beforeSHA256,'Whole exact08d4 parent restored '+file);return source;}
const normalizeMediumCanopySource=(s,f)=>view(s,f,'files'),normalizeMediumCanopyObserver=(s,f)=>view(s,f,'observers'),normalizeMediumCanopyAuditSource=(s,f)=>normalizeMediumCanopyObserver(normalizeMediumCanopySource(s,f),f);
function assertMediumCanopyCurrent(source,file){const row=contract.files[file]||contract.observers[file]||contract.addedFiles[file];assert(row,'Declared current Island medium owner '+file);assert.equal(sha(source),row.afterSHA256||row.sha256,'Whole current approved Island medium body '+file);return true;}
function normalizeMediumCanopyFixtureChanges(diff){const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate Island medium fixture paths');const kept=rows.filter(file=>{if(file!==fixture)return true;assert.equal(sha(fs.readFileSync(path.join(__dirname,'..',file))),sha(text),'Exact named Island medium fixture');return false;});return kept.length?kept.join('\n')+'\n':'';}
module.exports={normalizeMediumCanopySource,normalizeMediumCanopyObserver,normalizeMediumCanopyAuditSource,assertMediumCanopyCurrent,normalizeMediumCanopyFixtureChanges};

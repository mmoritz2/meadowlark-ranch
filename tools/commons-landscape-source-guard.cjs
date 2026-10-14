const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/commons-landscape-2fbab/contract.json',sha=s=>crypto.createHash('sha256').update(s).digest('hex'),text=fs.readFileSync(path.join(__dirname,'..',fixture),'utf8');
assert.equal(sha(text),'93569794ce7231d44ba7637feb099db76b6d8c70d28869075474b1870b7e8008','Exact approved commons landscape declaration');const contract=JSON.parse(text);
// Complete-source history view only. Actual commons model and sward tests import
// live current modules and never pass their implementation through this leaf.
function view(source,file,kind){const row=contract[kind][file];if(!row)return source;const hash=sha(source);if(hash===row.beforeSHA256)return source;
 if(!row.changes.some(c=>source.includes(c.after)))return source;
 assert.equal(hash,row.afterSHA256,'Whole current approved commons landscape '+kind+' owner '+file);
 for(const c of row.changes.toReversed()){assert.equal(source.split(c.after).length-1,c.occurrences,'Exact commons landscape history group '+file);source=source.replace(c.after,c.before);}
 assert.equal(sha(source),row.beforeSHA256,'Whole exact 2fbab commons parent restored '+file);return source;}
const normalizeCommonsLandscapeSource=(s,f)=>view(s,f,'files'),normalizeCommonsLandscapeObserver=(s,f)=>view(s,f,'observers'),normalizeCommonsLandscapeAuditSource=(s,f)=>normalizeCommonsLandscapeObserver(normalizeCommonsLandscapeSource(s,f),f);
function assertCommonsLandscapeCurrent(source,file){const row=contract.files[file]||contract.observers[file]||contract.addedFiles[file];assert(row,'Declared current commons landscape owner '+file);assert.equal(sha(source),row.afterSHA256||row.sha256,'Whole current approved commons landscape body '+file);return true;}
function normalizeCommonsLandscapeFixtureChanges(diff){const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate commons landscape fixture paths');const kept=rows.filter(file=>{const expected=file===fixture?sha(text):contract.addedFixtureSHA256[file];if(!expected)return true;assert.equal(sha(fs.readFileSync(path.join(__dirname,'..',file))),expected,'Exact named commons landscape fixture');return false;});return kept.length?kept.join('\n')+'\n':'';}
module.exports={normalizeCommonsLandscapeSource,normalizeCommonsLandscapeObserver,normalizeCommonsLandscapeAuditSource,assertCommonsLandscapeCurrent,normalizeCommonsLandscapeFixtureChanges};

const {normalizePasturePassageSource,normalizePasturePassageObserver,normalizePasturePassageFixtures}=require('./pasture-passage-source-guard.cjs');
const {normalizeNorthFormalFormalSource,normalizeNorthFormalFormalObserver,normalizeNorthFormalFormalAuditSource,normalizeNorthFormalFixtureChanges}=require('./north-formal-composition-source-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/formal-turf-ff10ddd/contract.json',sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const text=fs.readFileSync(path.join(__dirname,'..',fixture),'utf8');assert.equal(sha(text),'7e0329c60ce26374cd640903773d18cc5e10aef0237679130b60c84e38d1e279','Exact approved formal/turf merge contract');const contract=JSON.parse(text);
// Built-in-only leaf: never initialize Turf, Formal or the historical world
// guard dependency graph while their raw input pins are being reconstructed.
function reverse(source,rows,label,file){for(const c of rows.toReversed()){
 assert.equal(source.split(c.after).length-1,c.occurrences,'One exact merged '+label+' literal '+file);
 if(c.before)assert.equal(source.replace(c.after,'').split(c.before).length-1,0,'No mixed parent/'+label+' literal '+file);
 source=source.replace(c.after,c.before);
}return source;}
function sourceView(source,file,view){source=normalizeNorthFormalFormalSource(source,file);source=normalizePasturePassageSource(source,file);const row=contract.files[file];if(!row)return source;const hash=sha(source),target=row[view+'SHA256'];if(hash===target)return source;
 const groups=contract['to'+view[0].toUpperCase()+view.slice(1)].filter(c=>c.file===file);
 if(hash!==row.mergedSHA256&&[row.formalSHA256,row.incomingSHA256,row.baseSHA256].includes(hash))return source;
 if(!groups.some(c=>source.includes(c.after)))return source;
 assert.equal(hash,row.mergedSHA256,'Whole approved merged owner '+file);source=reverse(source,groups,view,file);assert.equal(sha(source),target,'Complete '+view+' parent owner '+file);return source;}
function observerView(source,file,view){source=normalizeNorthFormalFormalObserver(source,file);source=normalizePasturePassageObserver(source,file);const views=contract.observers[file],row=views?.[view];if(!row)return source;const hash=sha(source);if(hash===row.beforeSHA256)return source;
 if(hash!==row.afterSHA256&&Object.values(views).some(v=>v.beforeSHA256===hash))return source;
 if(!row.changes.some(c=>source.includes(c.after)))return source;
 assert.equal(hash,row.afterSHA256,'Whole approved merged observer '+file);source=reverse(source,row.changes,view,file);assert.equal(sha(source),row.beforeSHA256,'Complete '+view+' parent observer '+file);return source;}
const normalizeFormalTurfFormalSource=(s,f)=>sourceView(s,f,'formal'),normalizeFormalTurfIncomingSource=(s,f)=>sourceView(s,f,'incoming');
const normalizeFormalTurfFormalObserver=(s,f)=>observerView(s,f,'formal'),normalizeFormalTurfIncomingObserver=(s,f)=>observerView(s,f,'incoming');
const normalizeFormalTurfFormalAuditSource=(s,f)=>normalizeFormalTurfFormalObserver(normalizeFormalTurfFormalSource(s,f),f),normalizeFormalTurfIncomingAuditSource=(s,f)=>normalizeFormalTurfIncomingObserver(normalizeFormalTurfIncomingSource(s,f),f);
function fixtures(diff,baseline,view){diff=normalizeNorthFormalFixtureChanges(diff);diff=normalizePasturePassageFixtures(diff,baseline);assert.equal(baseline,contract.fixtureBaseline,'Exact historical fixture baseline');const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate fixture rows');const allowed={...contract.approvedAddedByView[view],[fixture]:sha(text)};const kept=rows.filter(file=>{if(!Object.hasOwn(allowed,file))return true;assert.equal(sha(fs.readFileSync(path.join(__dirname,'..',file))),allowed[file],'Exact approved other-parent/new fixture '+file);return false;});return kept.length?kept.join('\n')+'\n':'';}
const normalizeFormalTurfFormalFixtures=(s,b)=>fixtures(s,b,'formal'),normalizeFormalTurfIncomingFixtures=(s,b)=>fixtures(s,b,'incoming');
function assertFormalTurfCurrent(source,file){source=normalizeNorthFormalFormalAuditSource(source,file);const row=contract.files[file],views=contract.observers[file],expected=row?.mergedSHA256||(views?Object.values(views)[0].afterSHA256:null)||contract.strictFormalFiles[file]||contract.strictIncomingFiles[file];assert(expected,'Declared merge subject '+file);assert.equal(sha(source),expected,'Entire current approved merge subject '+file);return true;}
module.exports={normalizeFormalTurfFormalSource,normalizeFormalTurfIncomingSource,normalizeFormalTurfFormalObserver,normalizeFormalTurfIncomingObserver,normalizeFormalTurfFormalAuditSource,normalizeFormalTurfIncomingAuditSource,normalizeFormalTurfFormalFixtures,normalizeFormalTurfIncomingFixtures,assertFormalTurfCurrent};

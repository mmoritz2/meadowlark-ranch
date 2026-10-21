// Exact V24 appearance inverse before the existing historical environment authorities.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),baseRoot=path.join(__dirname,'..'),fixture='tools/fixtures/hollowpeak-thaw-floor-c2bd629/source-contract.json',declaration=fs.readFileSync(path.join(baseRoot,fixture));
assert.equal(sha(declaration),'d7e2e10eb468fec7e22ef8c675cd0a0a611f0b019adf1b0b10030f5f3284e2a5','Exact Hollowpeak thaw-floor source declaration');const contract=JSON.parse(declaration);
function normalizeHollowpeakThawSource(source,file){
 const row=contract.files[file];if(!row)return source;const hash=sha(source);if(hash===row.beforeSHA256)return source;
 const buffer=Buffer.isBuffer(source),text=buffer?source.toString('utf8'):source;
 // Older cohorts pass through to their unchanged complete-body authority. A
 // marked V24 body is never accepted partially, with drift or a mixed cache.
 if(hash!==row.afterSHA256&&!contract.markers.some(m=>text.includes(m)))return source;
 assert.equal(hash,row.afterSHA256,'Whole approved Hollowpeak thaw-floor owner '+file);let parent=text;
 for(const e of [...row.changes].reverse()){assert.equal(parent.split(e.after).length-1,e.occurrences,'Counted Hollowpeak thaw-floor inverse '+file);parent=parent.replaceAll(e.after,e.before);}
 assert.equal(sha(parent),row.beforeSHA256,'Whole exact c2bd629 parent '+file);return buffer?Buffer.from(parent):parent;
}
function assertHollowpeakThawCurrent(read,{rootDir=baseRoot}={}){
 const input=typeof read==='function'?read:file=>fs.readFileSync(path.join(rootDir,file));
 for(const[file,row]of Object.entries(contract.files))assert.equal(sha(input(file)),row.afterSHA256,'Actual current Hollowpeak thaw-floor owner '+file);
 assert.equal(sha(input(contract.addedHelper.file)),contract.addedHelper.sha256,'Actual current Hollowpeak thaw-floor helper');return true;
}
module.exports={normalizeHollowpeakThawSource,assertHollowpeakThawCurrent};

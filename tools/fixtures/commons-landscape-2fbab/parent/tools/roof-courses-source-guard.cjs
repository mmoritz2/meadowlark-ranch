const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/roof-courses-efded6f/contract.json',sha=s=>crypto.createHash('sha256').update(s).digest('hex'),text=fs.readFileSync(path.join(__dirname,'..',fixture),'utf8');
assert.equal(sha(text),'1827d1b82188984c0bc38754de0e469c6e25fbc02c0b3d7944d5f31159183acd','Exact approved dimensional roof declaration');const contract=JSON.parse(text);
// This leaf restores complete parent source/observer bodies for old authorities.
// Geometry, material, collision, resource and constructor tests use actual modules.
function view(source,file,kind){const row=contract[kind][file];if(!row)return source;const hash=sha(source);if(hash===row.beforeSHA256)return source;
 if(!row.changes.some(c=>source.includes(c.after)))return source;
 assert.equal(hash,row.afterSHA256,'Whole current approved roof courses '+kind+' owner '+file);
 for(const c of row.changes.toReversed()){assert.equal(source.split(c.after).length-1,c.occurrences,'One exact dimensional roof history group '+file);source=source.replace(c.after,c.before);}
 assert.equal(sha(source),row.beforeSHA256,'Whole exact efded6f roof parent restored '+file);return source;}
const normalizeRoofCoursesSource=(s,f)=>view(s,f,'files'),normalizeRoofCoursesObserver=(s,f)=>view(s,f,'observers'),normalizeRoofCoursesAuditSource=(s,f)=>normalizeRoofCoursesObserver(normalizeRoofCoursesSource(s,f),f);
function assertRoofCoursesCurrent(source,file){const row=contract.files[file]||contract.observers[file]||contract.addedFiles[file];assert(row,'Declared current dimensional roof owner '+file);assert.equal(sha(source),row.afterSHA256||row.sha256,'Whole current approved dimensional roof body '+file);return true;}
function normalizeRoofCoursesFixtureChanges(diff){const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate dimensional roof fixture paths');const kept=rows.filter(file=>{const expected=file===fixture?sha(text):contract.addedFixtureSHA256[file];if(!expected)return true;assert.equal(sha(fs.readFileSync(path.join(__dirname,'..',file))),expected,'Exact named dimensional roof fixture');return false;});return kept.length?kept.join('\n')+'\n':'';}
module.exports={normalizeRoofCoursesSource,normalizeRoofCoursesObserver,normalizeRoofCoursesAuditSource,assertRoofCoursesCurrent,normalizeRoofCoursesFixtureChanges};

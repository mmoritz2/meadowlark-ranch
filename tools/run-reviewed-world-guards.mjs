/* Run unchanged historical landscape/camera tests against an exact, disposable
 * projection of the current merged sources. Runtime behavior is tested directly
 * by the separate riding/ribbon/guide suites; this only composes preservation
 * preimages and never edits production, old tests, guards or their fixtures. */
import {mkdtempSync,mkdirSync,readdirSync,copyFileSync,symlinkSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {normalizeReviewedRuntimeSource,normalizeReviewedObserverSource,normalizeReviewedGuideSource} from './reviewed-riding-source-guard.cjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const projection=mkdtempSync(path.join(tmpdir(),'meadowlark-reviewed-world-'));
const observers=new Set(['tools/test-basic-riding-tack.mjs','tools/test-coyote-crag-composition.mjs','tools/test-starter-tack-catalog-preservation.mjs']);
const tests=[
 'tools/test-fieldstone-wall-cache-guard.mjs','tools/test-fieldstone-wall-lifecycle-cache-guard.mjs','tools/test-fine-hair-cache-guard.mjs',
 'tools/test-arched-grass-model.mjs','tools/test-arched-grass-wind.mjs','tools/test-follow-camera-authored-parts.mjs',
 'tools/test-follow-camera.mjs','tools/test-follow-camera-input.mjs','tools/test-fieldstone-wall-model.mjs','tools/test-fieldstone-wall-collision.mjs',
 'tools/test-grass-families.mjs','tools/test-grass-finesse.mjs','tools/test-grass-coverage.mjs',
 'tools/test-ranch-fieldstones-independent.mjs','tools/test-coyote-macroform.mjs','tools/test-coyote-macroform-independent.mjs',
 'tools/test-pastoral-source-independent.mjs','tools/test-pastoral-preservation-independent.mjs',
];
const requested=process.argv.slice(2);if(requested.some(name=>!tests.includes(name)))throw Error('Only the declared historical preservation suites may run');
function tree(relative=''){
 mkdirSync(path.join(projection,relative),{recursive:true});
 for(const ent of readdirSync(path.join(root,relative),{withFileTypes:true})){
  if(!relative&&[' .git'.trim(),'output','.playwright-mcp'].includes(ent.name))continue;
  const name=path.posix.join(relative,ent.name),dest=path.join(projection,name),src=path.join(root,name);
  if(ent.isDirectory()){
   if(['assets','tools','assets/features'].includes(name))tree(name);else symlinkSync(src,dest,'dir');
  }else if(name==='ranch3d.html'||name==='assets/features/index.js')writeFileSync(dest,normalizeReviewedRuntimeSource(readFileSync(src,'utf8'),name));
  else if(name==='assets/features/course-guide.js')writeFileSync(dest,normalizeReviewedGuideSource(readFileSync(src,'utf8'),name));
  // Incoming live observers now perform their own complete historical adapter
  // reversal; pre-projecting these copies would incorrectly reverse twice.
  else if(observers.has(name))copyFileSync(src,dest);
  // Copy all top-level tool modules so their import.meta.url/__dirname subject
  // and fixture paths use the projection; asset geometry stays the live source.
  else if(relative==='tools'&&/\.(?:mjs|cjs|js)$/.test(ent.name))copyFileSync(src,dest);
  else symlinkSync(src,dest);
 }
}
let result;
try{tree();process.stderr.write('Historical guard subject: exact reviewed riding/ribbon/guide projection; live merged world geometry remains unchanged.\n');result=spawnSync(process.execPath,['--test',...(requested.length?requested:tests)],{cwd:projection,stdio:'inherit'});}finally{rmSync(projection,{recursive:true,force:true});}
if(result.error)throw result.error;process.exitCode=result.status??1;

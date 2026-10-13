import {readFile,readdir,lstat,access} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

export const fileHash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function sourcePath(root,relative){
 if(typeof relative!=='string'||!relative||relative.includes('\\')||path.posix.isAbsolute(relative)||path.posix.normalize(relative)!==relative||relative==='.'||relative.split('/').includes('..'))throw Error('Invalid bundle source path: '+relative);
 const absolute=path.resolve(root,relative);
 if(!absolute.startsWith(path.resolve(root)+path.sep))throw Error('Bundle source escapes its tree: '+relative);
 return absolute;
}
const relativePath=(root,absolute)=>path.relative(root,absolute).split(path.sep).join('/');
async function walk(root,relative,include=()=>true,skipDirectories=new Set()){
 const directory=sourcePath(root,relative),rows=[];
 if((await lstat(directory)).isSymbolicLink())throw Error('Unexpected source symlink: '+relative);
 for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  const file=relative+'/'+entry.name;
  if(entry.isSymbolicLink())throw Error('Unexpected source symlink: '+file);
  if(entry.isDirectory()){if(!skipDirectories.has(entry.name))rows.push(...await walk(root,file,include,skipDirectories));}
  else if(entry.isFile()&&include(file))rows.push(file);
 }
 return rows;
}
async function existing(file){try{await access(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
export function currentRevision(root){return execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
export async function runtimeSourcePaths(root,spec){
 if(!spec||![spec.roots,spec.rootFiles,spec.reviewFiles,spec.excludedExtensions].every(Array.isArray))throw Error('Invalid native runtime asset specification');
 const files=new Set(['ranch3d.html']);
 for(const directory of spec.roots)for(const file of await walk(root,directory,p=>!spec.excludedExtensions.includes(path.posix.extname(p))))files.add(file);
 for(const file of spec.rootFiles){sourcePath(root,file);files.add(file);}
 for(const item of spec.reviewFiles){sourcePath(root,item.path);files.add(item.path);}
 return [...files].sort();
}
// Derive mandatory build inputs from the actual source tree, rather than from
// the manifest being checked. Source files, package JS/JSON and the installed
// esbuild entry executables are captured. Unused code changing requires a fresh
// stage too; no environment override or executable outside these packages is read.
export async function buildSourcePaths(root){
 const mandatory=['mobile/package.json','mobile/package-lock.json','mobile/runtime-assets.json','mobile/release-status.json',
  'mobile/capacitor.config.json','mobile/scripts/stage.mjs','mobile/scripts/bundle-freshness.mjs'];
 const files=new Set([...mandatory,...await walk(root,'mobile/src')]);
 for(const optional of ['mobile/tsconfig.json','tsconfig.json'])if(await existing(sourcePath(root,optional)))files.add(optional);
 const pkg=JSON.parse(await readFile(sourcePath(root,'mobile/package.json'),'utf8'));
 const packages=new Set();
 async function packageDirectory(name,from){
  if(typeof name!=='string'||!/^(?:@[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9_.-]+$/.test(name))throw Error('Invalid build dependency name: '+name);
  let directory=from;
  while(directory===root||directory.startsWith(root+path.sep)){
   const candidate=path.join(directory,'node_modules',name,'package.json');
   if(await existing(candidate))return path.dirname(candidate);
   if(directory===root)break;directory=path.dirname(directory);
  }
  return null;
 }
 async function addPackage(name,from,optional=false){
  const directory=await packageDirectory(name,from);
  if(!directory){if(optional)return;throw Error('Native build dependency unavailable: '+name);}
  if(packages.has(directory))return;packages.add(directory);
  const rel=relativePath(root,directory);sourcePath(root,rel);
  const compiler=name==='esbuild'||name.startsWith('@esbuild/');
  for(const file of await walk(root,rel,p=>/\.(?:[cm]?js|json)$/.test(p)||(compiler&&(p===rel+'/bin/esbuild'||p===rel+'/esbuild.exe')),new Set(['node_modules'])))files.add(file);
  const data=JSON.parse(await readFile(path.join(directory,'package.json'),'utf8'));
  for(const name of Object.keys(data.dependencies||{}))await addPackage(name,directory);
  for(const name of Object.keys(data.optionalDependencies||{}))await addPackage(name,directory,true);
 }
 for(const name of Object.keys(pkg.dependencies||{}))await addPackage(name,path.join(root,'mobile'));
 if(pkg.devDependencies?.esbuild)await addPackage('esbuild',path.join(root,'mobile'));
 return [...files].sort();
}
async function inputRows(root,paths){
 const rows=[];
 for(const file of paths){if((await lstat(sourcePath(root,file))).isSymbolicLink())throw Error('Unexpected source symlink: '+file);rows.push({path:file,sha256:fileHash(await readFile(sourcePath(root,file)))});}
 return rows;
}
export async function captureBuildInputs(root){return {schema:1,files:await inputRows(root,await buildSourcePaths(root))};}
export async function assertBuildInputsUnchanged(root,captured){
 const current=await captureBuildInputs(root);
 if(JSON.stringify(current)!==JSON.stringify(captured))throw Error('Native build inputs changed during staging. Stage the frozen source again.');
}
export async function verifyBundleFreshness({root,base,manifest}){
 const failures=[];
 if(manifest?.schema!==2||manifest.buildInputs?.schema!==1||!Array.isArray(manifest.buildInputs.files)||!Array.isArray(manifest.bootstrapInputs)||!Array.isArray(manifest.files))return ['Legacy or incomplete native bundle metadata. Run stage again.'];
 if(manifest.mode!=='native-development-offline'||manifest.releaseReady!==false)failures.push('Native development release guard changed');
 let revision;try{revision=currentRevision(root);}catch{failures.push('Current source Git revision is unavailable');}
 if(revision&&manifest.sourceRevision!==revision)failures.push('Stale source Git revision: '+manifest.sourceRevision+'; current '+revision);
 let spec,required,currentInputs;
 try{spec=JSON.parse(await readFile(sourcePath(root,'mobile/runtime-assets.json'),'utf8'));required=await runtimeSourcePaths(root,spec);currentInputs=await captureBuildInputs(root);}catch(error){return [...failures,error.message];}
 const expected=new Map(required.filter(p=>p!=='ranch3d.html').map(p=>[p,p]));
 for(const alias of ['index.html','ranch3d.html'])expected.set(alias,'ranch3d.html');expected.set('native-bootstrap.js',null);
 const rows=new Map();
 for(const row of manifest.files){
  try{sourcePath(base,row.path);}catch(error){failures.push(error.message);continue;}
  if(rows.has(row.path)){failures.push('Duplicate bundle record: '+row.path);continue;}rows.set(row.path,row);
  if(!expected.has(row.path)){failures.push('Unrequested runtime bundle file: '+row.path);continue;}
  const source=expected.get(row.path);
  if(source===null){if(row.generated!==true||row.sourcePath!==undefined)failures.push('Invalid native bootstrap provenance');}
  else if(row.sourcePath!==source)failures.push('Missing or incorrect raw source path: '+row.path);
 }
 for(const [file,source] of expected){
  const row=rows.get(file);if(!row){failures.push('Required runtime asset omitted: '+file);continue;}
  try{
   const bytes=await readFile(sourcePath(base,file));
   if(row.sha256!==fileHash(bytes)||row.bytes!==bytes.length)failures.push('Generated file changed: '+file);
   if(source!==null&&row.sourceSha256!==fileHash(await readFile(sourcePath(root,source))))failures.push('Stale raw source: '+source+' -> '+file);
  }catch(error){failures.push('Required bundle/source file unavailable: '+file+' ('+error.code+')');}
 }
 for(const item of spec.reviewFiles){
  try{if(fileHash(await readFile(sourcePath(root,item.path)))!==item.sha256||rows.get(item.path)?.sha256!==item.sha256)failures.push('Approved runtime asset changed: '+item.path);}catch{failures.push('Approved runtime asset unavailable: '+item.path);}
 }
 const inputs=new Map();
 for(const row of manifest.buildInputs.files){
  try{sourcePath(root,row.path);}catch(error){failures.push(error.message);continue;}
  if(inputs.has(row.path))failures.push('Duplicate build input: '+row.path);inputs.set(row.path,row.sha256);
 }
 for(const row of currentInputs.files){
  if(!inputs.has(row.path))failures.push('Required build input omitted: '+row.path);
  else if(inputs.get(row.path)!==row.sha256)failures.push('Stale native build input: '+row.path);
 }
 const currentPaths=new Set(currentInputs.files.map(row=>row.path));
 for(const file of inputs.keys())if(!currentPaths.has(file))failures.push('Obsolete native build input: '+file);
 const bootstrapInputs=new Set();
 for(const file of manifest.bootstrapInputs){
  try{sourcePath(root,file);}catch(error){failures.push(error.message);continue;}
  if(bootstrapInputs.has(file))failures.push('Duplicate native bootstrap input: '+file);bootstrapInputs.add(file);
  if(!currentPaths.has(file))failures.push('Uncaptured native bootstrap input: '+file);
 }
 for(const file of ['mobile/src/bootstrap.js','mobile/src/save-store.mjs','mobile/src/save-confirmation.mjs'])if(!bootstrapInputs.has(file))failures.push('Required native bootstrap input omitted: '+file);
 try{
  const html=await readFile(sourcePath(base,'index.html'),'utf8'),alias=await readFile(sourcePath(base,'ranch3d.html'),'utf8'),bootstrap=await readFile(sourcePath(base,'native-bootstrap.js'),'utf8');
  if(html!==alias)failures.push('Generated game aliases disagree');
  if(!html.includes('const SOCIAL=false;'))failures.push('Native social guard missing');
  if(!html.includes('await window.MeadowlarkNative.ready;'))failures.push('Save hydration barrier missing');
  if(html.includes('localStorage'))failures.push('Unadapted game storage reference');
  if(!html.includes('window.MeadowlarkNative.attachGame'))failures.push('Native lifecycle hook missing');
  if(!html.includes('awaitConfirmedFresh:()=>window.MeadowlarkNative.confirmedSave(SAVE_KEY)'))failures.push('Native reward confirmation bridge missing');
  if(!bootstrap.includes('confirmGameSave')||!bootstrap.includes('whenDurable'))failures.push('Native bootstrap durability adapter missing');
 }catch{failures.push('Generated native game or bootstrap unavailable');}
 return failures;
}

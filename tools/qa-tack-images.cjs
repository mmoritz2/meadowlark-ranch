// All catalog illustrations and static-host preview routes. Read-only, no browser or network.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {fileURLToPath,pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(__dirname,'..'),{TACK_PIECES, buyTackPiece}=await import('../assets/tack-collection.mjs'),{tackPieceSVG}=await import('../assets/tack-collection-art.mjs'),{tackPreviewURL}=await import('../assets/features/tack-collection.js');
 const rows=TACK_PIECES.map(piece=>({id:piece.id,name:piece.name,svg:tackPieceSVG(piece)}));assert.equal(rows.length,127);assert.equal(new Set(rows.map(r=>r.svg)).size,127);
 const normalized=rows.map(r=>r.svg.replaceAll(r.id,'piece').replaceAll(r.name,'name'));assert.equal(new Set(normalized).size,127,'picture content differs beyond item IDs and accessible names');
 const prior124=createHash('sha256').update(TACK_PIECES.filter(p=>!p.design.nativeOriginal).map(p=>p.id+'\n'+tackPieceSVG(p)).join('\n')).digest('hex');assert.equal(prior124,'41c4cae2b3ee850d4086d22343925fbea79d96c7f58d784c183230a02290c3c0','all 124 original illustrations remain byte-for-byte unchanged');
 const xml=String(execFileSync('python3',['-c',String.raw`
import sys,json,re,xml.etree.ElementTree as E
rows=json.load(sys.stdin)
for row in rows:
 s=row['svg']; root=E.fromstring(s)
 assert root.tag=='{http://www.w3.org/2000/svg}svg'
 assert root.attrib['viewBox']=='0 0 320 240'
 assert root.attrib['role']=='img' and root.attrib['aria-label']==row['name']+' illustration'
 assert not re.search(r'undefined|NaN|Infinity',s)
 ids=[e.attrib['id'] for e in root.iter() if 'id' in e.attrib]
 assert len(ids)==len(set(ids)),row['id']+' duplicate SVG definitions'
 for e in root.iter():
  assert e.tag.split('}')[-1] not in ('script','foreignObject','image','iframe')
  for key,value in e.attrib.items():
   assert not key.lower().startswith('on')
   if key.split('}')[-1] in ('href','src'): assert value.startswith('#')
 for ref in re.findall(r'url\(#([^\)]+)\)',s): assert ref in ids,(row['id'],ref)
print('PASS 127 well-formed accessible SVGs; all local definitions resolve; no scripts or external images')
`],{input:JSON.stringify(rows)})).trim();console.log(xml);
 const classic=TACK_PIECES.filter(p=>p.design.nativeOriginal);assert.equal(classic.length,3);for(const p of classic){const svg=tackPieceSVG(p);assert(svg.includes('Plain original Western'));assert(!svg.includes('-jewel')&&!svg.includes('-rainbow'),'source classics do not promise fantasy inlays or gems');assert.equal(p.free,true);assert.equal(p.priceCoins,0);}
 assert(tackPieceSVG('tc_classicwestern_bridle').includes('bridle with reins'));
 const horses=['bay-sporthorse-native','white-western','bay-western'];let links=0;
 for(const p of TACK_PIECES)for(const horse of horses){const url=new URL(tackPreviewURL(p,{breed:horse},'https://player.github.io/meadowlark-ranch/tack-studio.html'));assert.equal(url.origin,'https://player.github.io');assert.equal(url.pathname,'/meadowlark-ranch/tack-studio.html');assert.equal(url.searchParams.get('item'),p.id);assert.equal(url.searchParams.get('horse'),horse);assert.equal(url.searchParams.has('collection'),false,'individual picture opens only that selected piece');links++;}
 const visited=new Set();
 async function moduleFiles(filename){if(visited.has(filename))return;visited.add(filename);const source=await fs.readFile(filename,'utf8');for(const match of source.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g)){const spec=match[1];let resolved;if(spec.startsWith('.'))resolved=fileURLToPath(new URL(spec,pathToFileURL(filename)));else if(spec==='three')resolved=path.join(root,'assets/vendor/three/build/three.module.js');else if(spec.startsWith('three/addons/'))resolved=path.join(root,'assets/vendor/three/examples/jsm',spec.slice(13));else continue;await fs.access(resolved);if(/\.(?:js|mjs)$/.test(resolved))await moduleFiles(resolved);}}
 for(const file of ['assets/tack-collection-art.mjs','assets/features/tack-collection.js','assets/tack-studio.js'])await moduleFiles(path.join(root,file));
 for(const file of ['tack-studio.html','ranch3d.html','assets/tack-collection.css','assets/tack-studio.css'])await fs.access(path.join(root,file));
 const studio=await fs.readFile(path.join(root,'tack-studio.html'),'utf8');for(const [,ref]of studio.matchAll(/(?:href|src)="([^"#]+)"/g)){if(/^https?:/.test(ref))continue;assert(!ref.startsWith('/'),'project-host assets stay relative');await fs.access(fileURLToPath(new URL(ref,pathToFileURL(path.join(root,'tack-studio.html')))));}
 for(const p of TACK_PIECES.filter(p=>p.premiumProduct)){const save={coins:1e6,tack:[]},before=JSON.stringify(save);assert.equal(buyTackPiece(save,p.id).code,'paid-purchase-required');assert.equal(JSON.stringify(save),before);}
 console.log('PASS '+links+' selected-horse item preview URLs; '+visited.size+' local module dependencies; project-relative static assets; paid coin guards and free Classic definitions');
 if(process.env.QA_RASTER==='1'){const sharp=require('sharp'),hashes=new Set();for(const row of rows){const {data,info}=await sharp(Buffer.from(row.svg)).resize(320,240).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,320);assert.equal(info.height,240);assert(data.every(Number.isFinite));hashes.add(createHash('sha256').update(data).digest('hex'));}assert.equal(hashes.size,127,'all 127 pictures produce distinct rendered pixels');console.log('PASS all 127 illustrations rasterize to distinct 320×240 preview pictures');}
})().catch(error=>{console.error(error);process.exitCode=1;});

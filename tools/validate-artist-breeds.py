"""Read shipping GLBs independently of Blender's authoring statistics."""
import hashlib, importlib.util, json, re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('glb_checks',ROOT/'tools/validate-breed-assets.py')
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
base=ROOT/'assets/models/artist-breeds'
manifest=json.loads((base/'manifest.json').read_text())
report={'checks':{},'files':{},'errors':[]}
def check(label,condition):
 report['checks'][label]=bool(condition)
 if not condition:report['errors'].append(label)
source=ROOT/'assets/models/horse-candidates/b2przemo/rig-study/horse-rig-study.glb'
check('approved original unchanged',hashlib.sha256(source.read_bytes()).hexdigest()=='8e3004247f3010df216a3a19ae825fd91f6650f83c853016a0df9280a967e629')
ref=g.GLB(source);reference=ref.hierarchy(ref.doc['skins'][0])
roster_block=(ROOT/'ranch3d.html').read_text(encoding='utf-8').split('const BREEDS3=[',1)[1].split('\n];',1)[0]
keys=re.findall(r"^\s*\['([^']+)'",roster_block,re.M)
check('every game identity included',set(keys)==set(manifest['breeds']))
check('45 game identities',len(keys)==45)
files={s['file'] for s in manifest['breeds'].values()}
check('25 distinct model files',len(files)==25)
for file in sorted(files):
 doc=g.GLB(base/file);d=doc.doc;stats={'triangles':0,'weightError':0,'bindError':0,'bodyShape':None,'joints':[]}
 for index in range(len(d.get('accessors',[]))):doc.accessor(index)
 for index in range(len(d.get('nodes',[]))):doc.world(index)
 for skin in d['skins']:
  names,parents=doc.hierarchy(skin);stats['joints'].append(len(names))
  check(file+' named40 rig',len(names)==40 and set(names)==set(reference[0]))
  # Name hierarchy matters; export order itself is not an API.
  check(file+' joint parent hierarchy',dict(zip(names,parents))==dict(zip(*reference)))
  matrices=[g.multiply(doc.world(node),g.matrix(ibm)) for node,ibm in zip(skin['joints'],doc.accessor(skin['inverseBindMatrices']))]
  error=max(g.delta(m,matrices[0]) for m in matrices);stats['bindError']=max(stats['bindError'],error)
  check(file+' coherent inverse binds',error<1e-4)
 mesh_skin={node['mesh']:node['skin'] for node in d['nodes'] if 'mesh' in node and 'skin' in node}
 body_meshes={node['mesh'] for node in d['nodes'] if node.get('name')=='HorseBody' and 'mesh' in node}
 for index,mesh in enumerate(d['meshes']):
  for p in mesh['primitives']:
   a=p['attributes'];positions=doc.accessor(a['POSITION']);indices=[i[0] for i in doc.accessor(p['indices'])]
   check(file+' '+mesh.get('name','')+' complete triangles',len(indices)%3==0 and min(indices)>=0 and max(indices)<len(positions))
   stats['triangles']+=len(indices)//3
   if index in mesh_skin:
    weights=doc.accessor(a['WEIGHTS_0']);joints=doc.accessor(a['JOINTS_0']);error=max(abs(sum(w)-1) for w in weights);stats['weightError']=max(stats['weightError'],error)
    check(file+' '+mesh.get('name','')+' normalized weights',error<1e-4 and all(v>=0 for row in weights for v in row))
    check(file+' '+mesh.get('name','')+' valid joints',all(0<=v<40 for row in joints for v in row))
   if index in body_meshes:
    stats['bodyShape']=g.shape_hash(positions)
    stats['bodyBounds']=[[min(p[k] for p in positions) for k in range(3)],[max(p[k] for p in positions) for k in range(3)]]
    check(file+' grounded body',abs(stats['bodyBounds'][0][1])<1e-4)
 check(file+' identifiable body',stats['bodyShape'] is not None)
 check(file+' editable native source',(base/(Path(file).stem+'.blend')).exists())
 stats['sha256']=hashlib.sha256((base/file).read_bytes()).hexdigest()
 for key,s in manifest['breeds'].items():
  if s['file']==file:check(key+' manifest hash',s['sha256']==stats['sha256'])
 report['files'][file]=stats
check('25 different shapes after removing uniform scale',len({s['bodyShape'] for s in report['files'].values()})==25)
out=ROOT/'output/artist-breed-asset-audit.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps(report,indent=2))
print(json.dumps({'checks':len(report['checks']),'files':len(files),'errors':report['errors'],'report':str(out)}))
raise SystemExit(bool(report['errors']))

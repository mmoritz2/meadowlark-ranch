"""Independent compact GLB/shape/texture/coverage audit for WildMesh breeds."""
from pathlib import Path
import json,hashlib,importlib.util,sys
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/models/horse-imports/wildmesh-white-western/game/breeds'
def sha(data):return hashlib.sha256(data).hexdigest()
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('glb_audit',Path(__file__).with_name('rig_hero_horse.py'));glb=importlib.util.module_from_spec(spec);spec.loader.exec_module(glb)
manifest=json.loads((OUT/'manifest.json').read_text());replacement=json.loads((ROOT/'assets/models/horse-imports/replacement-plan.json').read_text());expected={x['id'] for x in replacement['identityMapping'] if x['bodySource']=='wildmesh-white-western'}
rows=[];normalized={};all_paths=set()
for key in manifest['expectedShapeIds']:
 folder=OUT/key;profile=json.loads((folder/'profile.json').read_text());model=folder/profile['file'];data=model.read_bytes();assert sha(data)==profile['sha256'];doc,binary=glb.read_glb(model);primitives=doc['meshes'][0]['primitives'];assert len(primitives)==1
 attrs=primitives[0]['attributes'];p=glb.accessor(doc,binary,attrs['POSITION']);normalized[key]=p/profile['withersM'];weights=glb.accessor(doc,binary,attrs['WEIGHTS_0']);indices=glb.accessor(doc,binary,attrs['JOINTS_0']);worlds,parents=glb.node_worlds(doc);heads=np.array([worlds[i][:3,3] for i in doc['skins'][0]['joints']]);names=[doc['nodes'][i]['name'] for i in doc['skins'][0]['joints']]
 photos=[]
 for image in doc['images']:
  uri=image['uri'];path=(folder/uri).resolve();assert path.is_relative_to(OUT.resolve()) and path.is_file();all_paths.add(path);photos.append({'uri':uri,'sha256':sha(path.read_bytes()),'bytes':path.stat().st_size})
 ownership={};sole={}
 for leg in ['FL','FR','HL','HR']:
  ids=[i for i,name in enumerate(names) if name.startswith(leg+'.') and not name.endswith('IK')];owner=np.sum(weights*np.isin(indices,ids),axis=1);foot=heads[names.index(leg+'.hoof')];mask=(owner>.75)&(p[:,1]<foot[1]+.01)&(np.linalg.norm(p[:,[0,2]]-foot[[0,2]],axis=1)<.15);assert mask.sum()>=5;sole[leg]={'vertices':int(mask.sum()),'minY':float(p[mask,1].min())}
 regions={}
 for region,ids in {'head':[6,7], 'neck':[4,5], 'ears':[8,9], 'barrel':[1,2,3]}.items():
  owner=np.sum(weights*np.isin(indices,ids),axis=1);v=p[owner>.6];regions[region]={'vertices':len(v),'bounds': [v.min(0).tolist(),v.max(0).tolist()] if len(v) else []}
 row={'id':key,'sha256':profile['sha256'],'bytes':len(data),'withersM':profile['withersM'],'heightM':profile['heightM'],'groundY':float(p[:,1].min()),'bodyVertexCount':len(p),'bodyGeometrySha256':sha(np.asarray(p,'<f4').tobytes()),'normalizedBounds':[normalized[key].min(0).tolist(),normalized[key].max(0).tolist()],'anatomyRegions':regions,'sole':sole,'images':photos,'clips':[a['name'] for a in doc['animations']],'groom':profile['groom'],'checks':{'finitePositions':bool(np.isfinite(p).all()),'canonical40':len(names)==40,'weightsNormalized':float(np.max(abs(weights.sum(1)-1)))<1e-5,'noGroundOffset':abs(float(p[:,1].min()))<1e-6,'physicalScale':profile.get('physicalScale') is True and profile['fitScale']==1,'nineClips':len(doc['animations'])==9,'referencedImageFilesExist':len(photos)==5,'allMotionChecksPass':all(json.loads((folder/'motion-validation.json').read_text())['checks'].values())}}
 assert all(row['checks'].values());rows.append(row)
pairs=[]
for i,key in enumerate(manifest['expectedShapeIds']):
 for other in manifest['expectedShapeIds'][i+1:]:
  difference=normalized[key]-normalized[other];rms=float(np.sqrt(np.mean(np.sum(difference*difference,axis=1))));pairs.append({'a':key,'b':other,'normalizedBodyRMSError':rms})
provenance=json.loads((OUT/'texture-provenance.json').read_text());original_images=[]
for image in provenance['originalImages']:
 path=OUT/'textures'/image['file'];actual=sha(path.read_bytes());original_images.append({'file':image['file'],'sha256':actual,'matchesOriginalPNG':actual==image['sha256']})
source=OUT.parent.parent/'source'/'horse_-_realistic_3d_model_demo_free.glb';receipt=json.loads((source.parent/'receipt.json').read_text());source_sha=sha(source.read_bytes())
checks={'all44IdentitiesExactlyCovered':set(manifest['models'])==expected,'all25PhysicalBodiesAudited':len(rows)==25,'everyBodyPasses':all(all(r['checks'].values()) for r in rows),'allShapePairsDifferAfterHeightNormalization':all(p['normalizedBodyRMSError']>.001 for p in pairs),'allOriginalSharedPNGsByteIdentical':all(x['matchesOriginalPNG'] for x in original_images),'originalSourceHashAndSizeUnchanged':source_sha==receipt['sha256']=='743fd70ec937dde1aa550afde17eeb506ca538933e291eca41d2fa8d5ffb20ea' and source.stat().st_size==receipt['bytes']}
result={'schemaVersion':1,'checks':checks,'sourceSha256':source_sha,'method':'Independent current GLB accessor/world-matrix decoding, every body vertex, sole ownership, normalized pairwise body differences, actual local image hashes, exact replacement-plan identity set','bodies':rows,'pairwiseDifferences':pairs,'closestNormalizedPair':min(pairs,key=lambda p:p['normalizedBodyRMSError']),'sharedOriginalImages':original_images,'uniqueReferencedTextureBytes':sum(p.stat().st_size for p in all_paths),'allBodyGLBBytes':sum(r['bytes'] for r in rows)}
(OUT/'batch-geometry-validation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'checks':checks,'closestNormalizedPair':result['closestNormalizedPair'],'bodyBytes':result['allBodyGLBBytes'],'textureBytes':result['uniqueReferencedTextureBytes']}));assert all(checks.values())

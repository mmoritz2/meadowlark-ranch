"""Read only the original Bay rest; derive independent anatomical low-hoof masks."""
from pathlib import Path
import json, hashlib, importlib.util, re
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT/'output/native-bay-rollover-audit'
HERE.mkdir(parents=True, exist_ok=True)
# This exact model preserves the original static Bay nodes/skin/mesh and binary prefix.
# No animation is evaluated; default-rest points are the original Bay source rest.
SOURCE = ROOT/'review/native-bay-rollover/model.glb'
SHA = '8f622bf3b22244ba1b6a39c72e3cb1ce6f2e378bb7eb731a22caba33b2459814'
ORIGINAL_REST_SHA = '6110fb3bcfe6ba6660c9c05d67269bc800d19706fab54db29633003d87f0a6a3'
RATIO = .8496868094
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SHA
spec = importlib.util.spec_from_file_location('g', ROOT/'tools/asset-gen/rig_hero_horse.py')
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
d,b = g.read_glb(SOURCE); worlds,parents = g.node_worlds(d)
names = {n.get('name'): i for i,n in enumerate(d['nodes'])}
markers = {'FL':'fingers_02_l_0208','FR':'fingers_02_r_0274','HL':'toes_02_l_0409','HR':'toes_02_r_0478'}
chains = {'FL':['clavicle_l_0203','upperarm_l_0204','lowerarm_l_0205','hand_l_0206','fingers_01_l_0187','fingers_02_l_0208'],
          'FR':['clavicle_r_0269','upperarm_r_0270','lowerarm_r_0271','hand_r_0272','fingers_01_r_0273','fingers_02_r_0274'],
          'HL':['upperleg_l_0405','lowerleg_l_0406','foot_l_0407','toes_01_l_0408','toes_02_l_0409'],
          'HR':['upperleg_r_0474','lowerleg_r_0475','foot_r_0476','toes_01_r_0477','toes_02_r_0478']}
report = {'sourcePath':'output/native-bay-preparation/native-bay-rest.glb','sourceSha256':ORIGINAL_REST_SHA,'restEvaluatedFrom':str(SOURCE.relative_to(ROOT)),'restEvaluatedFromSha256':SHA,'axes':'+Y up; +Z forward; _l anatomical left at +X; _r right at -X',
          'maskMethod':{'nearest':'original distal native marker in rest XZ','lowHoofHeightM':.115*RATIO,'strictSoleOwnMinimumWindowM':.007,'toeHeel':'lower/upper sorted rest-Z quartiles; ceil(sole count/4)'},
          'chains':{},'meshes':[]}
for k,chain in chains.items():
 p=np.array([worlds[names[n]][:3,3]for n in chain])
 report['chains'][k]={'names':chain,'pivots':p.tolist(),'segmentLengthsM':np.linalg.norm(np.diff(p,axis=0),axis=1).tolist()}
groom=[]
for ni,node in enumerate(d['nodes']):
 if 'mesh' not in node or 'skin' not in node: continue
 attrs=d['meshes'][node['mesh']]['primitives'][0]['attributes'];pos=g.accessor(d,b,attrs['POSITION']);idx=g.accessor(d,b,attrs['JOINTS_0']).astype(int);wt=g.accessor(d,b,attrs['WEIGHTS_0'])
 skin=d['skins'][node['skin']];joints=np.array(skin['joints']);ibm=g.accessor(d,b,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
 ops=np.array([worlds[i]for i in joints])@ibm
 points=np.sum(np.einsum('ncij,nj->nci',ops[idx],np.c_[pos,np.ones(len(pos))])*wt[:,:,None],axis=1)[:,:3]
 entry={'node':ni,'name':node['name'],'vertices':len(pos),'bounds':{'min':points.min(axis=0).tolist(),'max':points.max(axis=0).tolist()},'floor':float(points[:,1].min())}
 if len(pos)==16159:
  floor=entry['floor']; report['fixedFloorY']=floor;entry['soleMasks']={}
  footKeys=list(markers);m=np.array([worlds[names[markers[k]]][:3,3]for k in footKeys]);which=np.argmin(((points[:,None,[0,2]]-m[None,:,[0,2]])**2).sum(axis=2),axis=1)
  for j,k in enumerate(footKeys):
   ids=np.where((which==j)&(points[:,1]<floor+.115*RATIO))[0];assert len(ids)>10
   p=points[ids];low=p[:,1].min();strict=ids[p[:,1]<=low+.007];strict=strict[np.argsort(points[strict,2])];q=int(np.ceil(len(strict)*.25))
   totals=np.bincount(idx[ids].ravel(),weights=wt[ids].ravel(),minlength=len(joints));weights=sorted([(float(v),d['nodes'][joints[i]]['name'])for i,v in enumerate(totals)if v>.01],reverse=True)
   entry['soleMasks'][k]={'count':len(ids),'vertices':ids.tolist(),'bounds':{'min':p.min(axis=0).tolist(),'max':p.max(axis=0).tolist()},'centroid':p.mean(axis=0).tolist(),'weightTotals':weights,'strictVertices':strict.tolist(),'heelVertices':strict[:q].tolist(),'toeVertices':strict[-q:].tolist()}
  entry['bodyMarkers']={str(i):{'position':points[i].tolist(),'influences':[(d['nodes'][joints[int(j)]]['name'],float(w))for j,w in zip(idx[i],wt[i])if w>.001]}for i in [1931,1998]}
 if len(pos)==23514:
  impact=np.bincount(idx.ravel(),weights=wt.ravel(),minlength=len(joints));groom=sorted([(float(v),d['nodes'][joints[i]]['name'])for i,v in enumerate(impact)if v>5 and re.match(r'^dyn_(?:new_(?:head_)?neck|head_end|(?:bounce_)?tail)',d['nodes'][joints[i]]['name'])],reverse=True)
 report['meshes'].append(entry)
(HERE/'rig-rest.json').write_text(json.dumps(report,indent=2)+'\n')
(HERE/'groom-joints.json').write_text(json.dumps(groom,indent=2)+'\n')
body=next(m for m in report['meshes']if m['vertices']==16159)
print(json.dumps({'sourceSha256':report['sourceSha256'],'restEvaluatedFromSha256':SHA,'floorY':report['fixedFloorY'],'masks':{k:{'broad':v['count'],'sole':len(v['strictVertices']),'toeHeel':len(v['toeVertices'])}for k,v in body['soleMasks'].items()},'upperTrunk1998':body['bodyMarkers']['1998']},indent=2))

"""Derive allowed groom controls from actual source weights and hierarchy."""
from pathlib import Path
import sys,json,hashlib,numpy as np
H=Path(__file__).resolve().parent;sys.path.insert(0,str(H.parents[1]/'tools/asset-gen'))
from rig_hero_horse import read_glb,accessor
source=H.parent/'native-white-head-kit/model.glb';expected='488a3382f9c2f44dc69ccdfe935a032a03dae768e794088aaf9fa04ad045f81f'
assert hashlib.sha256(source.read_bytes()).hexdigest()==expected
j,b=read_glb(source);parents={c:i for i,n in enumerate(j['nodes']) for c in n.get('children',[])};hair={};nonhair={};meshrows=[]
for node in j['nodes']:
 if 'mesh' not in node or 'skin' not in node:continue
 mesh=j['meshes'][node['mesh']];ishair='_M_Hair_' in mesh['name'];used=hair if ishair else nonhair;joints=j['skins'][node['skin']]['joints']
 for p in mesh['primitives']:
  for k in range(3):
   if 'WEIGHTS_'+str(k) not in p['attributes']:break
   J=accessor(j,b,p['attributes']['JOINTS_'+str(k)]);W=accessor(j,b,p['attributes']['WEIGHTS_'+str(k)])
   for bone in np.unique(J[W>0]):used[joints[int(bone)]]=used.get(joints[int(bone)],0)+float(W[J==bone].sum())
 meshrows.append({'node':node['name'],'mesh':mesh['name'],'vertices':j['accessors'][mesh['primitives'][0]['attributes']['POSITION']]['count']})
protected=set(nonhair)
for i in nonhair:
 while i in parents:i=parents[i];protected.add(i)
safe=set(hair)-protected
channels=next(a for a in j['animations'] if a['name']=='Target Native Canter Left')['channels'];animated=set(c['target']['node'] for c in channels)
rows=[]
for i in sorted(safe):
 parent=parents.get(i);depth=0;a=i
 while a in parents:
  a=parents[a]
  if a in safe:depth+=1
 name=j['nodes'][i]['name'];tail='tail' in name
 rows.append({'node':i,'name':name,'parent':j['nodes'][parent]['name'],'safeDepth':depth,
              'primaryRoot':depth==0,'authoredCanterTrack':i in animated,'hairWeightSum':hair[i],
              'frequencyHz':(3.0 if not tail else 2.6)-min(depth,4)*.15,'dampingRatio':.78,
              'maxAddedWorldAngleDeg':(2.5 if depth==0 else 4.0),'angularInertiaGain':.65,'linearInertiaGain':.20})
report={'sourceFile':'../native-white-head-kit/model.glb','sourceSha256':expected,'sourceJointCount':len(j['skins'][0]['joints']),
        'meshes':meshrows,'hairWeightedBoneCount':len(hair),'protectedDirectWeightedBoneCount':len(nonhair),
        'hairOnlySafeControlCount':len(rows),'authoredHairOnlyCanterControls':sum(x['authoredCanterTrack'] for x in rows),
        'protectedNonHairBoneNames':[j['nodes'][i]['name'] for i in sorted(protected)],
        'protectedHairBones':[{'name':j['nodes'][i]['name'],'directNonHairWeightSum':nonhair.get(i,0)} for i in sorted(set(hair)&protected)],
        'controls':rows,'rule':'Any non-hair weight or non-hair-weighted descendant protects the bone and all its ancestors; all original nodes/weights/clips immutable.'}
(H/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n');print('Safe controls',len(rows),'existing safe authored tracks',report['authoredHairOnlyCanterControls'])

"""Validate native Black Dragon wing separation on packaged skinned animation.
Run from any directory. No mesh or animation files are modified.
"""
from pathlib import Path
import argparse,copy,json,sys,hashlib,re
import numpy as np
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools/asset-gen'));import rig_hero_horse as g
SOURCE=ROOT/'assets/models/horse-imports/black-dragon/game/black-dragon-native-2k-candidate.glb';MOTION=ROOT/'assets/models/dragon-motions/black-dragon-motion.glb'
d,b=g.read_glb(SOURCE);motion,mb=g.read_glb(MOTION);J=d['skins'][0]['joints'];names={n['name']:i for i,n in enumerate(d['nodes'])};ib=g.accessor(d,b,d['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
meshdata=[]
for mi in [245,246]:
 a=d['meshes'][d['nodes'][mi]['mesh']]['primitives'][0]['attributes'];vp=g.accessor(d,b,a['POSITION']);vj=g.accessor(d,b,a['JOINTS_0']);vw=g.accessor(d,b,a['WEIGHTS_0']);masks=[np.sum(vw*np.isin(vj,[k for k,j in enumerate(J)if lo<=j<=hi]),axis=1)>.5 for lo,hi in [(96,110),(111,125)]];include=masks[0]|masks[1];meshdata.append((mi,np.c_[vp[include],np.ones(include.sum())],vj[include],vw[include],[m[include]for m in masks]))
def slerp(a,b,t):
 a=np.asarray(a,dtype=float);b=np.asarray(b,dtype=float);a/=np.linalg.norm(a);b/=np.linalg.norm(b);dot=a@b
 if dot<0:b=-b;dot=-dot
 angle=np.arccos(min(1,dot));out=(1-t)*a+t*b if angle<1e-7 else (np.sin((1-t)*angle)*a+np.sin(t*angle)*b)/np.sin(angle)
 return out/np.linalg.norm(out)
clips={}
for clip in motion['animations']:
 tracks=[];duration=0
 for ch in clip['channels']:
  sampler=clip['samplers'][ch['sampler']];times=g.accessor(motion,mb,sampler['input']).reshape(-1);vals=g.accessor(motion,mb,sampler['output']);duration=max(duration,float(times[-1]));tracks.append((names[motion['nodes'][ch['target']['node']]['name']],ch['target']['path'],times,vals))
 clips[clip['name']]=(duration,tracks)
def pose(name,phase):
 out=copy.deepcopy(d);duration,tracks=clips[name];time=duration*phase
 for node,key,times,vals in tracks:
  k=min(len(times)-2,max(0,int(np.searchsorted(times,time,side='right')-1)));t=float(np.clip((time-times[k])/max(1e-10,times[k+1]-times[k]),0,1));value=slerp(vals[k],vals[k+1],t)if key=='rotation'else(1-t)*vals[k]+t*vals[k+1];out['nodes'][node][key]=value.tolist()
 return out

def blend(a,b,t):
 out=copy.deepcopy(d)
 for i in J:
  for key,default in [('translation',[0,0,0]),('scale',[1,1,1]),('rotation',[0,0,0,1])]:
   aa=a['nodes'][i].get(key,default);bb=b['nodes'][i].get(key,default);value=slerp(aa,bb,t)if key=='rotation'else(1-t)*np.array(aa)+t*np.array(bb);out['nodes'][i][key]=value.tolist()
 return out

def measure(doc):
 w,_=g.node_worlds(doc);mats=np.array([w[k]@ib[z]for z,k in enumerate(J)]);rows=[]
 for mi,vp,vj,vw,masks in meshdata:
  pts=np.einsum('nvij,nj,nv->ni',mats[vj],vp,vw)[:,:3];assert np.isfinite(pts).all();lx=float(pts[masks[0],0].min());rx=float(pts[masks[1],0].max());rows.append({'meshNode':mi,'leftVertices':int(masks[0].sum()),'rightVertices':int(masks[1].sum()),'leftMinimumX':lx,'rightMaximumX':rx,'gapSourceM':lx-rx,'minimumYSourceM':float(pts[:,1].min()),'crossingCount':int(np.sum(pts[masks[0],0]<0)+np.sum(pts[masks[1],0]>0))})
 return rows
records=[]
for name in clips:
 for phase in np.linspace(0,1,33):
  records.append({'clip':name,'phase':float(phase),'meshes':measure(pose(name,phase))})
blends=[]
for pf in np.linspace(0,1,17)[:-1]:
 fly=pose('DragonFly',pf)
 for pg in [0,.25,.5,.75]:
  stand=pose('DragonStand',pg)
  for t in np.linspace(0,1,17):
   blends.append({'flyPhase':float(pf),'groundPhase':pg,'groundWeight':float(t),'meshes':measure(blend(fly,stand,t))})
rows=[m for r in records+blends for m in r['meshes']];worst=min(rows,key=lambda r:r['gapSourceM']);crossings=sum(r['crossingCount']for r in rows)
# Ground motion must not change outside the wing subtrees.
parser=argparse.ArgumentParser();parser.add_argument('--baseline',type=Path,help='Previous motion-only GLB for verifying unchanged ground non-wing tracks');args=parser.parse_args();baseline=args.baseline;preserved=None
if baseline is not None:
 assert baseline.exists(),baseline
 old,ob=g.read_glb(baseline);oldclips={c['name']:c for c in old['animations']};preserved=True
 for name in ['DragonStand','DragonWalk','DragonRun']:
  oldtracks={}
  for ch in oldclips[name]['channels']:
   node=old['nodes'][ch['target']['node']]['name'];key=ch['target']['path'];ss=oldclips[name]['samplers'][ch['sampler']];oldtracks[(node,key)]=g.accessor(old,ob,ss['output'])
  for node,key,times,vals in clips[name][1]:
   if 96<=node<=125:continue
   previous=oldtracks[(d['nodes'][node]['name'],key)];preserved=preserved and np.array_equal(previous,vals)
 assert preserved,'Non-wing ground tracks changed'
report={'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'motionSha256':hashlib.sha256(MOTION.read_bytes()).hexdigest(),'groundNonWingTracksByteIdentical':preserved,'clipPoseCount':len(records),'landingBlendPoseCount':len(blends),'mask':'Sum of original skin weights for left wing joint subtree96..110 or right111..125 >0.5. Both wing-membrane skin272vertices and body skin22292vertices inspected.','minimumGapSourceM':worst['gapSourceM'],'minimumGapFittedM':worst['gapSourceM']*(1.85/3.2891557745925395),'crossingCount':crossings,'worstMesh':worst,'clipPoses':records,'landingBlends':blends}
# The normalization lift used in-game must cover the intermediate wing sweep.
profile_text=(ROOT/'assets/native-breed-profiles.js').read_text()
amplitude=float(re.search(r'nativeFlightBlendClearanceM:([.\d]+)',profile_text).group(1))
scale=1.85/3.2891557745925395;translation=.010140415394662964
required=max(max(0,-min(m['minimumYSourceM'] for m in r['meshes'])*scale-translation)/(4*r['groundWeight']*(1-r['groundWeight'])) for r in blends if 0<r['groundWeight']<1)
assert amplitude>=required,'Runtime flight blend clearance is too low'
report['flightBlendClearance']={'formula':'amplitudeM * 4 * flightWeight * (1-flightWeight)','requiredAmplitudeM':required,'runtimeAmplitudeM':amplitude}
path=ROOT/'review/dragon-wing-tail/black-wing-separation.json';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(report,indent=2)+'\n');assert crossings==0;assert worst['gapSourceM']>.20
print(json.dumps({k:v for k,v in report.items()if k not in('clipPoses','landingBlends')},indent=2))

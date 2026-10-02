"""Target-native late fore recovery: normalized source Hermite plus chain rule.

No gait solve or quaternion transplant. Only ten Trot fore rotation outputs.
"""
from pathlib import Path
import copy, hashlib, json, sys
import numpy as np
from scipy.spatial.transform import Rotation as R, Slerp
HERE=Path(__file__).resolve().parent; ROOT=HERE.parents[2]
sys.path.insert(0,str(ROOT/'tools/asset-gen')); import rig_hero_horse as g
TARGET=HERE.name
SOURCES={'bay':('native-bay-head-kit','8f7e7c94395595693e480a9b16a7112b0b70231f54ce6d34efa376a2ec2bec2d'),
         'sporthorse':('native-bay-sporthorse-packed-kit','a7ea093b602d1b6f3ce234afaed89925974faf7a127bf07b2900ac41674b0f74')}
FOLDER,SHA=SOURCES[TARGET]; SOURCE=ROOT/'review'/FOLDER/'model.glb'; OUT=HERE/'warped-base.glb'
STANCE=.44; ADVANCE=.05; WINDOW=(.55,.75,.98)
CHAINS={'FL':(0.,['clavicle_l_0203','upperarm_l_0204','lowerarm_l_0205','hand_l_0206','fingers_01_l_0187']),
        'FR':(.5,['clavicle_r_0269','upperarm_r_0270','lowerarm_r_0271','hand_r_0272','fingers_01_r_0273'])}
def quintic(t): return t*t*t*(10-15*t+6*t*t)
def quintic_prime(t): return 30*t*t*(1-t)*(1-t)
def lobe(u):
 a,p,z=WINDOW
 if u<=a or u>=z: return 0.,0.
 if u<=p: t=(u-a)/(p-a); return quintic(t),quintic_prime(t)/(p-a)
 t=(z-u)/(z-p); return quintic(t),-quintic_prime(t)/(z-p)
def mapped_phase(p,offset):
 q=(p-offset)%1.
 if q<STANCE: return p,0.,1.
 value,slope=lobe((q-STANCE)/(1-STANCE))
 if not value and not slope: return p,0.,1.
 return (offset+q+ADVANCE*value)%1.,value,1+ADVANCE*slope/(1-STANCE)
def normalized_hermite(times,v,t):
 i=min(max(int(np.searchsorted(times,t,side='right')-1),0),len(times)-2)
 dt=times[i+1]-times[i]; u=(t-times[i])/dt
 p0,p1=v[i,1],v[i+1,1]; m0,m1=dt*v[i,2],dt*v[i+1,0]
 p=(2*u**3-3*u*u+1)*p0+(u**3-2*u*u+u)*m0+(-2*u**3+3*u*u)*p1+(u**3-u*u)*m1
 pd=((6*u*u-6*u)*p0+(3*u*u-4*u+1)*m0+(-6*u*u+6*u)*p1+(3*u*u-2*u)*m1)/dt
 n=np.linalg.norm(p); q=p/n; qd=(pd-q*np.dot(q,pd))/n
 return q,qd
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==SHA
d,b=g.read_glb(SOURCE); original=copy.deepcopy(d); prefix=bytes(b); names={n.get('name'):i for i,n in enumerate(d['nodes'])}
clip=next(c for c in d['animations'] if c['name']=='Target Native Trot')
def append(v):
 v=np.asarray(v,dtype='<f4'); b.extend(b'\0'*((-len(b))%4)); vi=len(d['bufferViews']); d['bufferViews'].append({'buffer':0,'byteOffset':len(b),'byteLength':v.nbytes}); b.extend(v.tobytes()); ai=len(d['accessors']); d['accessors'].append({'bufferView':vi,'componentType':5126,'count':len(v),'type':'VEC4'}); return ai
changes=[]
for foot,(offset,chain) in CHAINS.items():
 for name in chain:
  node=names[name]; ch=next(c for c in clip['channels'] if c['target']=={'node':node,'path':'rotation'}); s=clip['samplers'][ch['sampler']]
  t=g.accessor(d,b,s['input']).reshape(-1).astype(float); raw=g.accessor(d,b,s['output']).astype(float); kind=s.get('interpolation','LINEAR'); D=float(t[-1]); new=raw.copy(); changed=[]
  if kind=='CUBICSPLINE': v=raw.reshape(len(t),3,4); new=new.reshape(len(t),3,4)
  else: assert kind=='LINEAR'; interp=Slerp(t,R.from_quat(raw))
  for i,ti in enumerate(t):
   p2,l,derivative=mapped_phase(float(ti/D),offset)
   if l==0.: continue
   if kind=='CUBICSPLINE':
    q,qd=normalized_hermite(t,v,p2*D); qd*=derivative
    if np.dot(q,v[i,1])<0: q=-q; qd=-qd
    new[i,1]=q; new[i,0]=new[i,2]=qd
   else:
    q=interp([p2*D]).as_quat()[0]
    if np.dot(q,raw[i])<0: q=-q
    new[i]=q
   changed.append(i)
  untouched=[i for i,ti in enumerate(t) if mapped_phase(float(ti/D),offset)[1]==0]
  assert np.array_equal(new[untouched],v[untouched] if kind=='CUBICSPLINE' else raw[untouched])
  old=s['output']; s['output']=append(new.reshape(-1,4))
  changes.append({'foot':foot,'name':name,'node':node,'sourceInterpolation':kind,'oldAccessor':old,'newAccessor':s['output'],'changedKeyIndices':changed,'unchangedKeyRowsExact':True})
d['buffers'][0]['byteLength']=len(b); g.write_glb(OUT,d,b)
checks={k:d.get(k)==original.get(k) for k in ['nodes','meshes','skins','materials','textures','images','samplers','scenes','scene']}; checks.update(binaryPrefixExact=bytes(b[:len(prefix)])==prefix,accessorPrefixExact=d['accessors'][:len(original['accessors'])]==original['accessors'],viewPrefixExact=d['bufferViews'][:len(original['bufferViews'])]==original['bufferViews'])
allowed={r['node'] for r in changes}; unchanged=0
for ca,cb in zip(original['animations'],d['animations']):
 assert ca['channels']==cb['channels'] and ca['name']==cb['name']
 for c in ca['channels']:
  a=ca['samplers'][c['sampler']]; z=cb['samplers'][c['sampler']]
  if ca['name']=='Target Native Trot' and c['target']['node'] in allowed and c['target']['path']=='rotation': assert a['input']==z['input'] and a.get('interpolation','LINEAR')==z.get('interpolation','LINEAR')
  else: assert a==z and g.accessor(original,prefix,a['output']).tobytes()==g.accessor(d,b,z['output']).tobytes(); unchanged+=1
minimum=min(mapped_phase(float(p),0)[2] for p in np.linspace(0,1,10001)); assert minimum>0 and all(checks.values())
report={'source':str(SOURCE.relative_to(ROOT)),'sourceSha256':SHA,'output':str(OUT.relative_to(ROOT)),'outputSha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'clip':'Target Native Trot','durationS':D,'stanceFraction':STANCE,'advanceFraction':ADVANCE,'swingWindowU':WINDOW,'globalMinMapDerivative':minimum,'changedTracks':changes,'unchangedTracks':unchanged,'preservation':checks,'method':'Target-own original normalized Hermite quaternion and projected time derivative; chain rule qdot(phi(t))*phiPrime(t). Exact original rows outside late-swing window. Original inputs and interpolation retained; LINEAR uses source Slerp. No body/hind/floor/rate/bind edits. Resampled cubic between key times is an approximation to the analytic phase warp, tested through actual GLTF playback.','status':'Private candidate, actual contact and visual QA required.'}
(HERE/'warp-report.json').write_text(json.dumps(report,indent=2)+'\n'); print(report['outputSha256'])

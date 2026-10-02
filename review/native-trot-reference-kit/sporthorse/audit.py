"""Independent final logical-field, raw-array and normalized-cubic audit."""
from pathlib import Path
import hashlib,json,sys
import numpy as np
from scipy.spatial.transform import Rotation as R
H=Path(__file__).resolve().parent;ROOT=H.parents[2];sys.path.insert(0,str(ROOT/'tools/asset-gen'));import rig_hero_horse as g
def project(q,x):return (x-q*np.dot(q,x)/np.dot(q,q))/np.linalg.norm(q)
def metrics(d,b,clip):
 out=[]
 for c in clip['channels']:
  if c['target']['path']!='rotation':continue
  name=d['nodes'][c['target']['node']]['name'];s=clip['samplers'][c['sampler']];t=g.accessor(d,b,s['input']).reshape(-1).astype(float);raw=g.accessor(d,b,s['output']).astype(float)
  if s['interpolation']=='LINEAR':
   steps=np.rad2deg((R.from_quat(raw[:-1]).inv()*R.from_quat(raw[1:])).magnitude())
   out.append({'name':name,'interpolation':'LINEAR','maxKeyedStepDegrees':float(max(steps)),'maxDenseAngularSpeedDegreesPerSecond':float(max(steps/np.diff(t))),'loopPoseDegrees':float(np.rad2deg((R.from_quat(raw[-1]).inv()*R.from_quat(raw[0])).magnitude())),'maxNormalizedCubicTangentJoin':None,'loopNormalizedCubicTangentJoin':None});continue
  assert s['interpolation']=='CUBICSPLINE';v=raw.reshape(len(t),3,4);steps=np.rad2deg((R.from_quat(v[:-1,1]).inv()*R.from_quat(v[1:,1])).magnitude());rates=[]
  for i,dt in enumerate(np.diff(t)):
   p0,p1=v[i,1],v[i+1,1];m0,m1=v[i,2]*dt,v[i+1,0]*dt
   for u in np.linspace(0,1,17):
    p=(2*u**3-3*u*u+1)*p0+(u**3-2*u*u+u)*m0+(-2*u**3+3*u*u)*p1+(u**3-u*u)*m1
    derivative=((6*u*u-6*u)*p0+(3*u*u-4*u+1)*m0+(-6*u*u+6*u)*p1+(3*u*u-2*u)*m1)/dt
    rates.append(2*np.linalg.norm(project(p,derivative))*180/np.pi)
  out.append({'name':name,'interpolation':'CUBICSPLINE','maxKeyedStepDegrees':float(max(steps)),'maxDenseAngularSpeedDegreesPerSecond':float(max(rates)),'loopPoseDegrees':float(np.rad2deg((R.from_quat(v[-1,1]).inv()*R.from_quat(v[0,1])).magnitude())),'maxNormalizedCubicTangentJoin':float(max(np.linalg.norm(project(q,i)-project(q,o)) for i,q,o in v)),'loopNormalizedCubicTangentJoin':float(np.linalg.norm(project(v[-1,1],v[-1,2])-project(v[0,1],v[0,0])))})
 return out
SOURCES={'bay':('native-bay-head-kit','8f7e7c94395595693e480a9b16a7112b0b70231f54ce6d34efa376a2ec2bec2d'),'sporthorse':('native-bay-sporthorse-packed-kit','a7ea093b602d1b6f3ce234afaed89925974faf7a127bf07b2900ac41674b0f74')}
FOLDER,SHA=SOURCES[H.name]; source=ROOT/'review'/FOLDER/'model.glb'; base=H/'warped-base.glb'; final=H/'model.glb'
a,ab=g.read_glb(source);w,wb=g.read_glb(base);d,b=g.read_glb(final);assert hashlib.sha256(source.read_bytes()).hexdigest()==SHA
names={n.get('name'):i for i,n in enumerate(a['nodes'])};fore={names[n] for n in ['clavicle_l_0203','upperarm_l_0204','lowerarm_l_0205','hand_l_0206','fingers_01_l_0187','clavicle_r_0269','upperarm_r_0270','lowerarm_r_0271','hand_r_0272','fingers_01_r_0273']};distal={names[n] for n in ['fingers_01_l_0187','fingers_01_r_0273','fingers_02_l_0208','fingers_02_r_0274']};gaitnames={'Target Native Walk Rollover','Target Native Trot','Target Native Canter Left','Target Native Canter Right'}
checks={k:a.get(k)==w.get(k)==d.get(k) for k in ['nodes','meshes','skins','materials','textures','images','samplers','scenes','scene']};checks.update(originalBinaryPrefixExact=bytes(b[:len(ab)])==bytes(ab),warpedBinaryPrefixExact=bytes(b[:len(wb)])==bytes(wb),accessorPrefixExact=d['accessors'][:len(a['accessors'])]==a['accessors'],viewPrefixExact=d['bufferViews'][:len(a['bufferViews'])]==a['bufferViews'])
unchanged=0;changed=0;rows=[]
for ca,cw,cd in zip(a['animations'],w['animations'],d['animations']):
 assert ca['name']==cw['name']==cd['name'] and ca['channels']==cw['channels'] and cd['channels'][:len(ca['channels'])]==ca['channels']
 for c in ca['channels']:
  sa=ca['samplers'][c['sampler']];sw=cw['samplers'][c['sampler']];sd=cd['samplers'][c['sampler']];ni=c['target']['node'];path=c['target']['path'];allowed=path=='rotation' and ((ca['name']=='Target Native Trot' and ni in fore) or (ca['name'] in gaitnames and ni in distal))
  assert sa['input']==sw['input']==sd['input'] and sa.get('interpolation','LINEAR')==sw.get('interpolation','LINEAR')==sd.get('interpolation','LINEAR')
  if allowed:changed+=1
  else:assert sa==sw==sd and g.accessor(a,ab,sa['output']).tobytes()==g.accessor(d,b,sd['output']).tobytes();unchanged+=1
 if ca['name'] in gaitnames:
  before,after=metrics(a,ab,ca),metrics(d,b,cd)
  rows.append({'clip':ca['name'],'sourceMaxKeyedStepDegrees':max(x['maxKeyedStepDegrees'] for x in before),'candidateMaxKeyedStepDegrees':max(x['maxKeyedStepDegrees'] for x in after),'sourceMaxAngularSpeedDegreesPerSecond':max(x['maxDenseAngularSpeedDegreesPerSecond'] for x in before),'candidateMaxAngularSpeedDegreesPerSecond':max(x['maxDenseAngularSpeedDegreesPerSecond'] for x in after),'candidateMaxCubicTangentJoin':max(x['maxNormalizedCubicTangentJoin'] for x in after if x['maxNormalizedCubicTangentJoin'] is not None),'candidateLoopCubicTangentJoin':max(x['loopNormalizedCubicTangentJoin'] for x in after if x['loopNormalizedCubicTangentJoin'] is not None),'foreTracks':[x for x in after if names[x['name']] in fore or names[x['name']] in distal]})
# Source-own analytic checks at every changed cubic warp key, using independent basis coefficients.
warpclip=next(c for c in w['animations'] if c['name']=='Target Native Trot');origclip=next(c for c in a['animations'] if c['name']=='Target Native Trot');maxq=0.;maxqd=0.;untouched=0
for c in origclip['channels']:
 ni=c['target']['node']
 if ni not in fore or c['target']['path']!='rotation':continue
 s=origclip['samplers'][c['sampler']];z=warpclip['samplers'][c['sampler']];assert s['interpolation']=='CUBICSPLINE';t=g.accessor(a,ab,s['input']).reshape(-1).astype(float);v=g.accessor(a,ab,s['output']).reshape(len(t),3,4).astype(float);new=g.accessor(w,wb,z['output']).reshape(len(t),3,4).astype(float);D=float(t[-1]);offset=0 if '_l_' in a['nodes'][ni]['name'] else .5
 for k,tk in enumerate(t):
  limb=(tk/D-offset)%1;u=(limb-.44)/.56
  if not .55<u<.98:assert np.array_equal(v[k],new[k]);untouched+=1;continue
  sign=1 if u<=.75 else -1; width=.20 if sign==1 else .23;x=(u-.55)/width if sign==1 else (.98-u)/width;f=x*x*x*(10-15*x+6*x*x);fp=sign*30*x*x*(1-x)*(1-x)/width;tt=((offset+limb+.05*f)%1)*D;rate=1+.05*fp/.56
  j=min(max(int(np.searchsorted(t,tt,side='right')-1),0),len(t)-2);dt=t[j+1]-t[j];r=(tt-t[j])/dt
  coeff=np.array([2*r**3-3*r*r+1,r**3-2*r*r+r,-2*r**3+3*r*r,r**3-r*r]);coeffd=np.array([6*r*r-6*r,3*r*r-4*r+1,-6*r*r+6*r,3*r*r-2*r])/dt;terms=np.array([v[j,1],dt*v[j,2],v[j+1,1],dt*v[j+1,0]]);raw=coeff@terms;rawdot=coeffd@terms;length=np.linalg.norm(raw);q=raw/length;qd=(rawdot-q*np.dot(q,rawdot))/length*rate
  if np.dot(q,v[k,1])<0:q=-q;qd=-qd
  maxq=max(maxq,float(np.max(np.abs(q.astype(np.float32)-new[k,1]))));maxqd=max(maxqd,float(np.max(np.abs(qd.astype(np.float32)-new[k,0]))),float(np.max(np.abs(qd.astype(np.float32)-new[k,2]))))
checks.update(exactNormalizedHermiteWarpValues=maxq==0,projectedChainRuleTangentsWithinFloatRoundoff=maxqd<2e-7,unchangedSourceOtherTracksExact=unchanged==312,onlyAllowedSourceTracksChanged=changed==16)
companions=[c for c in d['animations'] if c['name'].startswith('Native Foreleg Baseline | ')];assert len(companions)==4
for cd in companions:
 cw=next(c for c in w['animations'] if c['name']==cd['name'].split(' | ',1)[1]);assert len(cd['channels'])==4
 for c in cd['channels']:
  sw=next((x for x in cw['channels'] if x['target']==c['target']),None);sd=cd['samplers'][c['sampler']]
  if sw:assert sd==cw['samplers'][sw['sampler']] and g.accessor(d,b,sd['output']).tobytes()==g.accessor(w,wb,sd['output']).tobytes()
  else:
   v=g.accessor(d,b,sd['output']).reshape(-1,3,4);q=np.array(a['nodes'][c['target']['node']].get('rotation',[0,0,0,1]),dtype=np.float32);assert np.array_equal(v[:,1],np.tile(q,(len(v),1))) and not np.any(v[:,[0,2]])
checks['fourCompanionsExactWarpedBaselineOrSourceDefault']=True
assert all(checks.values()); report={'source':str(source.relative_to(ROOT)),'sourceSha256':SHA,'warpedBaseSha256':hashlib.sha256(base.read_bytes()).hexdigest(),'candidateSha256':hashlib.sha256(final.read_bytes()).hexdigest(),'candidateBytes':final.stat().st_size,'checks':checks,'unchangedSourceTracks':unchanged,'unchangedWarpRows':untouched,'maxWarpValueError':maxq,'maxWarpTangentError':maxqd,'gaits':rows,'limits':'Cubic normalized derivative continuity checked analytically. Bay Canter retains original LINEAR f1 interpolation. Runtime clearance gating is separately tested; source four-cycle body timing, restricted short stride, brisk swing rates and baseline source contact errors are not repaired.'};(H/'independent-preservation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'target':H.name,'checks':checks,'gaits':[{k:v for k,v in r.items() if k!='foreTracks'} for r in rows]},indent=2))

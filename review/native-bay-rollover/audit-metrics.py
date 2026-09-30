"""Compute regional contact travel, native joint limits and independent Bay body response."""
from pathlib import Path
import json, math
import numpy as np

HERE=Path(__file__).resolve().parents[2]/'output/native-bay-rollover-audit'
r=json.loads((HERE/'browser-report.json').read_text()); rows=r['rows']
build=json.loads((HERE.parent/'native-bay-rollover/build-report.json').read_text())
rest=json.loads((HERE/'rig-rest.json').read_text())
speed,duration,duty=build['impliedSpeedMps'],build['duration'],build['stanceFraction']
intent=r['structure']['intent']
assert intent['footOffsets']=={k:v['offset']for k,v in build['footMasks'].items()}
def angle(q,s):
 q=np.asarray(q)/np.linalg.norm(q);s=np.asarray(s)/np.linalg.norm(s)
 return math.degrees(2*math.acos(min(1,abs(float(q@s)))))
pivots={'FL':'hand_l_0206','FR':'hand_r_0272','HL':'foot_l_0407','HR':'foot_r_0476'}
out={'candidateSha256':r['candidateSha256'],'originalSourceSha256':rest['sourceSha256'],'nominalTravelSpeedMps':speed,'duration':duration,'stanceDurationSec':duration*duty,'nominalTravelPerCycleM':speed*duration,
     'travelFormula':'XYZ_world = XYZ_inplace + [0,0,speed*duration*unwrapped_limb_phase]. Fixed centroid proxies are evaluated within heel/flat/toe regimes; heel movement after lift is not planted-heel sliding. Centroid Y range is not minimum contact height.',
     'contact':{},'caps':{},'loop':{},'body':{}}
for foot in ['FL','FR','HL','HR']:
 offset=intent['footOffsets'][foot]
 st=sorted([p for p in rows if p['feet'][foot]['stance']],key=lambda p:(p['phase']-offset)%1)
 out['contact'][foot]={}
 for name,field,lo,hi in [('heelStrike','heelCentroid',0,.15),('flat','centroid',.15,.7),('toeBreakover','toeCentroid',.7,1),('wholeStanceToe','toeCentroid',0,1),('wholeStanceHeel','heelCentroid',0,1)]:
  take=[(p,(p['phase']-offset)%1)for p in st if lo<=((p['phase']-offset)%1)/duty<=hi]
  xyz=np.array([np.array(p['feet'][foot][field])+[0,0,speed*duration*q]for p,q in take]);xz=xyz[:,[0,2]]
  out['contact'][foot][name]={'samples':len(take),'xyzRangeM':np.ptp(xyz,axis=0).tolist(),'xzRangeDiagonalM':float(np.linalg.norm(np.ptp(xz,axis=0))),'endpointDriftXYZ':(xyz[-1]-xyz[0]).tolist(),'pathLengthXZ':float(np.linalg.norm(np.diff(xz,axis=0),axis=1).sum())}
 caps=[]
 for i,(lo,hi)in enumerate(build['boundsDegrees']['fore'if foot[0]=='F'else'hind']):
  low=[f['phase']for f in build['frames']if f['feet'][foot]['correctionDegrees'][i]<=lo+.006]
  high=[f['phase']for f in build['frames']if f['feet'][foot]['correctionDegrees'][i]>=hi-.006]
  caps.append({'joint':build['footMasks'][foot]['chain'][i],'boundsDegrees':[lo,hi],'lowerHitCount128':len(low),'upperHitCount128':len(high),'lowerLimbPhases':sorted((p-offset)%1 for p in low),'upperLimbPhases':sorted((p-offset)%1 for p in high),'lowerDurationSec':len(low)/128*duration,'upperDurationSec':len(high)/128*duration})
 out['caps'][foot]=caps
 qs=[p['bones'][pivots[foot]]['q']for p in rows];steps=[angle(qs[i],qs[(i+1)%len(qs)])for i in range(len(qs))]
 out['loop'][foot]={'firstLastLocalAngleDegrees':angle(r['first']['bones'][pivots[foot]]['q'],r['last']['bones'][pivots[foot]]['q']),'maxLocalAdjacentStepDegrees':max(steps),'loopLocalAdjacentStepDegrees':steps[-1],'firstLastHoofCentroidDistanceM':float(np.linalg.norm(np.array(r['first']['feet'][foot]['centroid'])-r['last']['feet'][foot]['centroid']))}
for name,fn in [('upperTrunk1998',lambda p:p['bodyMarkers']['upperTrunk1998']),('neckCrest1931',lambda p:p['bodyMarkers']['neckCrest1931']),('head_019',lambda p:p['bones']['head_019']['p']),('pelvis_08',lambda p:p['bones']['pelvis_08']['p'])]:
 points=np.array([fn(p)for p in rows]);out['body'][name]={'xyzRangeM':np.ptp(points,axis=0).tolist(),'worldYRangeM':[float(points[:,1].min()),float(points[:,1].max())],'yMinPhase':rows[int(np.argmin(points[:,1]))]['phase'],'yMaxPhase':rows[int(np.argmax(points[:,1]))]['phase']}
out['body']['headRelativeUpperTrunkYRangeM']=float(np.ptp([p['bones']['head_019']['p'][1]-p['bodyMarkers']['upperTrunk1998'][1]for p in rows]))
out['body']['originalRestUpperTrunk1998M']=next(m for m in rest['meshes']if m['vertices']==16159)['bodyMarkers']['1998']['position']
(HERE/'motion-metrics.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'maxRegionalXZRangeMm':max(v['xzRangeDiagonalM']for f in out['contact'].values()for k,v in f.items()if k in ['heelStrike','flat','toeBreakover'])*1000,'caps':{k:[{n:v for n,v in c.items()if 'Phases'not in n}for c in cs]for k,cs in out['caps'].items()},'body':out['body'],'loop':out['loop']},indent=2))

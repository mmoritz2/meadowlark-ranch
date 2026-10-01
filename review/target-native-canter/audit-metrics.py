from pathlib import Path
import json,math,numpy as np
HERE=Path(__file__).resolve().parents[2]/'output/target-native-canter-audit'
build=json.loads((HERE.parent/'target-native-canter/build-report.json').read_text());speed=build['impliedSpeedMps'];duration=build['duration'];duty=build['stanceFraction']
def angle(q,s):
 q=np.asarray(q)/np.linalg.norm(q);s=np.asarray(s)/np.linalg.norm(s);return math.degrees(2*math.acos(min(1,abs(float(q@s)))))
chainPivot={'FL':'hand_l_0206','FR':'hand_r_0272','HL':'foot_l_0407','HR':'foot_r_0476'}
out={'nominalTravelSpeedMps':speed,'duration':duration,'stanceDurationSec':duration*duty,'nominalTravelPerCycleM':speed*duration,'travelFormula':'XYZ_world = XYZ_inplace + [0,0,speed*duration*unwrapped_limb_phase]. Fixed centroid proxies evaluated within contact regime; whole-stance heel travel after lift is not planted sliding. Y centroid range is not the minimum contact height.','leads':{}}
for lead in ['left','right']:
 r=json.loads((HERE/f'browser-{lead}.json').read_text());rows=r['rows'];intent=r['structure']['intent'];a=build['leads'][lead.title()];o={'candidateSha256':r['candidateSha256'],'contact':{},'caps':{},'loop':{},'body':{}}
 assert intent['footOffsets']==build['footOffsets'][lead.title()]
 for k in ['FL','FR','HL','HR']:
  offset=intent['footOffsets'][k];st=sorted([p for p in rows if p['feet'][k]['stance']],key=lambda p:(p['phase']-offset)%1);v={}
  for name,field,lo,hi in [('heelStrike','heelCentroid',0,.15),('flat','centroid',.15,.7),('toeBreakover','toeCentroid',.7,1),('wholeStanceToe','toeCentroid',0,1),('wholeStanceHeel','heelCentroid',0,1)]:
   take=[(p,(p['phase']-offset)%1)for p in st if lo<=((p['phase']-offset)%1)/duty<=hi];xyz=np.array([np.array(p['feet'][k][field])+[0,0,speed*duration*q]for p,q in take]);xz=xyz[:,[0,2]]
   v[name]={'samples':len(take),'xyzRangeM':np.ptp(xyz,axis=0).tolist(),'xzRangeDiagonalM':float(np.linalg.norm(np.ptp(xz,axis=0))),'endpointDriftXYZ':(xyz[-1]-xyz[0]).tolist(),'pathLengthXZ':float(np.linalg.norm(np.diff(xz,axis=0),axis=1).sum())}
  o['contact'][k]=v;bounds=build['boundsDegrees']['fore'if k[0]=='F'else'hind'];cap=[]
  for i,(lo,hi)in enumerate(bounds):
   low=[f['phase']for f in a['frames']if f['feet'][k]['correctionDegrees'][i]<=lo+.006];high=[f['phase']for f in a['frames']if f['feet'][k]['correctionDegrees'][i]>=hi-.006]
   cap.append({'joint':build['footMasks'][k]['chain'][i],'boundsDegrees':[lo,hi],'lowerHitCount128':len(low),'upperHitCount128':len(high),'lowerLimbPhases':sorted((p-offset)%1 for p in low),'upperLimbPhases':sorted((p-offset)%1 for p in high),'lowerDurationSec':len(low)/128*duration,'upperDurationSec':len(high)/128*duration})
  o['caps'][k]=cap;qs=[p['bones'][chainPivot[k]]['q']for p in rows];steps=[angle(qs[i],qs[(i+1)%len(qs)])for i in range(len(qs))]
  o['loop'][k]={'firstLastLocalAngleDegrees':angle(r['first']['bones'][chainPivot[k]]['q'],r['last']['bones'][chainPivot[k]]['q']),'maxLocalAdjacentStepDegrees':max(steps),'loopLocalAdjacentStepDegrees':steps[-1],'firstLastHoofCentroidDistanceM':float(np.linalg.norm(np.array(r['first']['feet'][k]['centroid'])-r['last']['feet'][k]['centroid']))}
 for name,fn in [('upperTrunk1998',lambda p:p['bodyMarkers']['upperTrunk1998']),('neckCrest1931',lambda p:p['bodyMarkers']['neckCrest1931']),('head_019',lambda p:p['bones']['head_019']['p']),('pelvis_08',lambda p:p['bones']['pelvis_08']['p'])]:
  points=np.array([fn(p)for p in rows]);o['body'][name]={'xyzRangeM':np.ptp(points,axis=0).tolist(),'yMinPhase':rows[int(np.argmin(points[:,1]))]['phase'],'yMaxPhase':rows[int(np.argmax(points[:,1]))]['phase']}
 o['body']['headRelativeUpperTrunkYRangeM']=float(np.ptp([p['bones']['head_019']['p'][1]-p['bodyMarkers']['upperTrunk1998'][1]for p in rows]));out['leads'][lead]=o
(HERE/'motion-metrics.json').write_text(json.dumps(out,indent=2)+'\n')
for lead,o in out['leads'].items():
 print(lead,'max regional XZ mm',max(v['xzRangeDiagonalM']for f in o['contact'].values()for k,v in f.items()if k in ['heelStrike','flat','toeBreakover'])*1000)
 print(lead,'body',json.dumps(o['body'],indent=2));print(lead,'caps',json.dumps({k:[{n:v for n,v in c.items()if 'Phases'not in n}for c in v]for k,v in o['caps'].items()},indent=2));print(lead,'loop',json.dumps(o['loop'],indent=2))

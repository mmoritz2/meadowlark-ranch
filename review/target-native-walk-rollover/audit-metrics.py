from pathlib import Path
import json,math,numpy as np
HERE=Path(__file__).resolve().parents[2]/'output/target-native-walk-rollover-audit'
r=json.loads((HERE/'browser-report.json').read_text()); rows=r['rows']; a=json.loads((HERE.parent/'target-native-walk-rollover/build-report.json').read_text()); intent=r['structure']['intent']; speed=a['impliedSpeedMps']; duration=a['duration']; duty=a['stanceFraction']
def angle(q,s):
 q=np.asarray(q)/np.linalg.norm(q);s=np.asarray(s)/np.linalg.norm(s);return math.degrees(2*math.acos(min(1,abs(float(q@s)))))
def flex(row,chain):
 a,b,c=(np.array(row['bones'][n]['p'])for n in chain);x=a-b;y=c-b;return 180-math.degrees(math.acos(np.clip(x@y/np.linalg.norm(x)/np.linalg.norm(y),-1,1)))
chains={'FL':['lowerarm_l_0205','hand_l_0206','fingers_01_l_0187'],'FR':['lowerarm_r_0271','hand_r_0272','fingers_01_r_0273'],'HL':['lowerleg_l_0406','foot_l_0407','toes_01_l_0408'],'HR':['lowerleg_r_0475','foot_r_0476','toes_01_r_0477']}
old=json.loads((HERE.parent/'target-native-walk-audit/browser-report.json').read_text())
out={'candidateSha256':r['candidateSha256'],'nominalTravelSpeedMps':speed,'duration':duration,'stanceDurationSec':duration*duty,'travelFormula':'XYZ_world = XYZ_inplace + [0,0,speed*duration*unwrapped_limb_phase]. Centroid proxies are evaluated within each contact regime; whole-stance heel movement after lift is not planted sliding.','contact':{},'caps':{},'loop':{},'comparison':{}}
for k in ['FL','FR','HL','HR']:
 offset=intent['footOffsets'][k];st=sorted([p for p in rows if p['feet'][k]['stance']],key=lambda p:(p['phase']-offset)%1); v={}
 for name,field,lo,hi in [('heelStrike','heelCentroid',0,.15),('flat','centroid',.15,.7),('toeBreakover','toeCentroid',.7,1),('wholeStanceToe','toeCentroid',0,1),('wholeStanceHeel','heelCentroid',0,1)]:
  take=[(p,(p['phase']-offset)%1)for p in st if lo<=((p['phase']-offset)%1)/duty<=hi];xyz=np.array([np.array(p['feet'][k][field])+[0,0,speed*duration*q]for p,q in take]);xz=xyz[:,[0,2]]
  v[name]={'samples':len(take),'xRangeM':float(np.ptp(xyz[:,0])),'zRangeM':float(np.ptp(xyz[:,2])),'xzRangeDiagonalM':float(np.linalg.norm(np.ptp(xz,axis=0))),'endpointDriftXZ':(xz[-1]-xz[0]).tolist(),'pathLengthXZ':float(np.linalg.norm(np.diff(xz,axis=0),axis=1).sum())}
 out['contact'][k]=v; bounds=a['boundsDegrees']['fore'if k[0]=='F'else'hind']; cap=[]
 for i,(lo,hi)in enumerate(bounds):
  low=[f['phase']for f in a['frames']if f['feet'][k]['correctionDegrees'][i]<=lo+.006];high=[f['phase']for f in a['frames']if f['feet'][k]['correctionDegrees'][i]>=hi-.006];cap.append({'joint':a['footMasks'][k]['chain'][i],'boundsDegrees':[lo,hi],'lowerHitCount128':len(low),'upperHitCount128':len(high),'lowerPhases':low,'upperPhases':high})
 out['caps'][k]=cap;qs=[p['bones'][chains[k][1]]['q']for p in rows];steps=[angle(qs[i],qs[(i+1)%len(qs)])for i in range(len(qs))];out['loop'][k]={'firstLastLocalAngleDegrees':angle(r['first']['bones'][chains[k][1]]['q'],r['last']['bones'][chains[k][1]]['q']),'maxLocalAdjacentStepDegrees':max(steps),'loopLocalAdjacentStepDegrees':steps[-1],'firstLastHoofCentroidDistanceM':float(np.linalg.norm(np.array(r['first']['feet'][k]['centroid'])-r['last']['feet'][k]['centroid']))}
 os=[p for p in old['rows']if not p['feet'][k]['stance']];ns=[p for p in rows if not p['feet'][k]['stance']];out['comparison'][k]={'oldSwingGeometricFlexDegrees':[min(flex(p,chains[k])for p in os),max(flex(p,chains[k])for p in os)],'newSwingGeometricFlexDegrees':[min(p['flex'][k]for p in ns),max(p['flex'][k]for p in ns)]}
out['body']={}
for name,fn in [('upperTrunk1998',lambda p:p['bodyMarkers']['upperTrunk1998']),('neckCrest1931',lambda p:p['bodyMarkers']['neckCrest1931']),('head_019',lambda p:p['bones']['head_019']['p']),('pelvis_08',lambda p:p['bones']['pelvis_08']['p'])]:
 points=np.array([fn(p)for p in rows]);op=np.array([fn(p)for p in old['rows']]);out['body'][name]={'oldYRangeM':float(np.ptp(op[:,1])),'newYRangeM':float(np.ptp(points[:,1])),'newYMinPhase':rows[int(np.argmin(points[:,1]))]['phase'],'newYMaxPhase':rows[int(np.argmax(points[:,1]))]['phase']}
out['body']['headRelativeUpperTrunkYRangeM']=float(np.ptp([p['bones']['head_019']['p'][1]-p['bodyMarkers']['upperTrunk1998'][1]for p in rows]))
(HERE/'motion-metrics.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:out[k]for k in ['contact','comparison','body','loop']},indent=2));print('caps',json.dumps({k:[{n:v for n,v in x.items()if 'Phases'not in n}for x in xs]for k,xs in out['caps'].items()},indent=2))

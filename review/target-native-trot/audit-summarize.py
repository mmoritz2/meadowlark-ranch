from pathlib import Path
import json, math
import numpy as np

HERE=Path(__file__).resolve().parents[2]/'output/target-native-trot-audit'
r=json.loads((HERE/'browser-report.json').read_text());rows=r['rows'];intent=r['structure']['intent'];floor=rows[0]['groundY']
def angle(a,b):
    a=np.asarray(a);b=np.asarray(b);a=a/np.linalg.norm(a);b=b/np.linalg.norm(b)
    return math.degrees(2*math.acos(min(1,abs(float(a@b)))))
out={'candidateSha256':r['candidateSha256'],'errors':r['errors'],'clip':rows[0]['clip'],'phaseCount':len(rows),'intent':intent,'fixedFloorY':floor,'feet':{},'support':{},'markers':{},'joints':{}}
for foot in ['FL','FR','HL','HR']:
    st=[p for p in rows if p['feet'][foot]['stance']];sw=[p for p in rows if not p['feet'][foot]['stance']]
    duty=intent['stanceFraction'];offset=intent['footOffsets'][foot]
    flat=[p for p in st if .15<=(p['phase']-offset)%1/duty<=.7]
    roll=[p for p in st if (p['phase']-offset)%1/duty>=.8]
    strike=[p for p in st if (p['phase']-offset)%1/duty<=.10]
    out['feet'][foot]={
        'fullHoofCount':len(r['structure']['fullFootVertices'][foot]),'strictSoleCount':len(r['structure']['footVertices'][foot]),
        'stanceSamples':len(st),'stanceFullHoofMinRange':[min(p['feet'][foot]['minY']for p in st),max(p['feet'][foot]['minY']for p in st)],
        'stanceToeMinRange':[min(p['feet'][foot]['toeMinY']for p in st),max(p['feet'][foot]['toeMinY']for p in st)],
        'stanceHeelMinRange':[min(p['feet'][foot]['heelMinY']for p in st),max(p['feet'][foot]['heelMinY']for p in st)],
        'flatToeHeelGapRange':[min(p['feet'][foot]['heelMinY']-p['feet'][foot]['toeMinY']for p in flat),max(p['feet'][foot]['heelMinY']-p['feet'][foot]['toeMinY']for p in flat)],
        'lateRollHeelAboveToeRange':[min(p['feet'][foot]['heelMinY']-p['feet'][foot]['toeMinY']for p in roll),max(p['feet'][foot]['heelMinY']-p['feet'][foot]['toeMinY']for p in roll)],
        'strikeToeAboveHeelRange':[min(p['feet'][foot]['toeMinY']-p['feet'][foot]['heelMinY']for p in strike),max(p['feet'][foot]['toeMinY']-p['feet'][foot]['heelMinY']for p in strike)],
        'allCycleFullHoofMinRange':[min(p['feet'][foot]['minY']for p in rows),max(p['feet'][foot]['minY']for p in rows)],
        'stanceGeometricFlexDegrees':[min(p['flex'][foot]for p in st),max(p['flex'][foot]for p in st)],
        'swingGeometricFlexDegrees':[min(p['flex'][foot]for p in sw),max(p['flex'][foot]for p in sw)],'signedSagittalFlexAllDegrees':[min(p['signedFlex'][foot]for p in rows),max(p['signedFlex'][foot]for p in rows)]}
supports=[]
for p in rows:
    active=sorted(k for k,v in p['feet'].items()if v['stance']);supports.append(tuple(active))
out['support']['intentPatterns']={','.join(k)if k else 'suspension':supports.count(k)for k in set(supports)}
air=[p for p,support in zip(rows,supports)if not support]
out['support']['suspensionSampleCount']=len(air)
out['support']['suspensionFraction']=len(air)/len(rows)
out['support']['suspensionActualBodyMinRange']=[min(p['bounds']['min'][1]-floor for p in air),max(p['bounds']['min'][1]-floor for p in air)]if air else None
out['support']['wholeBodyMinRange']=[min(p['bounds']['min'][1]-floor for p in rows),max(p['bounds']['min'][1]-floor for p in rows)]
for name in ['neckCrest1931','upperTrunk1998']:
    points=np.array([p['bodyMarkers'][name]for p in rows]);out['markers'][name]={'min':points.min(axis=0).tolist(),'max':points.max(axis=0).tolist(),'yMinPhase':rows[int(np.argmin(points[:,1]))]['phase'],'yMaxPhase':rows[int(np.argmax(points[:,1]))]['phase']}
for name in ['pelvis_08','spine_04_012','neck_01_014','neck_03_016','neck_05_018','head_019','tail_01_0367','tail_03_0369','dyn_tail_06_0372','dyn_tail_08_0374','dyn_new_neck_03_02_0152','dyn_new_neck_04_01_0127','dyn_new_head_neck_01_073']:
    points=np.array([p['bones'][name]['p']for p in rows]);subset=rows[::4]
    out['joints'][name]={'worldMin':points.min(axis=0).tolist(),'worldMax':points.max(axis=0).tolist(),'maxLocalAngularExcursionDegrees':max(angle(a['bones'][name]['q'],b['bones'][name]['q'])for a in subset for b in subset),'loopSeamDegrees':angle(r['first']['bones'][name]['q'],r['last']['bones'][name]['q'])}
(HERE/'summary.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({k:out[k]for k in ['candidateSha256','errors','support','feet']},indent=2))

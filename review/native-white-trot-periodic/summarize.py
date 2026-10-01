"""Compact browser and authored-grid evidence for the private White fast gaits."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'output/native-white-trot-periodic';HERE=Path(__file__).resolve().parent
summary={'sourceSha256':'fd18d9b9b22e00dc30a6fa1cfe2e135bb20f7c871df0a976706aaea2f4dff655','gaits':{}}
for gait in ('trot',):
 build=json.loads((OUT/f'{gait}-build-report.json').read_text())
 browser=json.loads((OUT/f'browser-summary-{gait}.json').read_text())
 steps=json.loads((HERE/f'{gait}-step-audit.json').read_text())
 assert build['candidateSha256']==browser['candidateSha256']==steps['sha256']
 item={'candidateSha256':build['candidateSha256'],'periodS':build['duration'],'stanceFraction':build['stanceFraction'],'halfStrokeM':build['strideHalfM'],'nominalSpeedMps':build['impliedSpeedMps'],'footOffsets':build['footOffsets'],'fixedFloorY':build['floorY'],'standingProbePass':build['standingProbe']['pass'],'browserErrors':browser['errors'],'clips':{}}
 for result in browser['reports']:
  lead=result['lead'];name=result['clip'];frames=build['leads'][lead]['frames'];stance=[v for f in frames for v in f['feet'].values() if v['stance']];swing=[v for f in frames for v in f['feet'].values() if not v['stance']]
  scan=json.loads((OUT/f'browser-{gait}-{lead.lower()}.json').read_text());rows=scan['rows'];offsets=scan['structure']['intent']['footOffsets'];speed=build['impliedSpeedMps'];duration=build['duration']
  regional={}
  for foot in ['FL','FR','HL','HR']:
   groups={'heel':[],'flat':[],'toe':[]}
   for r in rows:
    f=r['feet'][foot]
    if not f['stance']:continue
    q=(r['phase']-offsets[foot])%1;u=q/build['stanceFraction'];part='heel' if u<.15 else 'toe' if u>.7 else 'flat';p=f['heelCentroid'] if part=='heel' else f['toeCentroid'] if part=='toe' else f['centroid'];groups[part].append((p[0],p[2]+speed*duration*r['phase']))
   regional[foot]={k:{'samples':len(v),'spanXM':max((p[0] for p in v),default=0)-min((p[0] for p in v),default=0),'spanZM':max((p[1] for p in v),default=0)-min((p[1] for p in v),default=0)} for k,v in groups.items()}
  upper=[r['bodyMarkers']['upperTrunk1998'][1] for r in rows];head=[r['bones']['head_019']['p'][1] for r in rows]
  step=steps['clips'][name]
  item['clips'][name]={'lead':lead,'browserPhases':result['phases'],'all677BoneTransformsFinite':result['finite'],'wholeHoofStanceContact':result['contact'],'allStanceWithin10mm':result['allStanceWithin10mm'],'bodyMinimumAboveFloorM':result['bodyMinimumAboveFloorM'],'suspensionPhases':result['suspensionSamples'],'seamPositionM':result['seamPositionM'],'authoredStanceVerticalErrorMaxM':max(abs(v['contactVerticalError']) for v in stance),'authoredSwingHeightErrorMaxM':max(abs(v['contactVerticalError']) for v in swing),'authoredGridPass':build['leads'][lead]['authoredGridPass'],'capFramesAnyJointByFoot':build['leads'][lead]['capHits'],'uncopiedClosureMaxDegrees':build['leads'][lead]['uncopiedClosureMaxDegrees'],'regionalPlantSpanXZ':regional,'upperTrunk1998RangeYM':max(upper)-min(upper),'headPivotRangeYM':max(head)-min(head),'maxLimbStepDegrees':step['maxLimbStepDegrees'],'stepDurationMs':1000*duration/128,'above5DegreeLimbSteps':step['above5DegreeLimbSteps'],'maxLimbStepVectorChangeDegrees':step['maxLimbStepVectorChangeDegrees'],'maxLimbSeamVelocityVectorJumpDegreesPerStep':step['maxLimbSeamVelocityVectorJumpDegreesPerStep']}
 summary['gaits'][gait]=item
(HERE/'qa-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({g:{c:{k:v[k] for k in ('maxLimbStepDegrees','above5DegreeLimbSteps','allStanceWithin10mm','suspensionPhases')} for c,v in d['clips'].items()} for g,d in summary['gaits'].items()},indent=2))

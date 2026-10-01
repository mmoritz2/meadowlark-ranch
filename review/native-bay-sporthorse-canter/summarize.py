"""Compact evidence from the authored grid and actual browser GLTF scans."""
from pathlib import Path
import json,math
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'output/native-bay-sporthorse-canter';HERE=Path(__file__).resolve().parent
build=json.loads((OUT/'build-report.json').read_text());browser=json.loads((OUT/'browser-summary.json').read_text())
assert build['candidateSha256']==browser['candidateSha256']
summary={'candidateSha256':browser['candidateSha256'],'sourceSha256':browser['sourceSha256'],'periodS':build['duration'],'stanceFraction':build['stanceFraction'],'bodyHeightRatio':build['bodyHeightRatio'],'halfStrokeM':build['strideHalfM'],'nominalSpeedMps':build['impliedSpeedMps'],'fixedFloorY':build['floorY'],'standingProbePass':build['standingProbe']['pass'],'browserErrors':browser['errors'],'leads':{}}
for result in browser['reports']:
 lead=result['lead'];b=build['leads'][lead];scan=json.loads((OUT/f'browser-{lead.lower()}.json').read_text());rows=scan['rows'];offsets=scan['structure']['intent']['footOffsets'];duration=result['durationS'];speed=build['impliedSpeedMps']
 authored_stance=[f for frame in b['frames'] for f in frame['feet'].values() if f['stance']]
 authored_swing=[f for frame in b['frames'] for f in frame['feet'].values() if not f['stance']]
 flight=[r['bounds']['min'][1]-r['groundY'] for r in rows if not any(v['stance'] for v in r['feet'].values())]
 regional={}
 for foot in ['FL','FR','HL','HR']:
  groups={'heel':[],'flat':[],'toe':[]}
  for r in rows:
   f=r['feet'][foot]
   if not f['stance']:continue
   q=(r['phase']-offsets[foot])%1;u=q/build['stanceFraction']
   name='heel' if u<.15 else 'toe' if u>.7 else 'flat'
   point=f['heelCentroid'] if name=='heel' else f['toeCentroid'] if name=='toe' else f['centroid']
   groups[name].append((point[0],point[2]+speed*duration*r['phase']))
  regional[foot]={name:{'samples':len(points),'spanXM':max((p[0] for p in points),default=0)-min((p[0] for p in points),default=0),'spanZM':max((p[1] for p in points),default=0)-min((p[1] for p in points),default=0)} for name,points in groups.items()}
 # Relative joints retain native asymmetric rest pose. Quantify only cyclic range.
 range_y=lambda key:max(r['bones'][key]['p'][1] for r in rows)-min(r['bones'][key]['p'][1] for r in rows)
 upper=[r['bodyMarkers']['upperTrunk1998'][1] for r in rows]
 cap_detail={}
 chain_names={k:build['footMasks'][k]['chain'] for k in ['FL','FR','HL','HR']}
 for foot,chain in chain_names.items():
  cap_detail[foot]={}
  for j,name in enumerate(chain):
   seq=[f['feet'][foot]['correctionDegrees'][j] for f in b['frames']]
   lo,hi=build['boundsDegrees']['fore' if foot.startswith('F') else 'hind'][j]
   hit=sum(abs(x-lo)<.006 or abs(x-hi)<.006 for x in seq)
   cap_detail[foot][name]={'minDegrees':min(seq),'maxDegrees':max(seq),'capFrames':hit,'capMilliseconds':hit*duration/len(seq)*1000}
 summary['leads'][lead]={
  'authoredFrames':len(b['frames']),'authoredGridPass':b['authoredGridPass'],'authoredWorstVerticalErrorM':b['worstVerticalErrorM'],'authoredWorstStrideAnchorErrorM':b['worstStrideErrorM'],'authoredStanceVerticalErrorMaxM':max(abs(f['contactVerticalError']) for f in authored_stance),'authoredStanceGridPass':all(abs(f['contactVerticalError'])<.005 and abs(f['strideAnchorError'])<.005 for f in authored_stance),'authoredSwingHeightErrorMaxM':max(abs(f['contactVerticalError']) for f in authored_swing),
  'browserPhases':result['phases'],'all677BoneTransformsFinite':result['finite'],'allStanceWholeHoofMinimaWithin10mm':result['allStanceWithin10mm'],'stanceContact':result['contact'],'bodyMinAboveFloorM':result['bodyMinimumAboveFloorM'],'suspensionPhases':result['suspensionSamples'],'flightBodyMinAboveFloorM':[min(flight),max(flight)],'seamPositionM':result['seamPositionM'],
  'regionalPlantSpanXZ':regional,'jointCaps':cap_detail,'upperTrunkMarker1998RangeYM':max(upper)-min(upper),'headPivotRangeYM':range_y('head_019'),'tailBaseRangeYM':range_y('tail_01_0367')}
(HERE/'qa-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({'candidate':summary['candidateSha256'],'leads':{k:{'contact':v['allStanceWholeHoofMinimaWithin10mm'],'flight':v['flightBodyMinAboveFloorM'],'maxPlantSpanZ':max(row['spanZM'] for ft in v['regionalPlantSpanXZ'].values() for row in ft.values()),'capFramesTotal':sum(x['capFrames'] for ft in v['jointCaps'].values() for x in ft.values())} for k,v in summary['leads'].items()}},indent=2))

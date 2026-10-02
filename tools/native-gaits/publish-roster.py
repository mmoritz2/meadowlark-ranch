"""Package reviewed curves onto the existing body assets, without rewriting skins.

Run after retarget-reference.py and the native target builds. --partial is for
local integration checks only; the default requires both gallop leads.
"""
from pathlib import Path
import argparse, copy, hashlib, importlib.util, json, math, sys
import numpy as np
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'tools/asset-gen'))
import rig_hero_horse as glb
spec = importlib.util.spec_from_file_location('pack', Path(__file__).with_name('package-motion.py'))
pack = importlib.util.module_from_spec(spec); spec.loader.exec_module(pack)
REVIEW = ROOT/'review/native-complete-gaits'
DEST = ROOT/'assets/models/horse-motions'
CLIPS = {'idle':'Horse|Horse_Idle', 'walk':'Target Native Walk Rollover',
 'trot':'Target Native Trot', 'canter-left':'Target Native Canter Left',
 'canter-right':'Target Native Canter Right', 'gallop-left':'Target Native Gallop Left',
 'gallop-right':'Target Native Gallop Right', 'jump':'Target Native Jump'}

def read(path): return json.loads(Path(path).read_text())
def write(path, value): Path(path).write_text(json.dumps(value, indent=2)+'\n')
def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def jump_record(metadata):
 return {k:metadata[k] for k in ['clip','durationS','flightStartS','flightEndS','actorLiftM']}
def curve_record(clip, duration, stroke, duty, offsets):
 return dict(clip=clip, durationS=duration, strokeM=stroke, stanceFraction=duty,
             nominalSpeedMps=stroke/(duration*duty), footOffsets=offsets, authoredHoofFold=True)

def scaled_jump(folder):
 """Normalize the initial batch clock; new retarget builds already do this."""
 report=read(folder/'jump.json'); metadata=copy.deepcopy(report['nativeJump'])
 if report.get('jumpTimeScale') is not None: return folder/'jump.glb', metadata
 clock=math.sqrt(report['ratio']); d,b=glb.read_glb(folder/'jump.glb'); b=bytearray(b)
 for ai in {s['input'] for a in d['animations'] for s in a['samplers']}:
  a=d['accessors'][ai]; view=d['bufferViews'][a['bufferView']]
  values=np.asarray(glb.accessor(d,b,ai)*clock,dtype='<f4')
  offset=view.get('byteOffset',0)+a.get('byteOffset',0)
  b[offset:offset+values.nbytes]=values.tobytes()
  a['min']=[float(values.min())]; a['max']=[float(values.max())]
 for key in ['durationS','flightStartS','flightEndS','foreTouchdownS','hindTouchdownS']:
  if key in metadata: metadata[key]*=clock
 metadata['actorLiftM']=[[t*clock,y] for t,y in metadata['actorLiftM']]
 metadata['gravityMps2']=9.81
 out=folder/'jump-scaled.glb'; glb.write_glb(out,d,b)
 write(folder/'jump-scaled-metadata.json',metadata)
 return out,metadata

def publish(partial=False):
 DEST.mkdir(parents=True,exist_ok=True)
 old=read(ROOT/'assets/models/artist-breeds/manifest.json')
 keys=sorted({s['file'].removesuffix('.glb') for s in old['breeds'].values()})
 gallop_contract=REVIEW/'locomotion/gallop-approved/clip-contract.json'
 gallops={k:v for k,v in read(gallop_contract).items() if k in ['gallopLeft','gallopRight']} if gallop_contract.exists() else None
 if not partial and not gallops: raise RuntimeError('Reviewed gallop contract is required')
 movements=['idle','walk','trot','canter-left','canter-right','jump']
 if gallops: movements+=['gallop-left','gallop-right']
 manifest={'version':1,'breeds':{}}
 for key in keys:
  folder=REVIEW/'roster'/key
  reports={k:read(folder/(k+'.json')) for k in movements}
  ratio=reports['trot']['ratio']; jumpfile,metadata=scaled_jump(folder)
  sources=[(jumpfile if k=='jump' else folder/(k+'.glb'),CLIPS[k]) for k in movements]
  output=DEST/(key+'.glb'); info=pack.package(sources,output)
  gaits={
   'walk':curve_record(CLIPS['walk'],1.12,.4*ratio,.65,{'HL':0,'FL':.25,'HR':.5,'FR':.75}),
   'trot':curve_record(CLIPS['trot'],.72,.58*ratio,.44,{'FL':0,'HR':0,'FR':.5,'HL':.5}),
   'canterLeft':curve_record(CLIPS['canter-left'],.64,.54*ratio,.4,{'HR':0,'HL':.24,'FR':.24,'FL':.48}),
   'canterRight':curve_record(CLIPS['canter-right'],.64,.54*ratio,.4,{'HL':0,'HR':.24,'FL':.24,'FR':.48})}
  if gallops:
   for mode,record in gallops.items():
    record=copy.deepcopy(record);record.pop('baselineCompanion',None);record['strokeM']*=ratio;record['nominalSpeedMps']*=ratio
    gaits[mode]=record
  manifest['breeds'][key]={'motionFile':'./models/horse-motions/'+key+'.glb',
   'motionSha256':info['sha256'],'nativeKind':'horse','nativeHoofFlex':False,
   'nativeIdleClip':CLIPS['idle'],'nativeGaits':gaits,'nativeJump':jump_record(metadata),
   'nativeMaxSpeedMps':max(r['nominalSpeedMps'] for r in gaits.values()),
   'motionAttribution':'Motion adapted from WildMesh 3D, CC BY-NC 4.0; original body by b2przemo, CC BY 3.0.'}
 write(DEST/'manifest.json',manifest)
 # The three native horses retain their exact meshes, rests, skins and contacts.
 native={}
 white_sources=[(ROOT/'review/native-trot-polish-pilot/model.glb',CLIPS['trot']),
  (REVIEW/'locomotion/canter/model.glb',CLIPS['canter-left']),
  (REVIEW/'locomotion/canter/model.glb',CLIPS['canter-right']),
  (REVIEW/'jump/model.glb',CLIPS['jump'])]
 for key,folder in [('white-western',None),('bay-western','bay'),('bay-sporthorse-native','sport')]:
  if folder:
   contract=read(REVIEW/'locomotion'/folder/'motion-contract.json')
   source=REVIEW/'locomotion'/folder/'motion-override.glb';d,_=glb.read_glb(source)
   sources=[(source,c['name']) for c in d['animations'] if c['name']!=CLIPS['walk']]
   gaits={k:v for k,v in contract['gaits'].items() if k!='jump'}
   for k,v in gaits.items():v['authoredHoofFold']=k!='walk'
   metadata=read(REVIEW/'locomotion'/folder/'jump/jump-metadata.json')
  else:
   sources=list(white_sources)
   gaits=copy.deepcopy(manifest['breeds'][keys[0]]['nativeGaits'])
   base_ratio=read(REVIEW/'roster'/keys[0]/'trot.json')['ratio']
   for r in gaits.values():r['strokeM']/=base_ratio;r['nominalSpeedMps']/=base_ratio
   gaits['walk']['authoredHoofFold']=False
   metadata=read(REVIEW/'jump/jump-metadata.json')
  gf=REVIEW/'locomotion/gallop-approved'/(folder or 'white')
  if gallops and (not partial or ((gf/'model.glb').exists() and (not folder or (gf/'clip-contract.json').exists()))):
   if folder:gaits.update({k:v for k,v in read(gf/'clip-contract.json').items() if k in ['gallopLeft','gallopRight']})
   else:gaits.update(gallops)
   sources.extend((gf/'model.glb',name) for k in ['gallop-left','gallop-right'] for name in [CLIPS[k],'Native Foreleg Baseline | '+CLIPS[k]])
  info=pack.package(sources,DEST/(key+'.glb'))
  native[key]={'motionFile':'./models/horse-motions/'+key+'.glb','motionSha256':info['sha256'],
   'nativeSupportsJump':True,'nativeSupportsGallop':'gallopLeft' in gaits,
   'description':'Walk, approved Trot, both Canter leads'+(', both collected Gallop leads' if 'gallopLeft' in gaits else '')+' and Jump on the preserved native rig.',
   'nativeGaits':gaits,'nativeJump':jump_record(metadata),
   'nativeMaxSpeedMps':max(r['nominalSpeedMps'] for r in gaits.values())}
 # Compact authoring reference keeps the approved Walk/Idle too.
 reference=[(ROOT/'review/native-trot-polish-pilot/model.glb',CLIPS[k]) for k in ['idle','walk']]+white_sources
 if gallops:reference.extend((REVIEW/'locomotion/gallop-approved/white/model.glb',CLIPS[k]) for k in ['gallop-left','gallop-right'])
 pack.package(reference,DEST/'authoring-reference.glb')
 (ROOT/'assets/native-complete-gaits.js').write_text('// Generated by tools/native-gaits/publish-roster.py. Existing skins are preserved.\nexport const NATIVE_COMPLETE_GAITS='+json.dumps(native,indent=2)+';\n')
 print(f'Packaged {len(keys)} preserved artist bodies and {len(native)} native horses; gallop={bool(gallops)}')

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--partial',action='store_true')
 publish(parser.parse_args().partial)

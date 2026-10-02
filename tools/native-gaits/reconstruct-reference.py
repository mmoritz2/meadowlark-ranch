"""Reconstruct a retargetable White reference from the shipped body and curves.

No source model download or duplicate mesh needs to be committed. The output is
a local authoring intermediate, not a replacement for the runtime body asset.
"""
from pathlib import Path
import copy, hashlib, json, sys
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/asset-gen'))
import rig_hero_horse as g

def reconstruct(output):
 body=ROOT/'review/native-trot-reference-kit/white/model.glb'
 motion=ROOT/'assets/models/horse-motions/authoring-reference.glb'
 d,b=g.read_glb(body); b=bytearray(b); m,mb=g.read_glb(motion)
 names={n.get('name'):i for i,n in enumerate(d['nodes'])}
 cache={}
 def accessor(ai):
  if ai in cache:return cache[ai]
  values=g.accessor(m,mb,ai);b.extend(b'\0'*(-len(b)%4))
  vi=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':len(b),'byteLength':values.nbytes});b.extend(values.tobytes())
  a=copy.deepcopy(m['accessors'][ai]);a['bufferView']=vi;a.pop('byteOffset',None)
  result=len(d['accessors']);d['accessors'].append(a);cache[ai]=result;return result
 incoming=[]
 for original in m['animations']:
  clip=copy.deepcopy(original)
  for channel in clip['channels']:channel['target']['node']=names[m['nodes'][channel['target']['node']]['name']]
  for sampler in clip['samplers']:
   sampler['input']=accessor(sampler['input']);sampler['output']=accessor(sampler['output'])
  incoming.append(clip)
 replaced={c['name'] for c in incoming}
 d['animations']=[c for c in d['animations'] if c['name'] not in replaced]+incoming
 d['buffers'][0]['byteLength']=len(b);output.parent.mkdir(parents=True,exist_ok=True);g.write_glb(output,d,b)
 source=(ROOT/'assets/native-complete-gaits.js').read_text().split('=',1)[1].strip().removesuffix(';')
 jump=json.loads(source)['white-western']['nativeJump']
 jump.update(maxActorLiftM=max(y for _,y in jump['actorLiftM']),gravityMps2=9.81,
             modelSha256=hashlib.sha256(output.read_bytes()).hexdigest(),bodyHeightRatio=1)
 output.with_name('jump-metadata.json').write_text(json.dumps(jump,indent=2)+'\n')
 print(output)

if __name__=='__main__':
 reconstruct(Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'review/native-complete-gaits/reconstructed/model.glb')

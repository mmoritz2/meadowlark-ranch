"""Pack motion-only clips, retaining source key values and interpolation exactly."""
from pathlib import Path
import copy,json,sys,hashlib
import numpy as np
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools/asset-gen'));import rig_hero_horse as g

def package(sources,outpath):
 out={'asset':{'version':'2.0','generator':'Meadowlark preserved reference motion'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'animations':[],'accessors':[],'bufferViews':[],'buffers':[{'byteLength':0}]};binary=bytearray();nodes={};audit=[]
 for file,clipname in sources:
  d,b=g.read_glb(Path(file));clip=next(c for c in d['animations'] if c['name']==clipname);new=copy.deepcopy(clip);cache={}
  def accessor(ai):
   if ai in cache:return cache[ai]
   a=d['accessors'][ai];assert 'sparse' not in a
   values=g.accessor(d,b,ai);binary.extend(b'\0'*(-len(binary)%4));view=len(out['bufferViews']);out['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':values.nbytes});binary.extend(values.tobytes());index=len(out['accessors']);dest=copy.deepcopy(a);dest['bufferView']=view;dest.pop('byteOffset',None);out['accessors'].append(dest);cache[ai]=index;return index
  for c in new['channels']:
   name=d['nodes'][c['target']['node']]['name']
   if name not in nodes:nodes[name]=len(out['nodes']);out['nodes'].append({'name':name});out['scenes'][0]['nodes'].append(nodes[name])
   c['target']['node']=nodes[name]
  for s in new['samplers']:s['input']=accessor(s['input']);s['output']=accessor(s['output'])
  out['animations'].append(new);audit.append({'source':str(Path(file).relative_to(ROOT)),'sourceSha256':hashlib.sha256(Path(file).read_bytes()).hexdigest(),'clip':clipname,'channels':len(new['channels'])})
 out['buffers'][0]['byteLength']=len(binary);outpath=Path(outpath);outpath.parent.mkdir(parents=True,exist_ok=True);g.write_glb(outpath,out,binary)
 report={'sha256':hashlib.sha256(outpath.read_bytes()).hexdigest(),'bytes':outpath.stat().st_size,'clips':audit};outpath.with_suffix('.provenance.json').write_text(json.dumps(report,indent=2)+'\n');return report

if __name__=='__main__':
 pairs=json.loads(Path(sys.argv[1]).read_text());print(json.dumps(package([(ROOT/f,c)for f,c in pairs],sys.argv[2]),indent=2))

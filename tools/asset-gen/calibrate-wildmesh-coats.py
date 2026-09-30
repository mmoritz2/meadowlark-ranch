"""Measure source-specific linear dye references in the actual WildMesh UVs."""
from pathlib import Path
import hashlib,importlib.util,json,sys
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/models/horse-imports/wildmesh-white-western/game/breeds'
sys.dont_write_bytecode=True
s=importlib.util.spec_from_file_location('wildmesh_batch',Path(__file__).with_name('build-wildmesh-breed-batch.py'));batch=importlib.util.module_from_spec(s);s.loader.exec_module(batch);glb=batch.trusted('rig_hero_horse.py','wildmesh_coat_glb');doc,binary=glb.read_glb(OUT.parent/'white-western.glb');pr=doc['meshes'][0]['primitives'][0];p=glb.accessor(doc,binary,pr['attributes']['POSITION']);uv=glb.accessor(doc,binary,pr['attributes']['TEXCOORD_0']);index=glb.accessor(doc,binary,pr['indices']).reshape(-1);atlas,coverage=batch.uv_atlas(p,uv,index)
region=coverage&(atlas[:,:,1]>.8)&(atlas[:,:,1]<1.8)&(atlas[:,:,2]<.5)
manifest=json.loads((OUT/'manifest.json').read_text());provenance=json.loads((OUT/'texture-provenance.json').read_text());neutral_name=provenance['originalImages'][0]['file']
def luminance(path):
 # Same linear RGB .299/.587/.114 weights used by the current coat shader.
 rgb=np.asarray(Image.open(path).convert('RGB').resize((1024,1024),Image.Resampling.BILINEAR),dtype=np.float64)/255
 linear=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
 return float(np.median((linear@np.array([.299,.587,.114]))[region]))
neutral=luminance(OUT/'textures'/neutral_name);rows=[]
for id in manifest['expectedShapeIds']:
 path=OUT/id/'profile.json';profile=json.loads(path.read_text());coat_name='coat-'+id+'.png';lum=luminance(OUT/'textures'/coat_name);profile.update(neutralCoatFile='../textures/'+neutral_name,neutralCoatLuminance=neutral,coatLuminance=lum);path.write_text(json.dumps(profile,indent=2)+'\n');rows.append({'id':id,'coatFile':'textures/'+coat_name,'coatPNGsha256':hashlib.sha256((OUT/'textures'/coat_name).read_bytes()).hexdigest(),'coatLuminance':lum})
base=OUT.parent/'profile.json';profile=json.loads(base.read_text());profile.update(neutralCoatFile='breeds/textures/'+neutral_name,neutralCoatLuminance=neutral,coatLuminance=neutral);base.write_text(json.dumps(profile,indent=2)+'\n')
report={'method':'Median linear RGB luminance (.299,.587,.114 shader weights), analyzed at1024px on UV-covered source torso pixels: y.8..1.8m, z<.5m; excludes legs/head/UV gutters','neutralCoatFile':'textures/'+neutral_name,'neutralCoatLuminance':neutral,'neutralPNGsha256':provenance['originalImages'][0]['sha256'],'coats':rows};(OUT/'coat-calibration.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))

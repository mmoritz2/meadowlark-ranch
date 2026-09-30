"""Author an explicit numeric neutral detail atlas from source colour, no AI.

Native pastel source colour remains byte-identical in the base GLB. This added
grayscale atlas is used only for player coat customization and is protected by
the root delivery packer. It retains the original UV value detail.
"""
from pathlib import Path
import sys,json,hashlib
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,str(Path(__file__).resolve().parent))
from draft_glb_tools import GLB
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/models/horse-imports/pastel-unicorn/game'
model=GLB(OUT/'pastel-unicorn-rigged.glb');body=next(m for m in model.doc['meshes'] if m['name']=='HorseBody')['primitives'][0]
uv=model.accessor(body['attributes']['TEXCOORD_0']);tri=model.accessor(body['indices']).reshape(-1,3)
image=Image.open(OUT/'source-body-basecolor.png').convert('RGBA');pixels=np.asarray(image).astype(np.float32)/255
rgb=pixels[:,:,:3];linear=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4);luminance=linear@np.array((.2126,.7152,.0722),dtype=np.float32)
mask=Image.new('1',(1024,1024));draw=ImageDraw.Draw(mask)
for face in tri:
 # glTF V0 maps to the texture top for the stored UV/image pairing.
 draw.polygon([tuple(v*1023) for v in uv[face]],fill=1)
active=np.asarray(mask.resize(image.size,Image.Resampling.NEAREST),dtype=bool)
target=.55;low,high=.05,8
for _ in range(30):
 mid=(low+high)/2;mean=float(np.clip(luminance[active]*mid,.025,.97).mean())
 if mean<target:low=mid
 else:high=mid
factor=(low+high)/2;gray=np.clip(luminance*factor,.025,.97);srgb=np.where(gray<=.0031308,gray*12.92,1.055*gray**(1/2.4)-.055)
encoded=np.round(srgb*255).astype(np.uint8);neutral=np.dstack([encoded,encoded,encoded,np.asarray(image)[:,:,3]])
path=OUT/'neutral-coat-detail.png';Image.fromarray(neutral,'RGBA').save(path)
read=np.asarray(Image.open(path)).astype(np.float32)[:,:,:3]/255;read=np.where(read<=.04045,read/12.92,((read+.055)/1.055)**2.4);measured=float((read@np.array((.2126,.7152,.0722),dtype=np.float32))[active].mean())
profile_path=OUT/'profile.json';profile=json.loads(profile_path.read_text());profile.update(neutralCoatFile=path.name,neutralCoatLuminance=measured,neutralCoatSourcePigmentRetained=False,neutralCoatAdaptation='New numeric grayscale value-detail atlas from original source diffuse in exact original UVs; original pastel base atlas remains unchanged in GLB.')
profile_path.write_text(json.dumps(profile,indent=2)+'\n')
report={'nativeBaseAtlasSha256':hashlib.sha256((OUT/'source-body-basecolor.png').read_bytes()).hexdigest(),'neutralAtlasSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'UVTexelsCovered':int(active.sum()),'nativeActiveLinearLuminance':float(luminance[active].mean()),'neutralActiveLinearLuminance':measured,'target':target,'numericValueMultiplier':factor,'sourceAtlasAndGLBUnmodified':True,'aiOrGenerativeToolsUsed':False,'rawAtlasMustRemainUnpublished':True}
(OUT/'coat-calibration-validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))

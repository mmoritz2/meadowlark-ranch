from pathlib import Path
import json,hashlib,sys
import numpy as np
from PIL import Image
raw=Path(sys.argv[1]);out=Path(sys.argv[2]);assert not out.exists();plan=Path(sys.argv[3]);j=json.loads(plan.read_text());out.mkdir(parents=True);sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();rows=[]
for channel in ['albedo','normal']:
 file=raw/(channel+'.png');original=np.asarray(Image.open(file).convert('RGBA')).copy();a=original.copy();assert list(a.shape[:2])==[896,1024];filled=0
 for tile in range(j['atlas']['tileCount']):
  x=(tile%8)*128;y=(tile//8)*128;region=a[y:y+128,x:x+128];rgb=region[:,:,:3].copy();valid=region[:,:,3]>0
  for iteration in range(4):
   sums=np.zeros((128,128,3),dtype=np.int32);counts=np.zeros((128,128),dtype=np.int32);pm=np.pad(valid,1);pc=np.pad(rgb.astype(np.int32),((1,1),(1,1),(0,0)))
   for dy,dx in [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]:
    mask=pm[1+dy:129+dy,1+dx:129+dx];sums+=pc[1+dy:129+dy,1+dx:129+dx]*mask[:,:,None];counts+=mask
   target=(~valid)&(counts>0);rgb[target]=np.rint(sums[target]/counts[target,None]).astype(np.uint8);filled+=int(target.sum());valid|=target
  region[:,:,:3]=rgb
 assert np.array_equal(a[:,:,3],original[:,:,3]);assert np.array_equal(a[original[:,:,3]>0],original[original[:,:,3]>0]);dest=out/(channel+'.png');Image.fromarray(a,'RGBA').save(dest,compress_level=9);check=np.asarray(Image.open(dest));assert np.array_equal(a,check)
 rows.append({'channel':channel,'rawSHA256':sha(file),'dilatedSHA256':sha(dest),'changedZeroAlphaRGBPixels':int(np.any(a[:,:,:3]!=original[:,:,:3],axis=2).sum()),'newRGBSupportSamples':filled,'alphaByteExact':True,'allPreviouslyNonzeroAlphaRGBAExact':True,'size':dest.stat().st_size})
r={'planSHA256':sha(plan),'scriptSHA256':sha(Path(__file__)),'operation':'Four iterations of RGB-only nearest-neighbour averaging into previously zero-alpha pixels, independently within each128px tile. All original alpha and all accepted colored samples byte-exact. PNG retains hidden RGB; no pixel alpha growth.','rows':rows};(out/'dilation-receipt.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(rows))

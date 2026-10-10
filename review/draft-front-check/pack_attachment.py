"""Pack a private collar experiment for the local review UI, never product assets."""
import argparse,hashlib,json
from pathlib import Path
import numpy as np
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
p=argparse.ArgumentParser();p.add_argument('candidate',type=Path);p.add_argument('--breed',default='shire');args=p.parse_args()
a=np.load(args.candidate);ids=a['ids'].astype('<u2');count=len(ids)
installed=(ROOT/'assets/models/native-roster'/(args.breed+'.bin')).read_bytes()
base=installed[:728256]
assert len(base)==728256,'Only the released pre-attachment baseline is accepted'
packed=bytearray(base)
record={'version':1,'meshIndex':3,'sourceSha256':'b188f5ea0c985c673c678daebf5e36daa1147a18693cec15ecc1bca439740a07','vertexCount':count}
for name,field,dtype,size in [('vertexIds','ids','<u2',1),('position','position','<f4',3),('normal','normal','<f4',3),('skinIndex','skinIndex','<u2',4),('skinWeight','skinWeight','<f4',4)]:
 while len(packed)%4:packed.append(0)
 data=a[field].astype(dtype).reshape(-1);assert len(data)==count*size
 record[name]={'byteOffset':len(packed),'count':len(data),'itemSize':size,'componentType':'uint16' if dtype=='<u2' else 'float32'};packed.extend(data.tobytes())
out=HERE/'attachment-preview';out.mkdir(exist_ok=True)
(out/(args.breed+'.bin')).write_bytes(packed)
(out/(args.breed+'.json')).write_text(json.dumps({'record':record,'baselineSha256':hashlib.sha256(installed).hexdigest(),'baseMorphSha256':hashlib.sha256(base).hexdigest(),'previewSha256':hashlib.sha256(packed).hexdigest(),'candidate':args.candidate.name},indent=2)+'\n')
print(args.breed,len(packed),hashlib.sha256(packed).hexdigest())

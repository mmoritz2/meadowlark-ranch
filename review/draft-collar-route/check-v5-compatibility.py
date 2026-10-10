"""Verify the inherited v5 thigh update preserves the reviewed front and tack inputs."""
from pathlib import Path
import hashlib,json,subprocess,sys,numpy as np
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools/asset-gen'));import rig_hero_horse as glb
sha=lambda b:hashlib.sha256(b).hexdigest()
def get(path,ref='d247858'):return subprocess.check_output(['git','show',ref+':'+path],cwd=ROOT)
import argparse
parser=argparse.ArgumentParser();parser.add_argument('--report',type=Path);args=parser.parse_args()
manifest=json.loads(get('assets/models/native-roster/manifest.json'));old=json.loads(get('assets/models/native-roster/manifest.json','260e776'))
doc,raw=glb.read_glb(ROOT/'review/native-trot-reference-kit/white/model.glb');skin=doc['skins'][0];inv=glb.accessor(doc,raw,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1);worlds,_=glb.node_worlds(doc);ops=np.array([worlds[i] for i in skin['joints']])@inv
p=doc['meshes'][0]['primitives'][0]['attributes'];pos=glb.accessor(doc,raw,p['POSITION']);j=glb.accessor(doc,raw,p['JOINTS_0']);w=glb.accessor(doc,raw,p['WEIGHTS_0']);mat=np.einsum('nw,nwij->nij',w,ops[j]);source=np.einsum('nij,nj->ni',mat,np.c_[pos,np.ones(len(pos))])[:,:3]+np.array([-6.225790382362317e-9,.0047147771075021355,-1.6744842715166992]);front=source[:,2]>=-.15
rows=[]
for b in ['shire','percheron','clyde']:
 before=get('assets/models/native-roster/'+b+'.bin','260e776');after=get('assets/models/native-roster/'+b+'.bin')
 same=[]
 for mi in range(5):
  for kind in ['positionDelta','normalDelta']:
   x=old['breeds'][b]['meshes'][mi][kind];y=manifest['breeds'][b]['meshes'][mi][kind]
   da=np.frombuffer(before,dtype='<i2',count=x['count'],offset=x['byteOffset']).reshape(-1,3)*x['scale'];db=np.frombuffer(after,dtype='<i2',count=y['count'],offset=y['byteOffset']).reshape(-1,3)*y['scale']
   if mi==0:same.append((kind+'FrontBitExact',bool(np.array_equal(da[front],db[front]))))
   else:same.append((str(mi)+kind+'BitExact',bool(np.array_equal(da,db))))
 row={'breed':b,'frontVertices':int(front.sum()),'newFullSha256':sha(after),'newPrefixSha256':sha(after[:728256]),'nonBodySuffixBitExact':before[193908:]==after[193908:],'attachmentAppendBitExact':before[728256:]==after[728256:],'checks':dict(same)}
 assert row['nonBodySuffixBitExact'] and row['attachmentAppendBitExact'] and all(row['checks'].values());rows.append(row);print(json.dumps(row),flush=True)
if args.report:args.report.write_text(json.dumps(rows,indent=2)+'\n')

"""Author the reviewed static lower breastcollar route on the prior70% attachment.

Run from a repository checkout (only NumPy and the repository GLB reader needed):
  python3 tools/native-roster/author-lower-route.py --out /tmp/lower-route

The three pinned 514-vertex NPZs are the previously reviewed attachment basis.
Current morph buffers are read only through their pinned728256-byte prefix.
Their standing cage is inverse-solved onto the preserved shoulder influences;
the old attachment positions never overwrite newly authored proportions.
All four joint influences remain exact. Desired standing positions and normals
are saved before inversion/float32 quantization for independent validation.
No production file is changed. The outputNPZs are inputs to collar_attachment.py.
"""
from pathlib import Path
import argparse,hashlib,json,sys
import numpy as np

SOURCE_SHA='b188f5ea0c985c673c678daebf5e36daa1147a18693cec15ecc1bca439740a07'
MOTION_SHA='87da96bce7e484d5298b83734ec44560b15ecb38e1fcc4171a907393e5fcd157'
TRANSLATION=np.array([-6.225790382362317e-9,.0047147771075021355,-1.6744842715166992])
BASE_BYTES=728256
# Reviewed v6 shared draft cage. Rebase the original70% shoulder weights onto
# the new standing cage before applying the unchanged lower-V route.
PREFIX_SHA={'percheron': 'b95f23d106510c6c991f245dc44eb90320bb3162837608b7ab6901f26613870b', 'shire': 'abb3c85f5d632de8f0d24a78832e224217eb7c5817783447a850e832f5fdd03c', 'clyde': 'bf649c008952f8a2ff49fb56dff0cf1b949dd4bdcaecde008b47d2855449f076'}
PRIOR_SHA={'percheron':'f6a89548f5e6bc3974514fdb290800fc770e0048bf23eeda4537a883efd003ae','shire':'eab7751b1dfff6a61a7c134be33a6ed7b117541b4937347c4602b63b66952acf','clyde':'291d3a17599e9e8c0e6e899f2638cdd2e09e553a8efbe18ee5ab7cd1a8bd45bf'}
MESH_DESCRIPTOR_SHA={'percheron': 'c9e5002103f868ea8d48168fd1683b591bdc34d67a52bbed12aac7b77cbfe197', 'shire': '1065b7b0cc3685f5b2ae3645f62d0aa78eb6c5414b2f568bca21296bfc38b1f4', 'clyde': '961fd759760be4dd6ec11db0d2dc7cff465bf7a2d98110928850a41c82b6afa9'}
RANGES=((0,43),(76,196),(426,531),(754,976),(3348,3428),(3601,3823),(4053,4158),(5369,5393),(5517,5690),(5826,5999),(7416,7646),(8356,8586),(9508,9738),(9782,9802),(9810,9855),(9892,10064),(11392,11412),(11522,11542),(12073,12224))
ROUTE={'version':1,'space':'source-standing-metres-before-actor-scale','liftM':.060,'forwardM':.012,'heightFade':[1.10,1.27],'frontRise':[.30,.69]}

def sha(data):return hashlib.sha256(data).hexdigest()
def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
def derivative(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return np.where((x>a)&(x<b),6*t*(1-t)/(b-a),0)
def unit(v):return v/np.maximum(np.linalg.norm(v,axis=1)[:,None],1e-20)
def transform(mat,p):return np.einsum('nij,nj->ni',mat,np.c_[p,np.ones(len(p))])[:,:3]+TRANSLATION

def author(root,basis,out,breed,glb,morph_dir=None):
 morph_dir=morph_dir or root/'assets/models/native-roster'
 source=root/'review/native-trot-reference-kit/white/model.glb';assert sha(source.read_bytes())==SOURCE_SHA
 motion=root/'assets/models/horse-motions/white-western.glb';assert sha(motion.read_bytes())==MOTION_SHA
 doc,binary=glb.read_glb(source);skin=doc['skins'][0];assert len(skin['joints'])==677
 worlds,_=glb.node_worlds(doc);inverse=glb.accessor(doc,binary,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
 ops=np.array([worlds[i] for i in skin['joints']])@inverse
 prim=doc['meshes'][3]['primitives'][0];attrs=prim['attributes']
 rawp=glb.accessor(doc,binary,attrs['POSITION']);rawn=glb.accessor(doc,binary,attrs['NORMAL']).astype(float)
 joints=glb.accessor(doc,binary,attrs['JOINTS_0']).copy();weights=glb.accessor(doc,binary,attrs['WEIGHTS_0']).astype('<f4').copy()
 manifest=json.loads((morph_dir/'manifest.json').read_text());row=manifest['breeds'][breed]
 assert sha(json.dumps(row['meshes'][3],sort_keys=True,separators=(',',':')).encode())==MESH_DESCRIPTOR_SHA[breed]
 data=(morph_dir/(breed+'.bin')).read_bytes();assert sha(data[:BASE_BYTES])==PREFIX_SHA[breed]
 def delta(key):
  d=row['meshes'][3][key];return np.frombuffer(data,dtype='<i2',count=d['count'],offset=d['byteOffset']).reshape(-1,3)*d['scale']
 position=(rawp+delta('positionDelta')).astype('<f4').astype(float)
 normal=unit((rawn+delta('normalDelta')).astype('<f4').astype(float))
 priorfile=basis/(breed+'.npz');assert sha(priorfile.read_bytes())==PRIOR_SHA[breed]
 prior=np.load(priorfile);priorids=prior['ids'].astype(int);assert len(priorids)==514
 # Preserve the fitted shoulder skin influences, not their obsolete positions.
 # The new shared cage supplies independent desired standing surface targets.
 source_mat=np.einsum('nw,nwij->nij',weights,ops[joints])
 desired=transform(source_mat,position)
 desired_normal=np.einsum('nij,nj->ni',source_mat[:,:3,:3],normal)
 joints[priorids]=prior['skinIndex'];weights[priorids]=prior['skinWeight']
 fitted_mat=np.einsum('nw,nwij->nij',weights[priorids],ops[joints[priorids]])
 position[priorids]=np.linalg.solve(fitted_mat[:,:3,:3],(desired[priorids]-TRANSLATION-fitted_mat[:,:3,3])[...,None])[...,0]
 normal[priorids]=unit(np.linalg.solve(fitted_mat[:,:3,:3],desired_normal[priorids][...,None])[...,0])
 assert np.linalg.norm(transform(fitted_mat,position[priorids])-desired[priorids],axis=1).max()<2e-5

 allowed=np.zeros(len(position),bool)
 for lo,hi in RANGES:allowed[lo:hi+1]=True
 ids=np.where(allowed)[0];assert len(ids)==2404
 oldsupport=np.zeros(len(ids));oldsupport[np.searchsorted(ids,priorids)]=prior['support']
 mat=np.einsum('nw,nwij->nij',weights,ops[joints]);standing=transform(mat,position)
 y,z=standing[ids,1],standing[ids,2];lo,hi=ROUTE['heightFade'];za,zb=ROUTE['frontRise'];fy=1-smooth(lo,hi,y);fz=smooth(za,zb,z);field=fy*fz
 lift,forward=ROUTE['liftM'],ROUTE['forwardM'];target=standing[ids]+field[:,None]*np.array([0,lift,forward])
 jac=np.broadcast_to(np.eye(3),(len(ids),3,3)).copy();dy=-derivative(lo,hi,y)*fz;dz=fy*derivative(za,zb,z)
 jac[:,1,1]+=lift*dy;jac[:,1,2]+=lift*dz;jac[:,2,1]+=forward*dy;jac[:,2,2]+=forward*dz
 assert np.linalg.det(jac).min()>.3
 standingnormal=np.einsum('nij,nj->ni',mat[ids,:3,:3],normal[ids]);normal_target=np.linalg.solve(jac.transpose(0,2,1),standingnormal[...,None])[...,0]
 rawtarget=np.linalg.solve(mat[ids,:3,:3],(target-TRANSLATION-mat[ids,:3,3])[...,None])[...,0]
 rawnormal=unit(np.linalg.solve(mat[ids,:3,:3],normal_target[...,None])[...,0])
 chosen=field>0;position[ids[chosen]]=rawtarget[chosen];normal[ids[chosen]]=rawnormal[chosen]
 support=np.maximum(oldsupport,field);keep=support>0;exportids=ids[keep]
 arrays={'ids':exportids.astype('<u2'),'position':position[exportids].astype('<f4'),'normal':normal[exportids].astype('<f4'),'skinIndex':joints[exportids].astype('<u2'),'skinWeight':weights[exportids].astype('<f4'),'support':support[keep],
 'standingTarget':target[keep],'standingNormal':unit(normal_target)[keep],'routeMask':chosen[keep].astype('u1'),'priorSkinIndex':joints[exportids].astype('<u2'),'priorSkinWeight':weights[exportids].astype('<f4')}
 out.mkdir(parents=True,exist_ok=True);file=out/(breed+'.npz');np.savez_compressed(file,**arrays)
 # Independent provenance for the reviewed route; installed metadata is index-only.
 details={'breed':breed,'sourceSha256':SOURCE_SHA,'motionSha256':MOTION_SHA,'meshDescriptorSha256':MESH_DESCRIPTOR_SHA[breed],'priorAttachmentSha256':PRIOR_SHA[breed],'baselineSha256':sha(data),'baseMorphSha256':PREFIX_SHA[breed],'npzSha256':sha(file.read_bytes()),'standingRoute':ROUTE,'allowedVertices':2404,'vertexCount':len(exportids),'routeVertices':int(chosen.sum()),'newVertices':int(((oldsupport==0)&chosen).sum()),'minimumRouteJacobianDeterminant':float(np.linalg.det(jac).min()),'maximumUnscaledStandingDisplacementM':float(np.linalg.norm(target-standing[ids],axis=1).max()),'unchangedRegionVertices':ids[~chosen].tolist(),'routeVerticesIds':ids[chosen].tolist()}
 (out/(breed+'-authoring.json')).write_text(json.dumps(details,indent=2)+'\n');print(json.dumps({k:v for k,v in details.items() if not k.endswith('Ids') and k!='unchangedRegionVertices'}),flush=True)

if __name__=='__main__':
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2]);ap.add_argument('--basis-dir',type=Path);ap.add_argument('--morph-dir',type=Path);ap.add_argument('--out',type=Path,required=True);ap.add_argument('--only',default='shire,percheron,clyde');args=ap.parse_args()
 args.basis_dir=args.basis_dir or args.root/'tools/native-roster/collar-attachments/prior-70percent'
 sys.path.insert(0,str(args.root/'tools/asset-gen'));import rig_hero_horse as glb
 for breed in args.only.split(','):
  assert breed in PREFIX_SHA;author(args.root,args.basis_dir,args.out,breed,glb,args.morph_dir)

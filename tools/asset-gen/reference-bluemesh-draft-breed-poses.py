"""Independent direct glTF skin reference for actual rendered breed clip poses."""
from pathlib import Path
import sys,json,hashlib
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parent))
from draft_glb_tools import GLB,quaternion_matrix
ROOT=Path(__file__).resolve().parents[2];O=ROOT/'assets/models/horse-imports/bluemesh-draft/game/breeds';TMP=Path('/private/tmp/horse-import-tools/draft-breed-pose-reference');TMP.mkdir(parents=True,exist_ok=True)
source_rig=GLB(O.parent.parent/'work/canonical-rig/draft-canonical-rig.glb');source_pos=source_rig.accessor(source_rig.doc['meshes'][0]['primitives'][0]['attributes']['POSITION']);_,seam_id,seam_count=np.unique(np.round(source_pos,5),axis=0,return_inverse=True,return_counts=True)
seam_groups=[np.where(seam_id==i)[0].tolist() for i in np.where(seam_count>1)[0]]
for key in sys.argv[1:] or ['vanner','percheron','shire','clyde','suffolk']:
 folder=O/key;profile=json.loads((folder/'profile.json').read_text());g=GLB(folder/profile['file']);poses=json.loads((folder/'review-poses.json').read_text());hashvalue=hashlib.sha256((folder/profile['file']).read_bytes()).hexdigest();assert hashvalue==profile['sha256']==poses['animatedSha256']
 joints=g.doc['skins'][0]['joints'];ibm=g.accessor(g.doc['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1);rows=[]
 for pose in poses['poses']:
  world={}
  for i,p,q in zip(joints,pose['positions'],pose['quaternions']):
   local=np.eye(4);local[:3,:3]=quaternion_matrix(q);local[:3,3]=p;parent=g.parents.get(i);world[i]=world[parent]@local if parent in world else local
  skin=np.array([world[i]@ibm[j] for j,i in enumerate(joints)]);coords=[];meshes=[];offset=0
  for mi,mesh in enumerate(g.doc['meshes']):
   a=mesh['primitives'][0]['attributes'];p=g.accessor(a['POSITION']).astype(float);ji=g.accessor(a['JOINTS_0']).astype(int);we=g.accessor(a['WEIGHTS_0']).astype(float);hp=np.c_[p,np.ones(len(p))];result=np.zeros_like(p)
   for k in range(4):result+=np.einsum('nij,nj->ni',skin[ji[:,k]],hp)[:,:3]*we[:,k,None]
   assert np.isfinite(result).all();coords.append(result);meshes.append({'index':mi,'name':mesh['name'],'offsetVertices':offset,'vertices':len(p)});offset+=len(p)
  target=TMP/(key+'-'+hashvalue[:12]+'-'+pose['name']+'.f64');np.vstack(coords).astype('<f8').tofile(target);rows.append({'clip':pose['name'],'time':pose['time'],'referenceFile':str(target),'meshes':meshes,'vertices':offset})
 report={'animatedSha256':hashvalue,'method':'Independent Python float64 raw glTF nodeWorld*inverseBind and normalized4 source influences at exact selected baked local poses; same numeric geometry used by our actual Blender preview reconstruction.','bodyUVSeamGroups':seam_groups,'poses':rows};(folder/'direct-skin-reference.json').write_text(json.dumps(report,indent=2));print(json.dumps({'breed':key,'poses':len(rows),'verticesPerPose':rows[0]['vertices'],'seamGroups':len(seam_groups)}))

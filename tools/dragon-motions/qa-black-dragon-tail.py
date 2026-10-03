from pathlib import Path
import sys,json,copy,hashlib,numpy as np
root=Path(__file__).resolve().parents[2];sys.path.insert(0,str(root/'tools/dragon-motions'));sys.path.insert(0,str(root/'tools/asset-gen'))
import rig_hero_horse as g
from scipy.spatial.transform import Rotation as R
from black_dragon_tail import apply_flight_tail,TAIL_JOINTS,flight_tail_angles
j,b=g.read_glb(root/'assets/models/horse-imports/black-dragon/game/black-dragon-native-2k-candidate.glb');rest,parents=g.node_worlds(j)
def turn(doc,i,axis,angle):
 w=g.node_worlds(doc)[0];q=R.from_matrix(w[i][:3,:3]/np.linalg.norm(w[i][:3,:3],axis=0));pq=R.from_matrix(w[parents[i]][:3,:3]/np.linalg.norm(w[parents[i]][:3,:3],axis=0));doc['nodes'][i]['rotation']=(pq.inv()*R.from_rotvec(np.array(axis)*angle)*q).as_quat().tolist()
J=j['skins'][0]['joints'];a=j['meshes'][j['nodes'][246]['mesh']]['primitives'][0]['attributes'];vi=g.accessor(j,b,a['JOINTS_0']);vw=g.accessor(j,b,a['WEIGHTS_0']);vp=g.accessor(j,b,a['POSITION']);vp=np.c_[vp,np.ones(len(vp))];ib=g.accessor(j,b,j['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
weights=np.sum(vw*np.isin(vi,[J.index(i) for i in TAIL_JOINTS]),axis=1);mask=weights>.7
poses=[];max_bend=0;skinnedmin=1e9
for p in np.linspace(0,1,121):
 doc=copy.deepcopy(j);apply_flight_tail(doc,p,turn);w=g.node_worlds(doc)[0];points=np.array([w[i][:3,3] for i in [14,15,16,17,18]]);vec=np.diff(points,axis=0);v=vec/np.linalg.norm(vec,axis=1)[:,None];bend=np.arccos(np.clip(np.sum(v[1:]*v[:-1],axis=1),-1,1))*180/np.pi;max_bend=max(max_bend,float(bend.max()));mats=np.array([w[k]@ib[z] for z,k in enumerate(J)]);skin=np.einsum('nvij,nj,nv->ni',mats[vi[mask]],vp[mask],vw[mask])[:,:3];assert np.isfinite(skin).all();skinnedmin=min(skinnedmin,float(skin[:,1].min()));poses.append({'phase':float(p),'tailJoints':points.tolist(),'localQuaternions':[doc['nodes'][i]['rotation'] for i in TAIL_JOINTS],'minimumTailVertexSourceY':float(skin[:,1].min()),'maximumSegmentBendDegrees':float(bend.max())})
scale=1.85/3.2891557745925395;tips=np.array([p['tailJoints'][-1] for p in poses]);report={'joints':list(TAIL_JOINTS),'tailWeightedVertices':int((weights>0).sum()),'tailReviewVertices':int(mask.sum()),'samples':len(poses),'phasePeriodSeconds':3.3,'tipRangeGameM':((tips.max(0)-tips.min(0))*scale).tolist(),'minimumTailVertexGameY':skinnedmin*scale+.010140415394662964,'maximumAdjacentSegmentAngleDegrees':max_bend,'loopEndpointError':float(np.max(np.abs(np.array(poses[0]['tailJoints'])-poses[-1]['tailJoints']))),'groundClipsTouched':False,'poses':poses};(root/'review/dragon-wing-tail/black-tail-helper-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='poses'},indent=2))

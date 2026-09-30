"""Compare every native-rig vertex against actual Three baked-clip playback."""
from pathlib import Path
import json, hashlib
import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/models/horse-imports/bluemesh-draft/work/canonical-rig'
poses=json.loads((OUT/'review-poses.json').read_text());three=json.loads((OUT/'actual-animation-playback.json').read_text())
assert poses['animatedSha256']==three['animatedSha256']
bpy.ops.wm.open_mainfile(filepath=str(OUT/'draft-canonical-rig.blend'),use_scripts=False,load_ui=False)
rig=bpy.data.objects['HorseRig'];C=Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)))
rest={b.name:b.matrix_local.copy() for b in rig.data.bones};parents={b.name:b.parent.name if b.parent else None for b in rig.data.bones};rows=[]
for pose,expected in zip(poses['poses'],three['poses']):
 assert pose['name']==expected['clip'];world={}
 for name,p,q in zip(poses['names'],pose['positions'],pose['quaternions']):
  local=Matrix.Translation(Vector(p))@Quaternion((q[3],q[0],q[1],q[2])).to_matrix().to_4x4();parent=parents[name];world[name]=world[parent]@local if parent else local
 native={n:C.inverted()@world[n]@C for n in poses['names']}
 for name in poses['names']:
  parent=parents[name];rl=rest[parent].inverted()@rest[name] if parent else rest[name];pl=native[parent].inverted()@native[name] if parent else native[name];rig.pose.bones[name].matrix_basis=rl.inverted()@pl
 bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();source=np.fromfile(expected['threeVerticesFile'],dtype='<f8').reshape(-1,3);offset=0;meshes=[]
 for mesh in expected['meshes']:
  o=bpy.data.objects[mesh['name']];e=o.evaluated_get(deps);m=e.to_mesh();p=np.array([e.matrix_world@v.co for v in m.vertices]);e.to_mesh_clear();actual=np.c_[p[:,0],p[:,2],-p[:,1]];reference=source[offset:offset+len(actual)];offset+=len(actual)
  assert len(actual)==mesh['vertices'];error=float(np.max(np.linalg.norm(actual-reference,axis=1)));meshes.append({'mesh':o.name,'vertices':len(actual),'maxNativeVsActualThreeAnimatedVertexErrorM':error});assert error<2e-5,(pose['name'],o.name,error)
 assert offset==len(source);rows.append({'pose':pose['name'],'time':pose['time'],'meshes':meshes,'maxVertexErrorM':max(r['maxNativeVsActualThreeAnimatedVertexErrorM'] for r in meshes)})
report={'animatedSha256':poses['animatedSha256'],'method':'every source vertex in native Blender fitted rig versus actual AnimationMixer baked clip at selected exact samples; native mesh linear skin matches manual canonical glTF skin',
 'passed':True,'poseCount':len(rows),'verticesPerPose':361486,'maxVertexErrorM':max(row['maxVertexErrorM'] for row in rows),'poses':rows}
(OUT/'native-vs-three-skin-validation.json').write_text(json.dumps(report,indent=2));print(json.dumps({'passed':True,'poses':len(rows),'maxErrorM':report['maxVertexErrorM']}))

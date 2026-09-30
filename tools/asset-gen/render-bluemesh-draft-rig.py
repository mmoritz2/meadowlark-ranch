"""Render actual baked anatomical draft poses using the owned native rig.

The verified Blender runs factory/disable-autoexec; this script adds view-only
studio lighting/camera/floor. No source original, shared manifest or game edit.
"""
from pathlib import Path
import bpy, json, math, hashlib, sys
import numpy as np
from mathutils import Matrix, Quaternion, Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/models/horse-imports/bluemesh-draft/work/canonical-rig'
data=json.loads((OUT/'review-poses.json').read_text());profile=json.loads((OUT/'draft-profile.json').read_text())
bake=json.loads((OUT/'animation-bake-report.json').read_text())
assert hashlib.sha256((OUT/profile['file']).read_bytes()).hexdigest()==data['animatedSha256']
bpy.ops.wm.open_mainfile(filepath=str(OUT/'draft-canonical-rig.blend'),use_scripts=False,load_ui=False)
rig=bpy.data.objects['HorseRig'];objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
C=Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)))
native_rest={b.name:b.matrix_local.copy() for b in rig.data.bones};parents={b.name:b.parent.name if b.parent else None for b in rig.data.bones}
names=data['names'];pose_bounds=[]
def apply_pose(pose):
 world={}
 for name,p,q in zip(names,pose['positions'],pose['quaternions']):
  local=Matrix.Translation(Vector(p))@Quaternion((q[3],q[0],q[1],q[2])).to_matrix().to_4x4();parent=parents[name]
  world[name]=(world[parent]@local if parent else local)
 native={name:C.inverted()@world[name]@C for name in names}
 for name in names:
  parent=parents[name];rest_local=native_rest[parent].inverted()@native_rest[name] if parent else native_rest[name]
  posed_local=native[parent].inverted()@native[name] if parent else native[name]
  rig.pose.bones[name].matrix_basis=rest_local.inverted()@posed_local
 bpy.context.view_layer.update()
def bounds():
 dep=bpy.context.evaluated_depsgraph_get();points=[]
 for o in objects:
  e=o.evaluated_get(dep);m=e.to_mesh();points.extend([e.matrix_world@v.co for v in m.vertices]);e.to_mesh_clear()
 points=np.array(points);assert np.isfinite(points).all()
 return points.min(0),points.max(0)
for pose in data['poses']:
 apply_pose(pose);lo,hi=bounds();pose_bounds.append({'pose':pose['name'],'time':pose['time'],'min':lo.tolist(),'max':hi.tolist()})
lo=np.min([p['min'] for p in pose_bounds],axis=0);hi=np.max([p['max'] for p in pose_bounds],axis=0);center=Vector((lo+hi)/2);size=max(hi-lo)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=40;scene.cycles.use_denoising=True
scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
world=bpy.data.worlds.new('View-only neutral studio');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.11,.13,.15,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5
camera_data=bpy.data.cameras.new('View-only three-quarter camera');camera=bpy.data.objects.new('View-only camera',camera_data);scene.collection.objects.link(camera);scene.camera=camera
direction=Vector((-5,-7,3.8)).normalized();camera.location=center+direction*size*3;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO'
bpy.context.view_layer.update();inv=camera.matrix_world.inverted();view=[]
for x in [lo[0],hi[0]]:
 for y in [lo[1],hi[1]]:
  for z in [lo[2],hi[2]]:view.append(inv@Vector((x,y,z)))
aspect=scene.render.resolution_x/scene.render.resolution_y
camera_data.ortho_scale=max(max(p.x for p in view)-min(p.x for p in view),(max(p.y for p in view)-min(p.y for p in view))*aspect)*1.13
for name,position,energy in [('Key',(-3,-4,6),40),('Fill',(4,-1,4),22),('Rim',(0,4,5),35)]:
 light_data=bpy.data.lights.new('View-only '+name,'AREA');light_data.energy=energy*size*size;light_data.shape='DISK';light_data.size=size*1.9
 light=bpy.data.objects.new('View-only '+name,light_data);scene.collection.objects.link(light);light.location=center+Vector(position)*size/3;light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
plane_mesh=bpy.data.meshes.new('View-only floor');s=size*5;plane_mesh.from_pydata([(-s,-s,-.012),(s,-s,-.012),(s,s,-.012),(-s,s,-.012)],[],[(0,1,2,3)]);floor=bpy.data.objects.new('View-only floor',plane_mesh);scene.collection.objects.link(floor)
floor_mat=bpy.data.materials.new('View-only matte floor');floor_mat.diffuse_color=(.20,.22,.24,1);floor_mat.use_nodes=True;floor_mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.20,.22,.24,1);floor_mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.92;floor.data.materials.append(floor_mat)
images=[]
requested=set(sys.argv[sys.argv.index('--')+1].split(',')) if '--' in sys.argv else set(p['name'] for p in data['poses'])
for pose in data['poses']:
 if pose['name'] not in requested:continue
 apply_pose(pose);png=OUT/(pose['name'].lower()+'-rig-preview.png');scene.render.filepath=str(png);bpy.ops.render.render(write_still=True)
 images.append({'pose':pose['name'],'time':pose['time'],'png':str(png.relative_to(ROOT)),'sha256':hashlib.sha256(png.read_bytes()).hexdigest(),'bytes':png.stat().st_size})
report={'animatedGlbSha256':data['animatedSha256'],'poseSource':f"actual appended{bake['fps']}Hz local canonical joint tracks from live solver; cyclic minor secondary-motion correction; actual source geometry render",'bakeRateHz':bake['fps'],
 'nativeRig':str((OUT/'draft-canonical-rig.blend').relative_to(ROOT)),'studioOnlyCameraLightingAndFloor':True,'sourceOriginalUnmodified':True,'sourceTexturesOriginalUVsAndTriangleCountRetained':True,'posedMeshes':len(objects),'poses':pose_bounds,'renders':images,
 'sourceSphereRepair':'original two sphere components fitted to head sockets and bound head-only, documented in conversion-report.json','visualReview':'pending PNG inspection','runtimeBrowserReview':'pending'}
(OUT/'rig-render-report.json').write_text(json.dumps(report,indent=2));print(json.dumps({'renders':images,'report':str(OUT/'rig-render-report.json')}))

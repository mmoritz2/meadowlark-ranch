"""Inspect existing horse in an isolated Blender process; no game/source mutation."""
import bpy, json, math, pathlib
from mathutils import Vector
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'output' / 'horse-review'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/horse_textured_rigged.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
summary={'objects':[], 'bones':[]}
for o in meshes:
    summary['objects'].append({'name':o.name,'vertices':len(o.data.vertices),'polygons':len(o.data.polygons),'dimensions':list(o.dimensions),'matrix':list(map(list,o.matrix_world)), 'materials':[m.name for m in o.data.materials]})
for b in arm.data.bones:
    summary['bones'].append({'name':b.name,'head':list(arm.matrix_world@b.head_local),'tail':list(arm.matrix_world@b.tail_local)})
(OUT/'original-inspection.json').write_text(json.dumps(summary,indent=2))
pts=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
lo=Vector(tuple(min(v[i] for v in pts) for i in range(3)))
hi=Vector(tuple(max(v[i] for v in pts) for i in range(3)))
center=(lo+hi)/2
print('BOUNDS',list(lo),list(hi))
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,lo.z-.002))
plane=bpy.context.object
mat=bpy.data.materials.new('Review Ground'); mat.diffuse_color=(.19,.23,.2,1); plane.data.materials.append(mat)
def aim(o,p): o.rotation_euler=(p-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=center+Vector((2.7,-4.2,1.3)))
cam=bpy.context.object; aim(cam,center); cam.data.type='ORTHO'; cam.data.ortho_scale=2.55
s=bpy.context.scene; s.camera=cam; s.render.engine='CYCLES'; s.cycles.samples=24
for name,loc,power,size in [('Key',(1,-3,4),500,4),('Fill',(-2,1,2),180,3),('Rim',(-1,3,3),400,2)]:
    bpy.ops.object.light_add(type='AREA',location=center+Vector(loc)); o=bpy.context.object; o.name=name; o.data.energy=power;o.data.shape='DISK';o.data.size=size;aim(o,center)
s.world=bpy.data.worlds.new('Review World'); s.world.use_nodes=True; s.world.node_tree.nodes['Background'].inputs[0].default_value=(.35,.42,.50,1); s.world.node_tree.nodes['Background'].inputs[1].default_value=.5
s.render.resolution_x=1280;s.render.resolution_y=960;s.render.resolution_percentage=100
s.view_settings.view_transform='AgX';s.render.image_settings.file_format='PNG';s.render.filepath=str(OUT/'horse-original.png')
bpy.ops.render.render(write_still=True)
cam.location=center+Vector((0,-4,0.4));aim(cam,center);s.render.filepath=str(OUT/'horse-original-side.png');bpy.ops.render.render(write_still=True)

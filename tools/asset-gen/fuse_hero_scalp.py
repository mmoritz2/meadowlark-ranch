"""One isolated volume cleanup trial for the projected hero scalp shell."""
import bpy,bmesh,json,pathlib,math
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'assets/models/hero-horse'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT/'hero-finished.glb'))
source=next(o for o in bpy.context.scene.objects if o.type=='MESH');source.name='Original finished source untouched'
body=source.copy();body.data=source.data.copy();bpy.context.collection.objects.link(body);body.name='Fused coat body'
bm=bmesh.new();bm.from_mesh(body.data)
bmesh.ops.delete(bm,geom=[v for v in bm.verts if all(f.material_index!=0 for f in v.link_faces)],context='VERTS')
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);bm.to_mesh(body.data);bm.free()
reference=body.copy();reference.data=body.data.copy();bpy.context.collection.objects.link(reference);reference.name='UV transfer source'
eyes=source.copy();eyes.data=source.data.copy();bpy.context.collection.objects.link(eyes);eyes.name='Original seated eyes'
bm=bmesh.new();bm.from_mesh(eyes.data);bmesh.ops.delete(bm,geom=[v for v in bm.verts if all(f.material_index==0 for f in v.link_faces)],context='VERTS');bm.to_mesh(eyes.data);bm.free()
source.hide_render=True;source.hide_set(True);reference.hide_render=True;reference.hide_set(True)
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
body.data.remesh_voxel_size=.003;body.data.use_remesh_preserve_volume=True;bpy.ops.object.voxel_remesh()
smooth=body.modifiers.new('Small voxel relaxation','SMOOTH');smooth.factor=.45;smooth.iterations=3;bpy.ops.object.modifier_apply(modifier=smooth.name)
tri=sum(len(f.vertices)-2 for f in body.data.polygons)
if tri>150000:
    dec=body.modifiers.new('Practical hero surface','DECIMATE');dec.ratio=150000/tri;dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
if not body.data.uv_layers:body.data.uv_layers.new(name='UVMap')
transfer=body.modifiers.new('Preserve painted coat atlas','DATA_TRANSFER');transfer.object=reference;transfer.use_loop_data=True;transfer.data_types_loops={'UV'};transfer.loop_mapping='POLYINTERP_NEAREST';bpy.ops.object.modifier_apply(modifier=transfer.name)
for f in body.data.polygons:f.use_smooth=True
eyes.select_set(True);bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free()
bpy.ops.export_scene.gltf(filepath=str(OUT/'hero-fused.glb'),export_format='GLB',use_selection=True,export_yup=True,export_tangents=True,export_animations=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.resolution_x=1040;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
scene.world=bpy.data.worlds.new('Hero fused daylight');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.37,.42,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.48
coords=[body.matrix_world@v.co for v in body.data.vertices];lo=Vector([min(p[i] for p in coords) for i in range(3)]);hi=Vector([max(p[i] for p in coords) for i in range(3)]);centre=(lo+hi)/2
def aim(o,p):o.rotation_euler=(p-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,lo.z-.004));floor=bpy.context.object;floor_mat=bpy.data.materials.new('Review floor');floor_mat.diffuse_color=(.13,.16,.15,1);floor.data.materials.append(floor_mat)
for name,offset,power,size in [('Soft key',(1,-3,4),500,4),('Fill',(-2,2,2),220,3),('Rim',(-2,1,3),300,3)]:
    bpy.ops.object.light_add(type='AREA',location=centre+Vector(offset));o=bpy.context.object;o.name=name;o.data.energy=power;o.data.size=size;aim(o,centre)
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';scene.camera=cam;head=Vector((.827,-.115,.590));review=OUT/'fused-review';review.mkdir(exist_ok=True)
for name,c,offset,scale in [('opposite',centre,(0,4,.14),2.55),('front',centre,(4,0,.04),2.55),('head-opposite',head,(2,4,.10),.70),('head-quarter',head,(2,-4,.10),.70)]:
    cam.location=c+Vector(offset);aim(cam,c);cam.data.ortho_scale=scale;scene.render.filepath=str(review/(name+'.png'));bpy.ops.render.render(write_still=True)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'hero-fused.blend'))
print('HERO_FUSED_TRIAL_READY',flush=True)

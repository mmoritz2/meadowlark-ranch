"""UV-preserving local finish of the new generated hero. Runs in Blender."""
import bpy,bmesh,json,pathlib,math,numpy as np,sys
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'assets/models/hero-horse';REVIEW=OUT/'finish-review';REVIEW.mkdir(exist_ok=True)
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent));import hero_local_sculpt as sculpt
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(OUT/'hero-textured-raw.glb'))
horse=next(o for o in bpy.context.scene.objects if o.type=='MESH');horse.name='Painted hero with preserved atlas'
bm=bmesh.new();bm.from_mesh(horse.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(horse.data);bm.free()
for f in horse.data.polygons:f.use_smooth=True
for mat in horse.data.materials:
    if mat and mat.use_nodes:
        bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Metallic'].default_value=0;bs.inputs['Roughness'].default_value=.67
        bs.inputs['Specular IOR Level'].default_value=.28

extras,landmarks=sculpt.refine_face(horse);sculpt.remove_tail(horse)
groom=json.loads((OUT/'hero-groom-anchors.json').read_text());sculpt.remove_mane(horse,groom['anchors']['crest']);sculpt.remove_opposite_mane(horse,groom['anchors']['crest'])
(OUT/'face-landmarks.json').write_text(json.dumps(landmarks,indent=2))
bpy.ops.object.select_all(action='DESELECT');horse.select_set(True)
for o in extras:o.select_set(True)
bpy.context.view_layer.objects.active=horse;bpy.ops.object.join()
bm=bmesh.new();bm.from_mesh(horse.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.0000001);
for _ in range(3):
    fins=[f for f in bm.faces if len(f.verts)==3 and sum(e.is_boundary for e in f.edges)==2 and any(len(e.link_faces)>2 for e in f.edges)]
    if not fins:break
    bmesh.ops.delete(bm,geom=fins,context='FACES_ONLY')
loose=[v for v in bm.verts if not v.link_faces]
if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(horse.data);bm.free()

bpy.ops.object.select_all(action='DESELECT');horse.select_set(True);bpy.context.view_layer.objects.active=horse
bpy.ops.export_scene.gltf(filepath=str(OUT/'hero-face-tail-review.glb'),export_format='GLB',use_selection=True,export_yup=True,export_tangents=True,export_animations=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.resolution_x=1040;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
scene.world=bpy.data.worlds.new('Hero finish daylight');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.37,.42,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.48
coords=[horse.matrix_world@v.co for v in horse.data.vertices];lo=Vector([min(p[i] for p in coords) for i in range(3)]);hi=Vector([max(p[i] for p in coords) for i in range(3)]);centre=(lo+hi)/2
def aim(o,p):o.rotation_euler=(p-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,lo.z-.004));floor=bpy.context.object;floor.name='Review ground';floor_mat=bpy.data.materials.new('Review floor');floor_mat.diffuse_color=(.13,.16,.15,1);floor.data.materials.append(floor_mat)
for name,offset,power,size in [('Soft key',(1,-3,4),500,4),('Fill',(-2,2,2),220,3),('Rim',(-2,1,3),300,3)]:
    bpy.ops.object.light_add(type='AREA',location=centre+Vector(offset));o=bpy.context.object;o.name=name;o.data.energy=power;o.data.size=size;aim(o,centre)
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';scene.camera=cam
head=Vector((.827,-.115,.590))
for name,c,offset,scale in [('side',centre,(0,-4,.14),2.55),('quarter',centre,(2.3,-4,.55),2.55),('head-side',head,(0,-4,.02),.70),('head-quarter',head,(2,-4,.10),.70),('head-front',head,(4,0,.04),.70),('head-opposite',head,(2,4,.10),.70),('opposite',centre,(0,4,.14),2.55)]:
    cam.location=c+Vector(offset);aim(cam,c);cam.data.ortho_scale=scale;scene.render.filepath=str(REVIEW/(name+'.png'));bpy.ops.render.render(write_still=True)
for image in bpy.data.images:
    if image.source=='FILE':image.pack()
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'hero-sculpt.blend'))
print('HERO_LOCAL_FINISH_REVIEW_READY',flush=True)

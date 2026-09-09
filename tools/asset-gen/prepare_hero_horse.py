"""Inspect and prepare the new Hunyuan hero in isolated Blender, without rigging."""
import bpy,bmesh,json,pathlib,math
from mathutils import Vector

ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'assets/models/hero-horse';REVIEW=OUT/'review';REVIEW.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT/'source-high.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=max(meshes,key=lambda o:len(o.data.polygons));bpy.ops.object.join()
source=bpy.context.object;source.name='Original Hunyuan high resolution surface'
original_triangles=sum(len(p.vertices)-2 for p in source.data.polygons)
hero=source.copy();hero.data=source.data.copy();bpy.context.collection.objects.link(hero);hero.name='Hero horse review geometry'
source.hide_render=True;source.hide_set(True)
bpy.ops.object.select_all(action='DESELECT');hero.select_set(True);bpy.context.view_layer.objects.active=hero
if original_triangles>140000:
    dec=hero.modifiers.new('Review topology preserving detail','DECIMATE');dec.ratio=140000/original_triangles;dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
bm=bmesh.new();bm.from_mesh(hero.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.0000001)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
boundary=sum(e.is_boundary for e in bm.edges);nonmanifold=sum(not e.is_manifold and not e.is_boundary for e in bm.edges)
bm.to_mesh(hero.data);bm.free()
for p in hero.data.polygons:p.use_smooth=True
mat=bpy.data.materials.new('Neutral anatomical clay');mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.28,.245,.205,1);bs.inputs['Roughness'].default_value=.76;bs.inputs['Metallic'].default_value=0
hero.data.materials.clear();hero.data.materials.append(mat)
bpy.ops.export_scene.gltf(filepath=str(OUT/'hero-paint-input.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_materials='EXPORT')
(OUT/'hero.glb').write_bytes((OUT/'hero-paint-input.glb').read_bytes())
coords=[hero.matrix_world@v.co for v in hero.data.vertices]
lo=Vector([min(p[i] for p in coords) for i in range(3)]);hi=Vector([max(p[i] for p in coords) for i in range(3)])
manifest={'file':'hero.glb','name':'Bay sporthorse — new anatomy candidate','revision':'hunyuan-hero-shape-1','status':'Unrigged anatomy review','heightM':2.30,'withersM':1.68,'rotation':[0,-math.pi/2,0],
 'reference':'reference.png','source':'source-high.glb','blenderSource':'hero-horse.blend','paintInput':'hero-paint-input.glb','coordinateNote':'Original Hunyuan glTF orientation retained. Verify forward axis visually; viewer rotation maps +X nose to +Z.',
 'geometry':{'sourceTriangles':original_triangles,'reviewTriangles':sum(len(p.vertices)-2 for p in hero.data.polygons),'vertices':len(hero.data.vertices),'boundaryEdges':boundary,'nonmanifoldEdges':nonmanifold},
 'generation':{'referenceModel':'FLUX.2 dev','shapeModel':'Hunyuan3D 2.1','octreeResolution':768,'diffusionSteps':60},'rigged':False,'reviewRequired':True}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('HERO_STATIC_READY',json.dumps(manifest['geometry']),flush=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.resolution_x=1040;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
scene.world=bpy.data.worlds.new('Neutral review world');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.34,.38,.42,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,lo.z-.006));floor=bpy.context.object;floor.name='Review ground'
floor_mat=bpy.data.materials.new('Review ground material');floor_mat.diffuse_color=(.12,.15,.14,1);floor.data.materials.append(floor_mat)
centre=(lo+hi)/2
def aim(o,p):o.rotation_euler=(p-o.location).to_track_quat('-Z','Y').to_euler()
for name,pos,power,size in [('Large soft key',(1,-3,4),500,4),('Broad fill',(-2,2,2),220,3),('Rim',(-2,1,3),300,3)]:
    bpy.ops.object.light_add(type='AREA',location=centre+Vector(pos));light=bpy.context.object;light.name=name;light.data.energy=power;light.data.size=size;aim(light,centre)
bpy.ops.object.camera_add();camera=bpy.context.object;camera.data.type='ORTHO';scene.camera=camera
span=hi-lo;scale=max(span.x*1.22,span.z*1.42)
for name,offset in [('side',(0,-4,.14)),('quarter',(2.3,-4,.55)),('front',(4,0,.20)),('rear-quarter',(-2.3,-4,.45))]:
    camera.location=centre+Vector(offset);aim(camera,centre);camera.data.ortho_scale=scale;scene.render.filepath=str(REVIEW/(name+'.png'));bpy.ops.render.render(write_still=True)
head=[p for p in coords if p.x>lo.x+.70*span.x and p.z>lo.z+.58*span.z]
if head:
    hmin=Vector([min(p[i] for p in head) for i in range(3)]);hmax=Vector([max(p[i] for p in head) for i in range(3)]);hc=(hmin+hmax)/2;hs=hmax-hmin
    for name,offset in [('head-side',(0,-4,.04)),('head-quarter',(2,-4,.2)),('head-front',(4,0,.08))]:
        camera.location=hc+Vector(offset);aim(camera,hc);camera.data.ortho_scale=max(hs.x,hs.z)*1.28;scene.render.filepath=str(REVIEW/(name+'.png'));bpy.ops.render.render(write_still=True)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'hero-horse.blend'))
print('HERO_REVIEW_COMPLETE',flush=True)

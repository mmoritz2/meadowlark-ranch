import bpy, json, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / 'assets/models/horse-candidates/lyndon-daniels'
SRC = FOLDER / 'source/horse'
OUT = ROOT / 'output/horse-candidates'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=str(SRC / 'LD_HorseRtime02.obj'))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
info = {'author': 'Lyndon Daniels', 'source': 'https://opengameart.org/content/realtime-ranchers-3d-model-pack', 'license': 'CC0', 'objects': []}
for obj in meshes:
    info['objects'].append({'name': obj.name, 'vertices': len(obj.data.vertices), 'polygons': len(obj.data.polygons), 'triangles': sum(len(p.vertices)-2 for p in obj.data.polygons), 'bounds': [list(v) for v in obj.bound_box], 'materials': [s.name for s in obj.data.materials], 'uv_layers': list(obj.data.uv_layers.keys())})
    for poly in obj.data.polygons: poly.use_smooth = True
for mat in bpy.data.materials:
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if not bsdf: continue
    mat.node_tree.nodes.clear()
    bsdf = mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
    output = mat.node_tree.nodes.new('ShaderNodeOutputMaterial')
    mat.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value = (.22,.085,.035,1)
    bsdf.inputs['Roughness'].default_value = .55
    if 'Eye' in mat.name: color, normal = 'eye_texture.png', None
    elif 'Hair' in mat.name: color, normal = 'Hair12Main2k.png', 'Hair12Main2kNorm.png'
    else: color, normal = 'HorseMain2k00.png', 'HorseMain2k00Norm00.png'
    tex = mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(str(SRC/color), check_existing=True)
    if 'Eye' in mat.name:
        # Source OBJ eyes have no UV coordinates. Use a neutral dark eye surface
        # for this review derivative instead of sampling one arbitrary texel.
        bsdf.inputs['Base Color'].default_value=(.008,.004,.002,1)
        bsdf.inputs['Roughness'].default_value=.16
    else: mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    if 'Hair' in mat.name:
        mat.node_tree.links.new(tex.outputs['Alpha'],bsdf.inputs['Alpha'])
        mat.surface_render_method='DITHERED'
    if normal:
        ntex=mat.node_tree.nodes.new('ShaderNodeTexImage');ntex.image=bpy.data.images.load(str(SRC/normal),check_existing=True);ntex.image.colorspace_settings.name='Non-Color'
        nmap=mat.node_tree.nodes.new('ShaderNodeNormalMap');nmap.inputs['Strength'].default_value=.5
        mat.node_tree.links.new(ntex.outputs['Color'],nmap.inputs['Color']);mat.node_tree.links.new(nmap.outputs['Normal'],bsdf.inputs['Normal'])
pts=[o.matrix_world@Vector(p) for o in meshes for p in o.bound_box]
lo=Vector(tuple(min(p[i] for p in pts) for i in range(3)));hi=Vector(tuple(max(p[i] for p in pts) for i in range(3)))
center=(lo+hi)/2;size=hi-lo
info['overall_bounds']=[list(lo),list(hi)];info['size']=list(size)
factor=2.2/size.z
offset=Vector((center.x,center.y,lo.z))
for obj in meshes:
    matrix=obj.matrix_world.copy()
    for vertex in obj.data.vertices:vertex.co=(matrix@vertex.co-offset)*factor
    obj.matrix_world.identity()
eye_centers=[sum((v.co for v in o.data.vertices),Vector())/len(o.data.vertices) for o in meshes if o.name.startswith('Sphere')]
head=sum(eye_centers,Vector())/len(eye_centers)
info['review_transform']={'uniform_scale':factor,'subtract_original_blender_xyz':list(offset),'gltf_orientation':'Y up, nose +Z','full_height_metres':2.2,'eye_center_gltf':[head.x,head.z,-head.y]}
pts=[o.matrix_world@Vector(p) for o in meshes for p in o.bound_box]
bpy.context.view_layer.update()
pts=[o.matrix_world@Vector(p) for o in meshes for p in o.bound_box]
lo=Vector(tuple(min(p[i] for p in pts) for i in range(3)));hi=Vector(tuple(max(p[i] for p in pts) for i in range(3)));center=(lo+hi)/2;size=hi-lo
(OUT/'lyndon-stats.json').write_text(json.dumps(info,indent=2))
print(json.dumps(info,indent=2))
# Asset-only GLB derivative: repaired relative texture paths, original geometry.
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(FOLDER/'horse-review.glb'),export_format='GLB',use_selection=True,export_yup=True)
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Neutral world');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.24,.26,.29,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.55
scene.view_settings.view_transform='AgX'
span=max(size)
bpy.ops.mesh.primitive_plane_add(size=span*8,location=(center.x,center.y,lo.z-.001))
ground=bpy.context.object;ground.name='Review ground';gm=bpy.data.materials.new('Review ground');gm.diffuse_color=(.12,.14,.16,1);gm.use_nodes=True;gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.12,.14,.16,1);gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.8;ground.data.materials.append(gm)
def aim(o,target):o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
for pos,power,scale in [((2,-4,5),1300,3),((-3,1,3),900,2.5),((1,3,5),1500,2)]:
    bpy.ops.object.light_add(type='AREA',location=center+Vector(pos)*span/4);light=bpy.context.object;light.data.energy=power*(span/4)**2;light.data.shape='DISK';light.data.size=scale*span/4;aim(light,center)
bpy.ops.object.camera_add();camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=span*1.35;scene.camera=camera
for label,position in [('lyndon-quarter',(1,-1.6,.5)),('lyndon-side',(2,0,.18))]:
    camera.location=center+Vector(position)*span;aim(camera,center);scene.render.filepath=str(OUT/(label+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(FOLDER/'review.blend'))

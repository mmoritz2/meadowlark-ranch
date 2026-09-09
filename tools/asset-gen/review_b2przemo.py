"""Render an isolated, attributed artist base; do not alter source or live game."""
import bpy,bmesh,pathlib,json,math
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[2]
SOURCE=ROOT/'assets/models/horse-candidates/b2przemo/source/blendswap-cc-by/horse'
OUT=ROOT/'output/horse-reset/b2przemo-review';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
verts=[];uvs=[];faces=[];faceuvs=[]
for line in (SOURCE/'horse.obj').read_text().splitlines():
    a=line.split()
    if not a:continue
    if a[0]=='v':
        x,y,z=map(float,a[1:4]);verts.append((z*.01,x*.01,y*.01))
    if a[0]=='vt':uvs.append(tuple(map(float,a[1:3])))
    if a[0]=='f':
        face=[];fu=[]
        for token in a[1:]:
            e=token.split('/');face.append(int(e[0])-1);fu.append(int(e[1])-1 if len(e)>1 and e[1] else -1)
        faces.append(face);faceuvs.append(fu)
mesh=bpy.data.meshes.new('b2przemo original artist topology');mesh.from_pydata(verts,[],faces);mesh.update()
uv=mesh.uv_layers.new(name='Author UV')
for poly,indices in zip(mesh.polygons,faceuvs):
    for li,u in zip(poly.loop_indices,indices):
        if u>=0:uv.data[li].uv=uvs[u]
    poly.use_smooth=True
horse=bpy.data.objects.new('Horse by b2przemo — CC BY 3.0',mesh);bpy.context.collection.objects.link(horse)
bpy.context.view_layer.objects.active=horse;horse.select_set(True)
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
coat=bpy.data.materials.new('Original artist palomino color');coat.use_nodes=True
bs=coat.node_tree.nodes.get('Principled BSDF');bs.inputs['Metallic'].default_value=0;bs.inputs['Roughness'].default_value=.57;bs.inputs['Specular IOR Level'].default_value=.3
tex=coat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(SOURCE/'color.jpg'));coat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
clay=bpy.data.materials.new('Matched warm clay');clay.use_nodes=True
bs=clay.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.17,.095,.055,1);bs.inputs['Roughness'].default_value=.52;bs.inputs['Specular IOR Level'].default_value=.3
horse.data.materials.append(coat)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=1050;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
scene.world=bpy.data.worlds.new('Controlled clay review');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.20,.24,.28,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
pts=[v.co for v in horse.data.vertices];lo=Vector([min(p[i] for p in pts) for i in range(3)]);hi=Vector([max(p[i] for p in pts) for i in range(3)]);centre=(lo+hi)/2
span=hi-lo
def aim(o,p):o.rotation_euler=(p-o.location).to_track_quat('-Z','Y').to_euler()
for name,pos,power,size in [('Key',(1,-3,4),420,3),('Fill',(-2,2,2),160,3),('Rim',(-2,1,3),200,3)]:
    bpy.ops.object.light_add(type='AREA',location=centre+Vector(pos));l=bpy.context.object;l.name=name;l.data.energy=power;l.data.size=size;aim(l,centre)
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';scene.camera=cam
headpts=[p for p in pts if p.x>hi.x-span.x*.24 and p.z>lo.z+span.z*.68]
headlo=Vector([min(p[i] for p in headpts) for i in range(3)]);headhi=Vector([max(p[i] for p in headpts) for i in range(3)]);head=(headlo+headhi)/2
headscale=max((headhi-headlo).x,(headhi-headlo).z)*1.5
for material,name in [(coat,'artist-color'),(clay,'artist-clay')]:
    horse.data.materials[0]=material
    for view,offset,scale,target in [('side',(0,-4,.1),max(span.x,span.z)*1.25,centre),('head-quarter',(2,-4,.10),headscale,head),('head-opposite',(2,4,.10),headscale,head),('head-front',(4,0,.02),headscale,head)]:
        cam.location=target+Vector(offset);aim(cam,target);cam.data.ortho_scale=scale
        scene.render.filepath=str(OUT/(name+'-'+view+'.png'));bpy.ops.render.render(write_still=True)
horse.data.materials[0]=coat;bpy.ops.object.select_all(action='DESELECT');horse.select_set(True);bpy.context.view_layer.objects.active=horse
bpy.ops.export_scene.gltf(filepath=str(OUT/'b2przemo-original-preview.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
for image in bpy.data.images:
    if image.source=='FILE':image.pack()
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'b2przemo-review.blend'))
report={'artist':'b2przemo','license':'CC BY 3.0 per embedded source license; attribution required','source':'https://blendswap.com/blend/13903','sourceAltered':False,'previewChanges':'Axis/unit conversion, recalculated normals and nonmetallic material; original vertices/faces/UV/color otherwise retained.','vertices':len(mesh.vertices),'polygons':len(mesh.polygons),'triangles':sum(len(p.vertices)-2 for p in mesh.polygons),'quadCount':sum(len(p.vertices)==4 for p in mesh.polygons),'textureSize':list(tex.image.size),'bounds':{'min':list(lo),'max':list(hi)},'rigged':False}
(OUT/'report.json').write_text(json.dumps(report,indent=2));print('ARTIST_REVIEW_COMPLETE',json.dumps(report),flush=True)

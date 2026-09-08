"""Bake an unlit, groomed chestnut coat in Blender without changing the 33-bone rig.

Run from repo root with Blender --background --factory-startup --python this_file.
The original GLB is never overwritten. Blender's glTF importer can add a hidden
Icosphere bone display: export selection deliberately excludes that helper.
"""
import bpy, json, pathlib, math, struct
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'output/horse-review'; OUT.mkdir(parents=True,exist_ok=True)
MODELS=ROOT/'assets/models'; TEX=ROOT/'assets/textures'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(MODELS/'horse_textured_rigged.glb'))
horse=next(o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
horse.name='StarRanch_GroomedHorse'
for p in horse.data.polygons:p.use_smooth=True
original=horse.data.materials[0]
image=next(n.image for n in original.node_tree.nodes if n.type=='TEX_IMAGE' and n.image)
pts=[v.co for v in horse.data.vertices]
lo=Vector(tuple(min(v[i] for v in pts) for i in range(3)));hi=Vector(tuple(max(v[i] for v in pts) for i in range(3)))
print('HORSE_BOUNDS',list(lo),list(hi))
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
# Vertex masks only define anatomical regions. Fine markings come from original
# atlas chroma, with light/dark body paint excluded from the new base color.
mask=horse.data.color_attributes.new(name='CoatRegions',type='FLOAT_COLOR',domain='POINT')
markings=horse.data.color_attributes.new(name='NaturalMarkings',type='FLOAT_COLOR',domain='POINT')
for v in horse.data.vertices:
    x,y,z=v.co
    groups={horse.vertex_groups[g.group].name:g.weight for g in v.groups}
    tail=sum(groups.get('bone_'+str(i),0) for i in (20,21,22))
    sock_top=(-.56 if x>0 else -.43)+.016*math.sin(y*41+x*20)
    ankle=1-smooth(sock_top-.016,sock_top+.016,z)
    neck=smooth(.12,.37,x)*smooth(.38,.62,z)
    if x>.72:neck*=smooth(.705,.74,z)
    white=neck
    # Eye plane is around the poll / upper face. Only this region retains dark
    # atlas detail; bright forehead paint remains eligible for the blaze.
    eye=math.exp(-((x-.801)/.070)**4-((z-.644)/.041)**4)
    muzzle=smooth(.835,.90,x)*(1-smooth(.48,.53,z))
    hoof=max(1-smooth(b.head_local.z+.014,b.head_local.z+.045,z) for b in arm.data.bones if b.name in (['bone_12','bone_18'] if x>0 else ['bone_27','bone_32']))
    tail=max(tail,smooth(.83,.94,-x))
    white*=1-eye
    detail=eye
    mask.data[v.index].color=(white,detail,tail,1)
    markings.data[v.index].color=(max(ankle,tail),max(hoof,muzzle),0,1)
mat=bpy.data.materials.new('Natural chestnut - unlit albedo bake');mat.use_nodes=True
nt=mat.node_tree;n=nt.nodes;lk=nt.links;n.clear()
def node(typ):return n.new(typ)
def mathnode(op,a,b=None):
    x=node('ShaderNodeMath');x.operation=op
    for i,v in enumerate((a,b)):
        if v is None:continue
        if isinstance(v,(int,float)):x.inputs[i].default_value=v
        else:lk.new(v,x.inputs[i])
    return x.outputs[0]
def mix(a,b,f):
    x=node('ShaderNodeMixRGB');x.blend_type='MIX'
    for i,v in ((1,a),(2,b)):
        if isinstance(v,tuple):x.inputs[i].default_value=v
        else:lk.new(v,x.inputs[i])
    lk.new(f,x.inputs[0]);return x.outputs[0]
tex=node('ShaderNodeTexImage');tex.image=image
sep=node('ShaderNodeSeparateColor');lk.new(tex.outputs['Color'],sep.inputs[0])
attrs=node('ShaderNodeVertexColor');attrs.layer_name=mask.name
regions=node('ShaderNodeSeparateColor');lk.new(attrs.outputs[0],regions.inputs[0])
marks=node('ShaderNodeVertexColor');marks.layer_name=markings.name
markchannels=node('ShaderNodeSeparateColor');lk.new(marks.outputs[0],markchannels.inputs[0])
# Original cream hair/white socks have high blue:red ratio. Restrict this chroma
# mask to mane, forehead, lower legs and tail so body highlights cannot bleach.
ratio=mathnode('DIVIDE',sep.outputs['Blue'],mathnode('ADD',sep.outputs['Red'],.008))
ratio=mathnode('MULTIPLY',mathnode('SUBTRACT',ratio,.37),5.0)
ratio=mathnode('MINIMUM',1,mathnode('MAXIMUM',0,ratio))
white=mathnode('MULTIPLY',ratio,regions.outputs['Red'])
white=mathnode('MAXIMUM',white,markchannels.outputs['Red'])
bw=node('ShaderNodeRGBToBW');lk.new(tex.outputs['Color'],bw.inputs[0])
# Deliberately cap inherited source variation to 9%; source shadow bands were
# nearly black and its painted specular spots almost white.
body=mix((.245,.082,.032,1),(.292,.106,.043,1),bw.outputs[0])
color=mix(body,(.71,.62,.45,1),white)
# Preserve original dark eye/muzzle pixels only in their anatomical masks.
dark=mathnode('MULTIPLY',mathnode('SUBTRACT',.15,bw.outputs[0]),12)
dark=mathnode('MINIMUM',1,mathnode('MAXIMUM',0,dark))
dark=mathnode('MULTIPLY',dark,regions.outputs['Green'])
dark=mathnode('MAXIMUM',dark,markchannels.outputs['Green'])
color=mix(color,(.027,.023,.021,1),dark)
# Longitudinal subtle variation is real material color, not illumination.
noise=node('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=245;noise.inputs['Detail'].default_value=2
coords=node('ShaderNodeTexCoord');lk.new(coords.outputs['Object'],noise.inputs['Vector'])
grain=mix((.96,.96,.96,1),(1.04,1.04,1.04,1),noise.outputs['Fac'])
mul=node('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1;lk.new(color,mul.inputs[1]);lk.new(grain,mul.inputs[2])
em=node('ShaderNodeEmission');lk.new(mul.outputs[0],em.inputs['Color'])
output=node('ShaderNodeOutputMaterial');lk.new(em.outputs[0],output.inputs['Surface'])
horse.data.materials.clear();horse.data.materials.append(mat)
bpy.ops.object.select_all(action='DESELECT');horse.select_set(True);bpy.context.view_layer.objects.active=horse
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=8
albedo=bpy.data.images.new('Horse Natural Chestnut Albedo',2048,2048,alpha=False)
albedo.colorspace_settings.name='sRGB'
target=node('ShaderNodeTexImage');target.image=albedo;n.active=target
s.render.bake.margin=12
bpy.ops.object.bake(type='EMIT')
albedo.filepath_raw=str(TEX/'horse_natural_albedo.png');albedo.file_format='PNG';albedo.save()
# Game-ready material exports a normal PBR base color with no baked lights.
final=bpy.data.materials.new('Groomed chestnut');final.use_nodes=True
nn=final.node_tree.nodes;ll=final.node_tree.links;bs=nn.get('Principled BSDF')
bs.inputs['Roughness'].default_value=.72;bs.inputs['Metallic'].default_value=0
bs.inputs['Specular IOR Level'].default_value=.26
bs.inputs['Coat Weight'].default_value=.06;bs.inputs['Coat Roughness'].default_value=.6
at=nn.new('ShaderNodeTexImage');at.image=albedo;ll.new(at.outputs['Color'],bs.inputs['Base Color'])
horse.data.materials.clear();horse.data.materials.append(final)
# Fine tangent-space normal from a procedural coat grain, avoiding the old
# albedo-derived normal that reinforced black muscle bands.
nc=nn.new('ShaderNodeTexCoord');mapping=nn.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(350,750,350);ll.new(nc.outputs['Object'],mapping.inputs[0])
grain=nn.new('ShaderNodeTexNoise');grain.inputs['Scale'].default_value=1;grain.inputs['Detail'].default_value=1;ll.new(mapping.outputs[0],grain.inputs['Vector'])
bump=nn.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.0012;ll.new(grain.outputs['Fac'],bump.inputs['Height']);ll.new(bump.outputs[0],bs.inputs['Normal'])
normal=bpy.data.images.new('Horse Fine Coat Normal',1024,1024,alpha=False);normal.colorspace_settings.name='Non-Color'
ntarget=nn.new('ShaderNodeTexImage');ntarget.image=normal;nn.active=ntarget
bpy.ops.object.bake(type='NORMAL')
normal.filepath_raw=str(TEX/'horse_natural_normal.png');normal.file_format='PNG';normal.save()
ll.remove(bs.inputs['Normal'].links[0]);normalnode=nn.new('ShaderNodeNormalMap');normalnode.inputs['Strength'].default_value=.5;ll.new(ntarget.outputs[0],normalnode.inputs['Color']);ll.new(normalnode.outputs[0],bs.inputs['Normal'])
# Keep editable source masks and original image in .blend, but export only horse
# and existing skeleton; cameras/review floor never enter the shipping GLB.
bpy.ops.object.select_all(action='DESELECT');horse.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=horse
bpy.ops.export_scene.gltf(filepath=str(MODELS/'horse_showcase_rigged.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_skins=True,export_all_influences=False,export_materials='EXPORT',export_extras=True)
# Blender recomputes bone-roll quaternions during import/export. Restore the
# exact original glTF joint transforms and inverse bind matrices so the runtime's
# index-driven gaits receive precisely the original skeleton, not accumulated
# float drift through 33 Blender rest-bone conversions.
def read_glb(path):
    raw=path.read_bytes();jl=struct.unpack_from('<I',raw,12)[0]
    return json.loads(raw[20:20+jl]),bytearray(raw[28+jl:])
orig,origbin=read_glb(MODELS/'horse_textured_rigged.glb')
ship,shipbin=read_glb(MODELS/'horse_showcase_rigged.glb')
oj=orig['skins'][0]['joints'];sj=ship['skins'][0]['joints']
assert [orig['nodes'][i]['name'] for i in oj]==[ship['nodes'][i]['name'] for i in sj]
for oi,si in zip(oj,sj):
    for prop in ('translation','rotation','scale','matrix'):
        ship['nodes'][si].pop(prop,None)
        if prop in orig['nodes'][oi]:ship['nodes'][si][prop]=orig['nodes'][oi][prop]
def bind_span(doc):
    a=doc['accessors'][doc['skins'][0]['inverseBindMatrices']];v=doc['bufferViews'][a['bufferView']]
    assert a['componentType']==5126 and a['type']=='MAT4' and not v.get('byteStride')
    return v.get('byteOffset',0)+a.get('byteOffset',0),a['count']*64
os,on=bind_span(orig);ss,sn=bind_span(ship);assert on==sn;shipbin[ss:ss+sn]=origbin[os:os+on]
jb=json.dumps(ship,separators=(',',':')).encode();jb+=b' '*((-len(jb))%4)
glb=struct.pack('<4sII',b'glTF',2,28+len(jb)+len(shipbin))+struct.pack('<II',len(jb),0x4E4F534A)+jb+struct.pack('<II',len(shipbin),0x004E4942)+shipbin
(MODELS/'horse_showcase_rigged.glb').write_bytes(glb)
albedo.pack();normal.pack();image.pack()
# Consistent soft studio review images, floor at the actual lowest hoof.
center=(lo+hi)/2
def aim(o,p):o.rotation_euler=(p-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,lo.z-.002));plane=bpy.context.object
pm=bpy.data.materials.new('Review ground');pm.diffuse_color=(.19,.23,.20,1);plane.data.materials.append(pm)
bpy.ops.object.camera_add(location=center+Vector((2.7,-4.2,1.3)));cam=bpy.context.object;aim(cam,center);cam.data.type='ORTHO';cam.data.ortho_scale=2.55;s.camera=cam
for name,loc,power,size in [('Key',(1,-3,4),500,4),('Fill',(-2,1,2),180,3),('Rim',(-1,3,3),400,2)]:
    bpy.ops.object.light_add(type='AREA',location=center+Vector(loc));o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;aim(o,center)
s.world=bpy.data.worlds.new('Review World');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.35,.42,.5,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.5
s.cycles.samples=24;s.render.resolution_x=1280;s.render.resolution_y=960;s.render.resolution_percentage=100;s.view_settings.view_transform='AgX';s.render.image_settings.file_format='PNG';s.render.filepath=str(OUT/'horse-refined.png');bpy.ops.render.render(write_still=True)
cam.location=center+Vector((0,-4,.4));aim(cam,center);s.render.filepath=str(OUT/'horse-refined-side.png');bpy.ops.render.render(write_still=True)
bpy.context.preferences.filepaths.save_version=0
cam.location=center+Vector((2.7,-4.2,1.3));aim(cam,center)
bpy.ops.object.select_all(action='DESELECT');horse.select_set(True);bpy.context.view_layer.objects.active=horse
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_distance=3.3
            area.spaces.active.region_3d.view_location=center
bpy.ops.wm.save_as_mainfile(filepath=str(MODELS/'horse_showcase.blend'))
(OUT/'refined-inspection.json').write_text(json.dumps({'vertices':len(horse.data.vertices),'polygons':len(horse.data.polygons),'bones':[b.name for b in arm.data.bones],'bounds_min':list(lo),'bounds_max':list(hi),'albedo':str(albedo.filepath),'normal':str(normal.filepath),'modifications':'new unlit coat bake; smooth shading; exact original mesh and rig topology preserved'},indent=2))

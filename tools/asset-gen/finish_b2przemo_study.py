"""Isolated artist-topology finish study. No remesh and no production edits."""
import bpy,bmesh,pathlib,json,math,random
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/models/horse-candidates/b2przemo';REVIEW=ROOT/'output/horse-reset/b2przemo-finished';REVIEW.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'output/horse-reset/b2przemo-review/b2przemo-review.blend'))
body=next(o for o in bpy.context.scene.objects if o.type=='MESH');body.name='Artist body — preserved quad topology'
bpy.context.view_layer.objects.active=body;bpy.ops.object.select_all(action='DESELECT');body.select_set(True)
# Open the original lids gently in their existing local feature loops.
for v in body.data.vertices:
    x,y,z=v.co
    if 1.095<x<1.180 and 1.636<z<1.716 and abs(y)>.070:
        dx=(x-1.139)/.046;dz=(z-1.677)/.046
        w=max(0,1-dx*dx-dz*dz)**2
        v.co.z=1.677+(z-1.677)*(1+.34*w)
sub=body.modifiers.new('One Catmull-Clark level on authored quads','SUBSURF');sub.levels=1;sub.render_levels=1;bpy.ops.object.modifier_apply(modifier=sub.name)
for p in body.data.polygons:p.use_smooth=True

def mat(name,color,rough=.5):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=0;p.inputs['Roughness'].default_value=rough;p.inputs['Specular IOR Level'].default_value=.32
    return m

# A new unlit bay albedo is baked to the artist's existing unwrap.
coat=body.data.materials[0];coat.name='Bay coat — artist UV, fresh color bake';nt=coat.node_tree
bs=nt.nodes.get('Principled BSDF');tex=next(n for n in nt.nodes if n.type=='TEX_IMAGE')
grey=nt.nodes.new('ShaderNodeRGBToBW');nt.links.new(tex.outputs['Color'],grey.inputs['Color'])
ramp=nt.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1])
stops=[(0,(.007,.004,.003,1)),(.05,(.018,.007,.003,1)),(.15,(.085,.021,.006,1)),(.28,(.205,.066,.018,1)),(.48,(.32,.135,.045,1)),(1,(.42,.20,.085,1))]
for i,(pos,color) in enumerate(stops):
    e=ramp.color_ramp.elements[0] if i==0 else ramp.color_ramp.elements.new(pos);e.position=pos;e.color=color
nt.links.new(grey.outputs[0],ramp.inputs[0])
geo=nt.nodes.new('ShaderNodeNewGeometry');sep=nt.nodes.new('ShaderNodeSeparateXYZ');nt.links.new(geo.outputs['Position'],sep.inputs[0])
leg=nt.nodes.new('ShaderNodeMapRange');leg.inputs['From Min'].default_value=.18;leg.inputs['From Max'].default_value=.64;leg.inputs['To Min'].default_value=.075;leg.inputs['To Max'].default_value=1;leg.clamp=True;nt.links.new(sep.outputs['Z'],leg.inputs[0])
multiply=nt.nodes.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1
nt.links.new(ramp.outputs[0],multiply.inputs[1]);nt.links.new(leg.outputs[0],multiply.inputs[2])
emit=nt.nodes.new('ShaderNodeEmission');nt.links.new(multiply.outputs[0],emit.inputs[0]);nt.links.new(emit.outputs[0],nt.nodes.get('Material Output').inputs['Surface'])
image=bpy.data.images.new('B2 original UV bay albedo',width=2048,height=2048,alpha=False);image.colorspace_settings.name='sRGB'
target=nt.nodes.new('ShaderNodeTexImage');target.image=image;nt.nodes.active=target
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.render.bake.margin=16
bpy.ops.object.bake(type='EMIT');image.filepath_raw=str(OUT/'bay-study-albedo.png');image.file_format='PNG';image.save();image.pack()
nt.links.new(target.outputs['Color'],bs.inputs['Base Color']);nt.links.new(bs.outputs['BSDF'],nt.nodes.get('Material Output').inputs['Surface'])
bs.inputs['Roughness'].default_value=.57;bs.inputs['Specular IOR Level'].default_value=.28
bs.inputs['Coat Weight'].default_value=.025;bs.inputs['Coat Roughness'].default_value=.42

eyeMat=mat('Warm dark brown iris and cornea',(.027,.008,.0025),.15)
ep=eyeMat.node_tree.nodes.get('Principled BSDF');ep.inputs['Specular IOR Level'].default_value=.52;ep.inputs['Coat Weight'].default_value=.40;ep.inputs['Coat Roughness'].default_value=.10
pupilMat=mat('Horizontal equine pupil',(.0015,.001,.0008),.12)
eyeObjects=[]
def ellipsoid(name,centre,radii,material,segments=40,rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1)
    o=bpy.context.object;o.name=name
    for v in o.data.vertices:v.co=Vector(centre)+Vector([v.co[i]*radii[i] for i in range(3)])
    o.data.materials.append(material)
    for p in o.data.polygons:p.use_smooth=True
    return o
for side in (-1,1):
    c=(1.139,side*.094,1.671)
    eyeObjects.append(ellipsoid('Seated '+('left' if side<0 else 'right')+' eye',c,(.025,.018,.013),eyeMat))
    eyeObjects.append(ellipsoid('Horizontal pupil '+str(side),(1.139,side*.1115,1.671),(.014,.0008,.0035),pupilMat,32,16))

hairMats=[mat('Black mane — warm '+str(i),c,.64) for i,c in enumerate([(.007,.005,.003),(.012,.007,.004),(.019,.011,.006),(.029,.017,.009)])]
for m in hairMats:m.node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value=.20
rng=random.Random(4471);hairverts=[];hairfaces=[];hairids=[]
def strand(points,radius,material=0,sides=3):
    start=len(hairverts)
    for j,p in enumerate(points):
        p=Vector(p);before=Vector(points[max(0,j-1)]);after=Vector(points[min(len(points)-1,j+1)])
        tangent=(after-before).normalized();ref=Vector((0,0,1)) if abs(tangent.z)<.9 else Vector((1,0,0));u=tangent.cross(ref).normalized();v=tangent.cross(u).normalized()
        taper=(1-j/(len(points)-.5))**.68
        for k in range(sides):
            a=k*math.tau/sides;hairverts.append(p+radius*max(.035,taper)*(u*math.cos(a)+v*math.sin(a)))
    for j in range(len(points)-1):
        for k in range(sides):
            a=start+j*sides+k;b=start+j*sides+(k+1)%sides
            hairfaces.append((a,b,b+sides,a+sides));hairids.append(material)

def bezier4(p0,p1,p2,p3,n=11):
    return [(1-t)**3*Vector(p0)+3*(1-t)**2*t*Vector(p1)+3*(1-t)*t*t*Vector(p2)+t**3*Vector(p3) for t in [i/(n-1) for i in range(n)]]
bpy.context.view_layer.update()
def crest(x,y=0):
    hit,p,n,i=body.ray_cast(Vector((x,y,3)),Vector((0,0,-1)))
    if not hit:raise RuntimeError('Mane crest ray missed '+str(x))
    return p
crestSamples=[]
for i in range(960):
    x=.24+rng.random()*.77;y=rng.uniform(-.013,.013);p=crest(x,y)+Vector((0,0,.002))
    if i%50==0:crestSamples.append(list(p))
    length=rng.uniform(.125,.235)*(1-.35*max(0,(x-.83)/.18))
    lean=rng.uniform(.016,.057)
    pts=bezier4(p,p+Vector((.015,-.035,.018)),p+Vector((lean,-.105,-length*.36)),p+Vector((lean+.015,-.102-rng.random()*.017,-length)),9)
    for q in pts[1:]:
        hit,surf,n,idx=body.ray_cast(Vector((q.x,-1,q.z)),Vector((0,1,0)))
        if hit:q.y=min(q.y,surf.y-.0035-rng.uniform(0,.001))
    strand(pts,rng.uniform(.0009,.0017),rng.choices(range(4),[5,3,2,1])[0])
# Separate forelock wisps follow the forehead between the ears, leaving eyes clear.
for i in range(260):
    x=rng.uniform(1.033,1.080);y=rng.uniform(-.031,.031);p=crest(x,y)+Vector((0,0,.003))
    endx=rng.uniform(1.142,1.195);endy=y*.55+rng.uniform(-.014,.014)
    end=Vector((endx,endy,rng.uniform(1.704,1.756)))
    pts=bezier4(p,p+Vector((.035,0,.028)),end+Vector((-.026,0,.045)),end,12)
    strand(pts,rng.uniform(.0007,.0013),rng.choices(range(4),[5,3,2,1])[0])
# Long individual tail strands hide the original short dock, never a solid shell.
for i in range(1200):
    a=rng.random()*math.tau;r=math.sqrt(rng.random())*.050
    p=Vector((-.866+math.cos(a)*r*.50,math.sin(a)*r,1.251+math.cos(a)*r))
    end=Vector((rng.uniform(-1.048,-.90),rng.uniform(-.075,.075),rng.uniform(.065,.21)))
    c1=Vector((rng.uniform(-1.035,-.95),p.y*1.45,1.03))
    c2=Vector((rng.uniform(-1.15,-1.00),end.y*1.4,.37))
    pts=bezier4(p,c1,c2,end,13)
    strand(pts,rng.uniform(.0010,.0017),rng.choices(range(4),[6,3,2,1])[0])
mesh=bpy.data.meshes.new('Individual tapered mane forelock tail strands');mesh.from_pydata(hairverts,[],hairfaces);mesh.update()
hair=bpy.data.objects.new('Groom — individual geometry strands',mesh);bpy.context.collection.objects.link(hair)
for m in hairMats:mesh.materials.append(m)
for p,mi in zip(mesh.polygons,hairids):p.material_index=mi;p.use_smooth=True

# Review in exactly the artist source orientation before final export normalization.
scene.cycles.samples=48;scene.cycles.use_denoising=True;scene.render.resolution_x=1200;scene.render.resolution_y=1000
pts=[v.co for v in body.data.vertices];lo=Vector([min(p[i] for p in pts) for i in range(3)]);hi=Vector([max(p[i] for p in pts) for i in range(3)]);centre=(lo+hi)/2
head=Vector((1.116,0,1.660));cam=scene.camera
def aim(o,p):o.rotation_euler=(p-o.location).to_track_quat('-Z','Y').to_euler()
for view,offset,scale,target in [('side',(0,-4,.10),2.85,centre),('quarter',(2,-4,.18),2.85,centre),('head-quarter',(2,-4,.10),.72,head),('head-opposite',(2,4,.10),.72,head),('head-front',(4,0,.02),.72,head)]:
    cam.location=target+Vector(offset);aim(cam,target);cam.data.ortho_scale=scale;scene.render.filepath=str(REVIEW/(view+'.png'));bpy.ops.render.render(write_still=True)

objects=[body,hair]+eyeObjects
scale=2.2/(hi.z-lo.z);cx=(lo.x+hi.x)/2;cy=(lo.y+hi.y)/2
for o in objects:
    for v in o.data.vertices:
        x,y,z=v.co;v.co=((y-cy)*scale,-(x-cx)*scale,(z-lo.z)*scale)
    o.data.update()
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.export_scene.gltf(filepath=str(OUT/'horse-finished-study.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
for image in bpy.data.images:
    if image.source=='FILE':image.pack()
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'horse-finished-study.blend'))
report={'artist':'b2przemo','license':'CC BY 3.0','original':'https://blendswap.com/blend/13903','file':'horse-finished-study.glb','status':'Isolated unrigged finish study, pending visual review','productionFilesChanged':False,'changes':['One Catmull-Clark subdivision on original artist quads','Local original lid vertices opened gently','Separate dark brown seated eyes and horizontal pupils','2048px bay albedo baked to original UVs from original coat luminance and authored bay palette; black lower legs','2420 individual tapered geometry strands for mane, forelock and tail'],'bodyTriangles':sum(len(p.vertices)-2 for p in body.data.polygons),'hairTriangles':sum(len(p.vertices)-2 for p in hair.data.polygons),'eyeTriangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in eyeObjects),'headCenter':[(head.y-cy)*scale,(head.z-lo.z)*scale,(head.x-cx)*scale],'orientation':'+Y up +Z nose centered XZ feetY0','height':2.2,'crestSourceSamples':crestSamples,'rigged':False}
(OUT/'finished-study-manifest.json').write_text(json.dumps(report,indent=2));print('FINISHED_STUDY_READY',json.dumps(report),flush=True)

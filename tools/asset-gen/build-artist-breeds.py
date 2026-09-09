"""Conform the accepted B2 authored horse into the complete ranch breed library.

Blender 5.2 --background --disable-autoexec --python this-file.py [-- --only bay,black]
The accepted source is read only. Each derivative retains its artist topology,
UVs, four-influence weights, fitted eyes and named anatomical skeleton.
"""
import bpy, bmesh, pathlib, json, math, hashlib, sys, random
import numpy as np
from mathutils import Vector, Quaternion

ROOT=pathlib.Path(__file__).resolve().parents[2]
BASE=ROOT/'assets/models/horse-candidates/b2przemo'
SOURCE=BASE/'rig-study/horse-rig-study.blend'
OUT=ROOT/'assets/models/artist-breeds'
OUT.mkdir(parents=True,exist_ok=True)
CONF=json.loads((ROOT/'tools/asset-gen/breed-conformation.json').read_text())
ACCEPTED=json.loads((BASE/'APPROVAL.json').read_text())
SOURCE_HASH=hashlib.sha256((BASE/'rig-study/horse-rig-study.glb').read_bytes()).hexdigest()
COATS={
 'bay':((.34,.16,.070),'dark','Rich bay with black points'),
 'chestnut':((.48,.19,.075),'flaxen','Chestnut with flaxen mane'),
 'palomino':((.69,.45,.16),'cream','Golden palomino with ivory mane'),
 'haflinger':((.63,.28,.085),'cream','Copper chestnut with flaxen mane and blaze'),
 'grey':((.63,.66,.69),'silver','Dapple grey with charcoal points'),
 'black':((.055,.045,.041),'dark','Soft black with warm highlights'),
 'pinto':((.36,.11,.044),'mixed','Bay tobiano with broad white patches'),
 'appaloosa':((.37,.16,.065),'dark','Bay blanket with dark leopard spots'),
 'sunset':((.57,.19,.065),'red','Copper chestnut with fine dark red mane'),
 'iceland':((.32,.18,.083),'dark','Mouse dun with dark dorsal stripe'),
 'welsh':((.59,.57,.53),'silver','Warm grey with dapples'),
 'stock':((.34,.092,.035),'dark','Deep mahogany bay'),
 'fjord':((.64,.49,.28),'fjord','Brown dun with two-tone upright mane'),
 'morgan':((.34,.085,.027),'dark','Seal bay with black points'),
 'thoro':((.30,.065,.024),'dark','Dark bay with a small star'),
 'knab':((.76,.75,.70),'mixed','Ivory leopard with irregular dark spots'),
 'vanner':((.035,.031,.028),'mixed','Piebald with abundant white feather'),
 'marwari':((.48,.23,.10),'dark','Dun bay with dark points and narrow blaze'),
 'lipiz':((.77,.78,.76),'silver','Mature pale grey with darker muzzle'),
 'sport':((.074,.060,.049),'dark','Black-brown athletic coat'),
 'akhal':((.63,.42,.16),'gold','Metallic golden buckskin'),
 'percheron':((.40,.43,.46),'silver','Steel dapple grey'),
 'shire':((.042,.033,.028),'dark','Black with white stockings and blaze'),
 'clyde':((.43,.15,.052),'dark','Bright bay with wide blaze and stockings'),
 'bay-sporthorse':((.39,.20,.085),'dark','Warm bay with black points'),
}
HAIR_COLOR={'dark':(.012,.008,.005),'red':(.16,.045,.015),'flaxen':(.60,.43,.22),'cream':(.77,.68,.47),'silver':(.36,.38,.40),'mixed':(.026,.022,.018),'fjord':(.06,.038,.017),'gold':(.30,.19,.066)}
LONG_MANE={'chestnut':1.7,'haflinger':1.6,'black':2.15,'iceland':1.8,'vanner':2.5,'shire':1.75,'clyde':1.45,'percheron':1.25,'lipiz':1.3,'grey':1.45,'akhal':.48,'thoro':.72,'stock':.84,'sport':.96}
FEATHERS={'black':.45,'vanner':1.,'shire':.85,'clyde':.9}

def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)

def deform(points,s,key):
 """Smooth regional rest-space cage; applied identically to mesh and joints."""
 p=np.asarray(points,dtype=float);one=p.ndim==1
 if one:p=p[None,:]
 x,y,z=p.T;q=p.copy()
 head=smooth(.79,1.04,-y)*smooth(1.48,1.77,z)
 neck=smooth(.18,.62,-y)*smooth(1.19,1.50,z)
 torso=(1-neck)*smooth(.69,1.07,z)
 rump=smooth(.36,.88,y)*torso
 width=1+torso*(s['barrel_width']-1)+rump*(s['hindquarter_width']-s['barrel_width'])
 # Keep the limbs centered below the enlarged shoulder and quarter. Their own
 # local thickness varies by bone size, separately from barrel width.
 leg=1-smooth(.77,1.13,z)
 limb_width=1+.34*(s['barrel_width']-1)
 lateral_center=np.sign(x)*.18
 q[:,0]=x*width+leg*((x-lateral_center)*(limb_width-1)+lateral_center*(s['barrel_width']-1)*.65)
 q[:,1]=.30+(y-.30)*s['body_length']
 q[:,2]=z+(s['limb_length']-1)*np.minimum(z,1.1)
 q[:,2]+=(z-1.43)*(s['body_depth']-1)*torso
 # Neck extension translates the whole head with the poll, not just a thin
 # neck tip. Widen around the sloping neck centerline, then add a crest arch.
 q[:,1]+=(y+.36)*(s['neck_length']-1)*neck
 q[:,2]+=(z-1.42)*(s['neck_length']-1)*neck
 q[:,0]+=x*(s['neck_thickness']-1)*neck*(1-head)
 centre_z=1.42+np.clip((-y-.36)/.6,0,1)*.55
 q[:,2]+=(z-centre_z)*(s['neck_thickness']-1)*neck*(1-head)
 arch=np.sin(np.clip((-y-.28)/.76,0,1)*math.pi)*smooth(1.55,1.90,z)
 q[:,2]+=s['neck_arch_rise_per_withers']*1.52*arch*(1-head*.65)
 # Head proportions around poll: whole cheeks and socket regions move together.
 q[:,0]+=x*(s['head_width']-1)*head
 q[:,1]+=(y+.96)*(s['head_length']-1)*head
 q[:,2]+=(z-1.97)*(s['head_length']-1)*head
 profile=np.exp(-((y+1.16)/.17)**2-((z-1.83)/.17)**2)*head
 q[:,1]-=s['face_profile_depth_per_withers']*1.52*profile
 ears=smooth(2.035,2.09,z)
 q[:,2]+=(z-2.05)*(s['ear_length']-1)*ears
 if key=='marwari':
  curl=smooth(2.09,2.19,z);q[:,0]-=np.sign(x)*.092*curl; q[:,1]-=.025*curl
 # Broader hooves expand about each foot rather than widening the stance.
 hoof=1-smooth(.13,.22,z)
 q[:,0]+=(x-lateral_center)*(s['hoof_width']-1)*hoof
 foot_y=np.where(y<.25,-.37,.95)
 q[:,1]+=(y-foot_y)*(s['hoof_width']-1)*hoof*.55
 return q[0] if one else q

def worldcoords(o):
 a=np.empty((len(o.data.vertices),3),dtype=np.float64);o.data.vertices.foreach_get('co',a.ravel());return a

def uv_positions(body,size=1024):
 """Rasterize original UV triangles once for coherent anatomical coat masks."""
 body.data.calc_loop_triangles();uv=body.data.uv_layers.active.data
 P=worldcoords(body);tex=np.zeros((size,size,3),np.float32);mask=np.zeros((size,size),bool)
 for tri in body.data.loop_triangles:
  u=np.array([uv[i].uv[:] for i in tri.loops])*(size-1)
  lo=np.maximum(0,np.floor(u.min(0)).astype(int));hi=np.minimum(size-1,np.ceil(u.max(0)).astype(int))
  if np.any(hi<lo):continue
  yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1];v0=u[1]-u[0];v1=u[2]-u[0];den=v0[0]*v1[1]-v1[0]*v0[1]
  if abs(den)<1e-8:continue
  px=xx-u[0,0];py=yy-u[0,1];a=(px*v1[1]-v1[0]*py)/den;b=(v0[0]*py-px*v0[1])/den;ok=(a>=-.01)&(b>=-.01)&(a+b<=1.01)
  pos=P[list(tri.vertices)];r=pos[0]+a[...,None]*(pos[1]-pos[0])+b[...,None]*(pos[2]-pos[0])
  part=tex[lo[1]:hi[1]+1,lo[0]:hi[0]+1];part[ok]=r[ok];mask[lo[1]:hi[1]+1,lo[0]:hi[0]+1]|=ok
 # Dilate seams using neighbors, so mipmaps never sample black UV gutters.
 for _ in range(5):
  for axis in (0,1):
   for step in (-1,1):
    nm=np.roll(mask,step,axis);take=~mask&nm;tex[take]=np.roll(tex,step,axis)[take];mask[take]=True
 return tex,mask

def coat_texture(key,positions,mask):
 color,hairkind,description=COATS[key];x,y,z=np.moveaxis(positions,-1,0)
 rgb=np.ones((*x.shape,3),np.float32)*np.array(color)
 # Fine coat grain plus broad warm/cool planes; dark points remain anatomical.
 grain=COAT_DETAIL*(.985+.015*np.sin(x*783+y*617+z*1039)*np.sin(y*983-z*769))
 plane=.83+.17*smooth(.7,1.6,z)+.045*np.sin(y*2.8+z*3.1)
 rgb*=np.clip(grain*plane,.60,1.13)[...,None]
 lower=1-smooth(.13,.54,z)
 bay=key in ('bay','palomino','pinto','appaloosa','stock','morgan','thoro','marwari','bay-sporthorse','clyde','akhal','fjord','iceland')
 if bay:rgb=rgb*(1-lower[...,None]*.88)+np.array((.027,.021,.016))*lower[...,None]*.88
 muzzle=smooth(1.14,1.29,-y)*(1-smooth(1.74,1.87,z));rgb=rgb*(1-muzzle[...,None]*.8)+np.array((.055,.05,.047))*muzzle[...,None]*.8
 if key in ('grey','welsh','percheron'):
  dapple=np.sin(x*38+np.sin(y*13))*np.sin(y*33+np.sin(z*16))*np.sin(z*31+np.cos(x*19))
  amount=smooth(-.15,.55,dapple)*smooth(.4,1.2,z)*.25
  rgb*=1-amount[...,None]
 if key in ('pinto','vanner'):
  field=np.sin(y*5.9+z*3.3)+.55*np.sin(y*11.1-z*5.4)+.5*np.cos(x*8.7+z*7.1)
  white=smooth(.13,.28,field);rgb=rgb*(1-white[...,None])+np.array((.84,.82,.76))*white[...,None]*grain[...,None]
 if key in ('knab','appaloosa'):
  field=np.sin(x*61+y*22+np.sin(z*13))*np.sin(y*53-z*12)*np.sin(z*49+x*9)
  spots=smooth(.55,.69,field)
  blanket=smooth(.35,.7,y)*smooth(.91,1.25,z) if key=='appaloosa' else np.ones_like(x)
  pale=np.array((.79,.78,.73))[None,None,:]*grain[...,None]
  marked=pale*(1-spots[...,None])+np.array((.047,.034,.026))*spots[...,None]
  rgb=rgb*(1-blanket[...,None])+marked*blanket[...,None]
 if key in ('fjord','iceland'):
  dorsal=(1-smooth(.016,.035,abs(x)))*smooth(1.45,1.54,z);rgb*=1-.69*dorsal[...,None]
 if key in ('haflinger','clyde','shire','marwari','chestnut'):
  width=.035 if key in ('haflinger','clyde','shire') else .018
  blaze=(1-smooth(width,width+.012,abs(x)))*smooth(.99,1.07,-y)*smooth(1.66,1.75,z)*(1-smooth(1.98,2.03,z))
  rgb=rgb*(1-blaze[...,None])+np.array((.87,.83,.75))*blaze[...,None]
 if key in ('shire','clyde','vanner'):
  stockings=1-smooth(.30+.035*np.sin(y*16+x*23),.37+.035*np.sin(y*16+x*23),z)
  stockings*=smooth(.1,.145,z)
  rgb=rgb*(1-stockings[...,None])+np.array((.84,.81,.73))*stockings[...,None]
 # Hoof horn is anatomical, independent of the coat or presence of stockings.
 horn=1-smooth(.098,.122,z)
 horn_color=np.array((.19,.16,.12)) if key in ('vanner','shire','clyde','haflinger') else np.array((.048,.042,.034))
 rgb=rgb*(1-horn[...,None])+horn_color*horn[...,None]*(.90+.10*np.sin(y*145+x*112)**2)[...,None]
 rgba=np.ones((*x.shape,4),np.float32);rgba[:,:,:3]=np.clip(rgb,0,1);rgba[~mask,:3]=np.array(color)
 img=bpy.data.images.new(key+' coat • anatomical UV',width=x.shape[1],height=x.shape[0]);img.pixels.foreach_set(rgba.ravel());img.filepath_raw=str(OUT/(key+'-coat.png'));img.file_format='PNG';img.save();img.pack()
 return img

def material_color(mat,color):
 mat.diffuse_color=(*color,1)
 if mat.use_nodes:
  bs=mat.node_tree.nodes.get('Principled BSDF')
  if bs:bs.inputs['Base Color'].default_value=(*color,1)

def make_hair(hair,key,warp):
 # Original groom's strands are disjoint contiguous groups of nine, twelve and
 # thirteen triangular rings. Removing complete strands preserves their taper.
 mesh=hair.data;coords=worldcoords(hair);offset=0;remove=[];counts=[(960,27,'mane'),(260,36,'forelock'),(1200,39,'tail')]
 assert len(coords)==sum(n*size for n,size,_ in counts),len(coords)
 strand_index=0
 for count,size,kind in counts:
  for k in range(count):
   ids=np.arange(offset,offset+size);p=coords[ids].copy();root=p[:3].mean(0)
   # Keep the accepted dense mane/forelock. Cull only complete tail strands,
   # where overlapping geometry does not improve the recognizable silhouette.
   if kind=='tail' and k%3==0:remove.extend(ids.tolist())
   if kind=='mane':
    length=LONG_MANE.get(key,1.)
    p[:,2]=root[2]+(p[:,2]-root[2])*length
    if length>1:p[:,0]+=np.sign(p[:,0]+.001)*np.maximum(0,root[2]-p[:,2])*.32
    if key=='fjord':
     t=np.repeat(np.linspace(0,1,9),3)
     stripe=(k%11-5)/5*.025
     length=.10+.022*math.sin(np.clip((-root[1]-.28)/.76,0,1)*math.pi)
     p[:,0]=stripe+(p[:,0]-np.repeat(p.reshape(9,3,3).mean(1)[:,0],3))*1.8
     p[:,2]=root[2]+t*length;p[:,1]=root[1]+(p[:,1]-root[1])*.12
     for polygon in mesh.polygons[k*24:(k+1)*24]:polygon.material_index=0 if abs(stripe)<.010 else 3
   if kind=='forelock' and key=='akhal':p=root+(p-root)*.70
   if kind=='tail':
    if key in ('vanner','black','shire'):p[:,0]=root[0]+(p[:,0]-root[0])*1.35
    elif key=='akhal':p[:,0]=root[0]+(p[:,0]-root[0])*.62
   coords[ids]=p;offset+=size;strand_index+=1
 coords=warp(coords);coords[:,2]=np.maximum(coords[:,2],.014)
 mesh.vertices.foreach_set('co',coords.ravel());mesh.update()
 bm=bmesh.new();bm.from_mesh(mesh);bm.verts.ensure_lookup_table();bmesh.ops.delete(bm,geom=[bm.verts[i] for i in remove],context='VERTS');bm.to_mesh(mesh);bm.free()
 hc=HAIR_COLOR[COATS[key][1]]
 for i,m in enumerate(mesh.materials):
  m=m.copy();mesh.materials[i]=m;material_color(m,tuple(min(1,c*(.74+i*.18)) for c in hc))
  if key=='fjord' and i>=2:material_color(m,(.72,.62,.43))

def feather_mesh(rig,key,warp):
 amount=FEATHERS.get(key,0)
 if not amount:return None
 rng=random.Random(1391);verts=[];faces=[];groups=[]
 for leg in ('FL','FR','HL','HR'):
  side=-1 if leg.endswith('L') else 1;front=leg.startswith('F')
  p=rig.data.bones[leg+'.cannon'].head_local.copy();h=rig.data.bones[leg+'.hoof'].head_local.copy()
  # These positions already belong to the conformed rig, so strand placement
  # is native to each new lower limb; no second cage warp.
  for i in range(int(650*amount)):
   angle=rng.uniform(-math.pi,math.pi);rear=max(0,math.sin(angle));height=rng.uniform(.11,.31)*amount
   start=Vector((h.x+math.cos(angle)*(.035+.015*amount),h.y+math.sin(angle)*.050,h.z+height))
   end=Vector((h.x+math.cos(angle)*(.080+.040*amount),h.y+math.sin(angle)*(.095+.04*amount),max(.014,h.z-.070+rng.uniform(-.014,.03))))
   base=len(verts);weight=leg+('.cannon' if start.z>h.z+.11 else '.pastern')
   for j in range(5):
    t=j/4;point=start.lerp(end,t);point.y+=.025*math.sin(t*math.pi);radius=.0022*(1-t*.94)
    for k in range(3):
     a=k*math.tau/3;verts.append(point+Vector((math.cos(a)*radius,math.sin(a)*radius,0)));groups.append(weight)
   for j in range(4):
    for k in range(3):faces.append((base+j*3+k,base+j*3+(k+1)%3,base+(j+1)*3+(k+1)%3,base+(j+1)*3+k))
 mesh=bpy.data.meshes.new(key+' silky leg feather');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('HorseFeather',mesh);bpy.context.collection.objects.link(o)
 m=bpy.data.materials.new(key+' feather silk');m.use_nodes=True;material_color(m,(.70,.65,.54) if key in ('vanner','shire','clyde') else tuple(c*.75 for c in COATS[key][0]));m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.73;mesh.materials.append(m)
 for p in mesh.polygons:p.use_smooth=True
 for name in set(groups):o.vertex_groups.new(name=name).add([i for i,n in enumerate(groups) if n==name],1,'REPLACE')
 o.parent=rig;mod=o.modifiers.new('Breed feather anatomy','ARMATURE');mod.object=rig
 return o

def gltfpoint(p):return [float(p[0]),float(p[2]),float(-p[1])]

def build(key,positions,mask):
 bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
 body=bpy.data.objects['Artist body — preserved quad topology'];hair=bpy.data.objects['Groom — individual geometry strands'];rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==rig]
 for o in list(bpy.context.scene.objects):
  if o not in objects and o!=rig:bpy.data.objects.remove(o,do_unlink=True)
 body.name='HorseBody';hair.name='HorseGroom';rig.name='HorseRig'
 rig.animation_data_clear()
 for a in list(bpy.data.actions):bpy.data.actions.remove(a)
 for pb in rig.pose.bones:
  pb.location=(0,0,0);pb.rotation_quaternion=(1,0,0,0);pb.scale=(1,1,1)
  for c in pb.constraints:c.influence=0
 if key=='bay-sporthorse':
  source_key='sport';spec=json.loads(json.dumps(CONF['conformations'][source_key]));s={k:1 for k in spec['sculpt_targets']};s['face_profile_depth_per_withers']=0;s['neck_arch_rise_per_withers']=.022;s['body_length']=1.015;s['limb_length']=1.02;spec['sculpt_targets']=s;spec['height']['target_m']=1.64;label='Bay Sporthorse'
 else:spec=CONF['conformations'][key];s=spec['sculpt_targets'];label=CONF['roster'][key]['label']
 P=worldcoords(body);raw=deform(P,s,key)
 # Measure the actual top of the withers, excluding the neck and mane.
 wm=(abs(P[:,0])<.075)&(P[:,1]>-.16)&(P[:,1]<-.07)&(P[:,2]>1.30)
 raw_withers=float(raw[wm,2].max());ground=float(raw[:,2].min());withers=spec['height']['target_m'];scale=withers/(raw_withers-ground)
 def warp(p):
  q=deform(p,s,key);q[...,2]-=ground;return q*scale
 for o in objects:
  if o==hair:continue
  q=warp(worldcoords(o));o.data.vertices.foreach_set('co',q.ravel());o.data.update()
 make_hair(hair,key,warp)
 # Every rest joint follows the same spatial cage, including IK goals and ears.
 bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
 for b in rig.data.edit_bones:
  a=warp(np.array(b.head[:]));c=warp(np.array(b.tail[:]));b.head=a;b.tail=c;b.align_roll(Vector((1,0,0)))
 bpy.ops.object.mode_set(mode='OBJECT')
 feather=feather_mesh(rig,key,warp)
 if feather:objects.append(feather)
 img=coat_texture(key,positions,mask);mat=body.data.materials[0].copy();body.data.materials.clear();body.data.materials.append(mat);mat.name=key+' authored coat'
 bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(1,1,1,1);bs.inputs['Roughness'].default_value=.46 if key=='akhal' else .68
 for link in list(mat.node_tree.links):
  if link.to_socket==bs.inputs['Base Color']:mat.node_tree.links.remove(link)
 tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=img;mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
 bs.inputs['Metallic'].default_value=.13 if key=='akhal' else 0
 scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=1;scene.frame_end=97
 # Rebase animation onto each changed rest skeleton. Faster locomotion is driven
 # by the named runtime anatomical solver, not inherited incompatible keyframes.
 actions=[]
 for name,frames in [('Rest',(1,2)),('Idle',range(1,98,3))]:
  a=bpy.data.actions.new(name);a.use_fake_user=True;rig.animation_data_create();rig.animation_data.action=a
  for frame in frames:
   scene.frame_set(frame);phase=(frame-1)/96*math.tau
   for pb in rig.pose.bones:
    pb.location=(0,0,0);pb.rotation_quaternion=(1,0,0,0)
    if name=='Idle':
     angle={'neck.lower':.005,'neck.upper':-.006,'head':.003,'ear.L':.032,'ear.R':-.027,'tail.1':.014,'tail.2':.018,'tail.3':.021,'tail.4':.024}.get(pb.name,0)
     axis=(0,1,0) if pb.name.startswith(('tail','ear')) else (0,0,1);pb.rotation_quaternion=Quaternion(axis,angle*math.sin(phase))
    pb.keyframe_insert('location',frame=frame);pb.keyframe_insert('rotation_quaternion',frame=frame)
  actions.append(a)
 rig.animation_data.action=actions[0];scene.frame_set(1);bpy.context.view_layer.update()
 for pb in rig.pose.bones:pb.location=(0,0,0);pb.rotation_quaternion=(1,0,0,0)
 # Surface-fit the saddle onto the transformed back, with native +Z anchors.
 Q=worldcoords(body);saddle_mask=(abs(P[:,0])<.07)&(P[:,1]>.04)&(P[:,1]<.20)&(P[:,2]>1.25)
 back=Q[saddle_mask];saddle=np.array((0,float(np.median(back[:,1])),float(back[:,2].max()+.012)))
 head=warp(np.array((0,-1.075,1.88)));poll=warp(np.array((0,-.97,2.03)));muzzle=warp(np.array((0,-1.28,1.70)))
 anchors={n:[gltfpoint(p)] for n,p in {'saddle':saddle,'withers':warp(np.array((0,-.18,raw_withers))),'head':head,'poll':poll,'muzzle':muzzle,'crest':warp(np.array((0,-.62,1.88))),'tail':warp(np.array((0,1.13,1.44)))}.items()}
 anchors['withers']=[[0,withers,float(-np.mean(Q[wm,1]))]]
 anchors['eyes']=[gltfpoint(warp(np.array((side*.102,-1.047,1.938)))) for side in (-1,1)]
 anchors['nostrils']=[gltfpoint(warp(np.array((side*.075,-1.274,1.741)))) for side in (-1,1)]
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=rig
 filepath=OUT/(key+'.glb');params={'filepath':str(filepath),'export_format':'GLB','use_selection':True,'export_animations':True,'export_yup':True,'export_force_sampling':True,'export_animation_mode':'ACTIONS','export_bake_animation':True,'export_frame_range':False,'export_skins':True,'export_all_influences':False,'export_anim_slide_to_zero':True,'export_current_frame':True}
 valid=bpy.ops.export_scene.gltf.get_rna_type().properties.keys();bpy.ops.export_scene.gltf(**{k:v for k,v in params.items() if k in valid})
 for image in bpy.data.images:
  if image.source=='FILE' and not image.packed_file:
   try:image.pack()
   except:pass
 bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(key+'.blend')),compress=True)
 triangles={o.name:sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects}
 sums=[];influences=[]
 for v in body.data.vertices:
  w=[g.weight for g in v.groups if g.weight>1e-7];sums.append(sum(w));influences.append(len(w))
 result={'id':key,'name':label,'label':label,'file':key+'.glb','artistBreed':True,'bodyMesh':'HorseBody','hairMesh':'HorseGroom','withersM':withers,'heightM':float(Q[:,2].max()),'fitScale':1.45/withers,'fitY':0,'anchors':anchors,'family':'breed','conformation':spec['morphology']['build'],'morphology':spec['morphology'],'coat':COATS[key][2],'sourceBasis':'Derivative of the user-approved b2przemo authored horse, CC BY 3.0','sha256':hashlib.sha256(filepath.read_bytes()).hexdigest(),'bodyGeometrySha256':hashlib.sha256(Q.astype('<f4').tobytes()).hexdigest(),'triangles':triangles,'jointCount':len(rig.data.bones),'clips':['Rest','Idle'],'groom':{'maneLengthFactor':LONG_MANE.get(key,1),'feathering':FEATHERS.get(key,0)},'validation':{'bodyVertices':len(Q),'finite':bool(np.isfinite(Q).all()),'maxWeightError':max(abs(a-1) for a in sums),'maxInfluences':max(influences),'actualWithersM':float(Q[wm,2].max()),'groundY':float(Q[:,2].min())}}
 (OUT/(key+'.json')).write_text(json.dumps(result,indent=2));print('BREED_READY',key,filepath.stat().st_size,result['validation'],flush=True)
 return result

def manifest():
 breeds={}
 for key in list(CONF['conformations'])+['bay-sporthorse']:
  path=OUT/(key+'.json')
  if path.exists():breeds[key]=json.loads(path.read_text())
 aliases={}
 for key,s in CONF['roster'].items():
  foundation=s['conformation_id']
  if foundation==key or foundation not in breeds:continue
  p=json.loads(json.dumps(breeds[foundation]));p.update(id=key,name=s['label'],label=s['label'],family='fantasy',foundation=foundation,coat='Fantasy coat applied by the ranch renderer',sourceBasis=s['mapping_basis']+' Approved authored '+breeds[foundation]['name']+' body.');breeds[key]=p;aliases[key]=foundation
 data={'version':3,'coordinates':'+Z forward, +Y up','canonicalWithers':1.45,'source':'../horse-candidates/b2przemo/rig-study/horse-rig-study.glb','sourceSha256':SOURCE_HASH,'author':'b2przemo','license':'CC BY 3.0','bodyMesh':'HorseBody','breeds':breeds,'aliases':aliases,'foundationCount':sum(k in breeds for k in CONF['conformations']),'rosterCount':len(breeds),'physicalModelCount':len({s['file'] for s in breeds.values()})}
 (OUT/'manifest.json').write_text(json.dumps(data,indent=2));return data

args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
keys=list(CONF['conformations'])+['bay-sporthorse']
if '--only' in args:keys=args[args.index('--only')+1].split(',')
if '--missing' in args:keys=[k for k in keys if not (OUT/(k+'.glb')).exists()]
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));positions,mask=uv_positions(bpy.data.objects['Artist body — preserved quad topology'])
# Recolor the accepted textured coat, retaining its fine hair and subtle surface
# tones instead of replacing the whole coat with a flat procedural color.
reference=bpy.data.images.load(str(BASE/'bay-study-albedo.png'),check_existing=False);reference.scale(1024,1024)
pixels=np.array(reference.pixels[:],dtype=np.float32).reshape(1024,1024,4)
lum=pixels[:,:,:3]@np.array((.2126,.7152,.0722))
blur=sum(np.roll(np.roll(lum,a,0),b,1) for a in (-9,-6,-3,0,3,6,9) for b in (-9,-6,-3,0,3,6,9))/49
body_mask=mask&(positions[:,:,2]>1)&(positions[:,:,1]>-.3)&(positions[:,:,1]<.8)
median=float(np.median(lum[body_mask]));COAT_DETAIL=np.clip(lum/np.maximum(blur,.008),.58,1.48)*(.50+.50*np.clip(lum/max(median,.01),.55,1.35))
for key in keys:
 build(key,positions,mask);manifest()
(OUT/'SOURCE.md').write_text('# Authored breed library\n\nOriginal horse mesh and UVs by **b2przemo**, licensed **Creative Commons Attribution 3.0**. Source: https://blendswap.com/blend/13903 . Original license, author and distribution archive are retained in `../horse-candidates/b2przemo/SOURCE.md` and its `source/` directory.\n\nThese are derivative works: breed conformation cages, adapted rest joints, coats, groom variations and lower-leg feather by this project. The approved original GLB is preserved unchanged and recorded by SHA-256 in the manifest. The 24 real breed bodies have different regional geometry, not only different colors. The additional Bay Sporthorse has its own athletic conformation. Fantasy identities inherit the named real foundation, with fantasy materials and appendages supplied by the game.\n\nRebuild with Blender 5.2: `blender --background --disable-autoexec --python tools/asset-gen/build-artist-breeds.py`. Each GLB has an editable `.blend`, coat PNG and profile JSON. `-- --only bay,black` builds selected breeds. `-- --missing` resumes missing builds. All models are +Z forward / +Y up, have a 40-joint named skeleton and neutral Rest and gentle Idle. Runtime movement is fitted to the new rest joints. Fast-gait art quality needs motion review; clip names or joint counts alone do not establish quality.\n')
result=manifest();assert hashlib.sha256((BASE/'rig-study/horse-rig-study.glb').read_bytes()).hexdigest()==SOURCE_HASH
print('ARTIST_BREEDS_COMPLETE',result['physicalModelCount'],result['rosterCount'],flush=True)

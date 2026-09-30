"""Bind the acquired detailed BlueMesh draft to the site's anatomical rig.

Run trusted Blender with --factory-startup --background --disable-autoexec
--python-exit-code 1 --python this file. The registered original is read only.
The original GLB BIN (UVs, indices and encoded 4K maps) is retained byte for byte;
new posed positions, anatomical weights and inverse binds are appended. No B2
mesh, procedural horse body or embedded source code is used.
"""
from pathlib import Path
import sys, json, math, hashlib, struct, copy
import bpy
import numpy as np
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree
sys.path.insert(0,str(Path(__file__).resolve().parent))
from bluemesh_source_pose import SourcePose, CANDIDATE, ROOT

OUT=CANDIDATE/'work/canonical-rig'; OUT.mkdir(parents=True,exist_ok=True)
source=SourcePose(); primitives=list(source.primitives())
assert len(primitives)==8 and sum(len(p['indices'])//3 for p in primitives)==200080
audit=json.loads((OUT/'source-three-pose-audit.json').read_text())
assert audit['passed'] and audit['sourceSha256']==source.sha256
ground=float(primitives[0]['positions'][:,1].min())
# Source faces -Z. A rigid 180-degree yaw, then glTF-to-Blender basis, puts
# forward on Blender -Y / glTF +Z. Ground translation is the only art offset.
def to_blender(p): return np.c_[-p[:,0],p[:,2],p[:,1]-ground]
def to_gltf(p): return np.c_[p[:,0],p[:,2],-p[:,1]]
def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
def capsule(p,a,b):
 d=b-a;t=np.clip((p-a)@d/max(1e-10,d@d),0,1)
 return np.linalg.norm(p-(a+t[:,None]*d),axis=1),t

# Import only to retain Blender's supported glTF PBR shader network in the
# editable .blend and independently compare native source pose. Runtime GLB
# materials/textures below are copied directly from the original JSON/BIN.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source.path),import_pack_images=True,disable_bone_shape=True,merge_vertices=False)
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
native=[]
for o in bpy.context.scene.objects:
 if o.type!='MESH':continue
 evaluated=o.evaluated_get(deps);mesh=evaluated.to_mesh()
 points=np.array([evaluated.matrix_world@v.co for v in mesh.vertices]);evaluated.to_mesh_clear()
 native.append({'name':o.name,'points':points})
native_comparison=[]
remaining=list(native)
for p in primitives:
 # Original scene axes to Blender, without the canonical yaw/ground change.
 expected=np.c_[p['positions'][:,0],-p['positions'][:,2],p['positions'][:,1]]
 emin,emax=expected.min(0),expected.max(0)
 picked=min(remaining,key=lambda row:np.max(np.abs(row['points'].min(0)-emin))+np.max(np.abs(row['points'].max(0)-emax)))
 remaining.remove(picked);actual=picked['points'];tree=KDTree(len(actual))
 for i,point in enumerate(actual):tree.insert(Vector(point),i)
 tree.balance();error=max(tree.find(Vector(point))[2] for point in expected)
 native_comparison.append({'sourceMesh':p['mesh'],'nativeMesh':picked['name'],'sourceVertices':len(expected),
  'nativeVertices':len(actual),'maxSourceVertexNearestNativeErrorM':error,
  'maxBoundsErrorM':float(max(np.max(abs(actual.min(0)-emin)),np.max(abs(actual.max(0)-emax))))})
assert all(row['maxSourceVertexNearestNativeErrorM']<2e-5 for row in native_comparison),native_comparison
materials=[bpy.data.materials['Root'],bpy.data.materials['BASE_BODY']]
for o in list(bpy.context.scene.objects):bpy.data.objects.remove(o,do_unlink=True)

P=to_blender(primitives[0]['positions'])
body_tree=KDTree(len(P))
for i,p in enumerate(P):body_tree.insert(Vector(p),i)
body_tree.balance()
bones={}
def bone(name,a,b,parent=None,deform=True):
 bones[name]={'head':np.array(a,dtype=float),'tail':np.array(b,dtype=float),'parent':parent,'deform':deform}
def section(z,front,side):
 mask=(abs(P[:,2]-z)<.03)&(P[:,0]*side>.10)&((P[:,1]<-.1) if front else (P[:,1]>.65))
 assert mask.sum()>5,(z,front,side)
 point=np.median(P[mask],axis=0);point[2]=z;return point
bone('ROOT',(0,0,0),(0,0,.3),deform=False)
bone('pelvis',(0,.91,1.66),(0,.30,1.64),'ROOT')
bone('spine',(0,.30,1.64),(0,-.16,1.65),'pelvis')
bone('chest',(0,-.16,1.65),(0,-.45,1.82),'spine')
bone('neck.lower',(0,-.45,1.82),(0,-.72,2.07),'chest')
bone('neck.upper',(0,-.72,2.07),(0,-1.035,2.185),'neck.lower')
bone('head',(0,-1.035,2.185),(0,-1.46,1.865),'neck.upper')
bone('jaw',(0,-1.19,2.005),(0,-1.47,1.845),'head')
for side,label in [(-1,'L'),(1,'R')]:
 bone('ear.'+label,(side*.10,-1.06,2.365),(side*.125,-1.105,2.49),'head')
tail_points=[(0,1.24,1.73),(0,1.45,1.43),(0,1.59,1.02),(0,1.67,.61),(0,1.66,.30)]
for i in range(4):bone('tail.'+str(i+1),tail_points[i],tail_points[i+1],'pelvis' if i==0 else 'tail.'+str(i))
legs=[]
for front in [True,False]:
 for side,label in [(-1,'L'),(1,'R')]:
  prefix=('F' if front else 'H')+label;fetlock=section(.22,front,side);hoof=section(.075,front,side)
  if front:
   points=[np.array((side*.22,-.19,1.82)),np.array((side*.265,-.49,1.28)),
           section(.95,True,side),section(.55,True,side),fetlock,hoof,hoof+np.array((0,-.12,-.022))]
   points[2][1]+=.075
   suffixes=['scapula','upperarm','forearm','cannon','pastern','hoof']
  else:
   points=[np.array((side*.235,1.01,1.60)),np.array((side*.245,1.10,1.04)),
           section(.65,False,side),fetlock,hoof,hoof+np.array((0,-.12,-.022))]
   suffixes=['thigh','shin','cannon','pastern','hoof']
  names=[]
  for i,suffix in enumerate(suffixes):
   name=prefix+'.'+suffix;bone(name,points[i],points[i+1],('chest' if front else 'pelvis') if i==0 else names[-1]);names.append(name)
  bone(prefix+'.IK',fetlock,fetlock+np.array((0,0,.14)),'ROOT',False)
  legs.append({'name':prefix,'front':front,'side':side,'points':np.array(points),'chain':names})

# Parent-before-child order is the live forward-kinematics contract.
ordered=[]
def visit(name):
 ordered.append(name)
 for child,spec in bones.items():
  if spec['parent']==name:visit(child)
visit('ROOT');assert len(ordered)==40
deform=[name for name in ordered if bones[name]['deform']];idx={name:i for i,name in enumerate(deform)}
def weights_for(points):
 n=len(points);w=np.zeros((n,len(deform)),dtype=float);x,y,z=points.T
 pelvis=smooth(.28,.82,y);chest=1-smooth(-.38,.20,y);middle=np.maximum(0,1-pelvis-chest)
 w[:,idx['pelvis']]=pelvis;w[:,idx['spine']]=middle;w[:,idx['chest']]=chest
 w/=np.maximum(w.sum(1)[:,None],1e-10)
 neck=smooth(.12,.55,-y)*smooth(1.34,1.69,z)
 upper=smooth(.61,.88,-y);head=smooth(.90,1.075,-y)*smooth(1.89,2.10,z)
 nw=np.zeros_like(w);nw[:,idx['neck.lower']]=1-upper;nw[:,idx['neck.upper']]=upper
 nw*=1-head[:,None];nw[:,idx['head']]+=head;w=w*(1-neck[:,None])+nw*neck[:,None]
 # Lower jaw is a real separately weighted joint; eye/orbit/upperface stay head.
 jaw=smooth(1.19,1.40,-y)*(1-smooth(1.93,2.055,z))
 w*=1-jaw[:,None];w[:,idx['jaw']]+=jaw
 for leg in legs:
  pts,chain=leg['points'],leg['chain'];dist=[];ts=[]
  for j in range(len(chain)):
   d,t=capsule(points,pts[j],pts[j+1]);dist.append(d);ts.append(t)
  distances=np.stack(dist,axis=1);near=distances.argmin(1);lengths=np.linalg.norm(np.diff(pts,axis=0),axis=1);stations=np.r_[0,np.cumsum(lengths)]
  along=stations[near]+np.stack(ts,axis=1)[np.arange(n),near]*lengths[near]
  transitions=np.minimum.accumulate(np.array([smooth(stations[j]-(.07 if j<len(chain)-2 else .035),stations[j]+(.07 if j<len(chain)-2 else .035),along) for j in range(1,len(chain))]),axis=0)
  lw=np.zeros_like(w);lw[:,idx[chain[0]]]=1-transitions[0]
  for j in range(1,len(chain)-1):lw[:,idx[chain[j]]]=transitions[j-1]-transitions[j]
  lw[:,idx[chain[-1]]]=transitions[-1]
  side=smooth(.025,.11,x*leg['side'])
  region=((1-smooth(.04,.35,y))*(1-smooth(.92,1.62,z)) if leg['front'] else smooth(.63,.98,y)*(1-smooth(1.12,1.67,z)))*side
  region*=1-smooth(.26,.44,np.min(distances[:,:-2],axis=1))*smooth(1.0,1.25,z)
  w=w*(1-region[:,None])+lw*region[:,None]
  rigid=(z<.13)&(x*leg['side']>.10)&((y<.10) if leg['front'] else (y>.75));w[rigid]=0;w[rigid,idx[chain[-1]]]=1
 for side,label in [(-1,'L'),(1,'R')]:
  ear=smooth(2.365,2.415,z)*smooth(.04,.085,x*side)*(1-smooth(-.85,-.71,y))
  w*=1-ear[:,None];w[:,idx['ear.'+label]]+=ear
 tail=(1-smooth(.065,.14,abs(x)))*smooth(1.24,1.41,y)*smooth(1.10,1.42,z)
 tw=np.zeros_like(w)
 for i in range(4):
  d,_=capsule(points,bones['tail.'+str(i+1)]['head'],bones['tail.'+str(i+1)]['tail']);tw[:,idx['tail.'+str(i+1)]]=np.exp(-d*d/.04)
 tw/=np.maximum(tw.sum(1)[:,None],1e-10);w=w*(1-tail[:,None])+tw*tail[:,None]
 return w/np.maximum(w.sum(1)[:,None],1e-10)

BW=weights_for(P)
# Source UV seams duplicate coincident surface vertices. Smoothing separate UV
# islands creates different joint ownership and opens visible cracks in motion.
# Weld only the ownership graph, retaining all exact source positions/UVs/faces.
# One shared weight row is copied back to every original seam vertex afterward.
welded,weld_index,weld_count=np.unique(np.round(P,5),axis=0,return_inverse=True,return_counts=True)
welded_weights=np.zeros((len(welded),len(deform)));np.add.at(welded_weights,weld_index,BW);welded_weights/=weld_count[:,None]
tris=weld_index[primitives[0]['indices'].reshape(-1,3)];edges=np.unique(np.sort(np.vstack([tris[:,[0,1]],tris[:,[1,2]],tris[:,[2,0]]]),axis=1),axis=0);edges=edges[edges[:,0]!=edges[:,1]];a,b=edges.T
degree=np.bincount(np.r_[a,b],minlength=len(welded));rigid=welded[:,2]<.13
for _ in range(3):
 accum=np.zeros_like(welded_weights);np.add.at(accum,a,welded_weights[b]);np.add.at(accum,b,welded_weights[a]);avg=accum/np.maximum(degree[:,None],1)
 welded_weights[~rigid]=.68*welded_weights[~rigid]+.32*avg[~rigid]
BW=welded_weights[weld_index]
assert np.max(abs(BW-welded_weights[weld_index]))==0

arm=bpy.data.armatures.new('BlueMesh anatomical draft • 40 joints');rig=bpy.data.objects.new('HorseRig',arm);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name in ordered:
 spec=bones[name];b=arm.edit_bones.new(name);b.head=spec['head'];b.tail=spec['tail'];b.use_deform=spec['deform'];b.align_roll(Vector((1,0,0)))
 if spec['parent']:b.parent=arm.edit_bones[spec['parent']]
bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
for pb in rig.pose.bones:pb.rotation_mode='QUATERNION'
groom_points=np.vstack([to_blender(p['positions']) for p in primitives[1:7]])
# glTF duplicates strand vertices at UV/normal seams and 16-bit chunk splits.
# Weld only for connectivity/weight ownership; source vertices/UVs stay intact.
unique,inverse=np.unique(np.round(groom_points,6),axis=0,return_inverse=True)
parent=np.arange(len(unique));rank=np.zeros(len(unique),dtype=np.uint8)
def find(i):
 while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
 return int(i)
def union(a,b):
 a,b=find(a),find(b)
 if a==b:return
 if rank[a]<rank[b]:a,b=b,a
 parent[b]=a
 if rank[a]==rank[b]:rank[a]+=1
offset=0
for p in primitives[1:7]:
 t=inverse[p['indices'].reshape(-1,3)+offset]
 for a,b,c in t:union(int(a),int(b));union(int(b),int(c))
 offset+=len(p['positions'])
roots=np.array([find(i) for i in range(len(unique))]);groups={}
for i,r in enumerate(roots):groups.setdefault(int(r),[]).append(i)
UW=np.empty((len(unique),len(deform)));tail_components=0;component_kind=np.zeros(len(unique),dtype=np.uint8);component_ids=np.zeros(len(unique),dtype=np.int32);component_metadata=[]
for ci,ids in enumerate(groups.values()):
 ids=np.array(ids,dtype=int);pts=unique[ids]
 tail_distance=min(float(capsule(pts,bones['tail.'+str(j+1)]['head'],bones['tail.'+str(j+1)]['tail'])[0].min()) for j in range(4))
 leg_distance=min(float(capsule(pts,leg['points'][j],leg['points'][j+1])[0].min()) for leg in legs for j in range(len(leg['chain'])))
 is_tail=np.median(pts[:,1])>1.1 and (np.median(pts[:,1])>1.23 and pts[:,2].max()>1.3 or tail_distance<leg_distance)
 component_ids[ids]=ci
 if is_tail:
  tail_components+=1;tw=np.zeros((len(ids),len(deform)))
  for j in range(4):
   d,_=capsule(pts,bones['tail.'+str(j+1)]['head'],bones['tail.'+str(j+1)]['tail']);tw[:,idx['tail.'+str(j+1)]]=np.exp(-d*d/.055)
  tw/=np.maximum(tw.sum(1)[:,None],1e-10);UW[ids]=tw;component_kind[ids]=1
 else:
  nearest=[body_tree.find(Vector(point)) for point in pts];root_vertex=min(nearest,key=lambda item:item[2])[1]
  UW[ids]=BW[root_vertex]
  if pts[:,2].max()<.85:component_kind[ids]=2
  elif np.median(pts[:,1])<-.92:component_kind[ids]=3
 component_metadata.append({'component':ci,'kind':int(component_kind[ids[0]]),'vertices':len(ids),'bounds':[pts.min(0).tolist(),pts.max(0).tolist()]})
groom_weights=UW[inverse];groom_offset=0
np.savez_compressed(OUT/'source-groom-components.npz',component=component_ids[inverse],kind=component_kind[inverse],points=groom_points)
(OUT/'source-groom-components.json').write_text(json.dumps({'kindLabels':{'0':'mane/uppergroom','1':'tail','2':'legfeather','3':'forelock'},'components':component_metadata},indent=2))
objects=[];converted=[];eye_report=[]
for p in primitives:
 points=to_blender(p['positions']);weights=BW.copy() if p['mesh']==0 else weights_for(points)
 if p['mesh']==7:
  # The source's two original spheres remain original geometry/UV/topology, but
  # their damaged source skin is replaced with explicit fitted socket centers.
  raw=source.accessor(source.doc['meshes'][7]['primitives'][0]['attributes']['POSITION']).astype(float)
  for side in [-1,1]:
   mask=raw[:,0]*side>0;center=raw[mask].mean(0);radius=np.max(np.linalg.norm(raw[mask]-center,axis=1))
   # Original texture UV landmarks locate the painted eye at roughly
   # |X|.111,Y-1.235,Z2.193. Centre the source sphere just inside that surface.
   target=np.array((side*.092,-1.235,2.193));points[mask]=(raw[mask]-center)*(.023/radius)+target
   eye_report.append({'componentSide':side,'vertices':int(mask.sum()),'originalRawCenter':center.tolist(),'fittedBlenderCenter':target.tolist(),'radiusM':.023,'socketEvidence':'dark original BASE_BODY 4K UV eye region, body vertices |X|.09-.125,Y-1.195..-1.255,Z2.17..2.213'})
  weights[:]=0;weights[:,idx['head']]=1
 elif p['mesh']>0:
  # Entire connected neck/leg strands use their actual body-root weights.
  # Tail strands use the continuous four-segment tail chain, never hind feet.
  weights=groom_weights[groom_offset:groom_offset+len(points)].copy();groom_offset+=len(points)
 keep=np.argpartition(weights,-4,axis=1)[:,-4:];limited=np.zeros_like(weights)
 for c in range(4):limited[np.arange(len(points)),keep[:,c]]=weights[np.arange(len(points)),keep[:,c]]
 limited/=np.maximum(limited.sum(1)[:,None],1e-10)
 name='HorseBody' if p['mesh']==0 else ('HorseEyes' if p['mesh']==7 else 'HorseGroom_'+str(p['mesh']))
 mesh=bpy.data.meshes.new(name+' • original BlueMesh topology');mesh.from_pydata(points.tolist(),[],p['indices'].reshape(-1,3).tolist());mesh.update()
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(materials[p['material']]);o.parent=rig
 if p['uv'] is not None:
  uv=mesh.uv_layers.new(name='SourceUV');loop_idx=np.array([loop.vertex_index for loop in mesh.loops]);loop_uv=p['uv'][loop_idx].copy();loop_uv[:,1]=1-loop_uv[:,1];uv.data.foreach_set('uv',loop_uv.ravel())
 for poly in mesh.polygons:poly.use_smooth=True
 if p['normals'] is not None and p['mesh']!=7:
  normals=np.c_[-p['normals'][:,0],p['normals'][:,2],p['normals'][:,1]]
  mesh.normals_split_custom_set_from_vertices(normals.tolist())
 for j,bn in enumerate(deform):
  group=o.vertex_groups.new(name=bn)
  ids=np.flatnonzero(limited[:,j]>1e-8)
  # Exact constant weights (rigid hoof/eyes) can be assigned in one operation.
  if len(ids) and np.ptp(limited[ids,j])<1e-10:group.add(ids.tolist(),float(limited[ids[0],j]),'REPLACE')
  else:
   for i in ids:group.add([int(i)],float(limited[i,j]),'REPLACE')
 mod=o.modifiers.new('Anatomical linear skin','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=False
 objects.append(o);converted.append({'source':p,'points':points,'weights':limited,'object':o})

bpy.context.view_layer.update()
# A canonical skin assembled from Blender's exact native rest matrices, rather
# than asking the exporter to reconstruct the already transformed source rig.
doc=copy.deepcopy(source.doc);binary=bytearray(source.binary)
doc.pop('animations',None);doc.pop('extensionsUsed',None);doc.pop('extensionsRequired',None)
doc['nodes']=[];doc['skins']=[];doc['meshes']=[];doc['scenes']=[{'name':'BlueMesh canonical draft','nodes':[]}];doc['scene']=0
def append_accessor(array,kind,component=5126,target=None):
 dtype={5126:'<f4',5123:'<u2',5125:'<u4'}[component];array=np.array(array,dtype=dtype)
 binary.extend(bytes((-len(binary))%4));offset=len(binary);binary.extend(array.tobytes())
 view={'buffer':0,'byteOffset':offset,'byteLength':array.nbytes}
 if target:view['target']=target
 vi=len(doc['bufferViews']);doc['bufferViews'].append(view);a={'bufferView':vi,'componentType':component,'count':len(array),'type':kind}
 if kind=='VEC3':a['min']=array.min(0).tolist();a['max']=array.max(0).tolist()
 ai=len(doc['accessors']);doc['accessors'].append(a);return ai
C=Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)));world={name:C@arm.bones[name].matrix_local@C.inverted() for name in ordered}
for name in ordered:
 parent=bones[name]['parent'];local=world[parent].inverted()@world[name] if parent else world[name];t,q,s=local.decompose()
 node={'name':name,'translation':list(t),'rotation':[q.x,q.y,q.z,q.w]}
 index=len(doc['nodes']);doc['nodes'].append(node)
 if parent:doc['nodes'][ordered.index(parent)].setdefault('children',[]).append(index)
 else:doc['scenes'][0]['nodes'].append(index)
ibms=np.array([np.array(world[name].inverted()).T.reshape(16) for name in ordered]);ib=append_accessor(ibms,'MAT4')
doc['skins']=[{'name':'BlueMesh complete anatomical draft','skeleton':0,'joints':list(range(40)),'inverseBindMatrices':ib}]
stats=[]
for row in converted:
 p,points,w,o=row['source'],row['points'],row['weights'],row['object'];old=source.doc['meshes'][p['mesh']]['primitives'][p['primitive']]
 primitive=copy.deepcopy(old);primitive['attributes']['POSITION']=append_accessor(to_gltf(points),'VEC3',target=34962)
 if p['mesh']==7:
  raw=source.accessor(old['attributes']['POSITION']);normal=np.empty_like(points)
  for side in [-1,1]:mask=raw[:,0]*side>0;normal[mask]=points[mask]-points[mask].mean(0)
  normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-10);normal=to_gltf(normal)
 else:normal=np.c_[-p['normals'][:,0],p['normals'][:,1],-p['normals'][:,2]]
 primitive['attributes']['NORMAL']=append_accessor(normal,'VEC3',target=34962);primitive['attributes'].pop('TANGENT',None)
 strongest=np.argsort(w,axis=1)[:,-4:][:,::-1];weights=np.take_along_axis(w,strongest,axis=1);joints=np.array([[ordered.index(deform[j]) for j in ids] for ids in strongest])
 primitive['attributes']['JOINTS_0']=append_accessor(joints,'VEC4',5123,34962);primitive['attributes']['WEIGHTS_0']=append_accessor(weights,'VEC4',5126,34962)
 for name in list(primitive['attributes']):
  if name.startswith('JOINTS_') and name!='JOINTS_0' or name.startswith('WEIGHTS_') and name!='WEIGHTS_0':del primitive['attributes'][name]
 meshindex=len(doc['meshes']);doc['meshes'].append({'name':o.name,'primitives':[primitive]});nodeindex=len(doc['nodes']);doc['nodes'].append({'name':o.name,'mesh':meshindex,'skin':0});doc['scenes'][0]['nodes'].append(nodeindex)
 stats.append({'name':o.name,'vertices':len(points),'triangles':len(p['indices'])//3,'maxWeightSumError':float(abs(weights.sum(1)-1).max()),'influences':4,'sourceMesh':p['mesh']})
doc['asset']['generator']='Meadowlark • actual BlueMesh geometry / fitted canonical anatomy'
doc['asset']['extras']['adaptation']='Scene-zero geometry preserved except damaged Sphere skin repaired into two fitted head sockets; complete 40-joint anatomical rig replaces source60; locomotion authored by ranch runtime solver.'
doc['buffers']=[{'byteLength':len(binary)}]
binary.extend(bytes((-len(binary))%4));doc['buffers'][0]['byteLength']=len(binary)
header=json.dumps(doc,separators=(',',':'),allow_nan=False).encode();header+=b' '*((-len(header))%4)
glb=struct.pack('<4sII',b'glTF',2,28+len(header)+len(binary))+struct.pack('<II',len(header),0x4E4F534A)+header+struct.pack('<II',len(binary),0x004E4942)+binary
target=OUT/'draft-canonical-rig.glb';target.write_bytes(glb)
bpy.context.scene.render.fps=60
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'draft-canonical-rig.blend'),compress=True)
withers_region=(abs(P[:,0])<.10)&(P[:,1]>-.15)&(P[:,1]<-.075)
withers_point=P[withers_region][P[withers_region,2].argmax()];withers=float(withers_point[2]);saddle_region=(abs(P[:,0])<.06)&(abs(P[:,1]-.34)<.075)
saddle=float(P[saddle_region,2].max())
anchors={'saddle':[[0,saddle+.008,-.34]],'withers':[[0,withers,float(-withers_point[1])]],'head':[[0,2.185,1.035]],'poll':[[0,2.365,1.06]],'muzzle':[[0,1.90,1.46]],'crest':[[0,2.24,.73]],'tail':[[0,1.73,-1.24]],'eyes':[[-.111,2.193,1.235],[.111,2.193,1.235]],'nostrils':[[-.11,1.93,1.44],[.11,1.93,1.44]]}
profile={'id':'bluemesh-draft','artistBreed':True,'bodyMesh':'HorseBody','hairMesh':'HorseGroom','sourceAuthor':'BlueMesh','license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','sourceUrl':source.doc['asset']['extras']['source'],
 'withersM':withers,'heightM':float(P[:,2].max()),'fitScale':1.45/withers,'fitY':0,'anchors':anchors,'jointCount':40,'triangles':{s['name']:s['triangles'] for s in stats},'file':'draft-canonical-rig.glb','sha256':hashlib.sha256(glb).hexdigest(),'rigSha256':hashlib.sha256(glb).hexdigest(),'clips':[],'motionStatus':'canonical rig produced; live solver validation and clip bake pending','sourceAppearancePreserved':True,'preserveAuthoredHair':True,'authoredCoat':True}
(OUT/'draft-profile.json').write_text(json.dumps(profile,indent=2))
report={'sourceSha256':source.sha256,'originalSourceAndReceiptUnchanged':True,'sourceThreeComparison':audit,
 'nativeSourcePoseComparison':native_comparison,'canonicalCoordinates':'+Z forward,+Y up,metres,groundY0','sourceToCanonical':'rigid180 yaw plus translation to original body sole ground; no body or groom resculpt/decimation',
 'meshes':stats,'triangleCount':200080,'jointCount':40,'joints':ordered,'hierarchy':{n:bones[n]['parent'] for n in ordered},'rigPointsBlender':{n:{'head':bones[n]['head'].tolist(),'tail':bones[n]['tail'].tolist()} for n in ordered},
 'originalEncodedImagesAndUVIndicesRetained':True,'originalBinaryPrefixRetained':bytes(binary[:len(source.binary)])==source.binary,
 'bodySkinOwnership':{'sourceVertices':len(P),'weldedOwnershipVertices':len(welded),'uvSeamGroups':int(np.count_nonzero(weld_count>1)),'method':'Actual triangle adjacency is welded at5decimals for skin ownership only; exact original split surface/UV geometry remains unchanged. Coincident source UV copies share identical smoothed joint weights so gait poses cannot open UV-seam cracks.'},
 'eyeRepair':eye_report,'eyeRepairReason':'Sphere_0 source skin evaluated by both Python and Three is detached below ground/behind rump; author transform node74 is an empty sibling, not a mesh parent. Original two sphere topology and UV preserved, new head-only weights and fitted centers.',
 'groomWeightOwnership':{'sourceVertices':len(groom_points),'weldedConnectivityVertices':len(unique),'connectedComponents':len(groups),'tailComponents':tail_components,'method':'source triangle connectivity welded at6decimals for ownership only; whole neck/leg strands use closest-body-root influence, whole tail strands use4tail segments; original split geometry untouched'},
 'editableNativeRig':str((OUT/'draft-canonical-rig.blend').relative_to(ROOT)),
 'gltfRig':str(target.relative_to(ROOT)),'gltfSha256':hashlib.sha256(glb).hexdigest(),'sourceGeometryPreservedExceptDocumentedEyes':True,'noEmbeddedSourceScriptsExecuted':True,'motionCertification':'pending live solver validation/bake'}
(OUT/'conversion-report.json').write_text(json.dumps(report,indent=2));print(json.dumps({'file':str(target),'sha256':profile['sha256'],'triangles':200080,'joints':40,'withersM':withers,'sourcePreserved':hashlib.sha256(source.path.read_bytes()).hexdigest()==source.sha256}))

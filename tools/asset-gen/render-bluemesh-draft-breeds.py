"""Render actual candidate breed GLB vertices/materials and exact baked poses.

Use the verified portable Blender with factory startup/disable-autoexec. The
glTF importer supplies only supported local PBR material networks. The owned
numeric GLB parser reconstructs actual evaluated geometry and normals, avoiding
importer bone-frame/animation ambiguity. Camera/lights/floor are view only.
"""
from pathlib import Path
import sys, json, hashlib, copy, math
import bpy
import numpy as np
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from draft_glb_tools import GLB, quaternion_matrix, gltf_to_blender
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/models/horse-imports/bluemesh-draft/game/breeds'
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
keys=args[0].split(',') if args else ['vanner','percheron','shire','clyde','suffolk']
requested=args[1].split(',') if len(args)>1 else ['Rest']
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()

for key in keys:
 folder=OUT/key;p=json.loads((folder/'profile.json').read_text());file=folder/p['file'];g=GLB(file);d=g.doc
 assert digest(file)==p['sha256'];bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(file),import_pack_images=True,disable_bone_shape=True,merge_vertices=False)
 # Local source maps, or explicitly authored derivative maps, only. No scripts,
 # drivers or network references are evaluated in this material-only import.
 mats=[]
 for mat in d['materials']:
  material=bpy.data.materials.get(mat['name'])
  if material is None:
   # glTFImporter omits wholly unused material records. Keep their table slots
   # without inventing texture content; no actual triangle uses this fallback.
   material=bpy.data.materials.new(mat['name']);material.use_nodes=True
   material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=mat.get('pbrMetallicRoughness',{}).get('baseColorFactor',[1,1,1,1])
  mats.append(material)
 material_images=[{'name':im.name,'bytes':len(im.packed_file.data) if im.packed_file else 0} for im in bpy.data.images if im.name not in ['Render Result','Viewer Node']]
 for o in list(bpy.context.scene.objects):bpy.data.objects.remove(o,do_unlink=True)
 joints=d['skins'][0]['joints'];ibm=g.accessor(d['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
 poses_data=json.loads((folder/'review-poses.json').read_text()) if (folder/'review-poses.json').exists() else None
 poses=[{'name':'Rest','time':0,'positions':None,'quaternions':None}]
 if poses_data:
  assert poses_data['animatedSha256']==p['sha256'];poses=poses_data['poses']
 renders=[];posebounds=[]
 for pose in poses:
  if pose['name'] not in requested:continue
  for o in list(bpy.context.scene.objects):bpy.data.objects.remove(o,do_unlink=True)
  if pose['positions'] is None:world={i:g.world(i) for i in joints}
  else:
   world={};assert poses_data['names']==[d['nodes'][i]['name'] for i in joints]
   for i,position,q in zip(joints,pose['positions'],pose['quaternions']):
    m=np.eye(4);m[:3,:3]=quaternion_matrix(q);m[:3,3]=position;parent=g.parents.get(i);world[i]=world[parent]@m if parent in world else m
  skin=np.array([world[i]@ibm[j] for j,i in enumerate(joints)]);bounds=[];meshes=[]
  for mesh in d['meshes']:
   # A split primitive shares original vertex attributes. Reconstruct the
   # complete original mesh once, assigning exact materials per triangle.
   first=mesh['primitives'][0];a=first['attributes'];pos=g.accessor(a['POSITION']).astype(float);normal=g.accessor(a['NORMAL']).astype(float);ji=g.accessor(a['JOINTS_0']).astype(int);we=g.accessor(a['WEIGHTS_0']).astype(float)
   hp=np.c_[pos,np.ones(len(pos))];posed=np.zeros((len(pos),3));n=np.zeros_like(normal)
   for influence in range(4):
    transform=skin[ji[:,influence]];posed+=np.einsum('nij,nj->ni',transform,hp)[:,:3]*we[:,influence,None];n+=np.einsum('nij,nj->ni',transform[:,:3,:3],normal)*we[:,influence,None]
   n/=np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-12)
   triangles=[];material_indices=[]
   for prim in mesh['primitives']:
    assert prim['attributes']==a;ids=g.accessor(prim['indices']).reshape(-1,3).astype(int);triangles.append(ids);material_indices.extend([prim['material']]*len(ids))
   triangles=np.vstack(triangles);used=np.unique(triangles);remap=np.full(len(pos),-1,int);remap[used]=np.arange(len(used));native=gltf_to_blender(posed[used]);native_normal=gltf_to_blender(n[used]);bounds.append(native)
   data=bpy.data.meshes.new(mesh['name']);data.from_pydata(native.tolist(),[],remap[triangles].tolist());data.update();o=bpy.data.objects.new(mesh['name'],data);bpy.context.scene.collection.objects.link(o)
   for mat in mats:data.materials.append(mat)
   for face,material in zip(data.polygons,material_indices):face.material_index=material;face.use_smooth=True
   if 'TEXCOORD_0' in a:
    uv=g.accessor(a['TEXCOORD_0'])[used].astype(float);uv[:,1]=1-uv[:,1];layer=data.uv_layers.new(name='Actual glTF UV');loop_vertex=np.array([loop.vertex_index for loop in data.loops]);layer.data.foreach_set('uv',uv[loop_vertex].ravel())
   data.normals_split_custom_set_from_vertices(native_normal.tolist())
   meshes.append({'mesh':mesh['name'],'referencedVertices':len(used),'triangles':len(triangles),'min':native.min(0).tolist(),'max':native.max(0).tolist()})
  points=np.vstack(bounds);assert np.isfinite(points).all();lo,hi=points.min(0),points.max(0);center=Vector((lo+hi)/2);size=max(hi-lo);posebounds.append({'pose':pose['name'],'time':pose['time'],'meshes':meshes,'min':lo.tolist(),'max':hi.tolist()})
  scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=28;scene.cycles.use_denoising=True;scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
  world_data=bpy.data.worlds.new('View-only studio');scene.world=world_data;world_data.use_nodes=True;world_data.node_tree.nodes['Background'].inputs[0].default_value=(.11,.13,.15,1);world_data.node_tree.nodes['Background'].inputs[1].default_value=.5
  cam_data=bpy.data.cameras.new('View-only camera');cam=bpy.data.objects.new('View-only camera',cam_data);scene.collection.objects.link(cam);scene.camera=cam;direction=Vector((-5,-7,3.8)).normalized();cam.location=center+direction*size*3;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam_data.type='ORTHO';bpy.context.view_layer.update();inv=cam.matrix_world.inverted();view=[]
  for x in [lo[0],hi[0]]:
   for y in [lo[1],hi[1]]:
    for z in [lo[2],hi[2]]:view.append(inv@Vector((x,y,z)))
  cam_data.ortho_scale=max(max(v.x for v in view)-min(v.x for v in view),(max(v.y for v in view)-min(v.y for v in view))*4/3)*1.13
  for name,offset,energy in [('Key',(-3,-4,6),40),('Fill',(4,-1,4),22),('Rim',(0,4,5),35)]:
   ld=bpy.data.lights.new('View-only '+name,'AREA');ld.energy=energy*size*size;ld.shape='DISK';ld.size=size*1.9;l=bpy.data.objects.new('View-only '+name,ld);scene.collection.objects.link(l);l.location=center+Vector(offset)*size/3;l.rotation_euler=(center-l.location).to_track_quat('-Z','Y').to_euler()
  s=size*5;fm=bpy.data.meshes.new('View-only floor');fm.from_pydata([(-s,-s,-.012),(s,-s,-.012),(s,s,-.012),(-s,s,-.012)],[],[(0,1,2,3)]);floor=bpy.data.objects.new('View-only floor',fm);scene.collection.objects.link(floor);mat=bpy.data.materials.new('View-only matte');mat.use_nodes=True;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.20,.22,.24,1);mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.92;fm.materials.append(mat)
  png=folder/(pose['name'].lower()+'-breed-preview.png');scene.render.filepath=str(png);bpy.ops.render.render(write_still=True);renders.append({'pose':pose['name'],'time':pose['time'],'png':str(png.relative_to(ROOT)),'sha256':digest(png),'bytes':png.stat().st_size,'renderedGlbSha256':p['sha256']})
 reportfile=folder/'breed-render-report.json';old=json.loads(reportfile.read_text()) if reportfile.exists() else {}
 # A partial rerender after re-rigging must never relabel old screenshots as
 # previews of the new skin. Only records from the same exact GLB may merge.
 previous={r['pose']:r for r in old.get('renders',[]) if r.get('renderedGlbSha256')==p['sha256']};previous.update({r['pose']:r for r in renders});previousbounds={r['pose']:r for r in old.get('poseBounds',[])} if old.get('renderedGlbSha256')==p['sha256'] else {};previousbounds.update({r['pose']:r for r in posebounds})
 report={'breed':key,'renderedGlbSha256':p['sha256'],'method':'Actual candidate GLB vertex attributes weighted by exact nodeWorld*inverseBind skin; source/explicit derivative PBR shaders supplied by local material-only Blender import; original source files unchanged.','geometryPoseIsDirectGLTFSkin':True,'materialsImages':material_images,'studioOnlyCameraLightingFloor':True,'poseBounds':list(previousbounds.values()),'renders':list(previous.values()),'visualReview':'pending actual PNG inspection','runtimeBrowserReview':'pending','motionStatus':p['motionStatus']}
 reportfile.write_text(json.dumps(report,indent=2));print(json.dumps({'breed':key,'renders':renders}),flush=True)

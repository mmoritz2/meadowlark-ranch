"""Apply the Akhal-only neck/head mask correction to the current saved library."""
import ast,bpy,hashlib,json,pathlib,struct,sys,copy
import numpy as np
from mathutils import Vector,Matrix,Quaternion

ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'assets/models/breeds'
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent));import equine_anatomy as anatomy
# Reuse the exact full-build conformation field and glTF rig writer without
# executing the author's full 24-model reconstruction/bake pipeline.
tree=ast.parse((pathlib.Path(__file__).with_name('build_breed_horses.py')).read_text())
names={'smooth','gauss','gltf_point','warp','read_glb','preserve_rig_and_share_textures'}
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),'breed-authoring-functions','exec'))
ANATOMY_V2=True
manifest=json.loads((OUT/'manifest.json').read_text());entry=manifest['breeds']['akhal'];oldp=entry['params'].copy();newp=oldp.copy();newp['separateHeadGate']=True
backup=ROOT/'output/akhal-before-head-gate';backup.mkdir(exist_ok=True)
for name in ('akhal.glb','manifest.json'):(backup/name).write_bytes((OUT/name).read_bytes())
unchanged={k:hashlib.sha256((OUT/v['file']).read_bytes()).hexdigest() for k,v in manifest['breeds'].items() if k!='akhal'}
bpy.ops.wm.open_mainfile(filepath=str(OUT/'breed-library.blend'))
reference=bpy.data.objects['Authoring reference - retained original'];original_arm=reference.parent
bones={b.name:(np.array(b.head_local[:]),np.array(b.tail_local[:]),0) for b in original_arm.data.bones}
ORIG,ORIGBIN=read_glb(ROOT/'assets/models/horse_textured_rigged.glb')
horse=bpy.data.objects['akhal_body'];arm=bpy.data.objects['akhal_skeleton'];coords=np.array([v.co[:] for v in horse.data.vertices])
# Invert the preceding continuous field at the existing vertices, retaining its
# exact topology, UVs, weights and all authored detail attachments.
raw=coords.copy();eps=1e-5
for _ in range(12):
    mapped=warp(raw,oldp);error=mapped-coords
    if np.max(np.abs(error))<2e-8:break
    jac=np.stack([(warp(raw+np.eye(3)[i]*eps,oldp)-mapped)/eps for i in range(3)],axis=2)
    step=np.linalg.solve(jac,error[...,None])[...,0];raw-=np.clip(step,-.15,.15)
residual=float(np.max(np.linalg.norm(warp(raw,oldp)-coords,axis=1)))
if residual>1e-5:raise RuntimeError('Old conformation inversion did not converge: '+str(residual))
updated=coords+(warp(raw,newp)-warp(raw,oldp))
for v,p in zip(horse.data.vertices,updated):v.co=p
anatomy.clean_export(horse)
bpy.ops.object.select_all(action='DESELECT');arm.hide_set(False);arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
for b in arm.data.edit_bones:
    direction=b.tail-b.head;b.use_connect=False;b.head=Vector(warp([bones[b.name][0]],newp)[0]);b.tail=b.head+direction
bpy.ops.object.mode_set(mode='OBJECT')
for name,points in manifest['sourceAnchors'].items():
    original=[[x,-z,y] for x,y,z in points];entry['anchors'][name]=[gltf_point(p) for p in warp(original,newp)]
pts=np.array([v.co[:] for v in horse.data.vertices]);lo=pts.min(axis=0);hi=pts.max(axis=0)
entry['params']=newp;entry['bounds']={'min':gltf_point((lo[0],hi[1],lo[2])),'max':gltf_point((hi[0],lo[1],hi[2]))}
entry['dimensionsSource'].update({'length':float(hi[0]-lo[0]),'width':float(hi[1]-lo[1]),'height':float(hi[2]-lo[2])})
entry['geometry'].update({'vertices':len(pts),'triangles':sum(len(f.vertices)-2 for f in horse.data.polygons),'sha256':hashlib.sha256(np.round(pts,7).tobytes()).hexdigest()})
entry['authoringNote']='Akhal head/muzzle is isolated from narrow neck thickness; other 23 breeds unchanged.'
bpy.ops.object.select_all(action='DESELECT');horse.hide_set(False);horse.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=horse
tmp=OUT/'akhal-repair.glb';bpy.ops.export_scene.gltf(filepath=str(tmp),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_skins=True,export_all_influences=False,export_materials='EXPORT',export_tangents=True)
preserve_rig_and_share_textures(tmp,newp);tmp.replace(OUT/'akhal.glb');entry['geometry']['bytes']=(OUT/'akhal.glb').stat().st_size
scene=bpy.context.scene;cam=scene.camera;floor=bpy.data.objects['Review floor']
for key in manifest['breeds']:
    bpy.data.objects[key+'_body'].hide_render=key!='akhal';bpy.data.objects[key+'_skeleton'].hide_render=key!='akhal'
floor.location.z=lo[2]-.003;centre=Vector(((lo[0]+hi[0])/2,0,(lo[2]+hi[2])/2))
def shot(name,centre,offset,scale):
    cam.location=centre+Vector(offset);cam.rotation_euler=(centre-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale
    scene.render.filepath=str(OUT/'review'/('akhal-'+name+'.png'));bpy.ops.render.render(write_still=True)
scale=max(float(hi[0]-lo[0])*1.23,float(hi[2]-lo[2])*1.6)
shot('side',centre,(0,-4.5,.15),scale);shot('three-quarter',centre,(2.4,-4.4,.70),scale)
head=Vector(warp([[.805,-.08,.575]],newp)[0])
for name,off in [('head-side',(0,-4,.03)),('head-quarter',(2,-4,.35)),('head-front',(4,0,.04))]:shot(name,head,off,.95)
physical=entry['fitScale']*entry['withersM']/1.45;arm.scale=(physical,)*3;arm.location.z=-lo[2]*physical;floor.location.z=-.003
shot('scale',Vector((0,0,1.34)),(0,-5,0),3.65);arm.scale=(1,1,1);arm.location=(0,0,0)
for key in manifest['breeds']:
    bpy.data.objects[key+'_body'].hide_render=key!='bay';bpy.data.objects[key+'_skeleton'].hide_render=key!='bay'
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'breed-library.blend'))
tmp=OUT/'manifest.json.tmp';tmp.write_text(json.dumps(manifest,indent=2));tmp.replace(OUT/'manifest.json')
assert all(hashlib.sha256((OUT/manifest['breeds'][k]['file']).read_bytes()).hexdigest()==h for k,h in unchanged.items())
(ROOT/'output/akhal-head-gate-metrics.json').write_text(json.dumps({'inverseResidual':residual,'other23ByteIdentical':True,'maximumVertexChange':float(np.max(np.linalg.norm(updated-coords,axis=1))),'fitPreserved':True},indent=2))
print('AKHAL_HEAD_GATE_READY',residual,flush=True)

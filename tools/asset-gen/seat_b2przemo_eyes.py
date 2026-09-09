"""Correct only the four eye objects; body and groom stay frozen for rigging."""
import bpy,pathlib,json
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'assets/models/horse-candidates/b2przemo';REVIEW=ROOT/'output/horse-reset/b2przemo-finished'
if json.loads((OUT/'finished-study-manifest.json').read_text()).get('eyeCorrection'):
    print('Eye correction already present; rebuild the finish first to apply a new correction.')
    raise SystemExit(0)
bpy.ops.wm.open_mainfile(filepath=str(OUT/'horse-finished-study.blend'))
eye=bpy.data.objects['Seated left eye'];s=(max(v.co.y for v in eye.data.vertices)-min(v.co.y for v in eye.data.vertices))/.05
meta=json.loads((OUT/'finished-study-manifest.json').read_text());head=meta['headCenter'];cx=1.116-head[2]/s;cy=-head[0]/s;loz=1.660-head[1]/s
changes=[]
for name,side in [('Seated left eye',-1),('Seated right eye',1)]:
    obj=bpy.data.objects[name];centre=sum((v.co for v in obj.data.vertices),Vector())/len(obj.data.vertices)
    shift=Vector((-side*.008*s,.004*s,-.008*s))
    for v in obj.data.vertices:
        delta=v.co-centre;v.co=centre+shift+Vector((delta.x*(.015/.018),delta.y*(.026/.025),delta.z*(.014/.013)))
    obj.data.update();changes.append({'object':name,'blenderShift':list(shift),'radiusRatios':[.015/.018,.026/.025,.014/.013]})
for name,side in [('Horizontal pupil -1',-1),('Horizontal pupil 1',1)]:
    obj=bpy.data.objects[name];shift=Vector((-side*.011*s,.004*s,-.008*s))
    for v in obj.data.vertices:v.co+=shift
    obj.data.update();changes.append({'object':name,'blenderShift':list(shift)})
iris=bpy.data.materials['Warm dark brown iris and cornea'].node_tree.nodes.get('Principled BSDF')
iris.inputs['Base Color'].default_value=(.04,.012,.004,1);iris.inputs['Specular IOR Level'].default_value=.175;iris.inputs['Coat Weight'].default_value=.15;iris.inputs['Roughness'].default_value=.23;iris.inputs['Coat Roughness'].default_value=.22
pupil=bpy.data.materials['Horizontal equine pupil'].node_tree.nodes.get('Principled BSDF');pupil.inputs['Specular IOR Level'].default_value=.10;pupil.inputs['Roughness'].default_value=.23
# Bring the original artist-review lights into the normalized horse coordinate system.
def normalized(p):return Vector(((p.y-cy)*s,-(p.x-cx)*s,(p.z-loz)*s))
def aim(o,p):o.rotation_euler=(p-o.location).to_track_quat('-Z','Y').to_euler()
for o in bpy.context.scene.objects:
    if o.type=='LIGHT':
        oldTarget=o.location+o.rotation_euler.to_matrix()@Vector((0,0,-1));o.location=normalized(o.location);aim(o,normalized(oldTarget));o.data.energy*=s*s;o.data.size*=s
cam=bpy.context.scene.camera;target=Vector((head[0],-head[2],head[1]));scene=bpy.context.scene
for view,offset in [('head-quarter',(-4,-2,.10)),('head-opposite',(4,-2,.10)),('head-front',(0,-4,.02))]:
    cam.location=target+Vector(offset);aim(cam,target);cam.data.ortho_scale=.88;scene.render.filepath=str(REVIEW/(view+'.png'));bpy.ops.render.render(write_still=True)
objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=bpy.data.objects['Artist body — preserved quad topology']
bpy.ops.export_scene.gltf(filepath=str(OUT/'horse-finished-study.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'horse-finished-study.blend'))
meta['eyeCorrection']={'reason':'UV and geometry located the actual socket deeper and lower; reduced outward projection and specular glare','bodyGroomChanged':False,'objectChanges':changes,'irisSpecularFactor':.35,'irisRoughness':.23,'irisClearcoat':.15}
(OUT/'finished-study-manifest.json').write_text(json.dumps(meta,indent=2));print('EYES_SEATED',json.dumps(meta['eyeCorrection']),flush=True)

import bpy,json,pathlib
from io_scene_fbx import import_fbx
# Blender 5.2 removed a Cycles lamp property used by legacy FBX import.
# Lights are immaterial to mesh inspection; substitute a fresh point light only in this process.
import_fbx.blen_read_light=lambda *args,**kwargs:bpy.data.lights.new('Legacy lamp placeholder',type='POINT')
root=pathlib.Path('C:/Users/msmor/Desktop/star_ranch_fable/assets/models/horse-candidates/b2przemo/source/ylikuutio')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(root/'horse.fbx'))
print(json.dumps({'objects':[{'name':o.name,'type':o.type,'vertices':len(o.data.vertices) if o.type=='MESH' else None,'polys':len(o.data.polygons) if o.type=='MESH' else None,'dimensions':list(o.dimensions),'bounds':list(o.location),'rotation':list(o.rotation_euler),'scale':list(o.scale)} for o in bpy.context.scene.objects],'images':[{'name':i.name,'size':list(i.size),'filepath':i.filepath} for i in bpy.data.images]},indent=2))
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
 if o.type=='MESH':o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(root/'horse-dense-reference.glb'),export_format='GLB',use_selection=True)

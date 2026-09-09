"""CPU close-up renders of the real bridle module geometry and native horse sources."""
import bpy,json,pathlib,sys
from mathutils import Vector
root=pathlib.Path(__file__).resolve().parent.parent
out=pathlib.Path(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv else root/'output/artist-bridle-native'
out=out.resolve()
for key in ['bay-sporthorse','chestnut','shire']:
 data=json.loads((out/(key+'.json')).read_text())
 bpy.ops.wm.open_mainfile(filepath=str(root/'assets/models/artist-breeds'/(key+'.blend')))
 scene=bpy.context.scene
 for obj in list(scene.objects):
  if obj.type in ['LIGHT','CAMERA']:bpy.data.objects.remove(obj,do_unlink=True)
 for entry in data['meshes']:
  mesh=bpy.data.meshes.new(entry['name']);idx=entry['indices'];mesh.from_pydata(entry['positions'],[],[idx[i:i+3] for i in range(0,len(idx),3)]);mesh.update()
  obj=bpy.data.objects.new(entry['name'],mesh);scene.collection.objects.link(obj)
  for p in mesh.polygons:p.use_smooth=True
  mat=bpy.data.materials.new(entry['name']);mat.use_nodes=True;p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*entry['material']['color'],1);p.inputs['Metallic'].default_value=entry['material']['metalness'];p.inputs['Roughness'].default_value=entry['material']['roughness'];obj.data.materials.append(mat)
 def native(v):return Vector((v[0],-v[2],v[1]))
 M=native(data['profile']['anchors']['muzzle'][0]);P=native(data['profile']['anchors']['poll'][0]);target=M.lerp(P,.48);length=(P-M).length
 def aim(o,p):o.rotation_euler=(p-o.location).to_track_quat('-Z','Y').to_euler()
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32;scene.cycles.use_denoising=True
 scene.render.resolution_x=1000;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
 scene.world=bpy.data.worlds.new('Bridle QA sky');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.4,.45,.5,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.75
 scene.view_settings.view_transform='AgX'
 for offset,power,size in [((2,-3,3),500,3),((-3,-2,2),350,3),((2,3,3),550,2)]:
  bpy.ops.object.light_add(type='AREA',location=target+Vector(offset));o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;aim(o,target)
 bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=length*1.95;scene.camera=cam
 for view,offset in [('side',(3,0,.13)),('front',(0,-3,.10)),('quarter',(3,-3,.13))]:
  cam.location=target+Vector(offset);aim(cam,target);scene.render.filepath=str(out/(key+'-'+view+'.png'));bpy.ops.render.render(write_still=True)
print('ARTIST_BRIDLE_NATIVE_COMPLETE')

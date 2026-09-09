"""Render repeatable side and quarter art review of generated native models."""
import bpy,pathlib,sys,json
from mathutils import Vector
out=pathlib.Path(__file__).resolve().parent
keys=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['bay','chestnut','black','fjord','vanner','shire','sunset','akhal','knab','marwari']
for key in keys:
 bpy.ops.wm.open_mainfile(filepath=str(out/(key+'.blend')))
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
 scene.render.resolution_x=1100;scene.render.resolution_y=840;scene.render.resolution_percentage=100
 scene.world=bpy.data.worlds.new('Review soft sky');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.30,.34,.40,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
 scene.view_settings.view_transform='AgX';spec=json.loads((out/(key+'.json')).read_text());h=spec['heightM']
 def aim(o,p):o.rotation_euler=(p-o.location).to_track_quat('-Z','Y').to_euler()
 target=Vector((0,0,h*.51))
 for position,power,size in [((3,-4,5),650,4),((-3,-2,3),450,4),((2,3,4),750,3)]:
  bpy.ops.object.light_add(type='AREA',location=position);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;aim(o,target)
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.012));ground=bpy.context.object;mat=bpy.data.materials.new('Review ground');mat.diffuse_color=(.15,.17,.20,1);ground.data.materials.append(mat)
 bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=h*1.55;scene.camera=cam
 for view,offset in [('side',(4,0,.04)),('quarter',(4,-3,.18))]:
  cam.location=target+Vector(offset);aim(cam,target);scene.render.filepath=str(out/('review-'+key+'-'+view+'.png'));bpy.ops.render.render(write_still=True)
print('REVIEW_RENDER_COMPLETE')

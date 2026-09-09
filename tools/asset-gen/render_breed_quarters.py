"""Refresh full-body three-quarter reviews from the saved current library."""
import bpy,json,pathlib
from mathutils import Vector

root=pathlib.Path(__file__).resolve().parents[2]
folder=root/'assets/models/breeds'
bpy.ops.wm.open_mainfile(filepath=str(folder/'breed-library.blend'))
manifest=json.loads((folder/'manifest.json').read_text())
scene=bpy.context.scene;camera=scene.camera;floor=bpy.data.objects['Review floor']
for key in manifest['breeds']:
    bpy.data.objects[key+'_body'].hide_render=True
    bpy.data.objects[key+'_skeleton'].hide_render=True
for key in manifest['breeds']:
    horse=bpy.data.objects[key+'_body'];arm=bpy.data.objects[key+'_skeleton']
    horse.hide_render=False;horse.hide_set(False);arm.hide_render=False;arm.hide_set(False)
    points=[v.co for v in horse.data.vertices]
    lo=Vector([min(v[i] for v in points) for i in range(3)]);hi=Vector([max(v[i] for v in points) for i in range(3)])
    centre=Vector(((lo.x+hi.x)/2,0,(lo.z+hi.z)/2));floor.location.z=lo.z-.003
    camera.location=centre+Vector((2.4,-4.4,.70));camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=max((hi.x-lo.x)*1.23,(hi.z-lo.z)*1.6)
    scene.render.filepath=str(folder/'review'/(key+'-three-quarter.png'))
    bpy.ops.render.render(write_still=True)
    horse.hide_render=True;arm.hide_render=True
print('QUARTER_REVIEW_COMPLETE 24',flush=True)

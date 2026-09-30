"""Ordinary CPU renders of the approved paired feather wing on converted hosts."""
from pathlib import Path
import argparse
import hashlib
import json
import sys
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'assets/models/horse-imports/cgcookie-wings/game'
POSES=Path('/private/tmp/horse-import-tools/feather-wing-qa')

def render(host,pose,host_file_override=None):
    if not {'--factory-startup','--disable-autoexec'} <= set(sys.argv): raise RuntimeError('Safe startup flags required')
    if host not in ['wildmesh-white-western','ikkiz-unicorn'] or pose not in ['source-open','ground-folded','flight','landing']: raise ValueError('Only owned source components and host review poses')
    profile=json.loads((BASE/'profile.json').read_text());host_base=ROOT/'assets/models/horse-imports'/host/'game';host_profile=json.loads((host_base/'profile.json').read_text())
    host_file=host_base/(host_file_override or host_profile['file']);host_pose_file=POSES/('host-'+host+'-'+pose+'.glb');mounted_pose_file=POSES/('wing-'+host+'-'+pose+'.glb');pose_file=mounted_pose_file if mounted_pose_file.exists() else POSES/(pose+'.glb');game_sha=hashlib.sha256((BASE/'wings.glb').read_bytes()).hexdigest();host_sha=hashlib.sha256(host_file.read_bytes()).hexdigest()
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.use_scripts_auto_execute=False
    bpy.ops.import_scene.gltf(filepath=str(host_pose_file if host_pose_file.exists() else host_file),import_pack_images=True,disable_bone_shape=True)
    host_objects=set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(pose_file),import_pack_images=True,disable_bone_shape=True)
    wing_objects=set(bpy.context.scene.objects)-host_objects
    ratio=host_profile['withersM']/profile['referenceWithersM'];a=host_profile['anchors']['withers'][0]
    for o in wing_objects:
        if o.parent is None and not mounted_pose_file.exists(): o.scale*=ratio;o.location+=Vector((a[0],-a[2],a[1]))
    if bpy.data.texts or any(o.animation_data and o.animation_data.drivers for o in bpy.data.objects): raise RuntimeError('Unexpected executable content')
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];graph=bpy.context.evaluated_depsgraph_get();points=[o.matrix_world@v.co for o in meshes for v in o.evaluated_get(graph).data.vertices]
    low=Vector([min(p[i]for p in points)for i in range(3)]);high=Vector([max(p[i]for p in points)for i in range(3)]);center=(low+high)*.5;span=high-low;size=max(span)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
    scene.world=bpy.data.worlds.new('Neutral feather wing studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.18,.22,.27,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
    def aim(o): o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
    for label,offset,power in [('Key',(-1.3,-1.8,1.8),55),('Fill',(1.4,-.7,1),32),('Rim',(.6,1.2,2),85)]:
        data=bpy.data.lights.new(label,'AREA');data.energy=power*size*size;data.size=size;o=bpy.data.objects.new(label,data);scene.collection.objects.link(o);o.location=center+Vector(offset)*size;aim(o)
    data=bpy.data.cameras.new('Mounted feather component review');camera=bpy.data.objects.new(data.name,data);scene.collection.objects.link(camera);data.lens=55;data.sensor_width=36;data.sensor_fit='HORIZONTAL';direction=Vector((-1.15,-1.8,.85)).normalized();camera.location=center+direction;aim(camera);inv=camera.rotation_euler.to_matrix().transposed();relative=[inv@(p-center)for p in points];tx=data.sensor_width/(2*data.lens);ty=tx*.75;distance=max(max(abs(p.x)/tx+p.z,abs(p.y)/ty+p.z)for p in relative)*1.12;camera.location=center+direction*distance;data.clip_start=.001;data.clip_end=size*100;scene.camera=camera
    if pose!='flight':
        bpy.ops.mesh.primitive_plane_add(size=size*10,location=(0,0,-.006));floor=bpy.context.object;floor.name='Review floor, excluded from game';mat=bpy.data.materials.new('Neutral floor');mat.use_nodes=True;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.08,.10,.125,1);mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.8;floor.data.materials.append(mat)
    output=BASE/'review';output.mkdir(exist_ok=True);name=host+'-'+pose;scene.render.filepath=str(output/(name+'.png'));bpy.ops.render.render(write_still=True)
    r={'host':host,'pose':pose,'gameSha256':game_sha,'hostFile':host_file.relative_to(ROOT).as_posix(),'hostSha256':host_sha,'poseSha256':hashlib.sha256(pose_file.read_bytes()).hexdigest(),'image':(output/(name+'.png')).relative_to(ROOT).as_posix(),'ordinaryRender':True,'generativeToolsUsed':False,'sourceLongFeathersPerSide':48,'neutralFeatherMaterials':True,'originalMapsAbsent':True,'unverifiedDownStrandsOmitted':True,'bodyPose':'exact live40-joint host and chest-mounted wing pose evaluated by Three' if host_pose_file.exists() else 'converted host default rest; wing component evaluated by Three','wingScale':ratio,'mountWithers':a,'bounds':{'min':list(low),'max':list(high),'size':list(span)},'visualReview':'pending','mountedRiderIntegration':'pending'};(output/(name+'.json')).write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r),flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--host',required=True);p.add_argument('--pose',required=True);p.add_argument('--host-file');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);render(a.host,a.pose,a.host_file)

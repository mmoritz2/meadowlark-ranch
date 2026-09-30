"""Ordinary CPU Blender renders of exact Three-baked dragon review poses.

No source project, embedded script, driver or shader code is executed. Input is
the static review-only GLB produced by tools/qa-imported-dragon.mjs --write-poses.
The game GLB and acquisition receipt are preserved.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT/'assets/models/horse-imports/black-dragon/game'
POSES = Path('/private/tmp/horse-import-tools/dragon-rig-qa')


def render(name):
    if not {'--factory-startup', '--disable-autoexec'} <= set(sys.argv):
        raise RuntimeError('Safe startup flags required')
    if name not in ['source-rest-open', 'ground-folded', 'flight', 'landing']:
        raise ValueError('Only owned validated dragon poses are accepted')
    game_sha = hashlib.sha256((BASE/'dragon.glb').read_bytes()).hexdigest()
    source = ROOT/'assets/models/horse-imports/black-dragon/source/black_dragon_with_idle_animation.glb'
    source_sha = hashlib.sha256(source.read_bytes()).hexdigest()
    path = POSES/(name+'.glb')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.use_scripts_auto_execute = False
    bpy.ops.import_scene.gltf(filepath=str(path), import_pack_images=True, disable_bone_shape=True)
    if bpy.data.texts or any(o.animation_data and o.animation_data.drivers for o in bpy.data.objects):
        raise RuntimeError('Unexpected source executable content')
    mesh = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    points = [o.matrix_world@v.co for o in mesh for v in o.data.vertices]
    low, high = Vector([min(p[i] for p in points) for i in range(3)]), Vector([max(p[i] for p in points) for i in range(3)])
    center, span = (low+high)*.5, high-low
    scene = bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
    scene.world=bpy.data.worlds.new('Dragon rig studio');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.18,.22,.27,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
    def aim(o):o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
    size=max(span)
    for label,offset,power in [('Key',(-1.3,-1.8,1.8),55),('Fill',(1.4,-.7,1),32),('Rim',(.6,1.2,2),85)]:
        data=bpy.data.lights.new(label,'AREA');data.energy=power*size*size;data.size=size
        light=bpy.data.objects.new(label,data);scene.collection.objects.link(light);light.location=center+Vector(offset)*size;aim(light)
    camera_data=bpy.data.cameras.new('Exact dragon review camera');camera=bpy.data.objects.new(camera_data.name,camera_data);scene.collection.objects.link(camera)
    camera_data.lens=55;camera_data.sensor_width=36;camera_data.sensor_fit='HORIZONTAL'
    direction=Vector((-1.15,-1.8,.85)).normalized();camera.location=center+direction;aim(camera)
    inv=camera.rotation_euler.to_matrix().transposed();relative=[inv@(p-center) for p in points]
    tx=camera_data.sensor_width/(2*camera_data.lens);ty=tx*scene.render.resolution_y/scene.render.resolution_x
    distance=max(max(abs(p.x)/tx+p.z,abs(p.y)/ty+p.z) for p in relative)*1.12
    camera.location=center+direction*distance;camera_data.clip_start=.001;camera_data.clip_end=size*100;scene.camera=camera
    if name!='flight':
        bpy.ops.mesh.primitive_plane_add(size=size*10,location=(0,0,-.006))
        floor=bpy.context.object;floor.name='Review studio floor, excluded from gameasset'
        mat=bpy.data.materials.new('Neutral studio floor');mat.diffuse_color=(.08,.10,.125,1);mat.use_nodes=True;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.08,.10,.125,1);mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.8;floor.data.materials.append(mat)
    output=BASE/'review';output.mkdir(exist_ok=True)
    scene.render.filepath=str(output/(name+'.png'));bpy.ops.render.render(write_still=True)
    report={'sourceSha256':source_sha,'gameSha256':game_sha,'reviewPose':name,'input':str(path),'inputSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'image':(output/(name+'.png')).relative_to(ROOT).as_posix(),
            'ordinaryRender':True,'generativeToolsUsed':False,'NoAI':True,'geometry':'Exact Three evaluated game rig pose baked to static glTF before Blender',
            'blenderBounds':{'min':list(low),'max':list(high),'size':list(span)},'sourceMaterials':True,'studioChoices':{'engine':'Cycles CPU','samples':32,'viewTransform':'AgX','camera':list(camera.location),'target':list(center),'floor':name!='flight'},
            'sourcePreserved':hashlib.sha256(source.read_bytes()).hexdigest()==source_sha,
            'gamePreserved':hashlib.sha256((BASE/'dragon.glb').read_bytes()).hexdigest()==game_sha,
            'visualReview':'pending','browserIntegration':'pending'}
    (output/(name+'.json')).write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--pose',required=True)
    arguments=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);render(arguments.pose)

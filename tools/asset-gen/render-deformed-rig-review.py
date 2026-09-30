"""Render exact Three-deformed approved horse poses using the trusted Blender.

Only our static temporary GLBs are imported; the original Blend file is not
opened. Rendering is conventional Cycles CPU, never a generated illustration.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]


def render(candidate, names):
    if not {'--factory-startup', '--disable-autoexec'} <= set(sys.argv):
        raise RuntimeError('Trusted launch flags missing')
    if candidate not in ('ikkiz-unicorn', 'horse-skeleton', 'arabian-sculpt', 'fjord-sculpt', 'pastel-unicorn'):
        raise ValueError('Unregistered candidate')
    base = ROOT / 'assets/models/horse-imports' / candidate / 'game'
    data = json.loads((base / 'actual-deformed-review-poses.json').read_text())
    profile = json.loads((base / 'profile.json').read_text())
    animated = base / profile['file']
    sha = hashlib.sha256(animated.read_bytes()).hexdigest()
    assert sha == profile['sha256'] == data['animatedSha256']
    out = base / 'review'
    out.mkdir(exist_ok=True)
    for pose in data['poses']:
        if pose['name'] not in names:
            continue
        path = Path(pose['file'])
        if path.parent != Path('/private/tmp/horse-import-tools/' + candidate + '-poses'):
            raise RuntimeError('Unexpected pose input location')
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.context.preferences.filepaths.use_scripts_auto_execute = False
        bpy.ops.import_scene.gltf(filepath=str(path), import_pack_images=True)
        assert not bpy.data.texts
        meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
        points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
        low = Vector([min(p[i] for p in points) for i in range(3)])
        high = Vector([max(p[i] for p in points) for i in range(3)])
        center, span = (low + high) * .5, high - low
        size = max(span)
        scene = bpy.context.scene
        scene.render.engine = 'CYCLES'
        scene.cycles.device = 'CPU'
        scene.cycles.samples = 24
        scene.cycles.use_denoising = True
        scene.render.resolution_x = 1100
        scene.render.resolution_y = 850
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = 'PNG'
        scene.view_settings.view_transform = 'AgX'
        scene.world = bpy.data.worlds.new('View only neutral studio')
        scene.world.use_nodes = True
        scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.16, .19, .23, 1)
        scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .5

        def aim(o):
            o.rotation_euler = (center - o.location).to_track_quat('-Z', 'Y').to_euler()

        for label, offset, power in [('Key', (-1.3, -1.8, 1.8), 50), ('Fill', (1.4, -.7, 1), 28), ('Rim', (.6, 1.2, 2), 65)]:
            light_data = bpy.data.lights.new(label, 'AREA')
            light_data.energy = power * size * size
            light_data.size = size
            light = bpy.data.objects.new(label, light_data)
            scene.collection.objects.link(light)
            light.location = center + Vector(offset) * size
            aim(light)
        camera_data = bpy.data.cameras.new('Exact posed rig review camera')
        camera = bpy.data.objects.new(camera_data.name, camera_data)
        scene.collection.objects.link(camera)
        direction = Vector((-1.3, -2.3, .9)).normalized()
        camera.location = center + direction * size * 3
        aim(camera)
        camera_data.type = 'ORTHO'
        camera_data.ortho_scale = size * 1.35
        scene.camera = camera
        bpy.ops.mesh.primitive_plane_add(size=size * 10, location=(0, 0, -.006))
        floor = bpy.context.object
        material = bpy.data.materials.new('Studio floor excluded from asset')
        material.use_nodes = True
        material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.10, .12, .145, 1)
        material.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .9
        floor.data.materials.append(material)
        png = out / (pose['name'].lower() + '.png')
        scene.render.filepath = str(png)
        bpy.ops.render.render(write_still=True)
        report = {'animatedSha256': sha, 'clip': pose['name'], 'time': pose['time'],
                  'image': str(png.relative_to(ROOT)), 'imageSha256': hashlib.sha256(png.read_bytes()).hexdigest(),
                  'actualDeformedGeometry': True, 'ordinaryRender': True, 'generativeToolsUsed': False,
                  'sourceUvsAndMaterialsPreserved': True, 'boundsBlender': {'min': list(low), 'max': list(high)},
                  'animatedAssetPreserved': hashlib.sha256(animated.read_bytes()).hexdigest() == sha, 'visualReview': 'pending'}
        (out / (pose['name'].lower() + '.json')).write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--candidate', required=True)
    parser.add_argument('--poses', default='Rest,Walk,Gallop_Left,Jump')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    render(args.candidate, args.poses.split(','))

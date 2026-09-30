"""Render an actual registered, unchanged GLB using trusted Blender.

Run without opening a source file at startup:
  /path/to/blender --background --factory-startup --disable-autoexec \
    --python-exit-code 1 --python tools/asset-gen/render-registered-glb-preview.py -- \
    --candidate black-dragon --exclude-frame-mesh Plane_Material_0

The original receipt and GLB are never rewritten. Excluded meshes remain in the
render; exclusion changes camera fitting only. Output is review/preview.png and
review/offline-render.json. Rendering is ordinary Blender rendering, with no
generative tools, and does not certify motion or game compatibility.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]


def trusted_module(filename, name):
    previous = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    finally:
        sys.dont_write_bytecode = previous


def render(candidate_id, excluded, *, camera_direction=None, output_name='preview'):
    if not {'--factory-startup', '--disable-autoexec'} <= set(sys.argv):
        raise RuntimeError('Required launch flags: --factory-startup --disable-autoexec')
    preparer = trusted_module('prepare-registered-glb-review.py', 'horse_glb_preparation')
    paths = preparer.extraction_module()
    candidate, source, receipt = paths.registered_source(candidate_id)
    if receipt['inspection'].get('format') != 'glb' or source.suffix.lower() != '.glb':
        raise ValueError('A registered standalone GLB is required')
    expected = receipt['sha256'], receipt['bytes']
    receipt_path = source.parent / 'receipt.json'
    receipt_bytes = receipt_path.read_bytes()
    review = paths.checked_path(candidate / 'review/model.glb', ROOT)
    if paths.file_digest(source) != expected or paths.file_digest(review) != expected:
        raise ValueError('Source and review must match the acquisition receipt exactly')
    doc = preparer.glb_json(review, paths)
    # This renderer accepts the original modern-material path. Legacy material
    # adapters belong to the browser review and require separate render review.
    preparer.validate_preview(doc)
    metadata = next(item for item in paths.read_json(paths.CATALOG)['candidates'] if item.get('id') == candidate_id)
    output = paths.checked_path(candidate / 'review', ROOT, directory=True)
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]*', output_name):
        raise ValueError('Output name must contain only letters, numbers, underscores or hyphens')
    direction = Vector(camera_direction if camera_direction is not None else (-1.3, -1.8, .85))
    if not all(math.isfinite(value) for value in direction) or direction.length <= 0:
        raise ValueError('Camera direction must be a finite nonzero vector')
    direction.normalize()
    png = paths.checked_path(output / (output_name + '.png'), ROOT)
    report_path = paths.checked_path(output / ('offline-render.json' if output_name == 'preview' else output_name + '-render.json'), ROOT)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.use_scripts_auto_execute = False
    bpy.ops.import_scene.gltf(filepath=str(review), import_pack_images=True, disable_bone_shape=True)
    if bpy.data.texts:
        raise RuntimeError('Unexpected script text; refusing evaluation')
    if any(item.animation_data and item.animation_data.drivers for item in bpy.data.objects):
        raise RuntimeError('Unexpected imported drivers; refusing evaluation')
    scene = bpy.context.scene
    armatures = [obj for obj in scene.objects if obj.type == 'ARMATURE']
    # Keep the importer's first evaluated action pose. Forcing the armature REST
    # display can change geometry; cross-renderer pose fidelity is checked separately.
    scene.frame_set(0)
    bpy.context.view_layer.update()
    # The importer creates hidden meshes for bone control shapes. They are UI
    # helpers, not source geometry, and must not affect camera fitting.
    bone_shapes = {bone.custom_shape for obj in armatures for bone in obj.pose.bones if bone.custom_shape}
    meshes = [obj for obj in scene.objects if obj.type == 'MESH' and obj not in bone_shapes]
    frame_meshes = [obj for obj in meshes if obj.name not in excluded and obj.data.name not in excluded]
    matched = [obj for obj in meshes if obj not in frame_meshes]
    if set(excluded) - {name for obj in matched for name in (obj.name, obj.data.name)}:
        raise ValueError('An excluded frame mesh name did not match the imported source')
    depsgraph = bpy.context.evaluated_depsgraph_get()
    # Exact evaluated world vertices avoid inflated framing when an object's
    # local bounding box is rotated before conversion into world coordinates.
    points = [obj.matrix_world @ vertex.co for original in frame_meshes
              for obj in [original.evaluated_get(depsgraph)] for vertex in obj.data.vertices]
    if not points or not all(math.isfinite(value) for point in points for value in point):
        raise ValueError('No finite evaluated mesh bounds to frame')
    low = Vector([min(point[i] for point in points) for i in range(3)])
    high = Vector([max(point[i] for point in points) for i in range(3)])
    center, span = (low + high) / 2, high - low
    size = max(span)
    if size <= 0:
        raise ValueError('Degenerate geometry bounds')

    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1200, 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = 0
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new('Registered source review lighting')
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes['Background']
    background.inputs['Color'].default_value = (.32, .36, .40, 1)
    background.inputs['Strength'].default_value = .6

    def aim(obj):
        obj.rotation_euler = (center - obj.location).to_track_quat('-Z', 'Y').to_euler()

    lights = []
    for name, offset, energy in [('Key', (-1.3, -1.8, 2), 40),
                                 ('Fill', (1.8, -.5, 1.2), 22),
                                 ('Rim', (.5, 1.7, 1.8), 35)]:
        data = bpy.data.lights.new(name + ' review light', 'AREA')
        light = bpy.data.objects.new(data.name, data)
        scene.collection.objects.link(light)
        light.location = center + Vector(offset) * size
        data.energy, data.size = energy * size * size, size * 1.2
        aim(light)
        lights.append({'name': name, 'location': list(light.location), 'energy': data.energy, 'size': data.size})

    camera_data = bpy.data.cameras.new('Registered source quarter-view camera')
    camera = bpy.data.objects.new(camera_data.name, camera_data)
    scene.collection.objects.link(camera)
    camera_data.lens, camera_data.sensor_width = 55, 36
    camera_data.sensor_fit = 'HORIZONTAL'
    camera.location = center + direction
    aim(camera)
    inverse = camera.rotation_euler.to_matrix().transposed()
    relative = [inverse @ (point - center) for point in points]
    tan_x = camera_data.sensor_width / (2 * camera_data.lens)
    tan_y = tan_x * scene.render.resolution_y / scene.render.resolution_x
    distance = 1.12 * max(max(abs(point.x) / tan_x + point.z,
                               abs(point.y) / tan_y + point.z) for point in relative)
    camera.location = center + direction * distance
    camera_data.clip_start, camera_data.clip_end = max(.001, size / 10000), size * 100
    scene.camera = camera

    report = {'schemaVersion': 1, 'candidateId': candidate_id,
              'renderedAtUtc': datetime.now(timezone.utc).isoformat(timespec='seconds'),
              'sourceSha256': receipt['sha256'], 'reviewSha256': receipt['sha256'],
              'creator': metadata.get('creator'), 'license': metadata.get('license'),
              'licenseUrl': metadata.get('licenseUrl'), 'sourceUrl': metadata.get('sourceUrl'),
              'noAI': metadata.get('noAI', False), 'generativeToolsUsed': False,
              'originalBytesPreserved': True, 'sourceReceiptPreserved': True,
              'renderOnlyChoices': {'engine': 'Cycles CPU', 'blenderVersion': bpy.app.version_string,
                  'samples': 32, 'denoising': True, 'resolution': [1200, 900],
                  'viewTransform': 'AgX', 'animationDisplay': 'source action first frame, render only',
                  'sourceAnimationFrame': 0, 'importerBoneControlShapesDisabled': True,
                  'animationPlaybackAssessed': False,
                  'cameraFitExcludedMeshes': [obj.name for obj in matched],
                  'excludedGeometryHidden': False, 'sourceGeometryRetained': True,
                  'camera': {'location': list(camera.location), 'target': list(center), 'lensMm': 55},
                  'frameBoundsBlenderCoordinates': {'min': list(low), 'max': list(high), 'size': list(span),
                      'method': 'exact evaluated mesh vertices in world coordinates'},
                  'studioLights': lights, 'studioWorldStrength': .6},
              'importedSource': {'meshCount': len(meshes),
                  'meshes': [{'object': obj.name, 'mesh': obj.data.name, 'polygons': len(obj.data.polygons)} for obj in meshes],
                  'armatureBoneCounts': [len(obj.data.bones) for obj in armatures],
                  'importerBoneControlMeshesExcluded': sorted(obj.name for obj in bone_shapes),
                  'imageCount': len(bpy.data.images),
                  'images': [{'name': image.name, 'size': list(image.size), 'packed': bool(image.packed_file)} for image in bpy.data.images],
                  'materialCount': len(bpy.data.materials), 'actionNames': [action.name for action in bpy.data.actions]},
              'rigRetargeted': False, 'animationsModified': False, 'motionReview': 'pending',
              'crossRendererPoseFidelity': 'not-assessed',
              'gameCompatibility': 'not-assessed',
              'note': 'Ordinary Blender rendering of the actual original GLB using imported source textures/materials. Camera fitting and studio lighting are render-only choices; material appearance may differ from the browser renderer. No animation playback has been certified.'}
    with tempfile.TemporaryDirectory(dir=output, prefix='.offline-render-') as folder:
        staged = Path(folder)
        scene.render.filepath = str(staged / 'preview.png')
        bpy.ops.render.render(write_still=True)
        if (paths.file_digest(source) != expected or paths.file_digest(review) != expected
                or receipt_path.read_bytes() != receipt_bytes):
            raise RuntimeError('Original source, review or receipt changed during rendering')
        preview = staged / 'preview.png'
        if not preview.is_file() or preview.read_bytes()[:8] != b'\x89PNG\r\n\x1a\n':
            raise RuntimeError('Blender did not produce a PNG')
        report.update(previewFile=str(png.relative_to(ROOT)), previewSha256=paths.file_digest(preview)[0])
        (staged / 'offline-render.json').write_text(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + '\n', encoding='utf-8')
        paths.checked_path(png, ROOT)
        paths.checked_path(report_path, ROOT)
        os.replace(preview, png)
        os.replace(staged / 'offline-render.json', report_path)
    print(json.dumps({'status': 'actual-source-rendered', 'preview': str(png), 'report': str(report_path),
                      'sourceSha256': receipt['sha256'], 'motionReview': 'pending'}))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--candidate', required=True)
    parser.add_argument('--exclude-frame-mesh', action='append', default=[])
    parser.add_argument('--camera-direction', nargs=3, type=float, metavar=('X', 'Y', 'Z'))
    parser.add_argument('--output-name', default='preview')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    render(args.candidate, args.exclude_frame_mesh, camera_direction=args.camera_direction, output_name=args.output_name)


if __name__ == '__main__':
    main()

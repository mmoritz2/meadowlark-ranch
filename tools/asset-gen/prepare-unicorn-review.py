"""Safely inspect the acquired ikkiz unicorn before a faithful glTF conversion.

Run only with the trusted Blender executable, without passing the source as a
startup file. Example (replace /path/to/blender with the installed binary):

  /path/to/blender --background --factory-startup --disable-autoexec \
    --python-exit-code 1 --python tools/asset-gen/prepare-unicorn-review.py -- \
    --mode inspect

Modes: inspect, render-preview, export-review. Export refuses particle hair and
unsupported legacy Cycles materials instead of silently omitting their appearance.
The original archive, extracted blend and acquisition receipt are never modified.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
CANDIDATE = ROOT / 'assets/models/horse-imports/ikkiz-unicorn'
SOURCE = CANDIDATE / 'work/extracted' / "Jill_Janus's _unocorn1.blend"
EXPECTED_BLEND_HASH = '2712c699a967d6261028f7015f45e2f87c876291d9bab6a9d0156d9b255ef60e'
EXPECTED_ARCHIVE_HASH = '7becb0fbd08d90c11ddd82386707ef1051a12a8cdadaf29258598ee55a4e7b1b'
OUTPUT = CANDIDATE / 'review'


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def all_ids():
    """Include embedded material node trees and mesh shape keys, too."""
    seen = set()
    pending = []
    for prop in bpy.data.bl_rna.properties:
        if prop.type == 'COLLECTION':
            pending.extend(value for value in getattr(bpy.data, prop.identifier) if isinstance(value, bpy.types.ID))
    while pending:
        value = pending.pop()
        address = value.as_pointer()
        if address in seen:
            continue
        seen.add(address)
        yield value
        for name in ('node_tree', 'shape_keys'):
            nested = getattr(value, name, None)
            if isinstance(nested, bpy.types.ID):
                pending.append(nested)


def safe_append():
    if '--disable-autoexec' not in sys.argv:
        raise RuntimeError('Required launch flag missing: --disable-autoexec')
    receipt = json.loads((CANDIDATE / 'source/receipt.json').read_text())
    if receipt.get('candidateId') != 'ikkiz-unicorn' or receipt.get('status') != 'source-acquired' or receipt.get('sha256') != EXPECTED_ARCHIVE_HASH:
        raise RuntimeError('The registered unicorn archive receipt does not match this reviewed source')
    if not SOURCE.is_file() or sha256(SOURCE) != EXPECTED_BLEND_HASH:
        raise RuntimeError('The extracted Blender file does not match the statically inspected source')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.use_scripts_auto_execute = False
    # Keep only the factory-startup engine handlers. They belong to the trusted
    # Blender distribution and perform old-file node migration; source Text,
    # WindowManager and Scene blocks are never loaded as a startup file.
    # Appending object/data blocks avoids opening the source Scene/WindowManager
    # or loading its Text blocks. Nothing is linked to a scene while drivers exist.
    with bpy.data.libraries.load(str(SOURCE), link=False) as (available, loaded):
        loaded.objects = list(available.objects)
        loaded.materials = list(available.materials)
        loaded.actions = list(available.actions)
    removed = []
    for value in all_ids():
        animation = getattr(value, 'animation_data', None)
        if animation:
            for driver in list(animation.drivers):
                removed.append({'id': value.name, 'dataPath': driver.data_path, 'arrayIndex': driver.array_index})
                animation.drivers.remove(driver)
    if any(getattr(value, 'animation_data', None) and value.animation_data.drivers for value in all_ids()):
        raise RuntimeError('Driver removal failed; refusing to evaluate the source')
    if bpy.data.texts:
        raise RuntimeError('Unexpected Text blocks were appended; refusing to evaluate the source')
    for material in bpy.data.materials:
        if material.node_tree and any(node.type == 'SCRIPT' for node in material.node_tree.nodes):
            raise RuntimeError('OSL/script material needs separate review; refusing source evaluation')
    for obj in loaded.objects:
        if obj and obj.type in ('MESH', 'ARMATURE', 'EMPTY', 'CURVE'):
            bpy.context.scene.collection.objects.link(obj)
    return receipt, removed


def inspect(removed):
    objects, particles, materials, issues = [], [], [], []
    for obj in bpy.context.scene.objects:
        row = {'name': obj.name, 'type': obj.type, 'modifiers': []}
        if obj.type == 'MESH':
            row.update(vertices=len(obj.data.vertices), polygons=len(obj.data.polygons), shapeKeys=[key.name for key in obj.data.shape_keys.key_blocks] if obj.data.shape_keys else [])
        if obj.type == 'ARMATURE':
            row['boneCount'] = len(obj.data.bones)
        for modifier in obj.modifiers:
            item = {'name': modifier.name, 'type': modifier.type}
            if modifier.type == 'MULTIRES':
                item.update(viewportLevel=modifier.levels, renderLevel=modifier.render_levels, totalLevels=modifier.total_levels)
            row['modifiers'].append(item)
        for system in obj.particle_systems:
            particles.append({'object': obj.name, 'name': system.name, 'type': system.settings.type,
                              'parentCount': len(system.particles), 'viewportChildren': system.settings.child_percent,
                              'renderChildren': system.settings.rendered_child_count})
            if system.settings.type == 'HAIR':
                issues.append(f'{obj.name}/{system.name}: legacy hair must become curves/mesh with materials before glTF export')
        objects.append(row)
    for material in bpy.data.materials:
        nodes = material.node_tree.nodes if material.node_tree else []
        node_types = sorted(set(node.bl_idname for node in nodes))
        materials.append({'name': material.name, 'nodes': node_types})
        if nodes and not any(node.type == 'BSDF_PRINCIPLED' for node in nodes):
            issues.append(f'{material.name}: bake/translate the legacy Cycles network to glTF-compatible Principled materials')
    images = [{'name': image.name, 'packed': bool(image.packed_file), 'size': list(image.size), 'source': image.source}
              for image in bpy.data.images if image.type != 'RENDER_RESULT']
    return {'objects': objects, 'particleSystems': particles, 'materials': materials, 'images': images,
            'actions': [action.name for action in bpy.data.actions], 'removedDrivers': removed,
            'conversionRequirements': sorted(set(issues))}


def render_preview(report):
    scene = bpy.context.scene
    quality = []
    original_children = {system.settings.as_pointer(): system.settings.rendered_child_count
                         for obj in scene.objects for system in obj.particle_systems}
    for obj in scene.objects:
        for modifier in obj.modifiers:
            if modifier.type == 'MULTIRES':
                old = modifier.render_levels
                modifier.render_levels = min(old, modifier.levels, 1)
                quality.append({'object': obj.name, 'modifier': modifier.name, 'originalRenderLevel': old, 'previewRenderLevel': modifier.render_levels})
        for system in obj.particle_systems:
            settings = system.settings
            if settings.type == 'HAIR':
                old = original_children[settings.as_pointer()]
                settings.rendered_child_count = min(old, settings.child_percent)
                quality.append({'object': obj.name, 'hairSystem': system.name, 'originalRenderChildren': old, 'previewRenderChildren': settings.rendered_child_count})
    # First scene/dependency-graph evaluation occurs only after driver removal.
    bpy.context.view_layer.update()
    geometry = [obj for obj in scene.objects if obj.type == 'MESH']
    points = [obj.matrix_world @ Vector(corner) for obj in geometry for corner in obj.bound_box]
    if not points or not all(math.isfinite(v) for point in points for v in point):
        raise RuntimeError('Source has no finite geometry to frame')
    low = Vector([min(point[i] for point in points) for i in range(3)])
    high = Vector([max(point[i] for point in points) for i in range(3)])
    center, span = (low + high) / 2, high - low
    scale = max(span)
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 850
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.world = bpy.data.worlds.new('Isolated unicorn source review lighting')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.32, .36, .31, 1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .65
    def aim(obj):
        obj.rotation_euler = (center - obj.location).to_track_quat('-Z', 'Y').to_euler()
    for name, offset, energy in [('Key', (1, -2, 3), 1500), ('Fill', (-2, 1, 2), 900)]:
        data = bpy.data.lights.new(name, 'AREA')
        light = bpy.data.objects.new(name, data)
        scene.collection.objects.link(light)
        light.location = center + Vector(offset) * scale
        data.energy = energy * scale * scale
        data.shape = 'DISK'
        data.size = scale * 2
        aim(light)
    data = bpy.data.cameras.new('Unicorn review camera')
    camera = bpy.data.objects.new('Unicorn review camera', data)
    scene.collection.objects.link(camera)
    camera.location = center + Vector((1.8, -2.6, .7)) * scale
    data.type = 'ORTHO'
    data.ortho_scale = max(span.x, span.y, span.z) * 1.4
    scene.camera = camera
    aim(camera)
    scene.render.filepath = str(OUTPUT / 'source-preview.png')
    bpy.ops.render.render(write_still=True)
    report.update(status='source-render-preview-only', previewFile='source-preview.png', previewQualityChanges=quality,
                  observedRigLimitations=['No original action clips or gait library are stored in this source.',
                                          'Blender 4.5 reports a dependency cycle in the original DEF-szyja.002/003/004 neck copy-rotation/parent chain.'],
                  note='Original Cycles/particle appearance rendered after removing drivers; this PNG does not certify glTF or game compatibility.')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--mode', choices=('inspect', 'render-preview', 'export-review'), default='inspect')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    receipt, removed = safe_append()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    report = {'schemaVersion': 1, 'candidateId': 'ikkiz-unicorn', 'sourceArchiveSha256': receipt['sha256'],
              'sourceBlendSha256': EXPECTED_BLEND_HASH, 'blenderVersion': bpy.app.version_string,
              'status': 'source-inspected', 'embeddedTextLoaded': False, 'embeddedScriptsExecuted': False,
              'driversRemovedBeforeSceneLink': True, 'gameCompatibility': 'not-assessed', **inspect(removed)}
    try:
        if args.mode == 'render-preview':
            render_preview(report)
        elif args.mode == 'export-review':
            if report['conversionRequirements']:
                report['status'] = 'conversion-required'
                raise RuntimeError('Source particle hair/legacy materials need explicit conversion; refusing an incomplete glTF preview')
            bpy.ops.object.select_all(action='DESELECT')
            for obj in bpy.context.scene.objects:
                obj.select_set(True)
            bpy.ops.export_scene.gltf(filepath=str(OUTPUT / 'model.glb'), export_format='GLB', use_selection=True,
                                      export_animations=False, export_yup=True)
            report.update(status='static-review-exported; validation-required', reviewFile='model.glb', animationsExported=False)
    finally:
        report['sourceBlendUnchanged'] = sha256(SOURCE) == EXPECTED_BLEND_HASH
        if not report['sourceBlendUnchanged']:
            raise RuntimeError('Source file changed unexpectedly')
        (OUTPUT / 'blender-inspection.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        print('UNICORN_PREPARATION', json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()

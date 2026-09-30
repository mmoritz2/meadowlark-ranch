"""Inspect genuine fantasy source anatomy for replacement rig authoring.

Run trusted Blender with --background --factory-startup --disable-autoexec.
Loads only registered source data and our own append helper. Writes inspection
JSON; does not rewrite source assets, existing game files or shared manifests.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'assets/models/horse-imports'


def module(name):
    old = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        spec = importlib.util.spec_from_file_location('owned_fantasy_inspection', Path(__file__).with_name(name))
        result = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(result)
        return result
    finally:
        sys.dont_write_bytecode = old


def vec(p):
    return [float(x) for x in p]


def inspect_objects():
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    objects = []
    for obj in bpy.context.scene.objects:
        row = {'name': obj.name, 'type': obj.type, 'worldMatrix': [list(r) for r in obj.matrix_world]}
        if obj.type == 'ARMATURE':
            row['bones'] = [{'name': b.name, 'parent': b.parent.name if b.parent else None,
                             'headWorld': vec(obj.matrix_world @ b.head_local),
                             'tailWorld': vec(obj.matrix_world @ b.tail_local),
                             'deform': b.use_deform} for b in obj.data.bones]
            row['pose'] = [{'name': b.name, 'headWorld': vec(obj.matrix_world @ b.head),
                            'tailWorld': vec(obj.matrix_world @ b.tail),
                            'constraints': [{'type': c.type, 'name': c.name, 'influence': c.influence}
                                            for c in b.constraints]} for b in obj.pose.bones]
        if obj.type == 'MESH':
            evaluated = obj.evaluated_get(dg)
            mesh = evaluated.to_mesh()
            try:
                points = [evaluated.matrix_world @ v.co for v in mesh.vertices]
                row.update(vertices=len(mesh.vertices), polygons=len(mesh.polygons),
                           worldBounds={'min': [min(p[i] for p in points) for i in range(3)],
                                        'max': [max(p[i] for p in points) for i in range(3)]},
                           materials=[m.name if m else None for m in mesh.materials],
                           originalVertexGroups=[g.name for g in obj.vertex_groups])
                row['materialVertexBounds'] = []
                for i, mat in enumerate(mesh.materials):
                    ids = {v for f in mesh.polygons if f.material_index == i for v in f.vertices}
                    if ids:
                        ps = [points[j] for j in ids]
                        row['materialVertexBounds'].append({'material': mat.name if mat else None, 'vertices': len(ids),
                            'min': [min(p[k] for p in ps) for k in range(3)], 'max': [max(p[k] for p in ps) for k in range(3)]})
            finally:
                evaluated.to_mesh_clear()
            row['particleSystems'] = []
            for ps in obj.particle_systems:
                samples = []
                for part in list(ps.particles)[:3]:
                    samples.append({'location': vec(part.location),
                                    'hairKeys': [vec(k.co) for k in part.hair_keys]})
                row['particleSystems'].append({'name': ps.name, 'count': len(ps.particles),
                    'hairStep': ps.settings.hair_step, 'length': ps.settings.hair_length,
                    'radiusRoot': ps.settings.root_radius, 'radiusTip': ps.settings.tip_radius,
                    'radiusScale': ps.settings.radius_scale, 'materialSlot': ps.settings.material,
                    'samples': samples})
        objects.append(row)
    return objects


def main():
    if not {'--factory-startup', '--disable-autoexec'} <= set(sys.argv):
        raise RuntimeError('Use factory-startup and disable-autoexec')
    outputs = []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.use_scripts_auto_execute = False
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'assets/models/artist-breeds/bay.glb'))
    canonical = inspect_objects()
    helper = module('prepare-unicorn-review.py')
    receipt, removed = helper.safe_append()
    unicorn = inspect_objects()
    out = BASE / 'ikkiz-unicorn/game'
    out.mkdir(parents=True, exist_ok=True)
    report = {'schemaVersion': 1, 'blenderVersion': bpy.app.version_string,
              'coordinateFrame': 'Blender world coordinates, Z up', 'canonicalRig': canonical,
              'sourceObjects': unicorn, 'removedDrivers': removed, 'scriptsExecuted': False,
              'sourceBlendSha256': helper.sha256(helper.SOURCE), 'sourceArchiveSha256': receipt['sha256'],
              'status': 'anatomy-inspected-conversion-required'}
    assert report['sourceBlendSha256'] == helper.EXPECTED_BLEND_HASH
    (out / 'source-rig-authoring-inspection.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    outputs.append(str(out / 'source-rig-authoring-inspection.json'))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source = BASE / 'horse-skeleton/review/model.glb'
    before = hashlib.sha256(source.read_bytes()).hexdigest()
    bpy.ops.import_scene.gltf(filepath=str(source))
    skeleton = inspect_objects()
    assert hashlib.sha256(source.read_bytes()).hexdigest() == before
    out = BASE / 'horse-skeleton/game'
    out.mkdir(parents=True, exist_ok=True)
    (out / 'source-rig-authoring-inspection.json').write_text(json.dumps({
        'schemaVersion': 1, 'blenderVersion': bpy.app.version_string,
        'coordinateFrame': 'Blender world coordinates, Z up', 'sourceObjects': skeleton,
        'sourceSha256': before, 'originalUnchanged': True, 'scriptsExecuted': False,
        'status': 'anatomy-inspected-conversion-required'}, indent=2, ensure_ascii=False) + '\n')
    outputs.append(str(out / 'source-rig-authoring-inspection.json'))
    print(json.dumps({'status': 'inspected', 'outputs': outputs}))


if __name__ == '__main__':
    main()

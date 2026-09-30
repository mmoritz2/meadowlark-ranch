"""Inspect the registered CG Cookie wing in Blender without source auto-execution.

Run with an official Blender executable:
  blender --factory-startup --background --disable-autoexec --python tools/asset-gen/inspect-cgcookie-wing-source.py

Only static source data is read. No scene evaluation, rendering, conversion or
source saving is performed. The report stays within this candidate's work area.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import tempfile

import bpy

ROOT = Path(__file__).resolve().parents[2]
CANDIDATE = ROOT / 'assets/models/horse-imports/cgcookie-wings'
SOURCE = CANDIDATE / 'work/extracted/wing_042810.blend'
EXPECTED_SHA256 = 'f43fd99185b2e0d3877dc5b42c4c8004a6071ac420cb774d4d466ffd3fe0e258'
OUTPUT = CANDIDATE / 'work/static-inspection.json'


def name(value):
    return value.name if value is not None else None


def action_summary(action):
    curves = list(getattr(action, 'fcurves', []))
    # Newer Blender action slots/layers may hold channel bags instead.
    if not curves:
        for layer in getattr(action, 'layers', []):
            for strip in getattr(layer, 'strips', []):
                for bag in getattr(strip, 'channelbags', []):
                    curves.extend(getattr(bag, 'fcurves', []))
    return {'name': action.name, 'frameRange': list(action.frame_range),
            'fcurveCount': len(curves),
            'keyframePointCount': sum(len(curve.keyframe_points) for curve in curves)}


def inspect():
    if SOURCE.is_symlink() or hashlib.sha256(SOURCE.read_bytes()).hexdigest() != EXPECTED_SHA256:
        raise ValueError('Wing source does not match the registered extraction report')
    if bpy.context.preferences.filepaths.use_scripts_auto_execute:
        raise ValueError('Blender must be started with --factory-startup --disable-autoexec')
    # These flags are explicit at file-open time as well as on the CLI. Reading
    # bpy.data afterward avoids evaluating scripted drivers or particle systems.
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE), load_ui=False, use_scripts=False)
    if bpy.context.preferences.filepaths.use_scripts_auto_execute:
        raise ValueError('Source scripts must remain disabled')
    objects = []
    for obj in bpy.data.objects:
        row = {'name': obj.name, 'type': obj.type, 'parent': name(obj.parent),
               'instanceType': obj.instance_type, 'instanceCollection': name(obj.instance_collection),
               'modifiers': [{'name': mod.name, 'type': mod.type,
                              'target': name(getattr(mod, 'object', None))}
                             for mod in obj.modifiers],
               'constraints': [{'name': con.name, 'type': con.type,
                                'target': name(getattr(con, 'target', None))}
                               for con in obj.constraints]}
        if obj.type == 'MESH':
            mesh = obj.data
            row['mesh'] = {'vertices': len(mesh.vertices), 'edges': len(mesh.edges),
                           'polygons': len(mesh.polygons),
                           'trianglesFromPolygonSizes': sum(max(0, len(p.vertices) - 2) for p in mesh.polygons),
                           'uvLayers': [layer.name for layer in mesh.uv_layers],
                           'materials': [name(mat) for mat in mesh.materials],
                           'vertexGroups': [group.name for group in obj.vertex_groups],
                           'verticesWithAnyGroupWeight': sum(bool(v.groups) for v in mesh.vertices),
                           'shapeKeys': [key.name for key in mesh.shape_keys.key_blocks] if mesh.shape_keys else []}
        if obj.type == 'ARMATURE':
            row['armature'] = {'boneCount': len(obj.data.bones),
                               'bones': [{'name': bone.name, 'parent': name(bone.parent),
                                          'deform': bone.use_deform}
                                         for bone in obj.data.bones]}
        row['particleSystems'] = [{'name': system.name, 'settings': name(system.settings),
                                   'type': system.settings.type,
                                   'count': system.settings.count,
                                   'hairLength': system.settings.hair_length,
                                   'renderType': system.settings.render_type}
                                  for system in obj.particle_systems]
        data = obj.animation_data
        row['animation'] = None if data is None else {
            'action': name(data.action),
            'nlaTracks': [{'name': track.name,
                           'strips': [{'name': strip.name, 'action': name(strip.action)}
                                      for strip in track.strips]}
                          for track in data.nla_tracks],
            'driverCount': len(data.drivers)}
        objects.append(row)
    return {'schemaVersion': 1, 'candidateId': 'cgcookie-wings',
            'blenderVersion': bpy.app.version_string,
            'sourcePath': str(SOURCE.relative_to(ROOT)), 'sourceSha256': EXPECTED_SHA256,
            'sourceOpened': True, 'embeddedScriptsExecuted': False,
            'autoExecutionEnabled': bpy.context.preferences.filepaths.use_scripts_auto_execute,
            'autoExecutionBlocked': bool(bpy.app.autoexec_fail),
            'autoExecutionMessage': bpy.app.autoexec_fail_message,
            'objects': objects,
            'actions': [action_summary(action) for action in bpy.data.actions],
            'images': [{'name': img.name, 'source': img.source, 'filepath': img.filepath,
                        'packed': bool(img.packed_file)} for img in bpy.data.images],
            'textBlockNames': [text.name for text in bpy.data.texts],
            'materialNames': [mat.name for mat in bpy.data.materials],
            'gameCompatibility': 'not-assessed',
            'note': 'Raw source data only; no evaluated geometry or particle instances, rendering, conversion, rig motion assessment or source saving.'}


report = inspect()
if OUTPUT.is_symlink() or OUTPUT.parent.is_symlink():
    raise ValueError('Refusing a symlink report destination')
encoded = (json.dumps(report, indent=2, allow_nan=False) + '\n').encode('utf-8')
with tempfile.NamedTemporaryFile(dir=OUTPUT.parent, prefix='.wing-inspection-', delete=False) as stream:
    temporary = Path(stream.name)
    stream.write(encoded)
try:
    os.replace(temporary, OUTPUT)
finally:
    temporary.unlink(missing_ok=True)
print(json.dumps({'candidateId': report['candidateId'], 'reportPath': str(OUTPUT.relative_to(ROOT)),
                  'objects': len(report['objects']), 'actions': len(report['actions']),
                  'embeddedScriptsExecuted': False}, indent=2))

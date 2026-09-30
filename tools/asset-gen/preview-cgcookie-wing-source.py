"""Create a neutral, untextured preview of the acquired CG Cookie wing component.

Run Blender with --factory-startup --background --disable-autoexec before --python.
Only a GLB and conversion report are written; the source .blend stays untouched.
The original four-bone body rig and source units are retained. Long feathers are
baked for static review. Legacy downy hair is omitted because its migrated world
coordinates cannot be verified; the source groom remains intact in the .blend.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
CANDIDATE = ROOT / 'assets/models/horse-imports/cgcookie-wings'
SOURCE = CANDIDATE / 'work/extracted/wing_042810.blend'
EXPECTED_SHA256 = 'f43fd99185b2e0d3877dc5b42c4c8004a6071ac420cb774d4d466ffd3fe0e258'
REVIEW = CANDIDATE / 'review'


def neutral_material(name):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (0.74, 0.72, 0.68, 1)
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = material.diffuse_color
    shader.inputs['Roughness'].default_value = 0.72
    shader.inputs['Metallic'].default_value = 0
    material.use_backface_culling = False
    return material


def mesh_object(name, vertices, faces, material):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    mesh.materials.append(material)
    return obj


if SOURCE.is_symlink() or hashlib.sha256(SOURCE.read_bytes()).hexdigest() != EXPECTED_SHA256:
    raise ValueError('Wing source does not match the registered extraction report')
if bpy.context.preferences.filepaths.use_scripts_auto_execute:
    raise ValueError('Blender must be started with --factory-startup --disable-autoexec')
bpy.ops.wm.open_mainfile(filepath=str(SOURCE), load_ui=False, use_scripts=False)
if bpy.context.preferences.filepaths.use_scripts_auto_execute:
    raise ValueError('Source scripts must remain disabled')
if any(obj.animation_data and len(obj.animation_data.drivers) for obj in bpy.data.objects):
    raise ValueError('Preview cannot evaluate a source that depends on animation drivers')

scene = bpy.context.scene
graph = bpy.context.evaluated_depsgraph_get()
body = bpy.data.objects['Cube']
armature = bpy.data.objects['Armature']
if len(armature.data.bones) != 4:
    raise ValueError('Unexpected wing source rig')

# Preserve all 48 original face-instance transforms. Do not include the emitter
# polygons or the loose feather template in the visible component preview.
feather_vertices, feather_faces = [], []
instance_count = 0
for instance in graph.object_instances:
    if not instance.is_instance or instance.object.original.name != 'Mesh':
        continue
    mesh = instance.object.data
    offset = len(feather_vertices)
    feather_vertices.extend(tuple(instance.matrix_world @ vertex.co) for vertex in mesh.vertices)
    feather_faces.extend(tuple(offset + index for index in polygon.vertices) for polygon in mesh.polygons)
    instance_count += 1
if instance_count != 48:
    raise ValueError(f'Expected 48 feather instances, found {instance_count}')

material = neutral_material('Neutral untextured component review')
feathers = mesh_object('Baked source long feathers', feather_vertices, feather_faces, material)
body_preview = body.copy()
body_preview.data = body.data.copy()
body_preview.name = 'Wing body with original four-bone rig'
scene.collection.objects.link(body_preview)
for mod in list(body_preview.modifiers):
    if mod.type == 'PARTICLE_SYSTEM':
        body_preview.modifiers.remove(mod)
body_preview.data.materials.clear()
body_preview.data.materials.append(material)
for polygon in body_preview.data.polygons:
    polygon.material_index = 0

for obj in scene.objects:
    obj.select_set(False)
for obj in (armature, body_preview, feathers):
    obj.hide_set(False)
    obj.hide_render = False
    obj.select_set(True)
bpy.context.view_layer.objects.active = body_preview
if REVIEW.is_symlink():
    raise ValueError('Refusing a symlink review directory')
REVIEW.mkdir(parents=True, exist_ok=True)
output = REVIEW / 'model.glb'
if output.is_symlink():
    raise ValueError('Refusing a symlink preview destination')
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB',
                          use_selection=True, export_animations=False,
                          export_apply=True, export_yup=True, export_extras=True)
if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != EXPECTED_SHA256:
    raise ValueError('Original wing source changed unexpectedly')
report = {'schemaVersion': 1, 'candidateId': 'cgcookie-wings',
          'status': 'neutral-component-preview', 'blenderVersion': bpy.app.version_string,
          'sourcePath': str(SOURCE.relative_to(ROOT)), 'sourceSha256': EXPECTED_SHA256,
          'previewPath': str(output.relative_to(ROOT)), 'previewBytes': output.stat().st_size,
          'previewSha256': hashlib.sha256(output.read_bytes()).hexdigest(),
          'sourceUnitSystem': scene.unit_settings.system,
          'sourceUnitScale': scene.unit_settings.scale_length, 'sourceScalePreserved': True,
          'sourceBoneCount': len(armature.data.bones), 'sourceRigRetainedOnBody': True,
          'bakedLongFeatherInstances': instance_count, 'bakedDownyStrandPaths': 0,
          'legacyDownyStrandsOmitted': 1000,
          'missingImageMaps': ['wing_alphamap.png', 'wing_texturemap.jpg'],
          'embeddedScriptsExecuted': False, 'sourceSavedOrModified': False,
          'gameCompatibility': 'not-assessed', 'animationsCreated': False,
          'limitations': ['Neutral untextured materials replace missing original color and alpha maps.',
                          'Long feathers are baked for static shape review; their motion binding needs conversion.',
                          'Legacy downy hair is omitted: migrated cache coordinates are zero and object-coordinate queries do not include verified emitter placement.',
                          'This is a single wing component; it has not been fitted to a horse or reviewed for flight.']}
(REVIEW / 'preview-conversion.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))

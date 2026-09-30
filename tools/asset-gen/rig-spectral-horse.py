"""Bind the acquired skeleton's real bone surfaces to an anatomical game rig.

Trusted Blender: --background --factory-startup --disable-autoexec --python
tools/asset-gen/rig-spectral-horse.py. Original sources and shipping assets are
read only. Output is horse-imports/horse-skeleton/game/ for rig/motion review.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'assets/models/horse-imports/horse-skeleton'
SOURCE = BASE / 'review/model.glb'
OUT = BASE / 'game'
SOURCE_SHA = '9a28a22d9e194454f1557409cdc1aa99e2f3af4696ce6ad151fcbec73c8ebdc0'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def point(p):
    return [float(p[0]), float(p[2]), float(-p[1])]


def main():
    if not {'--factory-startup', '--disable-autoexec'} <= set(sys.argv):
        raise RuntimeError('Required trusted launch flags missing')
    if digest(SOURCE) != SOURCE_SHA:
        raise RuntimeError('Original registered skeleton hash mismatch')
    receipt_path = BASE / 'source/receipt.json'
    receipt_bytes = receipt_path.read_bytes()
    inspection = json.loads((ROOT / 'assets/models/horse-imports/ikkiz-unicorn/game/source-rig-authoring-inspection.json').read_text())
    canonical = next(o['bones'] for o in inspection['canonicalRig'] if o['type'] == 'ARMATURE')
    assert len(canonical) == 40
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.use_scripts_auto_execute = False
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    if bpy.data.texts:
        raise RuntimeError('Unexpected embedded script data')
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    assert len(meshes) == 47
    source_min = min((o.matrix_world @ v.co).z for o in meshes for v in o.data.vertices)
    # The source's scapular/withers bones lie at Z=1.70. Preserve its proportions
    # while expressing the new rest rig in metres with 1.68m physical withers.
    withers_m = 1.68
    scale = withers_m / (1.70 - source_min)
    center_y = .70

    def normalize(p):
        return Vector((p[0] * scale, (p[1] - center_y) * scale, (p[2] - source_min) * scale))

    for ob in meshes:
        matrix = ob.matrix_world.copy()
        for v in ob.data.vertices:
            v.co = normalize(matrix @ v.co)
        ob.parent = None
        ob.matrix_world = Matrix.Identity(4)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in meshes:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    body = bpy.context.object
    body.name = 'HorseBody'
    body.data.name = 'Diego skeleton anatomical surfaces'
    # Reunite exporter fragment boundaries, preserving actual surface positions.
    bm = bmesh.new()
    bm.from_mesh(body.data)
    original_vertices = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=scale * .00001)
    bm.to_mesh(body.data)
    bm.free()
    body.data.update()
    positions = np.array([v.co[:] for v in body.data.vertices])

    # Anatomical pivots follow the source skeleton, including its naturally
    # staggered hind stance. Control joints preserve the live motion convention.
    source_heads = {
        'ROOT': (0, .70, source_min), 'pelvis': (0, 2.20, 1.30),
        'spine': (0, .75, 1.42), 'chest': (0, -.80, 1.42),
        'neck.lower': (0, -1.38, 1.58), 'neck.upper': (0, -2.02, 2.22),
        'head': (0, -2.65, 2.62), 'jaw': (0, -2.73, 2.23),
        'ear.L': (-.22, -2.63, 2.84), 'ear.R': (.22, -2.63, 2.84),
        'tail.1': (0, 2.70, 1.30), 'tail.2': (0, 3.02, .78),
        'tail.3': (0, 3.30, -.18), 'tail.4': (0, 3.40, -1.00),
    }
    for prefix, side in [('FL', -1), ('FR', 1)]:
        y = -1.23 if side < 0 else -.88
        source_heads.update({prefix + '.scapula': (side * .38, -.78, 1.52),
            prefix + '.upperarm': (side * .42, -1.45, .59),
            prefix + '.forearm': (side * .42, y, -.23),
            prefix + '.cannon': (side * .42, y, -1.51),
            prefix + '.pastern': (side * .41, y, -2.45),
            prefix + '.hoof': (side * .41, y - .055, -2.89),
            prefix + '.IK': (side * .41, y - .055, -2.89)})
    for prefix, side in [('HL', -1), ('HR', 1)]:
        y = 3.10 if side < 0 else 2.25
        source_heads.update({prefix + '.thigh': (side * .46, 2.12, 1.30),
            prefix + '.shin': (side * .42, 2.04 if side < 0 else 1.67, -.16),
            prefix + '.cannon': (side * .41, y - .09, -1.49),
            prefix + '.pastern': (side * .41, y, -2.47),
            prefix + '.hoof': (side * .41, y - .03, -2.91),
            prefix + '.IK': (side * .41, y - .03, -2.91)})
    heads = {k: normalize(v) for k, v in source_heads.items()}
    # Common articular hubs measured from the adjacent source longbone endpoint
    # bands. The source has a staggered stance; generic limb-axis guesses put
    # the fore fetlocks up to 72mm ahead of the actual articulating surfaces.
    articular_hubs = {
        'FL.pastern': (-.1379650831, .1916460246, .6397037506),
        'FR.pastern': (.1404586732, .1968440115, .4902824163),
        'HL.cannon': (-.1392316818, .5372449160, -.8245766163),
        'HR.cannon': (.1376409531, .5182694197, -.5681545138),
        'HL.pastern': (-.1345569491, .2041008174, -.8865331411),
        'HR.pastern': (.1380763501, .1776148081, -.5417071581),
    }
    for name, (x, y, z) in articular_hubs.items():
        heads[name] = Vector((x, -z, y))
    children = {b['name']: [] for b in canonical}
    for b in canonical:
        if b['parent']:
            children[b['parent']].append(b['name'])
    terminal_tails = {'head': normalize((0, -3.65, 2.20)), 'jaw': normalize((0, -3.70, 1.98)),
                      'tail.4': normalize((0, 3.38, -1.61))}
    for prefix in ['FL', 'FR', 'HL', 'HR']:
        p = source_heads[prefix + '.hoof']
        terminal_tails[prefix + '.hoof'] = normalize((p[0], p[1] - .30, p[2] - .07))
    arm_data = bpy.data.armatures.new('Spectral anatomical rig')
    arm = bpy.data.objects.new('SpectralRig', arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for spec in canonical:
        name = spec['name']
        bone = arm_data.edit_bones.new(name)
        bone.head = heads[name]
        descendants = children[name]
        target = next((k for k in descendants if not k.endswith('.IK')), None)
        bone.tail = heads[target] if target else terminal_tails.get(name, heads[name] + Vector((0, 0, .04)))
        if (bone.tail - bone.head).length < .0001:
            bone.tail = bone.head + Vector((0, 0, .04))
        if spec['parent']:
            bone.parent = arm_data.edit_bones[spec['parent']]
        bone.use_connect = False
        bone.use_deform = not name.endswith('.IK')
    bpy.ops.object.mode_set(mode='OBJECT')

    # Keep each disconnected physical bone rigid. A component's nearest joint
    # segment owns it; joints are not a distance-field substitute for anatomy.
    parent = list(range(len(positions)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for edge in body.data.edges:
        a, b = edge.vertices
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra
    components = {}
    for i in range(len(positions)):
        components.setdefault(find(i), []).append(i)
    segments = [(b.name, np.array(b.head_local), np.array(b.tail_local))
                for b in arm_data.bones if b.use_deform and b.name not in ['ROOT', 'ear.L', 'ear.R']]
    for b in arm_data.bones:
        body.vertex_groups.new(name=b.name)
    ownership = []
    for ids in components.values():
        pts = positions[ids]
        center = pts.mean(axis=0)
        distances = []
        for name, a, z in segments:
            direction = z - a
            t = np.clip(np.dot(center - a, direction) / max(np.dot(direction, direction), 1e-12), 0, 1)
            distance = np.linalg.norm(center - (a + direction * t))
            # Prevent a left limb surface from attaching to the right chain.
            if name.startswith(('FL.', 'HL.')) and center[0] > .035:
                distance += 2
            if name.startswith(('FR.', 'HR.')) and center[0] < -.035:
                distance += 2
            distances.append(distance)
        target = segments[int(np.argmin(distances))][0]
        # The acquired ribs are separate curved bone/cartilage components. Their
        # lower ends lie closer to an upperarm than the spine; proximity alone
        # therefore made the rib cage tear apart during a stride. Keep the whole
        # thorax and sternum on the chest, while the source's larger scapula,
        # humerus and femur components retain their anatomical limb ownership.
        x, height, forward = point(center)
        thoracic_fragment = len(ids) <= 750 and height > 1.0 and -.36 < forward < .82
        sternum = abs(x) < .05 and .85 < height < 1.25 and -.35 < forward < .85
        if thoracic_fragment or sternum:
            target = 'chest'
        joint_cluster = None
        if abs(x) > .09:
            side = 'L' if x < 0 else 'R'
            limb = ('F' if forward > .35 else 'H') + side
            if height < .105 and (forward > .35 or forward < -.35):
                target, joint_cluster = limb + '.hoof', 'distal phalanges and coffin bone'
            elif len(ids) <= 500 and .48 < height < .70 and forward < -.40:
                target, joint_cluster = limb + '.cannon', 'tarsal/calcaneal joint cluster'
            elif len(ids) <= 500 and .48 < height < .60 and forward > .35:
                target, joint_cluster = limb + '.cannon', 'carpal joint cluster'
        body.vertex_groups[target].add(ids, 1.0, 'REPLACE')
        ownership.append({'vertices': len(ids), 'joint': target,
                          'center': point(center), 'min': point(pts.min(axis=0)), 'max': point(pts.max(axis=0)),
                          'thoraxOwnershipOverride': thoracic_fragment or sternum,
                          'articularCluster': joint_cluster,
                          'nearestSegmentDistanceM': float(min(distances))})
    modifier = body.modifiers.new('Anatomical skin', 'ARMATURE')
    modifier.object = arm
    body.parent = arm
    bpy.context.view_layer.update()
    # Source material stays original. Elemental/spectral appearance is a private
    # runtime material adaptation, not an alteration of the acquired asset.
    for material in body.data.materials:
        if material:
            material.name = 'Skeleton source bone'
    OUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    glb = OUT / 'skeleton-rigged.glb'
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', use_selection=True,
                             export_animations=False, export_yup=True, export_skins=True,
                             export_all_influences=False, export_materials='EXPORT')
    low, high = positions.min(axis=0), positions.max(axis=0)
    anchors = { 'saddle': [point(normalize((0, .65, 1.64)))],
        'withers': [point(normalize((0, -.60, 1.70)))],
        'head': [point(normalize((0, -3.20, 2.42)))],
        'poll': [point(normalize((0, -2.70, 2.82)))],
        'muzzle': [point(normalize((0, -3.91, 2.06)))],
        'crest': [point(normalize((0, -1.80, 2.06)))],
        'tail': [point(heads['tail.1'])],
        'eyes': [point(normalize((side * .26, -3.09, 2.58))) for side in [-1, 1]],
        'nostrils': [point(normalize((side * .17, -3.81, 2.13))) for side in [-1, 1]]}
    profile = {'id': 'spectral-skeleton', 'name': 'Spectral skeleton horse',
        'file': 'skeleton-rigged.glb', 'artistBreed': True, 'bodyMesh': 'HorseBody',
        'hairMesh': None, 'withersM': withers_m, 'heightM': float(high[2] - low[2]),
        'fitScale': 1, 'fitY': float(-low[2]), 'physicalScale': True,
        'preserveSaddleAnchor': True, 'preserveSourceGroom': True,
        'anchors': anchors, 'jointCount': 40, 'sha256': digest(glb),
        'sourceCandidate': 'horse-skeleton', 'sourceBasis': 'Horse Skeleton by Diego Luján García, CC BY 4.0; anatomical rig, metre normalization and spectral adaptation by Meadowlark Ranch.',
        'license': 'CC BY 4.0', 'sourceSha256': SOURCE_SHA,
        'gameCompatibility': 'awaiting-motion-and-visual-review'}
    (OUT / 'profile.json').write_text(json.dumps(profile, indent=2, ensure_ascii=False) + '\n')
    assert digest(SOURCE) == SOURCE_SHA and receipt_path.read_bytes() == receipt_bytes
    report = {'schemaVersion': 1, 'status': 'anatomical-skin-authored-awaiting-review',
        'sourceSha256': SOURCE_SHA, 'originalSourceAndReceiptPreserved': True,
        'blenderVersion': bpy.app.version_string, 'scriptsExecuted': False,
        'sourceMeshCount': 47, 'sourceVerticesBeforeSeamWeld': original_vertices,
        'riggedVertices': len(positions), 'disconnectedPhysicalBoneComponents': len(components),
        'jointCount': len(arm_data.bones), 'componentOwnership': ownership,
        'articularHubsRawGameMetres': articular_hubs,
        'basisChanges': {'scale': scale, 'sourceGroundZ': source_min, 'centerY': center_y,
                         'withersM': withers_m, 'axisConvention': '+Z forward / +Y up after glTF export'},
        'maxInfluences': 1, 'weightsNormalized': True, 'originalMaterialSourceUsed': True,
        'gaitReview': 'pending', 'riderTackReview': 'pending', 'browserReview': 'pending',
        'gameCompatibility': 'not-yet-verified', 'outputSha256': digest(glb)}
    (OUT / 'rigging-report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'status': report['status'], 'file': str(glb), 'components': len(components),
                      'vertices': len(positions), 'joints': len(arm_data.bones)}))


if __name__ == '__main__':
    main()

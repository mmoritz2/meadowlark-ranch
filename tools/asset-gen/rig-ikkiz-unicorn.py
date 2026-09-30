"""Convert the registered ikkiz unicorn, including its real legacy hair paths.

Run using verified Blender with --factory-startup --disable-autoexec. Source
Text, Scene and WindowManager blocks are never loaded; source drivers are removed
by the reviewed append helper. This writes a review derivative, never a receipt,
source blend, shipping manifest or runtime file.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import sys

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'assets/models/horse-imports/ikkiz-unicorn'
OUT = BASE / 'game'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def game_point(p):
    return [float(p[0]), float(p[2]), float(-p[1])]


def principled(name, color, roughness=.55, metal=0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    node = material.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Metallic'].default_value = metal
    material.diffuse_color = (*color, 1)
    material.use_backface_culling = False
    return material


def convert_paths(body):
    """Read Blender's actual evaluated hair cache through its mesh operator."""
    outputs = []
    modifiers = [m for m in body.modifiers if m.type == 'PARTICLE_SYSTEM']
    originals = []
    # Some systems share ParticleSettings. Capture all originals before changing
    # any datablock, otherwise the tail records the already-changed mane density.
    for ps in body.particle_systems:
        settings = ps.settings
        originals.append({'name': ps.name, 'originalRenderChildren': settings.rendered_child_count,
                          'originalDisplayChildren': settings.child_percent,
                          'rootRadius': settings.root_radius, 'tipRadius': settings.tip_radius,
                          'radiusScale': settings.radius_scale})
    for ps in body.particle_systems:
        settings = ps.settings
        settings.display_percentage = 100
        settings.display_method = 'RENDER'
        settings.child_percent = min(settings.rendered_child_count, 40 if ps.name in ('grzywa', 'ogon') else 8)
    for modifier in modifiers:
        modifier.show_viewport = True
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    for index, modifier in enumerate(modifiers):
        bpy.ops.object.select_all(action='DESELECT')
        body.select_set(True)
        bpy.context.view_layer.objects.active = body
        body.particle_systems.active_index = index
        before = set(bpy.context.scene.objects)
        result = bpy.ops.object.modifier_convert(modifier=modifier.name)
        if result != {'FINISHED'}:
            raise RuntimeError(f'Actual source hair conversion failed: {modifier.name}: {result}')
        meshes = [o for o in bpy.context.scene.objects if o not in before and o.type == 'MESH']
        if len(meshes) != 1:
            raise RuntimeError('Expected one converted strand mesh')
        obj = meshes[0]
        points = [obj.matrix_world @ v.co for v in obj.data.vertices]
        adjacency = [[] for _ in points]
        for edge in obj.data.edges:
            a, b = edge.vertices
            adjacency[a].append(b)
            adjacency[b].append(a)
        visited, paths = set(), []
        for start, neighbours in enumerate(adjacency):
            if start in visited or len(neighbours) != 1:
                continue
            path, previous, current = [], -1, start
            while current not in visited:
                visited.add(current)
                path.append(points[current])
                next_ids = [i for i in adjacency[current] if i != previous]
                if not next_ids:
                    break
                if len(next_ids) != 1:
                    raise RuntimeError('Unexpected branching in a legacy hair path')
                previous, current = current, next_ids[0]
            if len(path) > 1:
                # The conversion operator orders each strand root first. Keep
                # original endpoints; only reduce the sampled curve resolution.
                stride = 4 if len(path) > 17 else 1
                ids = list(range(0, len(path), stride))
                if ids[-1] != len(path) - 1:
                    ids.append(len(path) - 1)
                paths.append([path[i] for i in ids])
        if not paths or len(visited) != len(points):
            raise RuntimeError(f'Incomplete strand cache extraction: {modifier.name}')
        original = originals[index]
        outputs.append({'name': original['name'], 'paths': paths, 'settings': original,
                        'convertedVertices': len(points), 'displayChildren': body.particle_systems[index].settings.child_percent})
        bpy.data.objects.remove(obj, do_unlink=True)
    return outputs


def bake_diffuse(body):
    """Bake the artist's legacy diffuse colour, excluding lighting and shadows.

    Original packed files are bump/flow images, not colour atlases. Each source
    material is baked in its own existing UV space to avoid treating those maps
    as colour. The source horn is retained as a separate material/mesh.
    """
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 8
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.use_pass_color = True
    scene.render.bake.margin = 12
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    images, materials = {}, {}
    used = {p.material_index for p in body.data.polygons}
    for i in sorted(used):
        original = body.data.materials[i]
        if original is None or not original.use_nodes:
            raise RuntimeError('Expected the original source material network')
        image = bpy.data.images.new('Unicorn source colour ' + str(i), width=2048, height=2048, alpha=False)
        image.colorspace_settings.name = 'sRGB'
        node = original.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = image
        original.node_tree.nodes.active = node
        node.select = True
        images[i] = image
    result = bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_clear=True)
    if result != {'FINISHED'}:
        raise RuntimeError('Legacy diffuse colour bake failed')
    for i, image in images.items():
        path = OUT / ('source-horn-albedo.png' if 'rogu' in body.data.materials[i].name else 'source-body-albedo.png')
        image.filepath_raw = str(path)
        image.file_format = 'PNG'
        image.save()
        old = body.data.materials[i]
        new = principled('Unicorn source horn' if 'rogu' in old.name else 'Unicorn source coat', (1, 1, 1),
                         .36 if 'rogu' in old.name else .66, .16 if 'rogu' in old.name else 0)
        tree = new.node_tree
        texture = tree.nodes.new('ShaderNodeTexImage')
        texture.image = image
        tree.links.new(texture.outputs['Color'], tree.nodes['Principled BSDF'].inputs['Base Color'])
        materials[i] = new
    return materials, {i: {'file': Path(image.filepath_raw).relative_to(ROOT).as_posix(), 'sha256': digest(Path(image.filepath_raw))} for i, image in images.items()}


def main():
    if not {'--factory-startup', '--disable-autoexec'} <= set(sys.argv):
        raise RuntimeError('Trusted launch flags missing')
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location('owned_unicorn_append', Path(__file__).with_name('prepare-unicorn-review.py'))
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    receipt, removed = helper.safe_append()
    OUT.mkdir(parents=True, exist_ok=True)
    receipt_bytes = (BASE / 'source/receipt.json').read_bytes()
    body = bpy.data.objects['kon']
    eyes = bpy.data.objects['kon_oczy']
    source_arm = bpy.data.objects['horse_Armature']
    source_arm.data.pose_position = 'REST'
    for bone in source_arm.pose.bones:
        for constraint in list(bone.constraints):
            bone.constraints.remove(constraint)
    for modifier in body.modifiers:
        if modifier.type == 'MULTIRES':
            modifier.show_viewport = True
            modifier.levels = 1
            modifier.render_levels = 1
    strands = convert_paths(body)
    for modifier in body.modifiers:
        if modifier.type == 'PARTICLE_SYSTEM':
            modifier.show_viewport = False
            modifier.show_render = False
    baked_materials, baked_images = bake_diffuse(body)
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    new_body = body.copy()
    new_body.data = bpy.data.meshes.new_from_object(body.evaluated_get(depsgraph), preserve_all_data_layers=True, depsgraph=depsgraph)
    bpy.context.scene.collection.objects.link(new_body)
    new_body.modifiers.clear()
    body_world = body.matrix_world.copy()
    source_positions = np.array([(body_world @ v.co)[:] for v in new_body.data.vertices])
    floor = float(source_positions[:, 2].min())
    torso = source_positions[(source_positions[:, 1] > -1.5) & (source_positions[:, 1] < 1.7) & (np.abs(source_positions[:, 0]) < 1.3)]
    withers_source = float(torso[:, 2].max())
    withers_m = 1.60
    scale = withers_m / (withers_source - floor)
    center_y = .70

    def normalize(p):
        return Vector((float(p[0]) * scale, (float(p[1]) - center_y) * scale, (float(p[2]) - floor) * scale))

    source_bones = source_arm.data.bones

    def source_head(name):
        return source_arm.matrix_world @ source_bones[name].head_local

    def source_tail(name):
        return source_arm.matrix_world @ source_bones[name].tail_local

    primary = {'ROOT': 'Root', 'pelvis': 'DEF-zad', 'spine': 'DEF-siodlo', 'chest': 'DEF-żebra',
               'neck.lower': 'DEF-szyja.001', 'neck.upper': 'DEF-szyja.004', 'head': 'DEF-łeb',
               'tail.1': 'DEF-ogon.001', 'tail.2': 'DEF-ogon.002'}
    heads_source = {name: source_head(old) for name, old in primary.items()}
    heads_source['ROOT'] = Vector((0, center_y, floor))
    heads_source['tail.3'] = source_head('DEF-ogon.002').lerp(source_tail('DEF-ogon.002'), .55)
    heads_source['tail.4'] = source_tail('DEF-ogon.002')
    heads_source['ear.L'] = Vector((-.52, -6.48, 13.83))
    heads_source['ear.R'] = Vector((.52, -6.48, 13.83))
    heads_source['jaw'] = Vector((0, -7.28, 12.77))
    leg_mapping = {}
    for prefix, side in [('FL', 'R'), ('FR', 'L')]:
        for joint, native in [('scapula', 'def-łopatka'), ('upperarm', 'DEF-ramienna'), ('forearm', 'DEF-promieniowa'),
                              ('cannon', 'DEF-nadpęcinowa'), ('pastern', 'DEF-pęcinowa'), ('hoof', 'DEF-kopytoprzod')]:
            leg_mapping[prefix + '.' + joint] = native + '.' + side
    for prefix, side in [('HL', 'R'), ('HR', 'L')]:
        for joint, native in [('thigh', 'DEF-udowa'), ('shin', 'DEF-piszczelowa'), ('cannon', 'DEF-t-śródstopia'),
                              ('pastern', 'DEF-t-palec.001'), ('hoof', 'DEF-t-palec.002')]:
            leg_mapping[prefix + '.' + joint] = native + '.' + side
    for name, native in leg_mapping.items():
        heads_source[name] = source_head(native)
    for prefix in ['FL', 'FR', 'HL', 'HR']:
        heads_source[prefix + '.IK'] = heads_source[prefix + '.hoof'].copy()
    heads = {name: normalize(p) for name, p in heads_source.items()}
    canonical = json.loads((OUT / 'source-rig-authoring-inspection.json').read_text())['canonicalRig']
    canonical = next(o['bones'] for o in canonical if o['type'] == 'ARMATURE')
    children = {b['name']: [] for b in canonical}
    for b in canonical:
        if b['parent']:
            children[b['parent']].append(b['name'])
    arm_data = bpy.data.armatures.new('Unicorn anatomical rig')
    arm = bpy.data.objects.new('UnicornRig', arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for row in canonical:
        name = row['name']
        bone = arm_data.edit_bones.new(name)
        bone.head = heads[name]
        child = next((k for k in children[name] if not k.endswith('.IK')), None)
        if child:
            bone.tail = heads[child]
        elif name in leg_mapping:
            bone.tail = normalize(source_tail(leg_mapping[name]))
        elif name == 'head':
            bone.tail = normalize(source_tail('DEF-łeb'))
        else:
            bone.tail = heads[name] + Vector((0, -.035, .045))
        if (bone.tail - bone.head).length < .0001:
            bone.tail = bone.head + Vector((0, 0, .03))
        if row['parent']:
            bone.parent = arm_data.edit_bones[row['parent']]
        bone.use_connect = False
        bone.use_deform = not name.endswith('.IK')
    bpy.ops.object.mode_set(mode='OBJECT')
    semantic = {old: name for name, old in {**primary, **leg_mapping}.items()}
    semantic.update({'DEF-szyja.002': 'neck.lower', 'DEF-szyja.003': 'neck.upper',
                     'def-biceps.L': 'FR.upperarm', 'def-biceps.R': 'FL.upperarm',
                     'def-nadg.R': 'FL.cannon', 'ik-palec_przedni.R': 'FL.pastern', 'ik-palec_przedni.L': 'FR.pastern'})
    old_groups = {group.index: group.name for group in new_body.vertex_groups}
    weights = []
    missing = set()
    for vertex in new_body.data.vertices:
        value = {}
        for group in vertex.groups:
            native = old_groups[group.group]
            target = semantic.get(native)
            if target:
                value[target] = value.get(target, 0) + float(group.weight)
            elif group.weight > 1e-5:
                missing.add(native)
        weights.append(value)
    if missing:
        raise RuntimeError('Unmapped source deformation groups: ' + str(missing))
    normalized_positions = np.array([normalize(p)[:] for p in source_positions])
    ear_vertices = {'ear.L': 0, 'ear.R': 0}
    for index, value in enumerate(weights):
        if not value:
            # The horn uses the source head transform rather than vertex groups.
            value['head'] = 1
        position = normalized_positions[index]
        source = source_positions[index]
        # The source's ear surfaces are part of its head mesh. Add real ear
        # deformation with a soft root, keeping the central horn on the head.
        if abs(source[0]) > .22 and abs(source[1] + 6.5) < 1.05 and source[2] > 13.7:
            name = 'ear.L' if source[0] < 0 else 'ear.R'
            influence = min(1., max(0., (source[2] - 13.7) / .72))
            head_weight = value.get('head', 0)
            if head_weight and influence:
                value['head'] = head_weight * (1 - influence)
                value[name] = head_weight * influence
                ear_vertices[name] += 1
        if position[2] < .055:
            prefix = min(['FL', 'FR', 'HL', 'HR'], key=lambda k: (Vector(position) - heads[k + '.hoof']).length)
            value.clear()
            value[prefix + '.hoof'] = 1
        tail_weight = value.pop('tail.2', 0)
        if tail_weight:
            a, z = heads['tail.2'][2], heads['tail.4'][2]
            t = min(1., max(0., (a - position[2]) / max(a - z, .001))) * 2
            low = int(t)
            low = min(low, 1)
            for name, portion in [('tail.' + str(low + 2), 1 - (t - low)), ('tail.' + str(low + 3), t - low)]:
                if portion > 0:
                    value[name] = value.get(name, 0) + tail_weight * portion
        total = sum(value.values())
        for name in value:
            value[name] /= total
    new_body.vertex_groups.clear()
    for bone in arm_data.bones:
        new_body.vertex_groups.new(name=bone.name)
    for vertex, position, value in zip(new_body.data.vertices, normalized_positions, weights):
        vertex.co = position
        for name, weight in value.items():
            new_body.vertex_groups[name].add([vertex.index], weight, 'REPLACE')
    new_body.parent = None
    new_body.matrix_world = Matrix.Identity(4)
    meshes = []
    used_materials = {p.material_index for p in new_body.data.polygons}
    for index in sorted(used_materials):
        obj = new_body.copy()
        obj.data = new_body.data.copy()
        bpy.context.scene.collection.objects.link(obj)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index != index], context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        for face in bm.faces:
            face.material_index = 0
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.materials.clear()
        obj.data.materials.append(baked_materials[index])
        obj.name = 'HorseHorn' if 'rogu' in body.data.materials[index].name else 'HorseBody'
        meshes.append(obj)
    bpy.data.objects.remove(new_body, do_unlink=True)
    tree = KDTree(len(normalized_positions))
    for i, p in enumerate(normalized_positions):
        tree.insert(p, i)
    tree.balance()
    hair_reports = []
    for item in strands:
        verts, faces, strand_weights = [], [], []
        root_distances = []
        max_tip_clearance_adjustment = 0.
        for path in item['paths']:
            points = [normalize(p) for p in path]
            _, root_id, distance = tree.find(points[0])
            root_distances.append(distance)
            attached = weights[root_id].copy()
            if item['name'] == 'ogon':
                # The source's longest tail paths reach the hoof plane. Preserve
                # the root/flow, but lift the lowest ends smoothly so gait bob
                # does not drag those fibers through the runtime ground.
                for point in points:
                    adjustment = .065 * float(np.exp(-max(0., point.z - .24) / .15))
                    point.z += adjustment
                    max_tip_clearance_adjustment = max(max_tip_clearance_adjustment, adjustment)
            radius = item['settings']['radiusScale'] * item['settings']['rootRadius'] * scale
            for j, point in enumerate(points):
                direction = (points[min(j + 1, len(points) - 1)] - points[max(j - 1, 0)]).normalized()
                reference = Vector((0, 0, 1)) if abs(direction.z) < .9 else Vector((1, 0, 0))
                side = direction.cross(reference).normalized()
                other = direction.cross(side).normalized()
                t = j / (len(points) - 1)
                width = max(radius * ((1 - t) + item['settings']['tipRadius'] * t), .000018)
                skin_value = attached.copy()
                if item['name'] == 'ogon':
                    a, z = heads['tail.2'][2], heads['tail.4'][2]
                    phase = min(1., max(0., (a - point.z) / max(a - z, .001))) * 2
                    low = min(int(phase), 1)
                    skin_value = {'tail.' + str(low + 2): 1 - (phase - low), 'tail.' + str(low + 3): phase - low}
                for axis in [side, other]:
                    verts.extend([tuple(point - axis * width), tuple(point + axis * width)])
                    strand_weights.extend([skin_value, skin_value])
                if j:
                    base = len(verts) - 8
                    for side_id in [0, 2]:
                        faces.append((base + side_id, base + side_id + 1, base + side_id + 5, base + side_id + 4))
        if max(root_distances) > .06:
            raise RuntimeError(f'Legacy {item["name"]} roots are not aligned with the source surface: {max(root_distances)}m')
        mesh = bpy.data.meshes.new('Source groom ' + item['name'])
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new('HorseGroom_' + item['name'], mesh)
        bpy.context.scene.collection.objects.link(obj)
        dark = item['name'] == 'rzesy'
        mesh.materials.append(principled('Unicorn lashes' if dark else 'Unicorn white groom', (.045, .026, .014) if dark else (.80, .78, .72), .55))
        for bone in arm_data.bones:
            obj.vertex_groups.new(name=bone.name)
        for vertex, value in zip(mesh.vertices, strand_weights):
            for name, weight in value.items():
                if weight > 0:
                    obj.vertex_groups[name].add([vertex.index], weight, 'REPLACE')
        for poly in mesh.polygons:
            poly.use_smooth = True
        meshes.append(obj)
        hair_reports.append({'name': item['name'], 'actualSourcePaths': len(item['paths']),
                             'convertedCacheVertices': item['convertedVertices'], 'triangles': len(faces) * 2,
                             'maxRootSurfaceDistanceM': max(root_distances), 'maxTailTipClearanceAdjustmentM': max_tip_clearance_adjustment, 'displayChildren': item['displayChildren'],
                             **item['settings']})
    eye_copy = eyes.copy()
    eye_copy.data = bpy.data.meshes.new_from_object(eyes.evaluated_get(depsgraph), depsgraph=depsgraph)
    bpy.context.scene.collection.objects.link(eye_copy)
    eye_matrix = eyes.matrix_world.copy()
    for vertex in eye_copy.data.vertices:
        vertex.co = normalize(eye_matrix @ vertex.co)
    eye_copy.parent = None
    eye_copy.matrix_world = Matrix.Identity(4)
    eye_copy.modifiers.clear()
    eye_copy.vertex_groups.clear()
    eye_copy.vertex_groups.new(name='head').add(list(range(len(eye_copy.data.vertices))), 1, 'REPLACE')
    for i in range(len(eye_copy.data.materials)):
        eye_copy.data.materials[i] = principled('Unicorn source eye ' + str(i), (.11, .065, .024) if i == 0 else (.016, .013, .010), .08)
    eye_copy.name = 'HorseEyes'
    meshes.append(eye_copy)
    for obj in meshes:
        modifier = obj.modifiers.new('Canonical anatomical skin', 'ARMATURE')
        modifier.object = arm
        obj.parent = arm
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = arm
    path = OUT / 'unicorn-rigged.glb'
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                             export_animations=False, export_yup=True, export_skins=True,
                             export_all_influences=False, export_materials='EXPORT')
    anchors_source = {'saddle': [(0, .70, withers_source - .16)], 'withers': [(0, -.9, withers_source)],
                      'head': [(0, -7.1, 13.1)], 'poll': [(0, -6.62, 14)], 'muzzle': [(0, -9.07, 10.55)],
                      'crest': [(0, -4.8, 12.1)], 'tail': [heads_source['tail.1']],
                      'eyes': [(-.69, -7.8, 12.54), (.69, -7.8, 12.54)],
                      'nostrils': [(-.37, -8.8, 10.78), (.37, -8.8, 10.78)]}
    profile = {'id': 'ikkiz-unicorn', 'name': 'Unicorn of Jill Janus', 'file': path.name,
               'artistBreed': True, 'bodyMesh': 'HorseBody', 'jointCount': 40,
               'withersM': withers_m, 'heightM': float((source_positions[:, 2].max() - floor) * scale),
               'fitScale': 1, 'fitY': 0, 'physicalScale': True,
               'anchors': {k: [game_point(normalize(v)) for v in values] for k, values in anchors_source.items()},
               'nativeHorn': True, 'preserveSourceGroom': True, 'preserveSaddleAnchor': True,
               'sourceCandidate': 'ikkiz-unicorn', 'license': 'CC BY 3.0',
               'sourceBasis': 'Unicorn (of Jill Janus) by ikkiz, CC BY 3.0; REST repose, groom conversion, material bake and rig by Meadowlark Ranch.',
               'sourceSha256': helper.EXPECTED_BLEND_HASH, 'sha256': digest(path),
               'neutralCoatFile': 'source-body-albedo.png', 'status': 'rigged-visual-and-motion-review-required'}
    # This byte PNG reload exposes encoded sRGB values. Match the runtime
    # texture's sRGB-to-linear conversion before measuring its dye reference.
    image = bpy.data.images.load(str(OUT / 'source-body-albedo.png'), check_existing=False)
    linear = np.array(image.pixels[:], dtype=np.float64).reshape(-1, 4)[:, :3]
    linear = np.where(linear <= .04045, linear / 12.92, ((linear + .055) / 1.055) ** 2.4)
    luminance = linear @ np.array([.299, .587, .114])
    profile['neutralCoatLuminance'] = profile['coatLuminance'] = float(np.median(luminance[luminance > .005]))
    (OUT / 'profile.json').write_text(json.dumps(profile, indent=2, ensure_ascii=False) + '\n')
    report = {'schemaVersion': 1, 'status': 'rigged-review-derivative', 'sourceBlendUnchanged': digest(helper.SOURCE) == helper.EXPECTED_BLEND_HASH,
              'receiptUnchanged': (BASE / 'source/receipt.json').read_bytes() == receipt_bytes,
              'scriptsExecuted': False, 'removedDrivers': removed, 'sourcePose': 'REST, neutral planted stance',
              'sourceConstraintCycleRemovedFromDerivative': True, 'jointCount': 40,
              'sourceWorldFloor': floor, 'sourceWorldWithers': withers_source, 'scaleToMetres': scale,
              'semanticJointMerge': semantic, 'earDeformationVertices': ear_vertices, 'groom': hair_reports, 'diffuseColorBakes': baked_images,
              'materialChanges': ['Diffuse colour baked from original legacy Cycles materials in original UVs; packed flow/bump are not used as colour.',
                                  'Horn retained as separate source geometry/material.', 'Eye glass simplified to glTF-compatible dark glossy eyes.',
                                  'Hair cache paths converted to tapered crossed ribbons; child density and long-path samples reduced explicitly for runtime.',
                                  'Longest tail fiber ends lifted smoothly by at most65mm for ground clearance; strand roots and original source file unchanged.'],
              'file': path.name, 'sha256': digest(path), 'bytes': path.stat().st_size,
              'meshes': [{'name': o.name, 'vertices': len(o.data.vertices), 'polygons': len(o.data.polygons)} for o in meshes]}
    assert report['sourceBlendUnchanged'] and report['receiptUnchanged']
    (OUT / 'conversion-report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'file': str(path), 'sha256': report['sha256'], 'groom': hair_reports, 'status': report['status']}), flush=True)


if __name__ == '__main__':
    main()

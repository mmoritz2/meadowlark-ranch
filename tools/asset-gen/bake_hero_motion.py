"""Append browser-sampled local bone poses to a new GLB without re-exporting art.

The original BIN chunk is retained byte for byte. Animation data is appended,
and source mesh/material/image/skin/node definitions are left untouched.

Sample contract: version=1, fps=60, source filename, optional sourceSha256,
bones=[33 source joint names], clips=[{name, loop, duration, frames:[
{time, rotations:[33*4 XYZW floats], translations:[33*3 XYZ floats]}]}].
Translations may be omitted to retain the source rest translations. Samples
must be at 60 Hz, with an additional exact final-time sample when needed.
"""
from __future__ import annotations

import argparse
import array
import copy
import hashlib
import json
import math
from pathlib import Path
import struct
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / 'assets/models/hero-horse'
EXPECTED = ('idle', 'walk', 'trot', 'canter-left', 'canter-right',
            'gallop-left', 'gallop-right', 'jump')
JSON_CHUNK, BIN_CHUNK = 0x4E4F534A, 0x004E4942


def read_glb(path):
    raw = Path(path).read_bytes()
    if len(raw) < 28 or struct.unpack_from('<4sII', raw) != (b'glTF', 2, len(raw)):
        raise ValueError(f'Invalid GLB header: {path}')
    chunks, offset = {}, 12
    while offset < len(raw):
        length, kind = struct.unpack_from('<II', raw, offset)
        if kind in chunks or offset + 8 + length > len(raw):
            raise ValueError('Invalid or duplicated GLB chunk')
        chunks[kind] = raw[offset + 8:offset + 8 + length]
        offset += 8 + length
    if set(chunks) != {JSON_CHUNK, BIN_CHUNK}:
        raise ValueError('Expected one embedded JSON and one BIN chunk')
    doc = json.loads(chunks[JSON_CHUNK])
    if len(doc.get('buffers', [])) != 1 or doc['buffers'][0].get('uri'):
        raise ValueError('Source must have one embedded GLB buffer')
    return doc, chunks[BIN_CHUNK], hashlib.sha256(raw).hexdigest()


def encoded_glb(doc, binary):
    binary = bytes(binary) + bytes((-len(binary)) % 4)
    doc['buffers'][0]['byteLength'] = len(binary)
    header = json.dumps(doc, separators=(',', ':'), allow_nan=False).encode('utf-8')
    header += b' ' * ((-len(header)) % 4)
    return (struct.pack('<4sII', b'glTF', 2, 28 + len(header) + len(binary))
            + struct.pack('<II', len(header), JSON_CHUNK) + header
            + struct.pack('<II', len(binary), BIN_CHUNK) + binary)


def values(data, count, width, label):
    if not isinstance(data, list):
        raise ValueError(f'{label} must be an array')
    if len(data) == count and data and isinstance(data[0], list):
        if any(len(row) != width for row in data):
            raise ValueError(f'{label} has an incorrectly sized bone value')
        data = [value for row in data for value in row]
    if len(data) != count * width:
        raise ValueError(f'{label} needs {count * width} numbers')
    result = [float(value) for value in data]
    if not all(math.isfinite(value) for value in result):
        raise ValueError(f'{label} contains non-finite values')
    return [result[i:i + width] for i in range(0, len(result), width)]


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def rotation_error(a, b):
    return 2 * math.acos(min(1, abs(dot(a, b))))


def decode_float_accessor(doc, binary, index):
    item = doc['accessors'][index]
    view = doc['bufferViews'][item['bufferView']]
    if item['componentType'] != 5126 or view.get('byteStride'):
        raise ValueError('Animation exporter expected tightly packed float32')
    width = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[item['type']]
    offset = view.get('byteOffset', 0) + item.get('byteOffset', 0)
    flat = struct.unpack_from(f'<{item["count"] * width}f', binary, offset)
    return [flat[i:i + width] for i in range(0, len(flat), width)]


def prepare_clip(clip, names, rest, fps):
    name = clip['name']
    duration = float(clip.get('duration', 0))
    frames = clip.get('frames', [])
    if not math.isfinite(duration) or duration <= 0 or len(frames) < 2:
        raise ValueError(f'{name}: a positive duration and at least two samples are required')
    loop = bool(clip.get('loop', name != 'jump'))
    times, rotations, translations = [], [], []
    max_norm_correction = 0
    for index, frame in enumerate(frames):
        time = float(frame['time'])
        if not math.isfinite(time) or (times and time <= times[-1]):
            raise ValueError(f'{name}: frame times must be finite and increasing')
        expected_time = duration if index == len(frames) - 1 else index / fps
        if abs(time - expected_time) > 1e-5 or time > duration + 1e-5:
            raise ValueError(f'{name}: frame {index} is not on the {fps} Hz sample grid')
        if times and time - times[-1] > 1 / fps + 1e-5:
            raise ValueError(f'{name}: missing a {fps} Hz sample before frame {index}')
        q = values(frame['rotations'], len(names), 4, f'{name} frame {index} rotations')
        p = values(frame.get('translations', rest), len(names), 3, f'{name} frame {index} translations')
        for bone, quaternion in enumerate(q):
            norm = math.sqrt(dot(quaternion, quaternion))
            if norm < 1e-8:
                raise ValueError(f'{name}: zero quaternion on {names[bone]}')
            if abs(norm - 1) > .001:
                raise ValueError(f'{name}: {names[bone]} quaternion is not normalized (length {norm:.6f})')
            max_norm_correction = max(max_norm_correction, abs(norm - 1))
            q[bone] = [value / norm for value in quaternion]
            if rotations and dot(q[bone], rotations[-1][bone]) < 0:
                q[bone] = [-value for value in q[bone]]
        times.append(time)
        rotations.append(q)
        translations.append(p)
    if abs(times[0]) > 1e-7 or abs(times[-1] - duration) > 1e-6:
        raise ValueError(f'{name}: samples must include time zero and the exact duration')
    before_rotation = max(rotation_error(rotations[0][b], rotations[-1][b]) for b in range(len(names)))
    before_translation = max(math.dist(translations[0][b], translations[-1][b]) for b in range(len(names)))
    if loop:
        if before_rotation > .001 or before_translation > .0001:
            raise ValueError(f'{name}: loop does not close (rotation {before_rotation:.7f} rad, '
                             f'translation {before_translation:.7f}); fix the sampled poses')
        # Exact endpoint equivalence, retaining a continuous quaternion hemisphere.
        for bone in range(len(names)):
            sign = -1 if dot(rotations[0][bone], rotations[-2][bone]) < 0 else 1
            rotations[-1][bone] = [sign * value for value in rotations[0][bone]]
            translations[-1][bone] = translations[0][bone].copy()
    return times, rotations, translations, {
        'name': name, 'loop': loop, 'duration': duration, 'frames': len(times),
        'maxQuaternionNormCorrection': max_norm_correction,
        'sampledEndpointRotationErrorRadians': before_rotation,
        'sampledEndpointTranslationError': before_translation,
    }


def bake(samples_path, source_path, output_path, allow_partial=False):
    samples_path, source_path, output_path = map(Path, (samples_path, source_path, output_path))
    if source_path.resolve() == output_path.resolve():
        raise ValueError('Output must be a new file, never the rig source')
    source, source_binary, source_hash = read_glb(source_path)
    samples = json.loads(samples_path.read_text(encoding='utf-8-sig'))
    if samples.get('version') != 1 or samples.get('fps') != 60:
        raise ValueError('Expected pose contract version 1 at 60 fps')
    if Path(samples.get('source', '')).name != source_path.name:
        raise ValueError('The sampled source filename does not match the rig source')
    if samples.get('sourceSha256') and samples['sourceSha256'].lower() != source_hash:
        raise ValueError('Rig changed after poses were sampled (sourceSha256 mismatch)')
    joints = source['skins'][0]['joints']
    names = [source['nodes'][index]['name'] for index in joints]
    if len(joints) != 33 or samples.get('bones') != names:
        raise ValueError('Sample bone names/order must match all 33 source skin joints')
    if any('matrix' in source['nodes'][index] for index in joints):
        raise ValueError('Animated bone nodes must use TRS, not a matrix')
    rest = [source['nodes'][index].get('translation', [0, 0, 0]) for index in joints]
    clip_names = [clip['name'] for clip in samples.get('clips', [])]
    if not clip_names or len(set(clip_names)) != len(clip_names):
        raise ValueError('Clip names must be nonempty and unique')
    if not allow_partial and set(clip_names) != set(EXPECTED):
        raise ValueError(f'Expected exactly these clips: {", ".join(EXPECTED)}')
    old_names = {clip.get('name') for clip in source.get('animations', [])}
    if old_names.intersection(clip_names):
        raise ValueError('A named clip already exists in the source GLB')
    doc, binary = copy.deepcopy(source), bytearray(source_binary)
    doc.setdefault('animations', [])
    reports = []

    def append(rows, kind, bounds=False):
        binary.extend(bytes((-len(binary)) % 4))
        offset = len(binary)
        floats = array.array('f', (value for row in rows for value in row))
        if sys.byteorder != 'little':
            floats.byteswap()
        binary.extend(floats.tobytes())
        view_index = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(binary) - offset})
        item = {'bufferView': view_index, 'componentType': 5126, 'count': len(rows), 'type': kind}
        if bounds:
            width = len(rows[0])
            item['min'] = [min(floats[i::width]) for i in range(width)]
            item['max'] = [max(floats[i::width]) for i in range(width)]
        index = len(doc['accessors'])
        doc['accessors'].append(item)
        return index

    for clip in samples['clips']:
        times, rotations, translations, report = prepare_clip(clip, names, rest, 60)
        input_index = append([[time] for time in times], 'SCALAR', bounds=True)
        animation = {'name': clip['name'], 'samplers': [], 'channels': [],
                     'extras': {'loop': report['loop'], 'fps': 60, 'source': 'browser sampled IK poses'}}
        for field in ('speedMps', 'lead', 'rootMotion'):
            if field in clip:
                animation['extras'][field] = clip[field]
                report[field] = clip[field]
        for bone, node in enumerate(joints):
            for track, kind, frames in [('rotation', 'VEC4', rotations), ('translation', 'VEC3', translations)]:
                output_index = append([frame[bone] for frame in frames], kind)
                sampler = len(animation['samplers'])
                animation['samplers'].append({'input': input_index, 'output': output_index, 'interpolation': 'LINEAR'})
                animation['channels'].append({'sampler': sampler, 'target': {'node': node, 'path': track}})
        doc['animations'].append(animation)
        report['channels'] = len(animation['channels'])
        reports.append(report)

    # Validate the encoded float32 payload, rather than only its Python inputs.
    max_norm_error, min_adjacent_dot = 0, 1
    for animation, report in zip(doc['animations'][-len(reports):], reports):
        for channel in animation['channels']:
            sampler = animation['samplers'][channel['sampler']]
            rows = decode_float_accessor(doc, binary, sampler['output'])
            if not all(math.isfinite(value) for row in rows for value in row):
                raise ValueError(f'{animation["name"]}: invalid float32 animation payload')
            if channel['target']['path'] == 'rotation':
                max_norm_error = max(max_norm_error, max(abs(math.sqrt(dot(q, q)) - 1) for q in rows))
                min_adjacent_dot = min(min_adjacent_dot, min(dot(a, b) for a, b in zip(rows, rows[1:])))
                if report['loop'] and abs(abs(dot(rows[0], rows[-1])) - 1) > 1e-6:
                    raise ValueError('Encoded rotation loop endpoint is not equivalent')
            elif report['loop'] and rows[0] != rows[-1]:
                raise ValueError('Encoded translation loop endpoint changed')
    if min_adjacent_dot < -1e-6 or max_norm_error > 1e-6:
        raise ValueError('Quaternion continuity/normalization failed after encoding')
    if binary[:len(source_binary)] != source_binary:
        raise AssertionError('Source BIN data was modified')
    for field in ('meshes', 'images', 'materials', 'textures', 'samplers', 'skins', 'nodes', 'scenes'):
        if doc.get(field) != source.get(field):
            raise AssertionError(f'Source {field} definitions were modified')
    if doc['bufferViews'][:len(source['bufferViews'])] != source['bufferViews'] or doc['accessors'][:len(source['accessors'])] != source['accessors']:
        raise AssertionError('Source accessor or view definitions were modified')
    if hashlib.sha256(source_path.read_bytes()).hexdigest() != source_hash:
        raise ValueError('Rig source changed during animation baking')
    result = encoded_glb(doc, binary)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = output_path.with_suffix(output_path.suffix + '.tmp')
    temporary.write_bytes(result)
    temporary.replace(output_path)
    report = {'version': 1, 'source': str(source_path), 'sourceSha256': source_hash,
              'samples': str(samples_path), 'samplesSha256': hashlib.sha256(samples_path.read_bytes()).hexdigest(),
              'output': str(output_path), 'outputSha256': hashlib.sha256(result).hexdigest(),
              'fps': 60, 'bones': names, 'clips': reports, 'preservedSourceBinaryBytes': len(source_binary),
              'sourceBinaryPreserved': True, 'sourceDefinitionsPreserved': True,
              'maxEncodedQuaternionNormError': max_norm_error, 'minimumAdjacentQuaternionDot': min_adjacent_dot}
    output_path.with_suffix('.animations.json').write_text(json.dumps(report, indent=2))
    return report


def import_blender(input_path, output_path):
    import bpy
    document, _, _ = read_glb(input_path)
    clips = {clip['name']: clip for clip in document['animations']}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 60
    bpy.context.scene.frame_start = 0
    bpy.ops.import_scene.gltf(filepath=str(Path(input_path).resolve()))
    actions = []
    for action in bpy.data.actions:
        action.use_fake_user = True
        if action.name in clips:
            action['loop'] = clips[action.name].get('extras', {}).get('loop', False)
            action['source_fps'] = 60
        actions.append({'name': action.name, 'frameRange': list(action.frame_range), 'slots': len(action.slots)})
    missing = set(clips) - {action['name'] for action in actions}
    if missing:
        raise ValueError(f'Blender import is missing named actions: {sorted(missing)}')
    bpy.context.scene.frame_end = math.ceil(max(action['frameRange'][1] for action in actions))
    for image in bpy.data.images:
        if image.source == 'FILE':
            image.pack()
    bpy.context.scene.frame_set(0)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(Path(output_path).resolve()))
    Path(output_path).with_suffix('.actions.json').write_text(json.dumps({'fps': 60, 'actions': actions}, indent=2))
    print('BLENDER_ACTIONS_READY', json.dumps(actions))


def main():
    arguments = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    if arguments and arguments[0] == '--import-blend':
        import_blender(arguments[1], arguments[2])
        return
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('samples', type=Path, nargs='?')
    parser.add_argument('--source', type=Path, default=MODELS / 'hero-rigged-v2.glb')
    parser.add_argument('--output', type=Path, default=MODELS / 'hero-animated.glb')
    parser.add_argument('--blend', type=Path, help='Optional editable Blender action library')
    parser.add_argument('--blender', default=r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe')
    parser.add_argument('--allow-partial', action='store_true', help='Only for an explicitly requested partial sample set')
    parser.add_argument('--describe-source', action='store_true')
    args = parser.parse_args(arguments)
    if args.describe_source:
        doc, _, digest = read_glb(args.source)
        print(json.dumps({'version': 1, 'fps': 60, 'source': args.source.name, 'sourceSha256': digest,
                          'bones': [doc['nodes'][i]['name'] for i in doc['skins'][0]['joints']],
                          'requiredClips': list(EXPECTED)}, indent=2))
        return
    if args.samples is None:
        parser.error('a sampled-pose JSON file is required')
    report = bake(args.samples, args.source, args.output, args.allow_partial)
    print(json.dumps({'output': report['output'], 'clips': report['clips'],
                      'sourceBinaryPreserved': True, 'quaternionNormError': report['maxEncodedQuaternionNormError']}, indent=2))
    if args.blend:
        subprocess.run([args.blender, '--background', '--factory-startup', '--python', str(Path(__file__).resolve()),
                        '--', '--import-blend', str(args.output.resolve()), str(args.blend.resolve())], check=True)


if __name__ == '__main__':
    main()

"""Rebuild the private native-rig Western horse browser preview from approved source.

Only material declarations are converted; the 677-joint skin and creator clips
remain original. Requires the separately registered, ignored source GLB locally.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXPECTED_SOURCE = '743fd70ec937dde1aa550afde17eeb506ca538933e291eca41d2fa8d5ffb20ea'
DEFAULT_SOURCE = ROOT / 'assets/models/horse-imports/wildmesh-white-western/source/horse_-_realistic_3d_model_demo_free.glb'
OUTPUT = ROOT / 'assets/models/horse-imports/wildmesh-white-western/game/native-candidate/native-white-western-candidate.glb'


def load(filename, name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=DEFAULT_SOURCE)
    args = parser.parse_args()
    if not args.source.is_file():
        parser.error('approved original GLB is unavailable locally; pass --source pointing to its registered copy')
    source_bytes = args.source.read_bytes()
    if hashlib.sha256(source_bytes).hexdigest() != EXPECTED_SOURCE:
        parser.error('source hash differs from the approved WildMesh original')
    glb = load('rig_hero_horse.py', 'native_candidate_glb')
    builder = load('build-wildmesh-western-game.py', 'native_candidate_materials')
    original, binary = glb.read_glb(args.source)
    converted, output_binary = glb.read_glb(args.source)
    builder.modern_materials(converted)
    converted['asset'].setdefault('extras', {})['localReviewOnly'] = (
        'Original native mesh, 677-joint skin, Idle/Walk clips; PBR-equivalent materials for browser preview')
    assert output_binary == binary
    assert len(converted['skins'][0]['joints']) == 677
    assert [clip['name'] for clip in converted['animations']] == ['Horse|Horse_Idle', 'Horse|Horse_Walk']
    for section in ['nodes', 'meshes', 'skins', 'animations', 'accessors', 'bufferViews',
                    'images', 'textures', 'samplers', 'buffers', 'scenes']:
        assert converted.get(section) == original.get(section), section
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    glb.write_glb(OUTPUT, converted, output_binary)
    print(OUTPUT, OUTPUT.stat().st_size, hashlib.sha256(OUTPUT.read_bytes()).hexdigest())


if __name__ == '__main__':
    main()

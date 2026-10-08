"""Decode the roster independently; sample native clips on widened draft limbs.

Draft thickness may change; source rig, limb length, sole anchors and clips may
not. Motion samples check deformation numerically, not visual gait quality.
No builder cage or builder-reported measurements are trusted here.
"""
from pathlib import Path
import copy
import hashlib
import json
import sys
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/models/native-roster'
sys.path.insert(0, str(ROOT / 'tools/asset-gen'))
import rig_hero_horse as glb

SOURCE_SHA = 'b188f5ea0c985c673c678daebf5e36daa1147a18693cec15ecc1bca439740a07'
SOURCE_TRANSLATION = np.array([-6.225790382362317e-9, .0047147771075021355, -1.6744842715166992])
DRAFTS = {'percheron', 'shire', 'clyde'}
# The reviewed heavier bodies stay exact when fitting their separate tack mesh.
DRAFT_BODY_SHA = {
    'percheron': '3e8515dc0f417fa837368e425261dfcbf42d4adff21b4d7513f82a0e46974918',
    'shire': '60ffdfeb16104aead7db654714c106aed64a560f03448b42df1fabade3a4bca7',
    'clyde': '7cd4f35947849d201bb3fbc08dcc04e263c2b2953676f7f82586ee19373527d9',
}
QUANTIZATION_TOLERANCE_M = 2e-5
# Pin released non-draft buffers, rather than trusting updated manifest hashes.
NON_DRAFT_SHA = {
    'bay': 'ca1dcf544abb19e478ac0813f5ae59290beccc09cccda9680343089dcdb600e7',
    'chestnut': '01d8f25146d2be5b4fae8d5e53fc1db3651a7d37f306ef824c8358c53ebc2962',
    'palomino': 'f6ee5303eb51f6b62100f1601fd86bd16ee85f584b5540f00d2d99227f9117b6',
    'haflinger': 'd9daaf78d28991d7be44ba9e45e98ea9a015887f611009074b966f2ff1de071b',
    'grey': 'e65c13551cddb5304974ae4846816a1d838b3bf56465858a20fd8cd85432b066',
    'black': 'b0cb1d641edb47cb5339485642969671bee287168c663f62a0d61b31575b2dad',
    'pinto': '0cb283c8e25784e34cfa704df736e5ad200a3c3e1d628711112ae1b1dea4fe44',
    'appaloosa': '1f0e7c0b0bacae87ad5d3d5dc8574865e626e582a3612e4a0fe449812ae1a0d5',
    'sunset': 'ed74a03ac807c43b56849994eb8b5421040d87fee1ed2d36cd12d7953fe86c08',
    'iceland': '8fe26cbbbfe235fd81831deae40ee9127a6d9c83e05d94e8db3cf857d93ed8bd',
    'welsh': '0af77ee90e0d8190acc35e050443333ae10665f9039b6029254b3bb1ca44b2e1',
    'stock': '9d906ff04732bcd11592bce1437cb1f8dade3e062afb0245e770be9429403c64',
    'fjord': '259adf614e29cb9cbd9b5bb38b172af6d3cbb8d6ddfae1258f813d3920a03f3a',
    'morgan': '176dd003fe6029ef4dae2eb3f754f17fb617247c6defd1419a34eedea824262b',
    'thoro': 'd6261a3164afa6fca69e8d79fbe3b856d75dbcb471a4387c4509d5b699cecc3f',
    'knab': '815ae0c534b24b88e27cb6408cd4308fedc83185b7562f6cd2def363b609a20e',
    'vanner': 'ffd006da8a808c287410fb147688bde72e3b9c20e05c8a9bf8496d6a858250ac',
    'marwari': '0391e61b8ad20098673c8931fe152a902e77d1fec09323b9891b0f8693e78d91',
    'lipiz': '97997fc863a5b0d28853ba19451ca6f75dca80efe75d56dbcc34edbb02419c39',
    'sport': 'df35826e54a9297ca4fe077b07229f283b7618dc3d0ba225674b12a8cb8bb246',
    'akhal': '0c536c220d31fba3ba80d96471a7940dbf68f0051f4efc7f9ba1f4ddb11addc4',
    'bay-sporthorse': '1ba3bdabbb7dd6641cfd71fc01409b38883e7aa8c3ac68d0925709b1d8b67b12',
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def transform(matrix, points, translation):
    return np.einsum('nij,nj->ni', matrix, np.c_[points, np.ones(len(points))])[:, :3] + translation


def sample_channel(times, values, interpolation, path, at):
    """glTF linear/spherical and cubic-Hermite sampling, including tangents."""
    if len(times) == 1 or at <= times[0]:
        value = values[1] if interpolation == 'CUBICSPLINE' else values[0]
    elif at >= times[-1]:
        value = values[-2] if interpolation == 'CUBICSPLINE' else values[-1]
    else:
        k = int(np.searchsorted(times, at, side='right') - 1)
        duration = float(times[k + 1] - times[k])
        t = (at - times[k]) / duration
        if interpolation == 'CUBICSPLINE':
            a, tangent_a, tangent_b, b = values[3*k+1], values[3*k+2], values[3*k+3], values[3*k+4]
            value = (2*t**3-3*t*t+1)*a + (t**3-2*t*t+t)*duration*tangent_a + (-2*t**3+3*t*t)*b + (t**3-t*t)*duration*tangent_b
        elif interpolation == 'STEP':
            value = values[k]
        elif interpolation == 'LINEAR':
            a, b = values[k], values[k+1]
            if path == 'rotation':
                dot = float(np.dot(a, b))
                if dot < 0:
                    b, dot = -b, -dot
                if dot < .9995:
                    angle = np.arccos(np.clip(dot, -1, 1))
                    value = (np.sin((1-t)*angle)*a + np.sin(t*angle)*b) / np.sin(angle)
                else:
                    value = a + t*(b-a)
            else:
                value = a + t*(b-a)
        else:
            raise AssertionError(('Unsupported animation interpolation', interpolation))
    if path == 'rotation':
        length = np.linalg.norm(value)
        assert length > 1e-10
        value = value / length
    assert np.isfinite(value).all()
    return value


def gait_frames(doc, binary, skin, inverse_binds, body):
    """Cache identical native skin operators for source and draft surfaces."""
    frames = []
    wanted = ['Target Native Walk Rollover', 'Target Native Trot', 'Target Native Canter Left', 'Target Native Canter Right']
    for name in wanted:
        clip = next(a for a in doc['animations'] if a['name'] == name)
        channels = []
        for channel in clip['channels']:
            sampler = clip['samplers'][channel['sampler']]
            times = glb.accessor(doc, binary, sampler['input']).flatten().astype(float)
            values = glb.accessor(doc, binary, sampler['output']).astype(float)
            assert np.isfinite(times).all() and np.isfinite(values).all() and (np.diff(times) > 0).all()
            channels.append((channel['target'], times, values, sampler.get('interpolation', 'LINEAR')))
        duration = max(float(c[1][-1]) for c in channels)
        for at in np.linspace(0, duration, 21):
            animated = {'nodes': copy.deepcopy(doc['nodes'])}
            for target, times, values, interpolation in channels:
                assert target['path'] in {'rotation', 'translation', 'scale'}
                node = animated['nodes'][target['node']]
                assert 'matrix' not in node
                node[target['path']] = sample_channel(times, values, interpolation, target['path'], at).tolist()
            worlds, _ = glb.node_worlds(animated)
            ops = np.array([worlds[i] for i in skin['joints']]) @ inverse_binds
            matrix = np.einsum('nw,nwij->nij', body['weights'][body['lower']], ops[body['joints'][body['lower']]])
            assert np.isfinite(matrix).all()
            frames.append((name, float(at), matrix))
    return frames


def draft_checks(key, body, positions, normals, outworld, frames, translation):
    source = body['world']
    lower = body['lower']
    anchors = source[:, 1] <= .00005
    assert np.array_equal(positions[anchors], body['position'][anchors]), (key, 'sole anchor positions changed')
    assert np.array_equal(normals[anchors], body['normal'][anchors]), (key, 'sole anchor normals changed')
    y_drift = float(abs(outworld[lower, 1] - source[lower, 1]).max())
    assert y_drift < QUANTIZATION_TOLERANCE_M, (key, 'lower leg length changed', y_drift)
    hooves = []
    masks = []
    for xsign, side in [(-1, 'left'), (1, 'right')]:
        for zsign, end in [(-1, 'hind'), (1, 'front')]:
            mask = (source[:, 1] <= .14) & (source[:, 0]*xsign > 0) & (source[:, 2]*zsign > 0)
            assert mask.sum() > 250
            a, b = source[mask], outworld[mask]
            center_drift = float(np.linalg.norm(b.mean(0) - a.mean(0)))
            gain = np.ptp(b[:, [0, 2]], axis=0) / np.ptp(a[:, [0, 2]], axis=0)
            assert center_drift < QUANTIZATION_TOLERANCE_M, (key, end, side, 'hoof moved', center_drift)
            assert np.all(gain >= 1.25) and np.all(gain < 1.65), (key, end, side, 'hoof thickness', gain)
            hooves.append({'leg': end+'-'+side, 'vertices': int(mask.sum()), 'centerDriftM': center_drift, 'widthGainXZ': gain.tolist()})
            masks.append(mask[lower])
    assert np.count_nonzero(abs(outworld[lower]-source[lower]) > 1e-4) > 1500, (key, 'draft limbs were not widened')
    max_center_motion, max_surface_motion = 0., 0.
    for name, at, matrix in frames:
        a = transform(matrix, body['position'][lower], translation)
        b = transform(matrix, positions[lower], translation)
        assert np.isfinite(a).all() and np.isfinite(b).all(), (key, name, at, 'nonfinite skinned leg')
        max_surface_motion = max(max_surface_motion, float(np.linalg.norm(b-a, axis=1).max()))
        for mask in masks:
            max_center_motion = max(max_center_motion, float(np.linalg.norm(b[mask].mean(0)-a[mask].mean(0))))
    # Skin weights vary across a hoof, so its mean can move a little even though
    # the pivot is unchanged. Thickness must not meaningfully alter its path.
    assert max_center_motion < .002, (key, 'hoof trajectory changed', max_center_motion)
    assert max_surface_motion < .10, (key, 'exploding lower-leg deformation', max_surface_motion)
    return {'soleAnchorVertices': int(anchors.sum()), 'soleAnchorsBitExact': True, 'maxLowerLegYDriftM': y_drift,
            'hooves': hooves, 'nativeGaitSamples': len(frames), 'nativeGaitClips': sorted({f[0] for f in frames}),
            'sampledLowerLegPositionsFinite': True, 'maxAnimatedHoofCenterDriftM': max_center_motion,
            'maxAnimatedLowerLegSurfaceOffsetM': max_surface_motion}


def main():
    manifest = json.loads((OUT/'manifest.json').read_text())
    source = (ROOT/'assets'/manifest['sourceFile']).resolve()
    assert manifest['sourceSha256'] == SOURCE_SHA and sha(source) == SOURCE_SHA
    doc, binary = glb.read_glb(source)
    worlds, _ = glb.node_worlds(doc)
    skin = doc['skins'][0]
    assert len(skin['joints']) == 677
    inverse_binds = glb.accessor(doc, binary, skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    assert np.isfinite(inverse_binds).all()
    ops = np.array([worlds[i] for i in skin['joints']]) @ inverse_binds
    translation = np.array(manifest['sourceTranslation'])
    assert np.array_equal(translation, SOURCE_TRANSLATION), 'source alignment changed'
    source_meshes = []
    for mesh in doc['meshes']:
        primitive = mesh['primitives'][0]
        attributes = primitive['attributes']
        positions = glb.accessor(doc, binary, attributes['POSITION'])
        normals = glb.accessor(doc, binary, attributes['NORMAL'])
        joints = glb.accessor(doc, binary, attributes['JOINTS_0'])
        weights = glb.accessor(doc, binary, attributes['WEIGHTS_0'])
        indices = glb.accessor(doc, binary, primitive['indices'])
        uv = glb.accessor(doc, binary, attributes['TEXCOORD_0'])
        assert joints.max() < 677 and indices.max() < len(positions)
        assert np.isfinite(uv).all() and np.isfinite(weights).all() and np.isfinite(positions).all()
        assert abs(weights.sum(axis=1)-1).max() < .001
        matrix = np.einsum('nw,nwij->nij', weights, ops[joints])
        world = transform(matrix, positions, translation)
        source_meshes.append({'position': positions, 'normal': normals, 'matrix': matrix, 'world': world,
                              'joints': joints, 'weights': weights, 'lower': world[:, 1] <= .65})
    assert len(source_meshes) == 5
    frames = gait_frames(doc, binary, skin, inverse_binds, source_meshes[0])
    rows = []
    for key, row in manifest['breeds'].items():
        assert np.array_equal(row['sourceTranslation'], SOURCE_TRANSLATION), (key, 'alignment changed')
        path = (ROOT/'assets'/row['file']).resolve()
        assert sha(path) == row['sha256'], (key, 'buffer checksum')
        if key not in DRAFTS:
            assert sha(path) == NON_DRAFT_SHA[key], (key, 'non-draft buffer changed')
        packed = path.read_bytes()
        assert len(packed) == row['byteLength'] and len(row['meshes']) == 5
        used, normal_error, draft = 0, 0., None
        for index, (rec, source_mesh) in enumerate(zip(row['meshes'], source_meshes)):
            p, n = source_mesh['position'], source_mesh['normal']
            assert rec['meshIndex'] == index and rec['vertexCount'] == len(p)
            values = {}
            for field in ['positionDelta', 'normalDelta']:
                desc = rec[field]
                assert desc['count'] == len(p)*3 and desc['byteOffset'] == used
                assert np.isfinite(desc['scale']) and desc['scale'] > 0
                data = np.frombuffer(packed, dtype='<i2', count=desc['count'], offset=desc['byteOffset']).reshape(-1, 3)
                values[field] = data.astype(float)*desc['scale']
                used += data.nbytes
            outp = (p+values['positionDelta']).astype('<f4')
            outn = (n+values['normalDelta']).astype('<f4')
            assert np.isfinite(outp).all() and np.isfinite(outn).all()
            normal_error = max(normal_error, float(abs(np.linalg.norm(outn, axis=1)-1).max()))
            if index == 0:
                protected = source_mesh['lower']
                outworld = transform(source_mesh['matrix'], outp, translation)
                assert abs(outworld[:, 1].min()) < 1e-8, (key, 'floor moved')
                assert 0 < row['actorScale'] < 1.2
                if key in DRAFTS:
                    draft = draft_checks(key, source_mesh, outp, outn, outworld, frames, translation)
                else:
                    assert np.array_equal(outp[protected], p[protected]), (key, 'protected positions changed')
                    assert np.array_equal(outn[protected], n[protected]), (key, 'protected normals changed')
                bodyhash = hashlib.sha256(outp.tobytes()).hexdigest()
                if key in DRAFTS:
                    assert bodyhash == DRAFT_BODY_SHA[key], (key, 'reviewed draft body changed during tack fitting')
                floor = float(outworld[:, 1].min())
        assert used == len(packed) and normal_error < .002
        coat = (ROOT/'assets'/row['coat']['file']).resolve()
        assert sha(coat) == row['coat']['sha256']
        with Image.open(coat) as image:
            assert image.size == (1024, 1024)
        report = {'id': key, 'bufferSha256': row['sha256'], 'jointCount': 677, 'meshes': 5, 'bodyVertices': len(source_meshes[0]['position']),
                  'bodyGeometrySha256': bodyhash, 'protectedLowerBodyVertices': int(protected.sum()),
                  'protectedBodyPositionsAndNormalsBitExact': key not in DRAFTS,
                  'standingBodyFloorM': floor, 'maxNormalLengthError': normal_error,
                  'actorScale': row['actorScale'], 'withersM': row['withersM'], 'textureSize': [1024, 1024]}
        if draft:
            report['draftLowerLegValidation'] = draft
        else:
            report['releasedBufferBitExact'] = True
        rows.append(report)
    assert set(manifest['breeds']) == set(NON_DRAFT_SHA) | DRAFTS
    assert len(rows) == 25 and len({r['bodyGeometrySha256'] for r in rows}) == 25
    assert sha(source) == SOURCE_SHA
    report = {'sourceSha256': SOURCE_SHA, 'all25NativeFoundations': True, 'distinctBodyGeometryCount': 25,
              'sharedOriginalNativeSkeletonSize': 677, 'unchangedSkinWeightsBindsAndAnimations': True,
              'unchangedIndicesAndUVs': True, 'nonDraftBuffersBitExact': len(NON_DRAFT_SHA),
              'draftLowerLegThicknessUpdated': sorted(DRAFTS),
              'reviewedDraftBodyPositionsBitExact': sorted(DRAFTS),
              'limitsM': {'standingFloor': 1e-8, 'lowerLegYAndHoofCenterDrift': QUANTIZATION_TOLERANCE_M,
                          'animatedHoofCenterDrift': .002, 'animatedLowerLegSurfaceOffset': .10},
              'motionValidationScope': '84 sampled native walk/trot/left-canter/right-canter poses; finite skinned lower legs and bounded hoof-center drift. Visual gait quality requires runtime review.',
              'rows': rows}
    (OUT/'validation.json').write_text(json.dumps(report, indent=2, allow_nan=False)+'\n')
    print(json.dumps({'pass': True, 'variants': 25, 'nonDraftBuffersBitExact': len(NON_DRAFT_SHA),
                      'drafts': sorted(DRAFTS), 'gaitSamplesPerDraft': len(frames),
                      'maxNormalLengthError': max(r['maxNormalLengthError'] for r in rows)}))


if __name__ == '__main__':
    main()

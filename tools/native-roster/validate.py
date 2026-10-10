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
# Pin the reviewed front/rear draft contours; later tack changes must not reshape them.
DRAFT_BODY_SHA = {
    'percheron': '8c24aaae1c446d93a8dea7c3816c997da0004e7cb033e563ccabcdef8fee4f3c',
    'shire': '5a802fb18a70e1460181e88a733cb724be8c0754acd2c5061da6aff19a6bc733',
    'clyde': 'eb1db02381d8c475a6c0642550b740e210a949140ff8b09ebfa927d4ab63c52e',
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


# Approved combined head/front-contour revision pins; the focused head gate
# proves upstream nonfacial shape and contacts are preserved within20um.
HEAD_BUFFER_SHA = {'bay': 'c39a83254c5a543bdad7e4c99e4972923e4fdc4fe3e70f1a3b19d0cfe0d2e72a', 'pinto': 'ca09d4969996ef20e9adb57376a334529caccf2f576e8caeea25330e00d9055e', 'appaloosa': '1ad3fdf25bb5cd935e03a1e68c2aad5c3fa635d87f7a95a7461608ffeffd802c', 'sunset': '8669c0c2fa6ffe6b5bbefc8e4c13c4daab220d72a621547818950b0f073ed575', 'iceland': 'c20886d2644d601bde6f28af7a6c2fed52f411d19a28e3eb855edcd016934400', 'fjord': '5974a7fa1f3e4b4d91cb6c25e759ccbc72913a634d72188eb5b3be390564b826', 'akhal': '2001f2b1826da2fa166d0c1ff8f899c468f78a4ca3fe705188c2f19f263b9899', 'percheron': 'cb81418afb0b65d08b9d9cbcfea546ee0a20e48c25aa97938c64896d676a9e3d', 'shire': '43f19dd76574fb57fdf9f33e789c3958d667fb0de594bf007e7c8bd1321bd575', 'clyde': '1f1db05f21ad3f853da85dcd6a74dddbef7bb9edb4dfa963de6906fad68e679d'}
HEAD_DRAFT_BODY_SHA = {'percheron': '98cd1cc826f6940f36f53dce781a00eca0335447c0e718d9b0e8329d9e1ab3ac', 'shire': '87585e7f68d91e80884d626a902ac510960eb8f66e05e6bcd34208753ee25b2d', 'clyde': '6ce61579e46ade8e1a52a8b2bea02d6776e7d6a8364f2ae647acbf6a05194a12'}
# End head revision pins.

# Reviewed leg-contour revision keeps the prior head/upper-body and all four
# non-body meshes exact. Its broad hooves preserve source toe/heel depth.
DRAFT_LEG_BUFFER_SHA = {
    'percheron': 'aa729d6fa97b111052335f822dd9001b2e7cadd8f90b1e1966af2235f8c73647',
    'shire': '8ba4d986f21697ca10ced24d54477d1b6424bd040ccdf210fc20a02b16f1afd2',
    'clyde': '11ef3c254a2ed1a0eaa764cb56b46c516d1bac0f6bbefbd844314be16108334c',
}
DRAFT_LEG_BODY_SHA = {
    'percheron': 'f67e6d6b96a8f0c5c2d2f0e71a7522a480aa293c54f82c8b1ff9ac98e345aad3',
    'shire': '211fd2bdfef0ef85139ad88dab2a62289c52fb7f5aba41bec323aeef08877d37',
    'clyde': '39b1d2af6ce233750cd4ad438efb648cfc98787ba668b28f84f898e5c8bcf315',
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
            assert 1.25 <= gain[0] < 1.65, (key, end, side, 'hoof lateral width', gain)
            assert abs(gain[1]-1) < .001, (key, end, side, 'source toe/heel depth preserved', gain)
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



def groom_shell_checks(spec, packed, used, hair, translation):
    """Decode the added crest and verify real donor weights/binds in place."""
    assert spec['version']==1 and spec['space']=='native-source-mesh'
    assert spec['sourceMeshIndex']==2 and spec['originalSourceWeightsCopied']
    count=spec['vertexCount'];assert 16<=count<=2048
    arrays={}
    fields=[('position','<f4',3),('normal','<f4',3),('uv','<f4',2),
            ('skinIndex','<u2',4),('skinWeight','<f4',4),('outer','<f4',1),
            ('index','<u2',1),('sourceVertex','<u2',1)]
    for name,dtype,size in fields:
        aligned=(used+3)//4*4
        assert not any(packed[used:aligned]), 'Unexpected shell alignment bytes'
        d=spec[name]
        assert d['byteOffset']==aligned and d['itemSize']==size
        expected=spec['indexCount'] if name=='index' else count*size
        assert d['count']==expected
        assert d['componentType']==('float32' if dtype=='<f4' else 'uint16')
        a=np.frombuffer(packed,dtype=dtype,count=d['count'],offset=d['byteOffset']).reshape(-1,size)
        assert np.isfinite(a).all()
        arrays[name]=a;used=aligned+a.nbytes
    donor=arrays['sourceVertex'].ravel().astype(int)
    assert donor.min()>=0 and donor.max()<len(hair['position'])
    assert np.array_equal(arrays['skinIndex'],hair['joints'][donor])
    assert np.array_equal(arrays['skinWeight'],hair['weights'][donor])
    assert abs(arrays['skinWeight'].sum(axis=1)-1).max()<.001
    assert abs(np.linalg.norm(arrays['normal'],axis=1)-1).max()<1e-6
    assert arrays['uv'].min()>=0 and arrays['uv'].max()<=1
    assert arrays['outer'].min()>=0 and arrays['outer'].max()<=1
    indices=arrays['index'].ravel().astype(int)
    assert len(indices)%3==0 and 0<len(indices)<=15000
    assert indices.min()>=0 and indices.max()<count
    world=transform(hair['matrix'][donor],arrays['position'],translation)
    assert np.isfinite(world).all() and np.max(np.ptp(world,axis=0))<2
    assert np.max(np.ptp(world,axis=0))>.3 and world[:,1].min()>1
    assert np.max(abs(world.min(axis=0)-spec['standingBoundsM']['min']))<2e-6
    assert np.max(abs(world.max(axis=0)-spec['standingBoundsM']['max']))<2e-6
    assert spec['restReconstructionMaxErrorM']<2e-5
    t=world[indices.reshape(-1,3)]
    area=np.linalg.norm(np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]),axis=1)*.5
    assert area.min()>1e-12, 'Degenerate crest triangle'
    return used,{'vertices':count,'triangles':len(indices)//3,
        'originalHairDonorWeightsBitExact':True,'sourceJointCount':677,
        'standingBoundsM':spec['standingBoundsM'],
        'restReconstructionMaxErrorM':spec['restReconstructionMaxErrorM'],
        'minimumStandingTriangleAreaM2':float(area.min())}


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
        if row.get('headShape'):
            approved = DRAFT_LEG_BUFFER_SHA[key] if key in DRAFTS else HEAD_BUFFER_SHA[key]
            assert row['headShape']['version'] == 1 and sha(path) == approved, (key, 'approved appearance revision changed')
            if key in DRAFTS:
                assert row['draftShape']['version'] == 4 and row['draftShape']['legContour']['version'] == 1
        elif key not in DRAFTS:
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
                    expected = DRAFT_LEG_BODY_SHA[key]
                    assert bodyhash == expected, (key, 'reviewed draft body/head revision changed')
                floor = float(outworld[:, 1].min())
        shell_report=None
        shell=row.get('groom',{}).get('uprightCrest',{}).get('shell')
        if shell:
            assert key=='fjord'
            used,shell_report=groom_shell_checks(shell,packed,used,source_meshes[2],translation)
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
        if shell_report: report['additiveGroomShell']=shell_report
        if draft:
            report['draftLowerLegValidation'] = draft
        else:
            report['releasedBufferBitExact'] = not bool(row.get('headShape'))
        if row.get('headShape'):
            report['approvedHeadRevisionPinned'] = True
            report['headFamily'] = row['headShape']['family']
        rows.append(report)
    assert set(manifest['breeds']) == set(NON_DRAFT_SHA) | DRAFTS
    assert len(rows) == 25 and len({r['bodyGeometrySha256'] for r in rows}) == 25
    assert sha(source) == SOURCE_SHA
    report = {'sourceSha256': SOURCE_SHA, 'all25NativeFoundations': True, 'distinctBodyGeometryCount': 25,
              'sharedOriginalNativeSkeletonSize': 677, 'unchangedSkinWeightsBindsAndAnimations': True,
              'unchangedIndicesAndUVs': True, 'nonDraftBuffersBitExact': len(NON_DRAFT_SHA)-len(set(HEAD_BUFFER_SHA)-DRAFTS),
              'draftLowerLegThicknessUpdated': sorted(DRAFTS),
              'reviewedDraftBodyPositionsBitExact': sorted(DRAFTS-set(HEAD_DRAFT_BODY_SHA)),
              'approvedHeadRevisionProfiles': sorted(HEAD_BUFFER_SHA),
              'approvedDraftLegContourProfiles': sorted(DRAFT_LEG_BODY_SHA),
              'draftLegDeformationValidation': 'Run node tools/test-native-draft-leg-deformation.mjs for 81 production Trot poses, source-relative triangle collapse and actual hoof-floor clearance.',
              'headShapeValidation': 'Run qa-head-shapes.py for compact facial field, matching eyes/bridle, preserved seat/stirrups and 84 native head motion samples.',
              'limitsM': {'standingFloor': 1e-8, 'lowerLegYAndHoofCenterDrift': QUANTIZATION_TOLERANCE_M,
                          'animatedHoofCenterDrift': .002, 'animatedLowerLegSurfaceOffset': .10},
              'motionValidationScope': '84 sampled native walk/trot/left-canter/right-canter poses; finite skinned lower legs and bounded hoof-center drift. Visual gait quality requires runtime review.',
              'rows': rows}
    (OUT/'validation.json').write_text(json.dumps(report, indent=2, allow_nan=False)+'\n')
    print(json.dumps({'pass': True, 'variants': 25, 'nonDraftBuffersBitExact': len(NON_DRAFT_SHA)-len(set(HEAD_BUFFER_SHA)-DRAFTS),
                      'drafts': sorted(DRAFTS), 'gaitSamplesPerDraft': len(frames),
                      'maxNormalLengthError': max(r['maxNormalLengthError'] for r in rows)}))


if __name__ == '__main__':
    main()

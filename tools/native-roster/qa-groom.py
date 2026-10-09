"""Actual-source CPU regression for the Fjord's original-card upright groom.

Run: python3 tools/native-roster/qa-groom.py. No asset writes or browser needed.
"""
import copy
import hashlib
import json
import numpy as np
import build as builder
from groom import shape_fjord_groom

checks = 0

def check(value, description):
    global checks
    assert value, description
    checks += 1


def digest(array):
    return hashlib.sha256(np.ascontiguousarray(array).tobytes()).hexdigest()


def main():
    source_bytes = builder.SOURCE.read_bytes()
    check(builder.sha(source_bytes) == builder.SOURCE_SHA, 'Pinned original source is exact')
    doc, binary = builder.glb.read_glb(builder.SOURCE)
    metadata = copy.deepcopy(doc)
    worlds, _ = builder.glb.node_worlds(doc)
    skin = doc['skins'][0]
    inverse = builder.glb.accessor(doc, binary, skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    operators = np.array([worlds[i] for i in skin['joints']])@inverse
    meshes = []
    for mesh in doc['meshes']:
        prim = mesh['primitives'][0]
        attributes = {k: builder.glb.accessor(doc, binary, v).copy() for k, v in prim['attributes'].items()}
        raw = attributes['POSITION'].astype(float)
        weights, joints = attributes['WEIGHTS_0'], attributes['JOINTS_0']
        weighted = np.einsum('nw,nwij->nij', weights, operators[joints])
        actual = np.einsum('nij,nj->ni', weighted, np.c_[raw, np.ones(len(raw))])[:, :3]+builder.TRANSLATION
        meshes.append(dict(attributes=attributes, raw=raw, actual=actual,
                           linear=weighted[:, :3, :3], indices=builder.glb.accessor(doc, binary, prim['indices']).copy()))
    fingerprints = [[digest(a) for a in m['attributes'].values()]+[digest(m['indices']), digest(m['actual'])] for m in meshes]
    hair = meshes[2]
    check(len(hair['raw']) == 23514 and len(skin['joints']) == 677, 'Actual original hair and rig counts')
    source = hair['actual']
    groups = builder.groups(hair['indices'], len(source))
    sculpt = json.loads((builder.ROOT/'tools/asset-gen/breed-conformation.json').read_text())['conformations']['fjord']['sculpt_targets']
    shaped = builder.cage(source, sculpt, 'fjord')
    eps = 1e-5
    jacobian = np.stack([(builder.cage(source+np.eye(3)[axis]*eps, sculpt, 'fjord')-builder.cage(source-np.eye(3)[axis]*eps, sculpt, 'fjord'))/(2*eps) for axis in range(3)], axis=2)
    normals = np.einsum('nij,nj->ni', hair['linear'], hair['attributes']['NORMAL'])
    normals = np.linalg.solve(jacobian.transpose(0, 2, 1), normals[..., None])[..., 0]
    input_snapshots = [digest(x) for x in [source, shaped, normals]]
    result, corrected, report = shape_fjord_groom(source, shaped, groups, normals)
    check(input_snapshots == [digest(x) for x in [source, shaped, normals]], 'No input positions or normals are mutated')
    check(result.shape == source.shape and corrected.shape == source.shape, 'Exact vertex count and attributes retained')
    check(np.isfinite(result).all() and np.isfinite(corrected).all(), 'All transformed positions and normals are finite')
    check(report['components'] == dict(mane=212, forelock=66, tail=194, eyelashes=76), 'Every native hair island has the intended role')
    check(report['rootAnchorMaxDriftM'] < .08, 'Source card roots move only within the narrow neck crest region')
    check(report['minimumCardTransformDeterminant'] > .001, 'All shortened fringe cards retain positive orientation and finite area')
    check(.02 < report['minimumManeRiseM'] < .03 and .10 < report['maximumManeRiseM'] < .12, 'Fine fringe follows the rounded crest envelope instead of isolated spikes')
    check(report['minimumHairHeightM'] > .035, 'No new hair touches or crosses the floor')
    tone = np.zeros(len(source))
    for card in report['colorCards']:
        a, z = card['start'], card['start']+card['count']
        check(not tone[a:z].any() and 0 <= card['outer'] <= 1, 'Color card ranges are disjoint and bounded')
        tone[a:z] = 1+card['outer']
    check(np.count_nonzero(tone) == 11300, 'Only the 212 mane and 66 forelock cards receive pigment')
    check((tone==1).sum()>4000 and (tone==2).sum()>3000, 'Short fringe includes dark center and pale outer lanes')

    shell=report['crestShell'];sp=np.asarray(shell['positions']);sn=np.asarray(shell['normals']);tri=np.asarray(shell['indices']).reshape(-1,3)
    check(len(sp)<2048 and len(tri)<4000, 'Continuous crest has one tightly bounded small mesh')
    check(np.isfinite(sp).all() and np.isfinite(sn).all() and np.allclose(np.linalg.norm(sn,axis=1),1), 'Crest coordinates and normals are finite and normalized')
    check(tri.min()>=0 and tri.max()<len(sp), 'Every crest triangle addresses valid vertices')
    areas=np.linalg.norm(np.cross(sp[tri[:,1]]-sp[tri[:,0]],sp[tri[:,2]]-sp[tri[:,0]]),axis=1)
    check(areas.min()>1e-7, 'Closed surface has no degenerate triangles')
    from collections import Counter
    edges=Counter(tuple(sorted(pair)) for row in tri for pair in [(row[0],row[1]),(row[1],row[2]),(row[2],row[0])])
    check(all(count==2 for count in edges.values()), 'Continuous crest is closed and manifold, with no gaps between cards')
    check(np.asarray(shell['sourceVertex']).min()>=0 and np.asarray(shell['sourceVertex']).max()<23514, 'Crest skin donors are all original hair vertices')
    check(np.asarray(shell['outer']).min()==0 and np.asarray(shell['outer']).max()==1, 'Surface spans continuous dark center and pale outer sides')
    tones=np.asarray(shell['outer'])[:-2].reshape(-1,24)
    check(np.allclose(tones,tones[:1]), 'Stripe stays continuous down the neck rather than alternating by card')
    check(sp[:,1].min()>1.80 and sp[:,1].max()<2.30, 'Crest remains at the top of the neck, clear of body floor and eyes')
    for ids in groups:
        p = source[ids]
        if np.median(p[:, 2]) < -.60:
            check(not tone[ids].any(), 'Tail is excluded from two-tone mask')
            anchor = ids[np.argmax(p[:, 1])]
            root = shaped[anchor]
            expected = root+(shaped[ids]-root)*np.array([1.+.08*.06, 1.06, 1.+.04*.06])
            expected[:, 1] = np.maximum(expected[:, 1], .035)
            check(np.allclose(result[ids], expected, atol=1e-14), 'Tail retains exactly its previous 1.06 growth')
        elif np.ptp(p, axis=0).max() < .04:
            check(not tone[ids].any(), 'Eyelashes are excluded from two-tone mask')
            check(np.array_equal(result[ids], shaped[ids]) and np.array_equal(corrected[ids], normals[ids]), 'Eyelash card positions and normals unchanged')
    delta = np.linalg.solve(hair['linear'], (result-source)[..., None])[..., 0]
    raw_normals = np.linalg.solve(hair['linear'], corrected[..., None])[..., 0]
    raw_normals /= np.maximum(np.linalg.norm(raw_normals, axis=1, keepdims=True), 1e-12)
    check(np.isfinite(raw_normals).all() and np.allclose(np.linalg.norm(raw_normals, axis=1), 1), 'Returned normals convert into finite unit native-space normals')
    scale = max(float(abs(delta).max())/32760, 1e-10)
    quantized = np.rint(delta/scale).astype('<i2').astype(float)*scale
    restored = source+np.einsum('nij,nj->ni', hair['linear'], quantized)
    check(np.linalg.norm(restored-result, axis=1).max() < 2e-5, 'Original packed-delta format preserves shaped silhouette within 20 microns')
    repeated = shape_fjord_groom(source, shaped, groups, normals)
    check(np.array_equal(result, repeated[0]) and np.array_equal(corrected, repeated[1]), 'Build is deterministic')
    for mi, m in enumerate(meshes):
        now = [digest(a) for a in m['attributes'].values()]+[digest(m['indices']), digest(m['actual'])]
        check(now == fingerprints[mi], f'Original mesh {mi} data unchanged, including skin, UVs, topology and all non-hair surfaces')
    check(doc == metadata and builder.SOURCE.read_bytes() == source_bytes, 'Original hierarchy, bind matrices, animation data and source bytes untouched')
    check(abs(meshes[0]['actual'][:, 1].min()) < 1e-8, 'Original body floor contact remains exact')
    for invalid in [groups[:-1], [groups[0], *groups], [np.array([-1]), *groups[1:]]]:
        try:
            shape_fjord_groom(source, shaped, invalid, normals)
            raise AssertionError('Invalid card partition accepted')
        except ValueError:
            check(True, 'Invalid card groups fail safely')
        check(input_snapshots == [digest(x) for x in [source, shaped, normals]], 'Failed groom never mutates caller inputs')
    print(json.dumps(dict(checks=checks, components=report['components'], minimumCardDeterminant=report['minimumCardTransformDeterminant'], crestRiseM=[report['minimumManeRiseM'], report['maximumManeRiseM']], rootDriftM=report['rootAnchorMaxDriftM'], status='PASS'), indent=2))


if __name__ == '__main__':
    main()

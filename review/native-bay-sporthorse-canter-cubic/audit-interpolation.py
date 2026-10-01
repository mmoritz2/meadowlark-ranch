"""Dense normalized GLTF cubic-vs-source interpolation audit for all 82 tracks."""
from pathlib import Path
import hashlib
import importlib.util
import json
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('g', ROOT / 'tools/asset-gen/rig_hero_horse.py')
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)
old_path = ROOT / 'review/native-bay-sporthorse-canter/model.glb'
new_path = HERE / 'model.glb'
old, ob = g.read_glb(old_path)
new, nb = g.read_glb(new_path)
assert [x['name'] for x in old['animations']] == [x['name'] for x in new['animations']]

def unit(q):
    return q / np.linalg.norm(q, axis=-1, keepdims=True)

def quat_distance_deg(a, b):
    dot = np.abs(np.sum(unit(a) * unit(b), axis=-1))
    return np.rad2deg(2 * np.arccos(np.clip(dot, -1, 1)))

def slerp(a, b, u):
    a, b = unit(a), unit(b)
    dot = np.sum(a * b, axis=-1, keepdims=True)
    b = np.where(dot < 0, -b, b)
    dot = np.abs(dot)
    theta = np.arccos(np.clip(dot, -1, 1))
    sin = np.sin(theta)
    almost = sin < 1e-6
    wa = np.sin((1 - u) * theta) / np.where(almost, 1, sin)
    wb = np.sin(u * theta) / np.where(almost, 1, sin)
    out = wa * a + wb * b
    return unit(np.where(almost, (1-u)*a+u*b, out))

def pair_stats(original, packed, times, rotation, subdivisions=64):
    # One sample per interval endpoint with no duplicate interior key; the
    # original GLTF Hermite polynomial multiplies tangents by segment time.
    x = np.asarray(original, float)
    m = np.asarray(packed.reshape(-1, 3, x.shape[1])[:, 0], float)
    assert np.array_equal(packed.reshape(-1, 3, x.shape[1])[:, 1], original)
    assert np.array_equal(m[0], m[-1])
    h = np.diff(times).reshape(-1, 1, 1)
    u = (np.arange(subdivisions + 1, dtype=float) / subdivisions).reshape(1, -1, 1)
    h00 = 2*u**3 - 3*u**2 + 1
    h10 = u**3 - 2*u**2 + u
    h01 = -2*u**3 + 3*u**2
    h11 = u**3 - u**2
    raw = h00*x[:-1,None,:] + h10*h*m[:-1,None,:] + h01*x[1:,None,:] + h11*h*m[1:,None,:]
    assert np.isfinite(raw).all()
    baseline = slerp(x[:-1,None,:], x[1:,None,:], u) if rotation else (1-u)*x[:-1,None,:]+u*x[1:,None,:]
    cubic = unit(raw) if rotation else raw
    series = np.concatenate([cubic[:,:-1,:].reshape(-1,x.shape[1]), cubic[-1,-1,:][None,:]])
    old_series = np.concatenate([baseline[:,:-1,:].reshape(-1,x.shape[1]), baseline[-1,-1,:][None,:]])
    step_seconds = float(np.diff(times).mean()) / subdivisions
    if rotation:
        speed = quat_distance_deg(series[1:], series[:-1]) / step_seconds
        old_speed = quat_distance_deg(old_series[1:], old_series[:-1]) / step_seconds
        deviation = quat_distance_deg(cubic, baseline)
        raw_norm = np.linalg.norm(raw, axis=-1)
        return {'cubicPeakAngularRateDegPerS': float(speed.max()),
                'linearPeakAngularRateDegPerS': float(old_speed.max()),
                'maxBetweenKeyPoseDeviationDegrees': float(deviation.max()),
                'unnormalizedCubicQuatNormRange': [float(raw_norm.min()), float(raw_norm.max())],
                'finite': True}
    velocity = np.linalg.norm(np.diff(series, axis=0), axis=1) / step_seconds
    old_velocity = np.linalg.norm(np.diff(old_series, axis=0), axis=1) / step_seconds
    return {'cubicPeakTranslationRateSourceUnitsPerS': float(velocity.max()),
            'linearPeakTranslationRateSourceUnitsPerS': float(old_velocity.max()),
            'maxBetweenKeyTranslationDeviationSourceUnits': float(np.linalg.norm(cubic-baseline,axis=-1).max()),
            'finite': True}

clips = {}
for ao, an in zip(old['animations'], new['animations']):
    rows = []
    for so, sn, channel in zip(ao['samplers'], an['samplers'], an['channels']):
        assert so['interpolation'] == 'LINEAR' and sn['interpolation'] == 'CUBICSPLINE'
        times = g.accessor(old, ob, so['input']).reshape(-1)
        source = g.accessor(old, ob, so['output'])
        packed = g.accessor(new, nb, sn['output'])
        assert np.array_equal(source, packed.reshape(-1,3,source.shape[1])[:,1])
        stats = pair_stats(source, packed, times, channel['target']['path']=='rotation')
        stats.update(node=channel['target']['node'], nodeName=new['nodes'][channel['target']['node']].get('name'), path=channel['target']['path'])
        rows.append(stats)
    angular = sorted((r for r in rows if r['path']=='rotation'), key=lambda r:-r['cubicPeakAngularRateDegPerS'])
    transl = next(r for r in rows if r['path']=='translation')
    clips[ao['name']] = {'allTracksFinite':all(r['finite'] for r in rows),'trackCount':len(rows),
                        'worstCubicAngularRateDegPerS':angular[0]['cubicPeakAngularRateDegPerS'],
                        'worstOriginalLinearAngularRateDegPerS':max(r['linearPeakAngularRateDegPerS'] for r in angular),
                        'worstBetweenKeyQuaternionDeviationDegrees':max(r['maxBetweenKeyPoseDeviationDegrees'] for r in angular),
                        'worstRawQuaternionNormRange':[min(r['unnormalizedCubicQuatNormRange'][0] for r in angular),max(r['unnormalizedCubicQuatNormRange'][1] for r in angular)],
                        'topAngularRateJoints':angular[:8], 'pelvisTranslation':transl,
                        'allTracks':rows}

report = {'sourceCanterSha256':hashlib.sha256(old_path.read_bytes()).hexdigest(),
          'cubicCandidateSha256':hashlib.sha256(new_path.read_bytes()).hexdigest(),
          'subdivisionsPer5msSegment':64,'clips':clips}
(HERE / 'interpolation-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'clips':{name:{k:v[k] for k in ['allTracksFinite','worstCubicAngularRateDegPerS','worstOriginalLinearAngularRateDegPerS','worstBetweenKeyQuaternionDeviationDegrees','worstRawQuaternionNormRange','pelvisTranslation']} for name,v in clips.items()}},indent=2))

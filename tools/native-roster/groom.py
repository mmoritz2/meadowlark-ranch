"""Fjord trim on the original native hair cards in standing-world metres.

This pure surface operation receives ONLY the hair mesh. It cannot change the
body, eye or tack meshes, indices, UVs, weights, skeleton or animated hair bones.
The caller converts the returned positions/normals through its existing inverse
skin matrices. Source maps and transparent card edges remain the creator's art.
"""
import numpy as np


def _unit(v):
    return v / max(float(np.linalg.norm(v)), 1e-12)


def _rotation(a, b):
    """Proper rotation mapping unit a to b; never reflect card winding."""
    a, b = _unit(a), _unit(b)
    cross = np.cross(a, b)
    cosine = float(np.clip(np.dot(a, b), -1., 1.))
    if cosine < -.999999:
        axis = _unit(np.cross(a, [1., 0., 0.] if abs(a[0]) < .8 else [0., 0., 1.]))
        return 2*np.outer(axis, axis)-np.eye(3)
    skew = np.array([[0., -cross[2], cross[1]],
                     [cross[2], 0., -cross[0]],
                     [-cross[1], cross[0], 0.]])
    return np.eye(3)+skew+skew@skew/(1.+cosine)


def shape_fjord_groom(source, shaped, groups, normals=None):
    """Return new hair positions, optional normals, and JSON-safe QA metadata.

    `source` and `shaped` are matching Nx3 arrays, before per-card growth. `groups`
    contains connected ORIGINAL card islands. Inputs are never mutated. Each
    card gets one positive-determinant affine operation about its attached high
    endpoint, so strand texture, card topology and source inertial controls stay
    intact. Tiny eyelash islands receive no trim or normal change.
    """
    source, shaped = np.asarray(source, float), np.asarray(shaped, float)
    if source.ndim != 2 or source.shape[1] != 3 or shaped.shape != source.shape:
        raise ValueError('Fjord groom needs matching Nx3 source and shaped hair arrays')
    if not np.isfinite(source).all() or not np.isfinite(shaped).all():
        raise ValueError('Fjord groom positions must be finite')
    q = shaped.copy()
    n = None if normals is None else np.array(normals, dtype=float, copy=True)
    if n is not None and (n.shape != q.shape or not np.isfinite(n).all()):
        raise ValueError('Fjord groom normals must match finite hair positions')
    seen = np.zeros(len(q), bool)
    records, counts = [], dict(mane=0, forelock=0, tail=0, eyelashes=0)
    max_anchor_drift, min_determinant = 0., 1.
    for number, indices in enumerate(groups):
        ids = np.asarray(indices, dtype=int)
        if ids.ndim != 1 or not len(ids) or np.any(ids < 0) or np.any(ids >= len(q)) or seen[ids].any() or len(np.unique(ids)) != len(ids):
            raise ValueError('Fjord groom groups must partition the original hair vertices')
        seen[ids] = True
        p = source[ids]
        if np.median(p[:, 2]) < -.60:
            role = 'tail'
        elif float(np.ptp(p, axis=0).max()) < .04:
            counts['eyelashes'] += 1
            continue
        else:
            role = 'forelock' if np.median(p[:, 2]) > 1.12 else 'mane'
        counts[role] += 1
        anchor = int(np.argmax(p[:, 1]))
        root = shaped[ids[anchor]].copy()
        local = shaped[ids]-root
        if role == 'tail':
            # Exactly the existing 1.06 tail length treatment, with the normal
            # corrected for its anisotropic scale instead of left stale.
            transform = np.diag([1.+.08*.06, 1.06, 1.+.04*.06])
        else:
            # The farthest strand end, averaged to avoid a single width corner,
            # defines the old growth axis. Width remains real source geometry.
            distance = np.linalg.norm(local, axis=1)
            ends = local[distance >= np.quantile(distance, .82)]
            old_axis = _unit(ends.mean(axis=0))
            old_length = max(float((local@old_axis).max()), .02)
            if role == 'mane':
                t = float(np.clip((p[anchor, 2]-.42)/.69, 0., 1.))
                # Low at withers/poll, gently rounded through the crest. Small
                # preserved layers avoid a uniformly clipped plastic outline.
                height = .085+.075*np.sin(np.pi*t)**.8
                height *= .94+.06*min(old_length/.24, 1.)
                direction = _unit(np.array([.025, .94, -.34]))
                width_scale = .72
            else:
                height = .078+.018*np.clip((p[anchor, 2]-1.10)/.10, 0., 1.)
                direction = _unit(np.array([.02, .94, .20]))
                width_scale = .72
            length_scale = height/old_length
            stretch = width_scale*np.eye(3)+(length_scale-width_scale)*np.outer(old_axis, old_axis)
            transform = _rotation(old_axis, direction)@stretch
        determinant = float(np.linalg.det(transform))
        if determinant <= 0 or not np.isfinite(determinant):
            raise ValueError('Fjord grooming must preserve card orientation')
        min_determinant = min(min_determinant, determinant)
        q[ids] = root+local@transform.T
        if role == 'tail':
            q[ids, 1] = np.maximum(q[ids, 1], .035)
        if n is not None:
            normal = np.linalg.solve(transform.T, n[ids].T).T
            normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-12)
            n[ids] = normal
        max_anchor_drift = max(max_anchor_drift, float(np.linalg.norm(q[ids[anchor]]-root)))
        if role != 'tail':
            records.append(dict(component=number, role=role, vertices=len(ids),
                                rootM=root.tolist(), topRiseM=float(q[ids, 1].max()-root[1]),
                                oldDropM=float(root[1]-shaped[ids, 1].min())))
    if not seen.all():
        raise ValueError('Fjord groom groups must include every original hair vertex')
    assert np.isfinite(q).all() and (n is None or np.isfinite(n).all())
    # The source UV islands are contiguous. Store one scalar classification per
    # complete card, never a new mesh/material or a moving-position shader mask.
    # Local medians follow the source neck's subtle turn instead of assuming its
    # mane lies on world X=0. This leaves pale layers on BOTH sides of the stripe.
    centers = np.array([q[np.asarray(groups[r['component']], int)].mean(0) for r in records])
    color_cards = []
    for i, record in enumerate(records):
        ids = np.asarray(groups[record['component']], int)
        if not np.array_equal(ids, np.arange(ids[0], ids[-1]+1)):
            raise ValueError('Fjord color metadata requires the pinned contiguous source cards')
        local = abs(centers[:, 2]-centers[i, 2]) < .09
        center = float(np.median(centers[local, 0]))
        distance = abs(float(centers[i, 0])-center)
        t = float(np.clip((distance-.009)/.010, 0., 1.))
        outer = t*t*(3.-2.*t)
        color_cards.append(dict(start=int(ids[0]), count=len(ids), outer=round(outer, 6)))
    report = dict(version=1, style='Short rounded upright native-card crest and forelock',
                  sourceTopologyPreserved=True, sourceSkinWeightsPreserved=True,
                  sourceInertialHairBonesPreserved=True, components=counts,
                  rootAnchorMaxDriftM=max_anchor_drift,
                  minimumCardTransformDeterminant=min_determinant,
                  maximumManeRiseM=max((r['topRiseM'] for r in records if r['role']=='mane'), default=0.),
                  minimumManeRiseM=min((r['topRiseM'] for r in records if r['role']=='mane'), default=0.),
                  minimumHairHeightM=float(q[:, 1].min()),
                  colorTreatment='Original native alpha/detail atlas with pale outer cards and a dark central stripe',
                  colorCards=color_cards,
                  cards=records)
    return q, n, report

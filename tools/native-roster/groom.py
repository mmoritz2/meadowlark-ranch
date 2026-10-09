"""Fjord trim on the original native hair cards in standing-world metres.

This pure surface operation receives ONLY the hair mesh. It cannot change the
body, eye or tack meshes, indices, UVs, weights, skeleton or animated hair bones.
The caller converts the returned positions/normals through its existing inverse
skin matrices. Source maps and transparent card edges remain the creator's art.
"""
import numpy as np


def _unit(v):
    v=np.asarray(v,dtype=float)
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


def _crest_guides(source, shaped, groups):
    """Smooth the mane's attached ridge, not its ragged alpha-card tips."""
    roots = []
    for ids in groups:
        p = source[ids]
        if np.median(p[:, 2]) < -.6 or np.ptp(p, axis=0).max() < .04 or np.median(p[:, 2]) > 1.12:
            continue
        donor = int(ids[np.argmax(p[:, 1])])
        roots.append((donor, shaped[donor]))
    points = np.array([p for _, p in roots])
    zs = np.linspace(float(np.quantile(points[:, 2], .015)), float(np.quantile(points[:, 2], .985)), 15)
    centers = []
    for z in zs:
        local = points[abs(points[:, 2]-z) < .075]
        centers.append([np.quantile(local[:, 0], .68), np.median(local[:, 1])])
    centers = np.array(centers)
    xfit, yfit = np.polyfit(zs, centers[:, 0], 3), np.polyfit(zs, centers[:, 1], 3)
    lo, hi = float(zs[0]-.012), float(zs[-1]+.005)
    def section(z):
        t = float(np.clip((z-lo)/(hi-lo), 0., 1.))
        roundness = np.sin(np.pi*t)**.68
        height = .018+.069*roundness
        width = .008+.028*roundness
        return np.array([np.polyval(xfit,z),np.polyval(yfit,z),z]), height, width
    return roots, section, lo, hi


def _crest_shell(roots, section, lo, hi):
    """A small closed loft, skinned by the unchanged original hair-root donors."""
    positions, uv, outer, donors, indices = [], [], [], [], []
    rows, sides = 65, 24
    for row,z in enumerate(np.linspace(lo,hi,rows)):
        center,height,width=section(z)
        donor=min(roots,key=lambda r:abs(r[1][2]-z)+abs(r[1][0]-center[0])*.25)[0]
        for side in range(sides):
            angle=side*2*np.pi/sides
            lateral=np.cos(angle)
            dark_lift=.017*(1.-np.clip((abs(lateral)-.30)/.30,0.,1.))*max(np.sin(angle),0.)
            edge=(.00065*np.sin(row*2.17)+.00055*np.sin(row*4.31))*max(np.sin(angle),0.)**10
            positions.append([center[0]+width*lateral,center[1]+height*(.42+.58*np.sin(angle))+dark_lift+edge,z])
            uv.append([side/sides,row/(rows-1)])
            # A narrow, continuous dark top stripe; warm pale sidewalls. The
            # bottom stripe is buried in the neck and adds no floating underside.
            a=float(np.clip((abs(lateral)-.30)/.30,0.,1.))
            outer.append(a*a*(3-2*a));donors.append(donor)
    for row in range(rows-1):
        for side in range(sides):
            a=row*sides+side;b=row*sides+(side+1)%sides;c=a+sides;d=b+sides
            indices.extend([a,b,c,b,d,c])
    for row,at_start in [(0,True),(rows-1,False)]:
        ring=np.array(positions[row*sides:(row+1)*sides]);cap=len(positions)
        positions.append(ring.mean(0).tolist());uv.append([.5,row/(rows-1)]);outer.append(0.);donors.append(donors[row*sides])
        for side in range(sides):
            a=row*sides+side;b=row*sides+(side+1)%sides
            indices.extend([cap,b,a] if at_start else [cap,a,b])
    positions=np.array(positions);triangles=np.array(indices).reshape(-1,3)
    normals=np.zeros_like(positions)
    face=np.cross(positions[triangles[:,1]]-positions[triangles[:,0]],positions[triangles[:,2]]-positions[triangles[:,0]])
    for corner in range(3):np.add.at(normals,triangles[:,corner],face)
    normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-12)
    return dict(positions=positions.tolist(),normals=normals.tolist(),indices=indices,
                sourceVertex=donors,uv=uv,outer=outer)


def shape_fjord_groom(source, shaped, groups, normals=None):
    """Return trimmed source hair, normals, and a lightweight crest surface.

    The crest's donor indices refer to original hair-root vertices. The builder
    copies those unmodified weights and inverse-skins this added surface. Source
    cards become short fringe inside the crest; the forelock hangs neatly rather
    than standing up as a second cluster of zebra-striped feather tips.
    """
    source, shaped=np.asarray(source,float),np.asarray(shaped,float)
    if source.ndim!=2 or source.shape[1]!=3 or shaped.shape!=source.shape:
        raise ValueError('Fjord groom needs matching Nx3 source and shaped hair arrays')
    if not np.isfinite(source).all() or not np.isfinite(shaped).all():
        raise ValueError('Fjord groom positions must be finite')
    q=shaped.copy();n=None if normals is None else np.array(normals,dtype=float,copy=True)
    if n is not None and (n.shape!=q.shape or not np.isfinite(n).all()):
        raise ValueError('Fjord groom normals must match finite hair positions')
    seen=np.zeros(len(q),bool)
    for indices in groups:
        ids=np.asarray(indices,dtype=int)
        if ids.ndim!=1 or not len(ids) or np.any(ids<0) or np.any(ids>=len(q)) or seen[ids].any() or len(np.unique(ids))!=len(ids):
            raise ValueError('Fjord groom groups must partition the original hair vertices')
        seen[ids]=True
    if not seen.all():raise ValueError('Fjord groom groups must include every original hair vertex')
    roots,section,lo,hi=_crest_guides(source,shaped,groups)
    shell=_crest_shell(roots,section,lo,hi)
    records,color_cards=[],[];counts=dict(mane=0,forelock=0,tail=0,eyelashes=0)
    max_anchor_drift,min_determinant=0.,1.
    for number,indices in enumerate(groups):
        ids=np.asarray(indices,dtype=int);p=source[ids]
        if np.median(p[:,2])<-.60:role='tail'
        elif float(np.ptp(p,axis=0).max())<.04:
            counts['eyelashes']+=1;continue
        else:role='forelock' if np.median(p[:,2])>1.12 else 'mane'
        counts[role]+=1;anchor=int(np.argmax(p[:,1]));old_root=shaped[ids[anchor]].copy();root=old_root.copy();local=shaped[ids]-old_root
        if role=='tail':
            transform=np.diag([1.+.08*.06,1.06,1.+.04*.06])
        elif role=='forelock':
            # A modest, softly hanging tuft between the ears. No alternating
            # card colors; it reads as one tidy dark forelock with source detail.
            transform=np.diag([.40,.32,.38])
            ridge,_,_=section(min(old_root[2],hi))
            root[0]=ridge[0]+(old_root[0]-ridge[0])*.28
        else:
            distance=np.linalg.norm(local,axis=1);ends=local[distance>=np.quantile(distance,.82)]
            old_axis=_unit(ends.mean(axis=0));old_length=max(float((local@old_axis).max()),.02)
            ridge,height,width=section(float(np.clip(old_root[2],lo,hi)))
            root=ridge.copy();root[1]-=.004
            # Place narrow original-card fringe in coherent physical lanes:
            # pale low outer layers and the slightly raised dark central strip.
            # Only 1–2 mm extends past the continuous surface, never feather tufts.
            lane=0 if number%4<2 else (-1 if number%4==2 else 1)
            lateral=lane*.68;root[0]+=lateral*width
            target_height=height*(.42+.58*np.sqrt(1-lateral*lateral))+(.017 if lane==0 else 0.)
            fringe=.0012+.0006*np.sin(number*1.73)**2
            length=(target_height+.004+fringe)/old_length
            stretch=.14*np.eye(3)+(length-.14)*np.outer(old_axis,old_axis)
            transform=_rotation(old_axis,[0.,1.,0.])@stretch
        determinant=float(np.linalg.det(transform))
        if determinant<=0 or not np.isfinite(determinant):raise ValueError('Fjord grooming must preserve card orientation')
        min_determinant=min(min_determinant,determinant);q[ids]=root+local@transform.T
        if role=='tail':q[ids,1]=np.maximum(q[ids,1],.035)
        if n is not None:
            normal=np.linalg.solve(transform.T,n[ids].T).T
            normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-12);n[ids]=normal
        max_anchor_drift=max(max_anchor_drift,float(np.linalg.norm(root-old_root)))
        if role!='tail':
            if not np.array_equal(ids,np.arange(ids[0],ids[-1]+1)):raise ValueError('Fjord card metadata requires pinned contiguous source cards')
            color_cards.append(dict(start=int(ids[0]),count=len(ids),outer=1. if role=='mane' and lane else 0.))
            records.append(dict(component=number,role=role,vertices=len(ids),rootM=root.tolist(),
                                topRiseM=float(q[ids,1].max()-root[1]),oldDropM=float(old_root[1]-shaped[ids,1].min())))
    assert np.isfinite(q).all() and (n is None or np.isfinite(n).all())
    report=dict(version=3,style='Smooth rounded skinned roached crest with short native-card fringe and a tidy forelock',
                sourceTopologyPreserved=True,sourceSkinWeightsPreserved=True,sourceInertialHairBonesPreserved=True,
                components=counts,rootAnchorMaxDriftM=max_anchor_drift,minimumCardTransformDeterminant=min_determinant,
                maximumManeRiseM=max((r['topRiseM'] for r in records if r['role']=='mane'),default=0.),
                minimumManeRiseM=min((r['topRiseM'] for r in records if r['role']=='mane'),default=0.),
                minimumHairHeightM=float(q[:,1].min()),
                colorTreatment='Pale brushed crest sides and a raised continuous dark center stripe; short color-matched fringe and dark tidy forelock',
                colorCards=color_cards,crestShell=shell,cards=records)
    return q,n,report

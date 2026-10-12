"""Original sculpted locks on the existing draft-horse hair skin.

Authors in standing metres. The builder retains the source cards/UVs and copies
exact donor influences for the small additional closed surfaces. No body, eye,
tack, skeleton, contact or animation data is accepted or modified here.
"""
import numpy as np


def _unit(v):
    return v/max(float(np.linalg.norm(v)),1e-12)


def shape_equestrian_groom(source, shaped, groups, normals=None):
    source=np.asarray(source,float);shaped=np.asarray(shaped,float)
    if source.shape!=shaped.shape or source.ndim!=2 or source.shape[1]!=3 or not np.isfinite(source).all() or not np.isfinite(shaped).all():
        raise ValueError('Matching finite Nx3 source and shaped hair required')
    q=shaped.copy();n=None if normals is None else np.asarray(normals,float).copy()
    if n is not None and (n.shape!=q.shape or not np.isfinite(n).all()):raise ValueError('Finite hair normals required')
    seen=np.zeros(len(q),bool);cards=[];byrole={k:[] for k in ['mane','forelock','tail','eyelashes']}
    for indices in groups:
        ids=np.asarray(indices,int)
        if not len(ids) or ids.min()<0 or ids.max()>=len(q) or seen[ids].any() or len(np.unique(ids))!=len(ids):raise ValueError('Hair groups must partition source vertices')
        seen[ids]=True;p=source[ids]
        role='tail' if np.median(p[:,2])<-.6 else 'eyelashes' if np.ptp(p,axis=0).max()<.04 else 'forelock' if np.median(p[:,2])>1.12 else 'mane'
        anchor=int(ids[np.argmax(p[:,1])]);byrole[role].append((ids,anchor))
        if role!='eyelashes':
            if not np.array_equal(ids,np.arange(ids[0],ids[-1]+1)):raise ValueError('Pinned source cards must be contiguous')
            cards.append(dict(start=int(ids[0]),count=len(ids),role=role))
    if not seen.all():raise ValueError('Hair groups must cover every source vertex')
    positions=[];uv=[];part=[];donors=[];indices=[];locks=[]

    def loft(centers,widths,depths,donor_ids,tail=False,sides=8,across_x=False):
        """Closed tapered lock. Adjacent rings follow an actual original card."""
        base=len(positions);centers=np.asarray(centers);tangents=np.gradient(centers,axis=0)
        for row,center in enumerate(centers):
            tangent=_unit(tangents[row]);across=np.array([1.,0.,0.] if tail or across_x else [0.,0.,1.])
            across=_unit(across-tangent*np.dot(across,tangent));depth=_unit(np.cross(tangent,across))
            for side in range(sides):
                angle=side*2*np.pi/sides
                positions.append((center+across*np.cos(angle)*widths[row]+depth*np.sin(angle)*depths[row]).tolist())
                uv.append([side/sides,row/(len(centers)-1)]);part.append(1. if tail else 0.);donors.append(int(donor_ids[row]))
        for row in range(len(centers)-1):
            for side in range(sides):
                a=base+row*sides+side;b=base+row*sides+(side+1)%sides;c=a+sides;d=b+sides
                indices.extend([a,b,c,b,d,c])
        for row,start in [(0,True),(len(centers)-1,False)]:
            cap=len(positions);positions.append(centers[row].tolist());uv.append([.5,row/(len(centers)-1)]);part.append(1. if tail else 0.);donors.append(int(donor_ids[row]))
            for side in range(sides):
                a=base+row*sides+side;b=base+row*sides+(side+1)%sides
                indices.extend([cap,b,a] if start else [cap,a,b])
        locks.append(dict(start=base,count=len(positions)-base,part='tail' if tail else 'mane'))

    mane_ids=np.concatenate([ids for ids,_ in byrole['mane']]);mane=shaped[mane_ids]
    root_guides=[]
    roots=np.array([shaped[a] for _,a in byrole['mane']]);zs=np.linspace(np.quantile(roots[:,2],.04),np.quantile(roots[:,2],.94),12)
    for number,z in enumerate(zs):
        nearby=[(ids,a) for ids,a in byrole['mane'] if abs(shaped[a,2]-z)<.055]
        if not nearby:nearby=[min(byrole['mane'],key=lambda pair:abs(shaped[pair[1],2]-z))]
        root=np.median([shaped[a] for _,a in nearby],axis=0);root[2]=z
        pool=np.concatenate([ids for ids,_ in nearby]);u=number/(len(zs)-1)
        drop=.29+.105*np.sin(np.pi*u)-.025*u+.035*np.sin(number*1.87)
        levels=np.linspace(0,1,10);x=[]
        for t in levels:
            near=mane[(abs(mane[:,1]-(root[1]-drop*t))<.055)&(abs(mane[:,2]-(z-.045*t))<.07)]
            x.append(float(np.quantile(near[:,0],.23))-.010 if len(near) else root[0]-.17*np.sin(t*np.pi/2))
        x[0]=root[0]-.006;fit=np.polyfit(levels,x,3)
        centers=np.array([[np.polyval(fit,t),root[1]-drop*t+.016*np.sin(np.pi*t),z-(.125+.035*np.sin(number*1.13))*t*t+.018*np.sin(t*np.pi)] for t in levels]);centers[0]=root+[-.009,.002,0];root_guides.append(centers[0].copy())
        taper=np.maximum(.055,np.sin((.24+.76*levels)*np.pi))**.65
        widths=(.043+.006*np.sin(number*1.37)**2)*taper;depths=.022*taper
        anchor_card=min(nearby,key=lambda pair:abs(shaped[pair[1],2]-z))[0]
        ring_donors=[int(anchor_card[np.argmin(np.linalg.norm(shaped[anchor_card]-c,axis=1))]) for c in centers]
        loft(centers,widths,depths,ring_donors)

    fore_ids=np.concatenate([ids for ids,_ in byrole['forelock']]);fore=shaped[fore_ids]
    fore_roots=np.array([shaped[a] for _,a in byrole['forelock']]);poll=np.median(fore_roots,axis=0)
    for number,lateral in enumerate([-.043,0.,.043]):
        levels=np.linspace(0,1,8);root=poll+[lateral,.006,-.006];drop=[.13,.18,.145][number]
        centers=np.array([root+[.020*np.sin(t*np.pi)-lateral*t*.35,-drop*t,.055*t+.075*np.sin(t*np.pi/2)] for t in levels])
        taper=np.maximum(.04,np.sin((.17+.83*levels)*np.pi))**.7
        ring_donors=[int(fore_ids[np.argmin(np.linalg.norm(fore-c,axis=1))]) for c in centers]
        loft(centers,.034*taper,.018*taper,ring_donors,across_x=True)

    tail_ids=np.concatenate([ids for ids,_ in byrole['tail']]);tail=shaped[tail_ids]
    tail_roots=np.array([shaped[a] for _,a in byrole['tail']]);top=np.quantile(tail_roots[:,1],.85);bottom=max(.14,np.quantile(tail[:,1],.01)+.075)
    tail_levels=np.linspace(0,1,14)
    for number in range(5):
        angle=2*np.pi*number/5;centers=[]
        for t in tail_levels:
            y=top*(1-t)+bottom*t;near=tail[abs(tail[:,1]-y)<.095]
            mid=np.median(near,axis=0) if len(near) else np.median(tail,axis=0)
            radius=.034*np.sin((.12+.77*t)*np.pi)
            centers.append([mid[0]+np.cos(angle)*radius+.023*np.sin(t*np.pi),y,mid[2]+np.sin(angle)*radius-.013*np.sin(t*np.pi)])
        centers=np.asarray(centers);taper=(.30+.70*np.sin(np.pi*(.15+.79*tail_levels)))**.8;taper[-1]=.075
        ring_donors=[int(tail_ids[np.argmin(np.linalg.norm(tail-c,axis=1))]) for c in centers]
        loft(centers,.038*taper,.029*taper,ring_donors,True,10)

    # Keep the finer source strands as short fringe. Eyelashes are not grooming.
    for role,scale in [('mane',[.62,.30,.66]),('forelock',[.48,.22,.40]),('tail',[.84,.95,.84])]:
        transform=np.diag(scale)
        for ids,anchor in byrole[role]:
            root=shaped[anchor];target_root=root.copy()
            if role=='mane':
                guides=np.asarray(root_guides);target_root[0]=np.interp(root[2],zs,guides[:,0]);target_root[1]=np.interp(root[2],zs,guides[:,1])-.006
            q[ids]=target_root+(shaped[ids]-root)@transform.T
            if n is not None:
                nn=np.linalg.solve(transform.T,n[ids].T).T;n[ids]=nn/np.maximum(np.linalg.norm(nn,axis=1,keepdims=True),1e-12)
    pos=np.asarray(positions);tri=np.asarray(indices).reshape(-1,3);normal=np.zeros_like(pos)
    face=np.cross(pos[tri[:,1]]-pos[tri[:,0]],pos[tri[:,2]]-pos[tri[:,0]])
    for corner in range(3):np.add.at(normal,tri[:,corner],face)
    normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-12)
    if len(pos)>2048 or len(indices)>15000 or not np.isfinite(pos).all() or not np.isfinite(normal).all() or np.linalg.norm(face,axis=1).min()<1e-12:raise ValueError('Invalid bounded groom surface')
    report=dict(version=1,style='Original swept tapered mane locks, tidy forelock and cohesive flowing tail',components={k:len(v) for k,v in byrole.items()},cards=cards,eyelashCards=[dict(start=int(ids[0]),count=len(ids)) for ids,_ in byrole['eyelashes']],locks=locks,maneLocks=12,forelockLocks=3,tailLocks=5,sourceTopologyPreserved=True,sourceSkinWeightsPreserved=True,minimumHairHeightM=float(min(q[:,1].min(),pos[:,1].min())),crestShell=dict(positions=positions,normals=normal.tolist(),sourceVertex=donors,indices=indices,uv=uv,outer=part))
    return q,n,report

"""Build compact breed appearance derivatives on the approved native 677 rig.

No skeleton, skin weight, bind, index, UV or animation data is changed. Regional
body/groom appearance changes are encoded as quantized geometry deltas. Drafts
also widen limb crosssections without moving their centers or ground contacts;
other breeds retain exact source positions and normals below 0.65 m.
"""
from pathlib import Path
import argparse, ast, copy, hashlib, io, json, sys
import numpy as np
from PIL import Image
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/models/native-roster'
sys.path.insert(0, str(ROOT / 'tools/asset-gen'))
import rig_hero_horse as glb

SOURCE = ROOT / 'review/native-trot-reference-kit/white/model.glb'
SOURCE_SHA = 'b188f5ea0c985c673c678daebf5e36daa1147a18693cec15ecc1bca439740a07'
TRANSLATION = np.array([-6.225790382362317e-9, .0047147771075021355, -1.6744842715166992])
SOURCE_SEAT = np.array([6.225790382362317e-9, 1.7380817122270678, 1.6744842715166992])
BASE_WITHERS = 1.7869539753502213

def sha(raw): return hashlib.sha256(raw).hexdigest()
def smooth(a, b, x):
    t = np.clip((x-a)/(b-a), 0, 1)
    return t*t*(3-2*t)
def write_json(path, value): path.write_text(json.dumps(value, indent=2, allow_nan=False)+'\n')

# Reuse the existing roster's art palette without importing its Blender script.
palette_ast = ast.parse((ROOT/'tools/asset-gen/build-artist-breeds.py').read_text())
PALETTES = {n.targets[0].id: ast.literal_eval(n.value) for n in palette_ast.body
            if isinstance(n, ast.Assign) and isinstance(n.targets[0], ast.Name)
            and n.targets[0].id in ['COATS', 'HAIR_COLOR']}
COATS, HAIR = PALETTES['COATS'], PALETTES['HAIR_COLOR']
for key, description in [('vanner','Piebald with white stockings'),
                         ('fjord','Brown dun with a shortened dark mane'),
                         ('akhal','Golden buckskin')]:
    COATS[key] = (*COATS[key][:2], description)

# The palette is stored as linear Blender colors. Texture pixels use sRGB.
def srgb(linear):
    x = np.asarray(linear)
    return np.where(x <= .0031308, x*12.92, 1.055*np.maximum(x,0)**(1/2.4)-.055)

GROOM = {
    'bay': (1.00,1.00), 'chestnut':(1.18,1.10), 'palomino':(1.08,1.04),
    'haflinger':(1.28,1.10), 'grey':(1.20,1.07), 'black':(1.48,1.13),
    'pinto':(1.05,1.04), 'appaloosa':(.94,1.02), 'sunset':(.94,1.08),
    'iceland':(1.32,1.12), 'welsh':(1.10,1.06), 'stock':(.90,.98),
    'fjord':(.38,1.06), 'morgan':(1.14,1.06), 'thoro':(.78,.98),
    'knab':(.90,1.02), 'vanner':(1.44,1.14), 'marwari':(1.02,1.02),
    'lipiz':(1.20,1.09), 'sport':(1.15,1.05), 'akhal':(.63,.88),
    'percheron':(1.15,1.10), 'shire':(1.38,1.14), 'clyde':(1.28,1.12),
    'bay-sporthorse':(1.00,1.00),
}

# Original art directions for the native draft foundations. These surface-only
# multipliers deliberately keep the approved skeleton and limb lengths intact.
DRAFT_SHAPES = {
    'percheron': dict(barrel_width=1.50, hindquarter_width=1.55, body_depth=1.25,
        body_length=1.055, neck_thickness=1.53, neck_length=1.00,
        neck_arch_rise_per_withers=.065, head_width=1.27, head_length=1.055,
        hoof_width=1.42, shaft_width=1.32, joint_width=1.37, upper_limb_width=1.52),
    'shire': dict(barrel_width=1.52, hindquarter_width=1.52, body_depth=1.27,
        body_length=1.07, neck_thickness=1.56, neck_length=1.085,
        neck_arch_rise_per_withers=.075, head_width=1.25, head_length=1.14,
        hoof_width=1.50, shaft_width=1.36, joint_width=1.44, upper_limb_width=1.60),
    'clyde': dict(barrel_width=1.43, hindquarter_width=1.45, body_depth=1.23,
        body_length=1.075, neck_thickness=1.46, neck_length=1.12,
        neck_arch_rise_per_withers=.075, head_width=1.23, head_length=1.12,
        hoof_width=1.46, shaft_width=1.34, joint_width=1.41, upper_limb_width=1.56),
}
DRAFT_STIRRUP_LIFT_M = {'percheron':.04,'shire':.12,'clyde':.05}

def draft_limb_centers(body):
    """Measure four separate rest-pose centers; the source stance is asymmetric.

    A weighted hoof centroid makes the sum of X/Z offsets exactly zero even
    though the single floor contact is pinned. All other source sole vertices
    are at least 0.137 mm higher and receive the full horizontal enlargement.
    Above the hoof, measured crosssection centers follow each existing limb.
    """
    result=[]
    for front in (True,False):
        for side in (-1,1):
            select=(body[:,0]*side>0)&((body[:,2]>.10) if front else (body[:,2]<-.40))
            hoof=select&(body[:,1]<=.14)
            weight=smooth(.00005,.00012,body[hoof,1])
            center=np.average(body[hoof][:,[0,2]],axis=0,weights=weight)
            heights=[0.,.14,.28,.46,.65,.81,.96,1.10]
            centers=[center,center]
            for h in heights[2:]:
                band=select&(abs(body[:,1]-h)<(.045 if h<.85 else .065))
                points=body[band][:,[0,2]]
                assert len(points)>10, (front,side,h,'missing limb crosssection')
                centers.append((points.min(0)+points.max(0))*.5)
            result.append(dict(id=('fore' if front else 'hind')+('Left' if side>0 else 'Right'),
                front=front,side=side,heights=heights,centers=np.asarray(centers).tolist(),
                hoofVertexCount=int(hoof.sum()),hoofSourceCentroid=body[hoof][:,[0,2]].mean(0).tolist()))
    return result

def draft_limbs(p,s,limbs):
    """Pure X/Z radial expansion, with fixed source Y and no limb translation."""
    q=p.copy();y=p[:,1]
    # A muscled forearm/gaskin, defined knee/hock, and a slimmer clean cannon.
    factor=s['hoof_width']+(s['shaft_width']-s['hoof_width'])*smooth(.14,.28,y)
    factor+=(s['joint_width']-s['shaft_width'])*np.exp(-((y-.57)/.13)**2)*smooth(.20,.30,y)
    factor+=(s['upper_limb_width']-s['shaft_width'])*smooth(.66,.82,y)
    fade=smooth(.00005,.00012,y)*(1-smooth(.82,1.10,y))
    for limb in limbs:
        select=(p[:,0]*limb['side']>0)&((p[:,2]>.10) if limb['front'] else (p[:,2]<-.40))
        region=smooth(.10,.30,p[:,2]) if limb['front'] else smooth(-.40,-.58,p[:,2])
        region=1+(region-1)*smooth(.14,.30,y)
        ids=np.where(select&(fade>0))[0]
        c=np.asarray(limb['centers'])
        center=np.column_stack([np.interp(y[ids],limb['heights'],c[:,axis]) for axis in range(2)])
        q[np.ix_(ids,[0,2])]+=(p[np.ix_(ids,[0,2])]-center)*((factor[ids]-1)*fade[ids]*region[ids])[:,None]
    return q

def cage(p, s, key, limbs=None, tack_mask=None, tack_lift=0.):
    """Common body/tack cage; draft-only lower-body edits use limb centers."""
    p = np.asarray(p, float)
    x,y,z = (p/BASE_WITHERS).T
    q = p/BASE_WITHERS
    q = q.copy()
    upper = smooth(.65/BASE_WITHERS, 1.15/BASE_WITHERS, p[:,1])
    head = smooth(.43,.59,z)*smooth(.75,.94,y)
    neck = smooth(.08,.30,z)*smooth(.70,.89,y)
    torso = (1-neck)*smooth(.39,.63,y)
    rump = smooth(-.12,-.47,z)*torso
    width = torso*(s['barrel_width']-1)+rump*(s['hindquarter_width']-s['barrel_width'])
    q[:,0] += x*width
    # Keep the saddle/back crest close to the original articulated spine.
    depth = np.clip(s['body_depth']-1,-.06,.28 if key in DRAFT_SHAPES else .16)
    q[:,1] += (y-.86)*depth*torso
    q[:,2] += z*(s['body_length']-1)*torso*.45
    q[:,0] += x*(s['neck_thickness']-1)*neck*(1-head)
    center = .86+np.clip((z-.18)/.42,0,1)*.30
    q[:,1] += (y-center)*(s['neck_thickness']-1)*neck*(1-head)
    q[:,2] += (z-.35)*(s['neck_length']-1)*neck*.30
    q[:,1] += (y-1.05)*(s['neck_length']-1)*neck*.25
    crest = np.sin(np.clip((z-.10)/.55,0,1)*np.pi)*smooth(.86,1.08,y)
    q[:,1] += (s['neck_arch_rise_per_withers']-.022)*crest*(1-head)*.55
    q[:,0] += x*(s['head_width']-1)*head
    q[:,2] += (z-.62)*(s['head_length']-1)*head*.55
    q[:,1] += (y-1.12)*(s['head_length']-1)*head*.45
    nose = np.exp(-((z-.72)/.115)**2-((y-1.00)/.12)**2)*head
    q[:,2] += s['face_profile_depth_per_withers']*nose*.65
    ear = smooth(1.17,1.21,y)
    q[:,1] += (y-1.17)*(s['ear_length']-1)*ear
    if key == 'marwari':
        curl = smooth(1.205,1.245,y)
        q[:,0] -= .018*curl*x/(abs(x)+.05)
    if key == 'black': q[:,0] -= np.sign(x)*.005*smooth(1.20,1.245,y)
    target=p+(q*BASE_WITHERS-p)*upper[:,None]
    if key in DRAFT_SHAPES and limbs is not None:
        target+=draft_limbs(p,s,limbs)-p
        # The cage's torso support never changes the accepted lower-leg height.
        target[p[:,1]<=.65,1]=p[p[:,1]<=.65,1]
        target[p[:,1]<=.00005]=p[p[:,1]<=.00005]
    if tack_mask is not None:
        # Shorten the Western fenders, carrying each complete iron rigidly.
        # This is source-world Y only; the upper strap joins remain fixed.
        target[tack_mask,1]+=tack_lift*(1-smooth(1.20,1.60,p[tack_mask,1]))
    return target

def groups(indices, count):
    t=indices.reshape(-1,3)
    edges=np.concatenate([t[:,[0,1]],t[:,[1,2]],t[:,[2,0]]])
    graph=coo_matrix((np.ones(len(edges),dtype=np.uint8),(edges[:,0],edges[:,1])),shape=(count,count)).tocsr()
    n,labels=connected_components(graph,directed=False)
    return [np.where(labels==i)[0] for i in range(n)]

def draft_stirrup_components(mesh):
    """Whole native fender/iron islands; no girth, saddle body or headstall.

    Native UV seams split an iron into several islands, so include every island
    within this measured region, not only the two tread-contact vertex ranges.
    The source girth is behind this region at Z=-.1, and headstall is Z>.3.
    """
    mask=np.zeros(len(mesh['actual']),bool);selected=[]
    for component,ids in enumerate(groups(mesh['indices'],len(mask))):
        p=mesh['actual'][ids];lo=p.min(0);hi=p.max(0)
        if np.min(abs(p[:,0]))>.145 and np.all(np.sign(p[:,0])==np.sign(p[0,0])) and lo[2]>.14 and hi[2]<.28 and lo[1]>1.025 and hi[1]<1.65:
            mask[ids]=True;selected.append(component)
    assert mask[2792:2846].all() and mask[2716:2770].all(), 'Whole treads must follow fender tailoring'
    assert not mask[7894:8125].any() and not mask[6954:7185].any(), 'Bridle bit points must remain unchanged'
    return mask,selected

def uv_atlas(p, uv, indices, size):
    atlas=np.zeros((size,size,3),np.float32); covered=np.zeros((size,size),bool)
    # GLTF UV origin corresponds to the top row of texture images (flipY=false).
    for ids in indices.reshape(-1,3):
        t=uv[ids]*(size-1);lo=np.maximum(0,np.floor(t.min(0)).astype(int));hi=np.minimum(size-1,np.ceil(t.max(0)).astype(int))
        if np.any(hi<lo):continue
        yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
        v0=t[1]-t[0];v1=t[2]-t[0];den=v0[0]*v1[1]-v1[0]*v0[1]
        if abs(den)<1e-10:continue
        px=xx-t[0,0];py=yy-t[0,1];a=(px*v1[1]-v1[0]*py)/den;b=(v0[0]*py-px*v0[1])/den
        inside=(a>=-.003)&(b>=-.003)&(a+b<=1.003)
        q=p[ids];value=q[0]+a[...,None]*(q[1]-q[0])+b[...,None]*(q[2]-q[0])
        atlas[lo[1]:hi[1]+1,lo[0]:hi[0]+1][inside]=value[inside]
        covered[lo[1]:hi[1]+1,lo[0]:hi[0]+1]|=inside
    for _ in range(8):
        for axis in [0,1]:
            for step in [-1,1]:
                near=np.roll(covered,step,axis);take=~covered&near
                atlas[take]=np.roll(atlas,step,axis)[take];covered[take]=True
    return atlas,covered

def paint_coat(key, atlas, covered, original):
    # All patterns use actual native rest anatomy in its original, unchanged UVs.
    x,y,z=np.moveaxis(atlas,-1,0)
    linear=np.ones((*x.shape,3),np.float32)*COATS[key][0]
    lower=1-smooth(.18,.64,y)
    if key in ['bay','palomino','pinto','appaloosa','stock','morgan','thoro','marwari','bay-sporthorse','clyde','akhal','fjord','iceland']:
        linear=linear*(1-lower[...,None]*.88)+np.array((.027,.021,.016))*lower[...,None]*.88
    muzzle=smooth(1.17,1.35,z)*(1-smooth(1.72,1.92,y))
    linear=linear*(1-muzzle[...,None]*.65)+np.array((.055,.050,.047))*muzzle[...,None]*.65
    if key in ['grey','welsh','percheron']:
        d=np.sin(x*38+np.sin(z*13))*np.sin(z*33+np.sin(y*16))*np.sin(y*31+np.cos(x*19))
        linear*=1-(smooth(-.15,.55,d)*smooth(.4,1.2,y)*.26)[...,None]
    if key in ['pinto','vanner']:
        field=np.sin(z*5.9+y*3.3)+.55*np.sin(z*11.1-y*5.4)+.5*np.cos(x*8.7+y*7.1)
        white=smooth(.13,.28,field)
        linear=linear*(1-white[...,None])+np.array((.86,.84,.78))*white[...,None]
    if key in ['knab','appaloosa']:
        field=np.sin(x*61+z*22+np.sin(y*13))*np.sin(z*53-y*12)*np.sin(y*49+x*9)
        spots=smooth(.55,.69,field)
        blanket=smooth(-.18,-.55,z)*smooth(.91,1.25,y) if key=='appaloosa' else np.ones_like(x)
        marks=np.array((.82,.81,.77))*(1-spots[...,None])+np.array((.047,.034,.026))*spots[...,None]
        linear=linear*(1-blanket[...,None])+marks*blanket[...,None]
    if key in ['fjord','iceland']:
        dorsal=(1-smooth(.016,.038,abs(x)))*smooth(1.52,1.66,y)
        linear*=1-.69*dorsal[...,None]
    if key in ['haflinger','clyde','shire','marwari','chestnut']:
        width=.040 if key in ['haflinger','clyde','shire'] else .020
        blaze=(1-smooth(width,width+.015,abs(x+.02)))*smooth(.95,1.12,z)*smooth(1.56,1.74,y)*(1-smooth(2.07,2.16,y))
        linear=linear*(1-blaze[...,None])+np.array((.90,.86,.78))*blaze[...,None]
    if key=='thoro':
        star=np.exp(-((x+.020)/.037)**2-((y-1.98)/.050)**2-((z-1.24)/.12)**2)
        linear=linear*(1-star[...,None])+np.array((.88,.86,.80))*star[...,None]
    if key in ['shire','clyde','vanner']:
        stockings=(1-smooth(.33+.035*np.sin(z*16+x*23),.42+.035*np.sin(z*16+x*23),y))*smooth(.10,.155,y)
        linear=linear*(1-stockings[...,None])+np.array((.87,.84,.78))*stockings[...,None]
    horn=1-smooth(.10,.145,y)
    horncolor=np.array((.19,.16,.12)) if key in ['vanner','shire','clyde','haflinger'] else np.array((.048,.042,.034))
    linear=linear*(1-horn[...,None])+horncolor*horn[...,None]
    # Retain artist-painted fine hair/muscle shading. White detail is never replaced.
    rgb=np.asarray(original,dtype=np.float32)/255*srgb(linear)
    rgb=np.clip(rgb,0,1)
    Image.fromarray((rgb*255+.5).astype(np.uint8)).save(OUT/(key+'-coat.webp'),quality=95,method=6)

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--only')
    ap.add_argument('--geometry-only',action='store_true',help='Keep existing coat/neutral texture bytes unchanged')
    args=ap.parse_args()
    keys=args.only.split(',') if args.only else list(COATS)
    assert len(set(keys))==len(keys) and all(key in COATS for key in keys), 'Unknown or repeated breed key'
    previous=json.loads((OUT/'manifest.json').read_text()) if (OUT/'manifest.json').exists() else None
    previous_report=json.loads((OUT/'build-report.json').read_text()) if (OUT/'build-report.json').exists() else None
    if args.only or args.geometry_only:
        assert previous and previous['sourceSha256']==SOURCE_SHA, 'Partial builds require the matching full manifest'
        assert len(previous['breeds'])==len(COATS), 'Refusing to merge into an incomplete manifest'
        assert previous_report and len(previous_report['rows'])==len(COATS), 'Partial builds require the full numerical report'
    untouched={path.name:sha(path.read_bytes()) for path in (OUT.iterdir() if OUT.exists() else [])
               if path.suffix in ['.bin','.webp','.png'] and (path.stem not in keys or path.suffix!='.bin')}
    assert sha(SOURCE.read_bytes())==SOURCE_SHA, 'Pinned native foundation changed'
    doc,binary=glb.read_glb(SOURCE);worlds,_=glb.node_worlds(doc)
    skin=doc['skins'][0];assert len(skin['joints'])==677 and len(doc['meshes'])==5
    inverse=glb.accessor(doc,binary,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    operators=np.array([worlds[i] for i in skin['joints']])@inverse
    meshes=[]
    for mi,mesh in enumerate(doc['meshes']):
        prim=mesh['primitives'][0];a=prim['attributes']
        p=glb.accessor(doc,binary,a['POSITION']).astype(float);n=glb.accessor(doc,binary,a['NORMAL']).astype(float)
        ji=glb.accessor(doc,binary,a['JOINTS_0']);wt=glb.accessor(doc,binary,a['WEIGHTS_0'])
        weighted=np.einsum('nw,nwij->nij',wt,operators[ji]);linear=weighted[:,:3,:3]
        actual=np.einsum('nij,nj->ni',weighted,np.c_[p,np.ones(len(p))])[:,:3]+TRANSLATION
        meshes.append(dict(index=mi,name=mesh['name'],raw=p,normal=n,linear=linear,actual=actual,
                           indices=glb.accessor(doc,binary,prim['indices']).astype(int),uv=glb.accessor(doc,binary,a['TEXCOORD_0'])))
    OUT.mkdir(parents=True,exist_ok=True)
    view=doc['bufferViews'][doc['images'][0]['bufferView']];offset=view.get('byteOffset',0)
    neutral=bytes(binary[offset:offset+view['byteLength']])
    if not args.geometry_only:
        (OUT/'neutralcoat.png').write_bytes(neutral)
        original=Image.open(io.BytesIO(neutral)).convert('RGB').resize((1024,1024),Image.Resampling.LANCZOS)
        atlas,covered=uv_atlas(meshes[0]['actual'],meshes[0]['uv'],meshes[0]['indices'],1024)
    else:
        assert sha((OUT/'neutralcoat.png').read_bytes())==sha(neutral)
    hairgroups=groups(meshes[2]['indices'],len(meshes[2]['raw']))
    limbs=draft_limb_centers(meshes[0]['actual'])
    stirrup_mask,stirrup_components=draft_stirrup_components(meshes[3])
    config=json.loads((ROOT/'tools/asset-gen/breed-conformation.json').read_text())
    specs=config['conformations']; extra=copy.deepcopy(specs['sport'])
    extra['sculpt_targets']={k:1 for k in extra['sculpt_targets']}
    extra['sculpt_targets'].update(face_profile_depth_per_withers=0,neck_arch_rise_per_withers=.022,body_length=1.015,limb_length=1.02)
    extra['height']['target_m']=1.64;extra['canonical_breed']='Bay Sporthorse';specs['bay-sporthorse']=extra
    manifest=dict(schemaVersion=1,sourceFile='../review/native-trot-reference-kit/white/model.glb',sourceSha256=SOURCE_SHA,
                  sourceWithersM=BASE_WITHERS,sourceTranslation=TRANSLATION.tolist(),sourceSeat=SOURCE_SEAT.tolist(),
                  jointCount=677,bodyVertexCount=16159,hairVertexCount=23514,tackVertexCount=13895,
                  neutralCoatFile='./models/native-roster/neutralcoat.png',neutralCoatSha256=sha(neutral),
                  license='CC BY-NC 4.0',artist='WildMesh 3D',
                  sourceUrl='https://sketchfab.com/3d-models/horse-realistic-3d-model-demo-free-65d6a70a6721495f938c93e80a5998e4',
                  method='Original native677 skeleton and approved clips unchanged; breed body/groom geometry and original-UV coats. Drafts also widen limb crosssections around unchanged centers; limb lengths and floor contacts remain fixed.',breeds={})
    if args.only:
        manifest={**previous,'method':manifest['method'],'breeds':copy.deepcopy(previous['breeds'])}
    reports=[]
    pending=[]
    for key in keys:
        spec=specs[key];s={**spec['sculpt_targets'],**DRAFT_SHAPES.get(key,{})};packed=bytearray();records=[];report={'id':key,'meshes':[]}
        bodytarget=None
        body=meshes[0]['actual'];wm=(abs(body[:,0])<.07)&(body[:,2]>.285)&(body[:,2]<.426)
        target_withers=float(cage(body,s,key,limbs if key in DRAFT_SHAPES else None)[wm,1].max())
        draft_actor=spec['height']['target_m']/target_withers
        stirrup_lift=DRAFT_STIRRUP_LIFT_M.get(key,0.)/draft_actor
        for m in meshes:
            p=m['actual'];limb_cage=limbs if key in DRAFT_SHAPES and m['index']==0 else None
            tack_cage=stirrup_mask if key in DRAFT_SHAPES and m['index']==3 else None
            q=cage(p,s,key,limb_cage,tack_cage,stirrup_lift);eps=1e-5
            jac=np.stack([(cage(p+np.eye(3)[axis]*eps,s,key,limb_cage,tack_cage,stirrup_lift)-cage(p-np.eye(3)[axis]*eps,s,key,limb_cage,tack_cage,stirrup_lift))/(2*eps) for axis in range(3)],axis=2)
            det=np.linalg.det(jac);assert np.isfinite(det).all() and det.min()>.3,(key,m['index'],'cage inversion')
            if m['index']==2:
                mane,tail=GROOM[key]
                for ids in hairgroups:
                    # Extend complete source cards from their attached high endpoint.
                    growth=tail if np.median(p[ids,2])<-.60 else mane
                    anchor=ids[np.argmax(p[ids,1])];root=q[anchor].copy()
                    q[ids]=root+(q[ids]-root)*np.array([1+.08*(growth-1),growth,1+.04*(growth-1)])
                    q[ids,1]=np.maximum(q[ids,1],.035)
            if m['index']==0: bodytarget=q.copy()
            # Convert world-space differential into unchanged source mesh space.
            delta=np.linalg.solve(m['linear'],(q-p)[...,None])[...,0]
            worldnormal=np.einsum('nij,nj->ni',m['linear'],m['normal'])
            targetnormal=np.linalg.solve(jac.transpose(0,2,1),worldnormal[...,None])[...,0]
            rawnormal=np.linalg.solve(m['linear'],targetnormal[...,None])[...,0]
            rawnormal/=np.maximum(np.linalg.norm(rawnormal,axis=1)[:,None],1e-12)
            ndelta=rawnormal-m['normal']
            fixed=p[:,1]<=(.00005 if limb_cage is not None else .65)
            if m['index']!=2:
                delta[fixed]=0;ndelta[fixed]=0
            def pack(a):
                peak=float(np.max(abs(a)));scale=max(peak/32760,1e-10)
                quant=np.rint(a/scale).astype('<i2');offset=len(packed);packed.extend(quant.tobytes())
                return {'byteOffset':offset,'count':int(a.size),'scale':scale},quant.astype(float)*scale
            pd,recovered=pack(delta);nd,nrecovered=pack(ndelta)
            actual_error=np.linalg.norm(np.einsum('nij,nj->ni',m['linear'],recovered-delta),axis=1)
            assert np.isfinite(recovered).all() and actual_error.max()<2e-5
            if m['index']==0:
                assert np.count_nonzero(recovered[fixed])==0 and np.count_nonzero(nrecovered[fixed])==0
                decoded=m['raw']+recovered
                decoded=decoded.astype('<f4').astype(float)
                bodydecoded=p+np.einsum('nij,nj->ni',m['linear'],decoded-m['raw'])
                assert abs(bodydecoded[:,1].min())<1e-8, (key,'standing floor changed')
            if tack_cage is not None:
                decoded=(m['raw']+recovered).astype('<f4').astype(float)
                tackdecoded=p+np.einsum('nij,nj->ni',m['linear'],decoded-m['raw'])
                original_tack=cage(p,s,key)
                report['draftStirrups']={'displayedLiftM':DRAFT_STIRRUP_LIFT_M[key],
                    'sourceLiftM':stirrup_lift,'componentIds':stirrup_components,'tailoredVertices':int(stirrup_mask.sum()),
                    'shorteningSourceYRangeM':[1.20,1.60],
                    'treadActualDisplayedLiftM':{side:float((tackdecoded[a:b+1,1]-original_tack[a:b+1,1]).mean()*draft_actor)
                        for side,a,b in [('left',2792,2845),('right',2716,2769)]},
                    'unselectedIdealTargetExactlyPreserved':bool(np.array_equal(q[~stirrup_mask],original_tack[~stirrup_mask]))}
                assert report['draftStirrups']['unselectedIdealTargetExactlyPreserved']
            records.append({'meshIndex':m['index'],'name':m['name'],'vertexCount':len(p),'positionDelta':pd,'normalDelta':nd})
            report['meshes'].append({'meshIndex':m['index'],'vertices':len(p),'minCageJacobianDeterminant':float(det.min()),
                                     'maxPositionQuantizationErrorM':float(actual_error.max()),'maxAppearanceDeltaM':float(np.linalg.norm(q-p,axis=1).max()),
                                     'fixedLowerVertices':int(fixed.sum()) if m['index']!=2 else 0})
        file=OUT/(key+'.bin');pending.append((file,packed))
        if not args.geometry_only: paint_coat(key,atlas,covered,original)
        coatfile=OUT/(key+'-coat.webp')
        body=meshes[0]['actual'];wm=(abs(body[:,0])<.07)&(body[:,2]>.285)&(body[:,2]<.426)
        withers=float(bodytarget[wm,1].max());height=spec['height']['target_m'];actor=height/withers
        seat=cage((SOURCE_SEAT+TRANSLATION)[None,:],s,key)[0]-TRANSLATION
        hair_srgb=srgb(HAIR[COATS[key][1]]).tolist()
        row={'id':key,'label':spec['canonical_breed'],'file':'./models/native-roster/'+file.name,'sha256':sha(packed),'byteLength':len(packed),
             'meshes':records,'withersM':height,'sourceWithersM':withers,'actorScale':actor,'sourceSeat':seat.tolist(),
             'sourceTranslation':TRANSLATION.tolist(),'sculptTargets':s,'conformation':spec['morphology']['build'],
             'groom':{'maneLengthFactor':GROOM[key][0],'tailLengthFactor':GROOM[key][1],'preservedSourceCardTopology':True},
             'coat':{'file':'./models/native-roster/'+coatfile.name,'sha256':sha(coatfile.read_bytes()),'description':COATS[key][2],
                     'colorSrgb':srgb(COATS[key][0]).tolist(),'hairColorSrgb':hair_srgb,'hairColorLinear':list(HAIR[COATS[key][1]]),
                     'neutralFile':'./models/native-roster/neutralcoat.png','originalUVsPreserved':True},
             'limitations':'Shares the approved articulated limb proportions and motion; upper-body shape and overall height vary. Native grooming remains alpha cards. Breed-specific gaits and added fetlock feather geometry are not claimed.'}
        if key in DRAFT_SHAPES:
            row['draftShape']={'version':1,'limbCenters':limbs,'hoofHeightM':.14,'floorPinnedBelowM':.00005,
                'limbFadeRangeM':[.82,1.10],'sourceYBelow065mPreserved':True,
                'hoofCenterMethod':'XZ centroid, weighted by smoothstep(.00005,.00012,sourceY); a single lowest sole contact is pinned',
                'unchangedSkeletonAndLimbLengths':True,'sharedBodyAndTackCage':True}
            row['draftShape']['stirrupTailoring']={'displayedLiftM':DRAFT_STIRRUP_LIFT_M[key],
                'sourceLiftM':stirrup_lift,'meshIndex':3,'vertexCount':13895,
                'componentIds':stirrup_components,'shorteningSourceYRangeM':[1.20,1.60],
                'treadVertexRanges':{'left':[2792,2845],'right':[2716,2769]},
                'reason':'Shorter Western fenders keep the existing human rider feet within reach on the broad draft body.'}
            row['limitations']='Approved joint centers, limb lengths and gaits retained. Draft body, neck, head and limb crosssections are enlarged surface derivatives, not a new skeleton. Native groom remains source alpha cards.'
            regions={
                'barrel':(body[:,1]>.95)&(body[:,1]<1.60)&(body[:,2]>-.55)&(body[:,2]<.25),
                'chest':(body[:,1]>.90)&(body[:,1]<1.55)&(body[:,2]>.25)&(body[:,2]<.65),
                'quarters':(body[:,1]>1.05)&(body[:,1]<1.65)&(body[:,2]>-.95)&(body[:,2]<-.50),
                'neck':(body[:,1]>1.45)&(body[:,1]<2.05)&(body[:,2]>.55)&(body[:,2]<1.02),
                'head':(body[:,1]>1.65)&(body[:,1]<2.18)&(body[:,2]>1.10)}
            # Compare against the unchanged earlier native art directions, not
            # whatever buffer happens to be on disk; repeated builds are stable.
            baseline=cage(body,spec['sculpt_targets'],key)
            baseline[body[:,1]<=.65]=body[body[:,1]<=.65]
            baseline_actor=height/float(baseline[wm,1].max())
            report['draftWidths']={name:{'sourceM':float(np.ptp(body[mask,0])),
                'previousM':float(np.ptp(baseline[mask,0])),'newM':float(np.ptp(bodydecoded[mask,0])),
                'gainOverPreviousPercent':float((np.ptp(bodydecoded[mask,0])/np.ptp(baseline[mask,0])-1)*100),
                'previousDisplayedM':float(np.ptp(baseline[mask,0])*baseline_actor),
                'newDisplayedM':float(np.ptp(bodydecoded[mask,0])*actor),
                'displayedGainPercent':float((np.ptp(bodydecoded[mask,0])*actor/(np.ptp(baseline[mask,0])*baseline_actor)-1)*100)} for name,mask in regions.items()}
            report['draftFeet']=[]
            for limb in limbs:
                foot=(body[:,0]*limb['side']>0)&((body[:,2]>.10) if limb['front'] else (body[:,2]<-.40))&(body[:,1]<=.14)
                old=body[foot];new=bodydecoded[foot]
                report['draftFeet'].append({'id':limb['id'],'vertices':int(foot.sum()),
                    'sourceWidthXZ':np.ptp(old[:,[0,2]],axis=0).tolist(),'newWidthXZ':np.ptp(new[:,[0,2]],axis=0).tolist(),
                    'centerShiftM':float(np.linalg.norm(new[:,[0,2]].mean(0)-old[:,[0,2]].mean(0))),
                    'maxYChangeM':float(abs(new[:,1]-old[:,1]).max())})
            report['standingBodyFloorM']=float(bodydecoded[:,1].min())
            report['maxLowerLimbYChangeM']=float(abs(bodydecoded[body[:,1]<=.65,1]-body[body[:,1]<=.65,1]).max())
            assert max(foot['centerShiftM'] for foot in report['draftFeet'])<2e-5
            assert report['maxLowerLimbYChangeM']<2e-5
        manifest['breeds'][key]=row;report.update(sha256=row['sha256'],byteLength=len(packed),actorScale=actor,withersM=height,
                                                 sourceWithersM=withers,unchangedRigJoints=677,bodyBelow065mExactlyPreserved=key not in DRAFT_SHAPES)
        reports.append(report);print(json.dumps({'id':key,'bytes':len(packed),'actorScale':round(actor,4),'sha256':row['sha256']}),flush=True)
    if args.only:
        by_id={r['id']:r for r in previous_report['rows']}
        by_id.update({r['id']:r for r in reports});reports=[by_id[key] for key in manifest['breeds']]
    for file,packed in pending:file.write_bytes(packed)
    write_json(OUT/'manifest.json',manifest);write_json(OUT/'build-report.json',{'sourceSha256':SOURCE_SHA,'rows':reports,
       'distinctBodyDeltaHashes':len(set(r['sha256'] for r in reports)),'allApprovedMotionAndRigDataUnchanged':True})
    if args.geometry_only:
        assert all(sha((OUT/name).read_bytes())==digest for name,digest in untouched.items()), 'Unselected buffer or texture changed'
    assert sha(SOURCE.read_bytes())==SOURCE_SHA

if __name__=='__main__': main()

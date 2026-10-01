"""Rest-only native677 targets. Geometry inputs contain no old rig or clips.

python3 review/native-breed-targets/build.py [bay-sporthorse|iceland]
Dependencies: NumPy and the repository's rig_hero_horse GLB helper.
The original artist's per-joint rest skin offsets are preserved after fitting
every pivot; no animation is supplied or approved by this builder.
"""
from pathlib import Path
import copy, hashlib, json, sys
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / 'tools/asset-gen'))
import rig_hero_horse as glb

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def append(doc, binary, values, kind):
    a = np.asarray(values, dtype='<f4')
    if kind == 'MAT4': a = a.transpose(0, 2, 1).reshape(-1, 16)
    binary.extend(b'\0' * (-len(binary) % 4))
    vi = len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': a.nbytes})
    binary.extend(a.tobytes())
    ai = len(doc['accessors'])
    acc = {'bufferView': vi, 'componentType': 5126, 'count': len(a), 'type': kind}
    if kind == 'VEC3': acc.update(min=a.min(0).tolist(), max=a.max(0).tolist())
    doc['accessors'].append(acc)
    return ai

def smooth(a, b, x):
    t = np.clip((x-a)/(b-a), 0, 1)
    return t*t*(3-2*t)

def cage(points, s, withers, heads):
    p = np.asarray(points, float) / withers
    x, y, z = p.T
    q = p.copy()
    head = smooth(.43,.58,z)*smooth(.72,.88,y)
    neck = smooth(.10,.29,z)*smooth(.73,.88,y)
    torso = (1-neck)*smooth(.42,.67,y)
    rump = smooth(-.13,-.45,z)*torso
    width = 1+torso*(s['barrel_width']-1)+rump*(s['hindquarter_width']-s['barrel_width'])
    leg = 1-smooth(.42,.67,y)
    lateral = np.sign(x)*.105
    q[:,0] = x*width+leg*((x-lateral)*(.32*(s['barrel_width']-1))+lateral*(s['barrel_width']-1)*.65)
    q[:,2] = z*s['body_length']
    q[:,1] = y+(s['limb_length']-1)*np.minimum(y,.61)
    q[:,1] += (y-.80)*(s['body_depth']-1)*torso
    q[:,2] += (z-.18)*(s['neck_length']-1)*neck
    q[:,1] += (y-.85)*(s['neck_length']-1)*neck
    center_y = .86+np.clip((z-.18)/.42,0,1)*.30
    q[:,0] += x*(s['neck_thickness']-1)*neck*(1-head)
    q[:,1] += (y-center_y)*(s['neck_thickness']-1)*neck*(1-head)
    arch = np.sin(np.clip((z-.12)/.54,0,1)*np.pi)*smooth(.85,1.05,y)
    q[:,1] += s['neck_arch_rise_per_withers']*arch*(1-head*.65)
    q[:,0] += x*(s['head_width']-1)*head
    q[:,2] += (z-.58)*(s['head_length']-1)*head
    q[:,1] += (y-1.15)*(s['head_length']-1)*head
    nose = np.exp(-((z-.71)/.115)**2-((y-1.00)/.12)**2)*head
    q[:,2] += s['face_profile_depth_per_withers']*nose
    ears = smooth(1.176,1.22,y)
    q[:,1] += (y-1.176)*(s['ear_length']-1)*ears
    hoof = 1-smooth(.073,.125,y)
    feet = heads[[19,25,30,35]][:,[0,2]]/withers
    nearest = np.argmin(np.sum((p[:,None,[0,2]]-feet[None,:,:])**2,axis=2),axis=1)
    q[:,0] += (x-feet[nearest,0])*(s['hoof_width']-1)*hoof
    q[:,2] += (z-feet[nearest,1])*(s['hoof_width']-1)*hoof
    return q*withers

def surface(doc, binary, worlds, mesh_index):
    skin = doc['skins'][0]
    inv = glb.accessor(doc,binary,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    operators = np.array([worlds[i] for i in skin['joints']]) @ inv
    attrs = doc['meshes'][mesh_index]['primitives'][0]['attributes']
    p = glb.accessor(doc,binary,attrs['POSITION']).astype(float)
    ji = glb.accessor(doc,binary,attrs['JOINTS_0'])
    wt = glb.accessor(doc,binary,attrs['WEIGHTS_0']).astype(float)
    weighted = np.einsum('nw,nwij->nij',wt,operators[ji])
    return np.einsum('nij,nj->ni',weighted,np.c_[p,np.ones(len(p))])[:,:3], weighted

def build(key):
    folder = HERE/key
    info = json.loads((folder/'input.json').read_text())
    src = (folder/info['nativeSourceFile']).resolve()
    for p, pin in [(src,'nativeSourceSha256'),(folder/'shape-input.npz','shapeInputSha256'),(folder/'coat.png','coatSha256')]:
        assert sha(p)==info[pin], (p,'changed input')
    original, binary = glb.read_glb(src)
    doc = copy.deepcopy(original)
    original_binary = bytes(binary)
    shape = np.load(folder/'shape-input.npz',allow_pickle=False)
    assert len(doc['skins'][0]['joints'])==677 and len(doc['meshes'])==5
    worlds, parents = glb.node_worlds(original)
    skin = original['skins'][0]
    ids = skin['joints']
    inv = glb.accessor(original,binary,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    source_ops = np.array([worlds[i] for i in ids]) @ inv
    source_body, _ = surface(original,binary,worlds,0)
    source_ground = float(source_body[:,1].min())
    saddle = next(i for i in ids if doc['nodes'][i]['name'].startswith('saddle_'))
    offset = np.array([0.,-source_ground,-worlds[saddle][2,3]])
    uniform = info['targetWithersM']/info['baseWithersM']
    translation = offset*uniform
    reports = []
    for mi in range(5):
        prim = doc['meshes'][mi]['primitives'][0]
        src_prim = original['meshes'][mi]['primitives'][0]
        actual, weighted = surface(original,binary,worlds,mi)
        target = shape[f'{mi}_POSITION'].astype(float)
        normals = shape[f'{mi}_NORMAL'].astype(float)
        assert len(target)==len(actual)
        assert np.array_equal(glb.accessor(original,binary,src_prim['indices']),shape[f'{mi}_indices'])
        linear = weighted[:,:3,:3]
        condition = np.linalg.cond(linear)
        assert np.isfinite(condition).all() and condition.max()<100
        raw = np.linalg.solve(linear,((target-translation)/uniform-weighted[:,:3,3])[...,None])[...,0]
        raw_normals = np.linalg.solve(linear,normals[...,None])[...,0]
        raw_normals /= np.maximum(np.linalg.norm(raw_normals,axis=1)[:,None],1e-12)
        prim['attributes']['POSITION'] = append(doc,binary,raw,'VEC3')
        prim['attributes']['NORMAL'] = append(doc,binary,raw_normals,'VEC3')
        reports.append({'mesh':doc['meshes'][mi]['name'],'vertices':len(raw),'maxWeightedOperatorCondition':float(condition.max())})
    frame_body = source_body+offset
    mask = (np.abs(frame_body[:,0])<.07)&(frame_body[:,2]>.285)&(frame_body[:,2]<.426)
    heads = np.asarray(info['canonicalCageHeads'],float)
    s = info['sculptTargets']
    raw_body = cage(frame_body,s,info['baseWithersM'],heads)
    ground = float(raw_body[:,1].min())
    cage_scale = info['targetWithersM']/(float(raw_body[mask,1].max())-ground)
    def warp(p):
        q = cage(p+offset,s,info['baseWithersM'],heads)
        q[:,1] -= ground
        return q*cage_scale
    new_heads_game = warp(np.array([worlds[i][:3,3] for i in ids]))
    new_heads = (new_heads_game-translation)/uniform
    by_id = dict(zip(ids,new_heads))
    for i in ids:
        parent = parents[i]
        parent_head = by_id[parent] if parent in by_id else worlds[parent][:3,3]
        local = np.linalg.solve(worlds[parent][:3,:3],by_id[i]-parent_head)
        doc['nodes'][i]['translation'] = local.tolist()
        assert np.isfinite(local).all()
    new_matrices = np.array([worlds[i].copy() for i in ids])
    new_matrices[:,:3,3] = new_heads
    new_inv = np.linalg.inv(new_matrices) @ np.array([worlds[i] for i in ids]) @ inv
    assert np.max(np.abs(new_matrices@new_inv-source_ops))<1e-8
    doc['skins'][0]['inverseBindMatrices'] = append(doc,binary,new_inv,'MAT4')
    original_scene_roots = doc['scenes'][doc['scene']]['nodes']
    doc['nodes'].append({'name':key+'NativeRestFrame','children':original_scene_roots,'translation':translation.tolist(),'scale':[uniform]*3})
    doc['scenes'][doc['scene']]['nodes'] = [len(doc['nodes'])-1]
    coat = (folder/'coat.png').read_bytes()
    binary.extend(b'\0' * (-len(binary)%4))
    vi = len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(coat)})
    binary.extend(coat)
    doc['images'][0] = {'bufferView':vi,'mimeType':'image/png'}
    doc['materials'][2]['pbrMetallicRoughness']['baseColorFactor'] = info['groomColorFactor']
    doc['animations'] = []
    doc.setdefault('extras',{})['nativeRestTarget'] = {'id':key,'noMotionApproval':True,'sourceOriginalSha256':info['originalSourceSha256'],'referenceGeometryOnly':True}
    output = folder/'rest.glb'
    glb.write_glb(output,doc,binary)
    check, cb = glb.read_glb(output)
    cw, _ = glb.node_worlds(check)
    joints_error = max(float(np.linalg.norm(cw[i][:3,3]-p)) for i,p in zip(ids,new_heads_game))
    assert joints_error<1e-7
    for mi,r in enumerate(reports):
        p,_ = surface(check,cb,cw,mi)
        desired = shape[f'{mi}_POSITION'].astype(float)
        err = np.linalg.norm(p-desired,axis=1)
        assert np.isfinite(p).all() and err.max()<5e-6
        r.update(restSkinnedMaxErrorM=float(err.max()),restSkinnedRmsErrorM=float(np.sqrt(np.mean(err**2))),bounds=[p.min(0).tolist(),p.max(0).tolist()])
    for mi in range(5):
        old_prim=original['meshes'][mi]['primitives'][0]
        new_prim=check['meshes'][mi]['primitives'][0]
        assert np.array_equal(glb.accessor(original,original_binary,old_prim['indices']),glb.accessor(check,cb,new_prim['indices']))
        a=original['meshes'][mi]['primitives'][0]['attributes'];b=check['meshes'][mi]['primitives'][0]['attributes']
        for k in ['JOINTS_0','WEIGHTS_0','TEXCOORD_0']:
            assert np.array_equal(glb.accessor(original,original_binary,a[k]),glb.accessor(check,cb,b[k]))
    assert check['skins'][0]['joints']==ids and all(check['nodes'][i].get(k)==original['nodes'][i].get(k) for i in ids for k in ['rotation','scale','children','name'])
    det = np.linalg.det(new_inv[:,:3,:3])
    body, _ = surface(check,cb,cw,0)
    report = {'id':key,'sourceSha256':sha(src),'originalAcquiredSha256':info['originalSourceSha256'],'referenceGeometrySha256':info['geometryReferenceSha256'],'outputSha256':sha(output),'jointCount':677,'clipCount':0,'noMotionApproval':True,'reference40RigNotIncluded':True,'jointOrderRotationScaleHierarchyPreserved':True,'nativeIndicesWeightsUVsPreserved':True,'originalBinaryPrefixPreserved':bytes(cb[:len(original_binary)])==original_binary,'jointPivotMaxErrorM':joints_error,'inverseBindsFiniteNonsingular':bool(np.isfinite(new_inv).all() and np.min(np.abs(det))>1e-10),'inverseBindAbsDetRange':[float(np.min(np.abs(det))),float(np.max(np.abs(det)))],'defaultArtistSkinOperatorMaxError':float(np.max(np.abs(new_matrices@new_inv-source_ops))),'fixedBodyFloorY':float(body[:,1].min()),'regionCageScale':cage_scale,'previewUniformFrameScale':uniform,'jointPivotNonuniformDeltaRangeM':[float(np.min(np.linalg.norm(new_heads_game-(uniform*np.array([worlds[i][:3,3] for i in ids])+translation),axis=1))),float(np.max(np.linalg.norm(new_heads_game-(uniform*np.array([worlds[i][:3,3] for i in ids])+translation),axis=1)))],'meshes':reports,'status':'Rest-only static target; no gait, naturalism or mounted-rider approval'}
    (folder/'build-report.json').write_text(json.dumps(report,indent=2)+'\n')
    chains={'FL':['clavicle_l_0203','upperarm_l_0204','lowerarm_l_0205','hand_l_0206','fingers_01_l_0187'],
            'FR':['clavicle_r_0269','upperarm_r_0270','lowerarm_r_0271','hand_r_0272','fingers_01_r_0273'],
            'HL':['upperleg_l_0405','lowerleg_l_0406','foot_l_0407','toes_01_l_0408'],
            'HR':['upperleg_r_0474','lowerleg_r_0475','foot_r_0476','toes_01_r_0477']}
    by_name={check['nodes'][i]['name']:i for i in ids}
    reference={'id':key,'sha256':sha(output),'jointCount':677,'anatomy':'Native _l positive X = FL/HL; _r negative X = FR/HR',
               'joints':[{'node':i,'name':check['nodes'][i]['name'],'parent':parents.get(i),'worldRestPosition':cw[i][:3,3].tolist()}for i in ids],
               'limbRestChains':{foot:{'names':names,'segmentLengthsM':[float(np.linalg.norm(cw[by_name[b]][:3,3]-cw[by_name[a]][:3,3]))for a,b in zip(names[:-1],names[1:])]}for foot,names in chains.items()},
               'noMotionApproval':True}
    (folder/'joint-reference.json').write_text(json.dumps(reference,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['id','outputSha256','jointCount','clipCount','fixedBodyFloorY','jointPivotMaxErrorM','inverseBindsFiniteNonsingular']}))

if __name__=='__main__':
    for key in sys.argv[1:] or ['bay-sporthorse','iceland']: build(key)

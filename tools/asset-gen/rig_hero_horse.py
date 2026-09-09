"""Bind the finished hero to the game's exact 33-joint gait contract.

No mesh re-export or global deformation: original GLB buffer bytes, positions,
indices, normals, UVs, materials and images are retained. Only skin attributes,
joint nodes, and inverse binds are appended. Run with bundled Python (NumPy),
or Blender --background --python this.py -- [arguments].
"""
import argparse, copy, hashlib, json, pathlib, struct, sys
import numpy as np

ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/models/hero-horse'

def read_glb(path):
    data=path.read_bytes();magic,version,total=struct.unpack_from('<4sII',data)
    assert magic==b'glTF' and version==2 and total==len(data)
    offset=12;doc=None;binary=None
    while offset<len(data):
        length,kind=struct.unpack_from('<II',data,offset);block=data[offset+8:offset+8+length];offset+=8+length
        if kind==0x4E4F534A:doc=json.loads(block)
        elif kind==0x004E4942:binary=bytearray(block)
    assert doc is not None and binary is not None
    return doc,binary

def write_glb(path,doc,binary):
    binary.extend(b'\0'*((-len(binary))%4));doc['buffers'][0]['byteLength']=len(binary)
    js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
    result=struct.pack('<4sII',b'glTF',2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(binary),0x004E4942)+binary
    path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_suffix('.glb.tmp');temp.write_bytes(result);temp.replace(path)

def accessor(doc,binary,index):
    a=doc['accessors'][index];view=doc['bufferViews'][a['bufferView']]
    assert not a.get('sparse'),'Sparse source positions are not supported'
    dtype={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
    cols={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];size=np.dtype(dtype).itemsize
    offset=view.get('byteOffset',0)+a.get('byteOffset',0);stride=view.get('byteStride',cols*size)
    return np.ndarray((a['count'],cols),dtype=dtype,buffer=binary,offset=offset,strides=(stride,size)).copy()

def local_matrix(node):
    if 'matrix' in node:return np.asarray(node['matrix'],dtype=float).reshape(4,4).T
    x,y,z,w=node.get('rotation',[0,0,0,1]);x2=x+x;y2=y+y;z2=z+z
    m=np.array([[1-y*y2-z*z2,x*y2-w*z2,x*z2+w*y2,0],[x*y2+w*z2,1-x*x2-z*z2,y*z2-w*x2,0],[x*z2-w*y2,y*z2+w*x2,1-x*x2-y*y2,0],[0,0,0,1]],dtype=float)
    m[:3,:3]*=np.array(node.get('scale',[1,1,1]))[None,:];m[:3,3]=node.get('translation',[0,0,0]);return m

def node_worlds(doc):
    parents={c:i for i,n in enumerate(doc['nodes']) for c in n.get('children',[])};cache={}
    def world(i):
        if i not in cache:cache[i]=(world(parents[i]) if i in parents else np.eye(4))@local_matrix(doc['nodes'][i])
        return cache[i]
    for i in range(len(doc['nodes'])):world(i)
    return cache,parents

def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)

def capsule(points,a,b):
    direction=b-a;t=np.clip((points-a)@direction/max(float(direction@direction),1e-10),0,1)
    delta=points-(a+t[:,None]*direction);return np.sqrt((delta*delta).sum(axis=1)),t

def two_leg_centers(points,height,front):
    p=points[np.abs(points[:,1]-height)<.023]
    p=p[(p[:,0]>.00)&(p[:,0]<.56)] if front else p[(p[:,0]<-.30)&(p[:,0]>-.815)]
    assert len(p)>12,('Too few leg samples',height,front,len(p))
    xz=p[:,[0,2]];centers=np.array([np.median(xz[xz[:,1]<np.median(xz[:,1])],axis=0),np.median(xz[xz[:,1]>=np.median(xz[:,1])],axis=0)])
    for _ in range(10):
        labels=((xz[:,None,:]-centers[None,:,:])**2).sum(axis=2).argmin(axis=1)
        centers=np.array([(np.percentile(xz[labels==i],8,axis=0)+np.percentile(xz[labels==i],92,axis=0))*.5 for i in range(2)])
    centers=centers[np.argsort(centers[:,1])]
    return np.array([[c[0],height,c[1]] for c in centers])

def fit_joints(points,anchors):
    # The source has a slight head turn and a real four-foot stance. Lower joints
    # are fitted from cross sections, never by mirroring one limb onto another.
    heads=np.zeros((33,3));heads[:7]=[[-.55,.23,.018],[-.33,.19,-.015],[-.07,.16,-.032],[.21,.17,-.032],[.36,.405,.005],[.696,.675,.079],[.90,.480,.156]]
    tail=np.array(anchors['tail']);heads[19:23]=tail[:4]
    stations={}
    # Cross-section bulges locate the carpi/hocks and fetlocks. The old rig's
    # front knee was above the modeled joint and bent the forearm instead.
    front_levels=[-.16,-.440,-.570,-.695,-.805]
    hind_levels=[-.16,-.440,-.695,-.805]
    front=[two_leg_centers(points,y,True) for y in front_levels]
    hind=[two_leg_centers(points,y,False) for y in hind_levels]
    shoulders=two_leg_centers(points,-.07,True)
    for side,start in enumerate((7,13)):
        heads[start]=[shoulders[side,0]-.015,.145,shoulders[side,2]*.79]
        for j,row in enumerate(front):heads[start+1+j]=row[side]
        # At elbow height the cross-section still includes the chest wall;
        # interpolate the actual leg center instead of sampling that broad wall.
        heads[start+1,[0,2]]=heads[start,[0,2]]*.48+heads[start+2,[0,2]]*.52
        heads[start+1,0]+=.022
    for side,start in enumerate((23,28)):
        heads[start]=[-.55,.255,hind[0][side,2]*.82]
        for j,row in enumerate(hind):heads[start+1+j]=row[side]
    stations['front']=[v.tolist() for v in front];stations['hind']=[v.tolist() for v in hind]
    return heads,stations

def hoof_landmarks(points,heads):
    feet=[('frontFar',7,9,11,12),('frontNear',13,15,17,18),('hindFar',23,25,26,27),('hindNear',28,30,31,32)]
    low=points[points[:,1]<-.765];centers=np.array([heads[f[-1]] for f in feet]);which=((low[:,None,[0,2]]-centers[None,:,[0,2]])**2).sum(axis=2).argmin(axis=1)
    result={}
    for i,(name,root,knee,fetlock,hoof) in enumerate(feet):
        p=low[which==i];sole_y=float(np.percentile(p[:,1],.5));sole=p[p[:,1]<sole_y+.013]
        center=np.median(sole,axis=0);center[1]=sole_y
        toe=sole[np.argmax(sole[:,0])].copy();heel=sole[np.argmin(sole[:,0])].copy();toe[1]=heel[1]=sole_y
        result[name]={'chain':list(range(root,hoof+1)),'root':root,'knee':knee,'fetlock':fetlock,'hoof':hoof,'soleY':sole_y,'sole':center.tolist(),'toe':toe.tolist(),'heel':heel.tolist(),'hoofBounds':[p.min(axis=0).tolist(),p.max(axis=0).tolist()],'restHoofToSole':(center-heads[hoof]).tolist()}
    return result

def skin_weights(points,heads,indices=None):
    n=len(points);weights=np.zeros((n,33),dtype=float);x,y,z=points.T
    # Stable torso with smooth longitudinal transitions.
    body_centers=heads[:4,0];body=np.exp(-((x[:,None]-body_centers[None,:])/.21)**2);body/=body.sum(axis=1)[:,None];weights[:,:4]=body
    neck=smooth(.17,.43,x)*smooth(.16,.40,y)
    neck_line=heads[5]-heads[4];u=(points-heads[4])@neck_line/(neck_line@neck_line)
    head_part=smooth(.36,.92,u)
    weights*=1-neck[:,None];weights[:,4]+=neck*(1-head_part);weights[:,5]+=neck*head_part
    face_axis=heads[6]-heads[5];face_axis/=np.linalg.norm(face_axis)
    face=smooth(.075,.19,(points-heads[5])@face_axis)*smooth(.65,.82,x)
    weights*=1-face[:,None];weights[:,6]+=face
    # Each leg is isolated spatially. Capsule distance blends its shoulder or
    # haunch into the torso; a short transition around every joint avoids creases.
    influences=[];leg_weights=[];leg_distances=[]
    for start,end,front in [(7,12,True),(13,18,True),(23,27,False),(28,32,False)]:
        ids=list(range(start,end+1));chain=heads[ids];dist=[];ts=[]
        for j in range(len(chain)-1):d,t=capsule(points,chain[j],chain[j+1]);dist.append(d);ts.append(t)
        distances=np.array(dist).T;seg=distances.argmin(axis=1);d=distances[np.arange(n),seg];t=np.array(ts).T[np.arange(n),seg]
        # A wide thigh can be closest to a thin distal capsule. Blend the union
        # of tapered anatomical capsules, not the radius of whichever segment
        # happened to win the nearest-segment test.
        joint_radii=[.115,.087,.057,.052,.064,.081] if front else [.22,.18,.060,.065,.085]
        relative=[]
        for j in range(len(chain)-1):
            radius=joint_radii[j]*(1-ts[j])+joint_radii[j+1]*ts[j]
            relative.append(dist[j]/radius)
        influence=(1-smooth(.04 if front else .095,.245 if front else .39,y))*(1-smooth(.90,1.65,np.min(relative,axis=0)))
        midpoint=(heads[7,2]+heads[13,2])*.5 if front else (heads[23,2]+heads[28,2])*.5
        # The sternum and underside of the pelvis bridge both limbs. They must
        # stay mostly on the torso rather than switching directly between left
        # and right thighs across a 5 cm strip during an opposite-phase gait.
        side_width=.110 if front else .135
        side_gate=smooth(midpoint-.012,midpoint+side_width,z) if start in (13,28) else 1-smooth(midpoint-side_width,midpoint+.012,z)
        influence*=side_gate
        lw=np.zeros_like(weights)
        lengths=np.linalg.norm(np.diff(chain,axis=0),axis=1);stations=np.r_[0,np.cumsum(lengths)]
        along=stations[seg]+t*lengths[seg]
        transitions=[]
        for j in range(1,len(chain)):
            blend=.075 if j==1 else .043
            transitions.append(smooth(stations[j]-blend,stations[j]+blend,along))
        # The hoof is rigid below its coronet, joined to the pastern with a
        # continuous band instead of a 100%-weight cutoff across one mesh edge.
        transitions[-1]=1-smooth(-.788,-.749,y)
        transitions=np.minimum.accumulate(np.asarray(transitions),axis=0)
        lw[:,ids[0]]=1-transitions[0]
        for j in range(1,len(chain)-1):lw[:,ids[j]]=transitions[j-1]-transitions[j]
        lw[:,ids[-1]]=transitions[-1]
        influences.append(influence);leg_weights.append(lw);leg_distances.append(d)
    influence=np.stack(influences,axis=1)
    # A hoof's broad toe must never retain a torso weight simply because it lies
    # outside a narrow cannon capsule. Below the belly the nearest limb owns the
    # complete surface, including its hoof, with a smooth proximal transition.
    nearest_leg=np.stack(leg_distances,axis=1).argmin(axis=1)
    complete_lower=(1-smooth(-.28,-.16,y))*(1-smooth(.15,.28,np.min(leg_distances,axis=0)))
    influence*=1-complete_lower[:,None];influence[np.arange(n),nearest_leg]+=complete_lower
    strength=influence.max(axis=1);den=influence.sum(axis=1);weights*=1-strength[:,None]
    for i,lw in enumerate(leg_weights):weights+=lw*(strength*influence[:,i]/np.maximum(den,1e-12))[:,None]
    # Only the compact retained dock is skin-weighted to the tail. The long hair
    # is a separate alpha groom driven by the same 19–22 joints.
    # The approved sculpt includes a narrow caudal remnant beneath the dock.
    # Seat it on the pelvis rather than pulling it into the swinging thigh.
    caudal=(1-smooth(-.804,-.750,x))*smooth(-.17,.06,y)*(1-smooth(.035,.105,np.abs(z-heads[19,2])))
    weights*=1-caudal[:,None];weights[:,0]+=caudal
    # Restrict dock ownership to its real compact volume. An x-only mask used
    # to leak tail animation into the near hind hock and fetlock.
    dock=(1-smooth(-.835,-.79,x))*smooth(.13,.235,y)*(1-smooth(.33,.39,y))*(1-smooth(.035,.095,np.abs(z-heads[19,2])))
    tail_weights=np.zeros_like(weights);tail_dist=[];tail_t=[]
    for j in range(19,22):d,t=capsule(points,heads[j],heads[j+1]);tail_dist.append(d);tail_t.append(t)
    tail_seg=np.array(tail_dist).argmin(axis=0)
    for j in range(3):
        mask=tail_seg==j;t=np.array(tail_t)[j,mask];tail_weights[mask,19+j]=1-t;tail_weights[mask,20+j]=t
    weights*=1-dock[:,None];weights+=tail_weights*dock[:,None]
    if indices is not None and len(points)>10000:weights=smooth_surface_weights(points,indices,weights)
    weights=np.maximum(weights,0);order=np.argsort(weights,axis=1)[:,-4:][:,::-1];selected=np.take_along_axis(weights,order,axis=1);selected/=np.maximum(selected.sum(axis=1)[:,None],1e-12)
    assert np.isfinite(selected).all() and np.all(selected.sum(axis=1)>.999999)
    return order.astype('<u2'),selected.astype('<f4')

def smooth_surface_weights(points,indices,weights):
    # UV seams duplicate vertices. Weld only the *weight solve*, leaving every
    # original position/index/UV byte intact. Surface-neighbor diffusion cannot
    # bleed across the air gap between the legs as a spatial blur would.
    _,first,inverse=np.unique(np.round(points,6),axis=0,return_index=True,return_inverse=True)
    p=points[first];w=weights[first].astype(np.float32);tri=inverse[np.asarray(indices).reshape(-1,3)]
    edges=np.unique(np.sort(np.concatenate((tri[:,[0,1]],tri[:,[1,2]],tri[:,[2,0]])),axis=1),axis=0)
    edges=edges[edges[:,0]!=edges[:,1]];length=np.linalg.norm(p[edges[:,0]]-p[edges[:,1]],axis=1)
    conductance=np.clip(.010/np.maximum(length,.0015),.15,3).astype(np.float32)
    a,b=edges.T;degree=np.zeros(len(p),np.float32);np.add.at(degree,a,conductance);np.add.at(degree,b,conductance)
    # Keep the face and soles untouched; soften shoulders/haunches most strongly.
    amount=(smooth(-.802,-.745,p[:,1])*(1-smooth(.34,.49,p[:,1]))*.53).astype(np.float32)
    for _ in range(36):
        total=np.zeros_like(w);np.add.at(total,a,w[b]*conductance[:,None]);np.add.at(total,b,w[a]*conductance[:,None])
        mean=total/np.maximum(degree[:,None],1e-6);w=w*(1-amount[:,None])+mean*amount[:,None]
    return w[inverse]

def append_accessor(doc,binary,data,kind,component_type):
    binary.extend(b'\0'*((-len(binary))%4));view={'buffer':0,'byteOffset':len(binary),'byteLength':data.nbytes};binary.extend(data.tobytes())
    doc.setdefault('bufferViews',[]).append(view);a={'bufferView':len(doc['bufferViews'])-1,'componentType':component_type,'count':len(data),'type':kind};doc.setdefault('accessors',[]).append(a);return len(doc['accessors'])-1

def main():
    argv=sys.argv[sys.argv.index('--')+1:] if '--'in sys.argv else sys.argv[1:]
    p=argparse.ArgumentParser();p.add_argument('--input',type=pathlib.Path,default=OUT/'hero-finished.glb');p.add_argument('--output',type=pathlib.Path,default=OUT/'hero-rigged-v2.glb');p.add_argument('--report',type=pathlib.Path,default=ROOT/'output/hero-rig-v2-qa/report.json');p.add_argument('--inspect-only',action='store_true');p.add_argument('--blend-output',type=pathlib.Path);args=p.parse_args(argv)
    doc,binary=read_glb(args.input);assert not doc.get('skins'),'Source must be the final unrigged hero'
    original_prefix=bytes(binary);source_primitives=copy.deepcopy(doc['meshes']);source_worlds,_=node_worlds(doc)
    source_nodes=[i for i,n in enumerate(doc['nodes']) if 'mesh'in n]
    allpoints=[]
    for ni in source_nodes:
        for primitive in doc['meshes'][doc['nodes'][ni]['mesh']]['primitives']:
            positions=accessor(doc,binary,primitive['attributes']['POSITION']);allpoints.append((np.c_[positions,np.ones(len(positions))]@source_worlds[ni].T)[:,:3])
    fit_points=max(allpoints,key=len);anchor_file=OUT/'finished-anchors.json'
    if not anchor_file.exists():anchor_file=OUT/'hero-groom-anchors.json'
    anchors=json.loads(anchor_file.read_text())['anchors'];heads,stations=fit_joints(fit_points,anchors)
    report={'input':str(args.input),'sourceSha256':hashlib.sha256(args.input.read_bytes()).hexdigest(),'coordinateSystem':'+X forward / +Y up / +Z lateral; raw GLTF rest space','jointPositions':heads.tolist(),'hoofLandmarks':hoof_landmarks(fit_points,heads),'legStations':stations,'sourceBounds':[fit_points.min(axis=0).tolist(),fit_points.max(axis=0).tolist()]}
    if args.inspect_only:
        args.report.parent.mkdir(parents=True,exist_ok=True);args.report.write_text(json.dumps(report,indent=2));print(json.dumps(report));return
    rig,_=read_glb(ROOT/'assets/models/horse_textured_rigged.glb');old_worlds,old_parents=node_worlds(rig);ordered=rig['skins'][0]['joints'];assert [rig['nodes'][i]['name'] for i in ordered]==[f'bone_{i}'for i in range(33)]
    lookup={oi:j for j,oi in enumerate(ordered)};desired={oi:old_worlds[oi].copy() for oi in ordered}
    report['hierarchy']=[{'index':j,'name':rig['nodes'][oi]['name'],'parent':lookup.get(old_parents.get(oi)),'position':heads[j].tolist(),'restQuaternion':rig['nodes'][oi].get('rotation',[0,0,0,1])} for j,oi in enumerate(ordered)]
    for j,oi in enumerate(ordered):desired[oi][:3,3]=heads[j]
    base=len(doc['nodes']);new_ids=list(range(base,base+33))
    for j,oi in enumerate(ordered):
        old=rig['nodes'][oi];node={k:copy.deepcopy(v)for k,v in old.items()if k not in ('children','translation','matrix')};parent=old_parents.get(oi)
        parent_world=desired[parent] if parent in desired else np.eye(4)
        node['translation']=(np.linalg.inv(parent_world)@np.r_[heads[j],1])[:3].tolist()
        children=[new_ids[lookup[c]]for c in old.get('children',[])if c in lookup]
        if children:node['children']=children
        doc['nodes'].append(node)
    skeleton_root=len(doc['nodes']);doc['nodes'].append({'name':'Hero runtime skeleton','children':[new_ids[0]]});doc['scenes'][doc.get('scene',0)]['nodes'].append(skeleton_root)
    doc['skins']=[];weight_reports=[];cache={};seen_meshes=set()
    for ni in source_nodes:
        node=doc['nodes'][ni];source_mesh_id=node['mesh']
        # Separate transformed instances may need different local skin weights.
        # Reuse their immutable geometry accessors but not the attributes object.
        if source_mesh_id in seen_meshes:
            node['mesh']=len(doc['meshes']);doc['meshes'].append(copy.deepcopy(source_primitives[source_mesh_id]))
        seen_meshes.add(source_mesh_id)
        mesh=doc['meshes'][node['mesh']];world=source_worlds[ni]
        binds=np.stack([np.linalg.inv(desired[oi])@world for oi in ordered]).transpose(0,2,1).astype('<f4').reshape(33,16)
        bind_accessor=append_accessor(doc,binary,binds,'MAT4',5126);node['skin']=len(doc['skins']);doc['skins'].append({'name':'Hero 33-bone skin','joints':new_ids,'skeleton':new_ids[0],'inverseBindMatrices':bind_accessor})
        for primitive in mesh['primitives']:
            position_id=primitive['attributes']['POSITION'];key=(position_id,tuple(world.flatten()))
            if key not in cache:
                position=accessor(doc,binary,position_id);world_points=(np.c_[position,np.ones(len(position))]@world.T)[:,:3]
                indices=accessor(doc,binary,primitive['indices']).ravel() if 'indices' in primitive else np.arange(len(position))
                joints,weights=skin_weights(world_points,heads,indices)
                ja=append_accessor(doc,binary,joints,'VEC4',5123);wa=append_accessor(doc,binary,weights,'VEC4',5126);cache[key]=(ja,wa)
                weight_reports.append({'vertices':len(position),'weightSumMaxError':float(np.max(np.abs(weights.sum(axis=1)-1))),'activeBones':np.unique(joints[weights>.005]).tolist()})
            primitive['attributes']['JOINTS_0'],primitive['attributes']['WEIGHTS_0']=cache[key]
    # Original bytes stay at their original offsets. Relative external textures
    # remain usable when a QA output is written to a different directory.
    if args.output.parent.resolve()!=args.input.parent.resolve():
        import os
        for image in doc.get('images',[]):
            if 'uri'in image and not image['uri'].startswith(('data:','http:','https:')):image['uri']=pathlib.PurePath(os.path.relpath(args.input.parent/image['uri'],args.output.parent)).as_posix()
    assert binary[:len(original_prefix)]==original_prefix
    for before,after in zip(source_primitives,doc['meshes']):
        for bp,ap in zip(before['primitives'],after['primitives']):
            assert all(ap['attributes'][k]==v for k,v in bp['attributes'].items())
            assert bp.get('indices')==ap.get('indices') and bp.get('material')==ap.get('material')
    final_worlds,_=node_worlds(doc);max_joint_error=max(float(np.max(np.abs(final_worlds[new_ids[j]]-desired[oi])))for j,oi in enumerate(ordered))
    assert max_joint_error<1e-6,max_joint_error
    report.update({'output':str(args.output),'bones':33,'weights':weight_reports,'sourceBufferPrefixUnchanged':True,'originalMeshAttributesUnchanged':True,'restRotationsExact':all(doc['nodes'][new_ids[j]].get('rotation')==rig['nodes'][oi].get('rotation') for j,oi in enumerate(ordered)),'maxJointMatrixError':max_joint_error})
    write_glb(args.output,doc,binary);report['outputBytes']=args.output.stat().st_size
    if args.blend_output:
        import bpy
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(args.output.resolve()))
        for obj in bpy.data.objects:
            if obj.type=='ARMATURE':
                obj.show_in_front=True;obj.data.display_type='OCTAHEDRAL'
                obj['runtime_contract']='Exact 33 joint names; raw GLTF +X forward / +Y up / +Z lateral. GLB is the canonical runtime export.'
                for item in report['hierarchy']:
                    bone=obj.data.bones.get(item['name'])
                    if bone:bone['runtime_index']=item['index'];bone['gltf_rest_position']=item['position']
        bpy.ops.wm.save_as_mainfile(filepath=str(args.blend_output.resolve()))
        report['blenderSource']=str(args.blend_output)
    args.report.parent.mkdir(parents=True,exist_ok=True);args.report.write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items()if k not in ('jointPositions','legStations','weights','hierarchy','hoofLandmarks')}))

if __name__=='__main__':main()

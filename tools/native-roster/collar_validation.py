"""Independent sparse collar decoding and reviewed standing-route checks.

Legacy attachments preserve the morph's standing surface. Reviewed lower-route
attachments have pinned authoring targets and a bounded analytic collar-only
field; their body/morph prefix remains protected by the caller.
"""
import hashlib
import json
from pathlib import Path
import numpy as np

SOURCE_SHA='b188f5ea0c985c673c678daebf5e36daa1147a18693cec15ecc1bca439740a07'
RANGES=((0,43),(76,196),(426,531),(754,976),(3348,3428),(3601,3823),(4053,4158),(5369,5393),(5517,5690),(5826,5999),(7416,7646),(8356,8586),(9508,9738),(9782,9802),(9810,9855),(9892,10064),(11392,11412),(11522,11542),(12073,12224))
AUTHORING=Path(__file__).resolve().parent/'collar-attachments'
ROOT=Path(__file__).resolve().parents[2]
POSITION_TOLERANCE=2e-5
DIRECTION_TOLERANCE=2e-5


def _unit(values):
    values=np.asarray(values,dtype=float)
    length=np.linalg.norm(values,axis=1)
    assert np.isfinite(values).all() and np.all(length>1e-12), 'Invalid standing normal'
    return values/length[:,None]


def _authoring(breed,record,arrays):
    if breed is None:return None,None
    assert breed in {'shire','percheron','clyde'}
    index=json.loads((AUTHORING/'index.json').read_text())
    assert index['version']==1 and index['sourceSha256']==SOURCE_SHA
    motion=ROOT/'assets/models/horse-motions/white-western.glb'
    assert hashlib.sha256(motion.read_bytes()).hexdigest()==index['motionSha256'], 'Reviewed collar motion changed'
    spec=index['breeds'][breed];path=AUTHORING/spec['file']
    assert path.resolve().parent==AUTHORING.resolve(), 'Foreign collar authoring file'
    assert record['authoringSha256']==spec['sha256']==hashlib.sha256(path.read_bytes()).hexdigest(), 'Collar authoring checksum'
    data=np.load(path,allow_pickle=False)
    # A changed descriptor/order/value must not be hidden by otherwise valid
    # normalized weights or by an enlarged selected region.
    for name,field,dtype in [('vertexIds','ids','<u2'),('position','position','<f4'),('normal','normal','<f4'),('skinIndex','skinIndex','<u2'),('skinWeight','skinWeight','<f4')]:
        value=data[field].astype(dtype).reshape(arrays[name].shape)
        assert np.array_equal(arrays[name],value), ('Packed collar differs from reviewed authoring',name)
    return spec,data


def _route_targets(route,world,normal):
    assert route['version']==1 and route['space']=='source-standing-metres-before-actor-scale'
    # These fixed spatial limits reserve the shoulder/saddle anchors. A future
    # different routing region requires a separately reviewed validator version.
    assert route['heightFade']==[1.1,1.27] and route['frontRise']==[.30,.69]
    lift,forward=route['liftM'],route['forwardM']
    assert all(isinstance(v,(int,float)) and not isinstance(v,bool) and np.isfinite(v) for v in [lift,forward])
    assert 0<lift<=.075 and 0<=forward<=.020, 'Unbounded standing collar reroute'
    def smooth_and_derivative(a,b,x):
        t=np.clip((x-a)/(b-a),0,1)
        return t*t*(3-2*t),np.where((x>a)&(x<b),6*t*(1-t)/(b-a),0)
    sy,dy=smooth_and_derivative(*route['heightFade'],world[:,1])
    sz,dz=smooth_and_derivative(*route['frontRise'],world[:,2])
    field=(1-sy)*sz;gradient_y=-dy*sz;gradient_z=(1-sy)*dz
    target=world+field[:,None]*np.array([0,lift,forward])
    jac=np.broadcast_to(np.eye(3),(len(world),3,3)).copy()
    jac[:,1,1]+=lift*gradient_y;jac[:,1,2]+=lift*gradient_z
    jac[:,2,1]+=forward*gradient_y;jac[:,2,2]+=forward*gradient_z
    determinant=np.linalg.det(jac)
    assert np.isfinite(jac).all() and determinant.min()>.3, 'Reflected or collapsed route field'
    target_normal=_unit(np.linalg.solve(jac.transpose(0,2,1),normal[...,None])[...,0])
    return target,target_normal,field,float(determinant.min())

def _restored_shoulder(spec,source,decoded):
    # Independent reconstruction of the reviewed v7 spatial contact field.
    assert spec['version']==7 and spec['sourceHeightM']==[.77,.90,1.48,1.85] and spec['sourceForwardM']==[.02,.28,.65,.90]
    sourceworld=source['world'];matrix=source['matrix']
    before=np.einsum('nij,nj->ni',matrix,np.c_[decoded['position'],np.ones(len(sourceworld))])[:,:3]+np.array([-6.225790382362317e-9,.0047147771075021355,-1.6744842715166992])
    oldnormal=_unit(np.einsum('nij,nj->ni',matrix[:,:3,:3],_unit(decoded['normal'])))
    def ease(a,b,x):
        t=np.clip((x-a)/(b-a),0,1);return t**3*(10-15*t+6*t*t)
    y,z=sourceworld[:,1],sourceworld[:,2]
    allowed=np.zeros(len(y),bool)
    for lo,hi in RANGES:allowed[lo:hi+1]=True
    field=ease(.77,.90,y)*(1-ease(1.48,1.85,y))*ease(.02,.28,z)*(1-ease(.65,.90,z))*allowed
    after=before+(sourceworld-before)*field[:,None]
    tri=source['indices'].reshape(-1,3);_,weld=np.unique(np.round(sourceworld,7),axis=0,return_inverse=True)
    def geometric(points):
        a,b,c=points[tri].transpose(1,0,2);faces=np.cross(b-a,c-a);acc=np.zeros((weld.max()+1,3))
        for corner in range(3):np.add.at(acc,weld[tri[:,corner]],faces)
        return acc[weld]/np.maximum(np.linalg.norm(acc[weld],axis=1)[:,None],1e-20)
    oldgeo,newgeo=geometric(before),geometric(after);cross=np.cross(oldgeo,newgeo);sine=np.linalg.norm(cross,axis=1);cosine=np.clip((oldgeo*newgeo).sum(1),-1,1)
    assert cosine[field>0].min()>-.999, 'Reflected collar surface during source fit'
    axis=cross/np.maximum(sine[:,None],1e-20)
    rotated=oldnormal*cosine[:,None]+np.cross(axis,oldnormal)*sine[:,None]+axis*(axis*oldnormal).sum(1)[:,None]*(1-cosine[:,None])
    normals=oldnormal.copy();change=(field>0)&(sine>1e-10);normals[change]=_unit(rotated[change])
    return after,normals,field

def check_collar_attachment(record,packed,used,source,decoded,ops,translation,actor_scale,breed=None):
    assert record['version']==1 and record['meshIndex']==3 and record['sourceSha256']==SOURCE_SHA
    count=record['vertexCount'];assert isinstance(count,int) and 0<count<=2404
    assert used==728256 and len(source['position'])==13895
    arrays={}
    for name,dtype,size in [('vertexIds','<u2',1),('position','<f4',3),('normal','<f4',3),('skinIndex','<u2',4),('skinWeight','<f4',4)]:
        aligned=(used+3)//4*4;assert not any(packed[used:aligned])
        d=record[name];assert d['byteOffset']==aligned and d['count']==count*size and d['itemSize']==size
        assert d['componentType']==('uint16' if dtype=='<u2' else 'float32')
        a=np.frombuffer(packed,dtype=dtype,count=d['count'],offset=aligned).copy().reshape(count,size)
        assert np.isfinite(a).all();arrays[name]=a;used=aligned+a.nbytes
    ids=arrays['vertexIds'].ravel().astype(int);assert len(np.unique(ids))==count
    allowed=np.zeros(13895,dtype=bool)
    for lo,hi in RANGES:allowed[lo:hi+1]=True
    assert allowed[ids].all(),'An attachment changes protected tack vertices'
    newp,newn,newj,neww=[arrays[k] for k in ['position','normal','skinIndex','skinWeight']]
    assert newj.max()<677 and (neww>=0).all() and (neww<=1).all()
    assert abs(neww.sum(axis=1)-1).max()<1e-4 and abs(np.linalg.norm(newn,axis=1)-1).max()<.002
    oldp=decoded['position'][ids];oldn=_unit(decoded['normal'][ids])
    oldmat=source['matrix'][ids];newmat=np.einsum('nw,nwij->nij',neww,ops[newj])
    oldworld=np.einsum('nij,nj->ni',oldmat,np.c_[oldp,np.ones(count)])[:,:3]+translation
    newworld=np.einsum('nij,nj->ni',newmat,np.c_[newp,np.ones(count)])[:,:3]+translation
    error=np.linalg.norm(newworld-oldworld,axis=1)*actor_scale
    # Three's skin-normal chunk uses the forward weighted skin operator.
    oldnormal=np.einsum('nij,nj->ni',oldmat[:,:3,:3],oldn)
    newnormal=np.einsum('nij,nj->ni',newmat[:,:3,:3],newn)
    oldnormal=_unit(oldnormal);newnormal=_unit(newnormal)
    normal_error=np.linalg.norm(newnormal-oldnormal,axis=1)
    assert np.linalg.det(newmat[:,:3,:3]).min()>0,'Reflected or degenerate skin operator'
    spec,data=_authoring(breed,record,arrays)
    report={'vertices':count,'sourceSha256':SOURCE_SHA,'baseMorphBytes':728256,'baseMorphSha256':hashlib.sha256(packed[:728256]).hexdigest(),'protectedTackOutsideSparseIdsPreserved':True}
    if spec:
        report.update(authoringSha256=spec['sha256'],authoringBaseMorphSha256=spec['baseMorphSha256'])
    route=spec.get('standingRoute') if spec else None
    if route:
        assert spec['baseMorphSha256']==report['baseMorphSha256']==record['baseMorphSha256'], 'Route authored against a different immutable morph'
        preworld,prenormal=oldworld,oldnormal
        restoration=spec.get('sourceRestoration')
        restore=np.zeros(count)
        if restoration:
            allworld,allnormal,allfield=_restored_shoulder(restoration,source,decoded)
            preworld,prenormal,restore=allworld[ids],allnormal[ids],allfield[ids]
            assert np.max(abs(restore-data['sourceRestoreMask']))<1e-12, 'Source restoration region mismatch'
        expected,expected_normal,field,min_det=_route_targets(route,preworld,prenormal)
        targets=np.asarray(data['standingTarget'],dtype=float);normals=np.asarray(data['standingNormal'],dtype=float)
        mask=np.asarray(data['routeMask']).reshape(-1)
        assert targets.shape==normals.shape==(count,3) and mask.shape==(count,)
        assert np.isfinite(targets).all() and np.isfinite(normals).all()
        assert np.all((mask==0)|(mask==1)) and np.array_equal(mask.astype(bool),field>0), 'Standing route region mismatch'
        assert abs(np.linalg.norm(normals,axis=1)-1).max()<1e-8, 'Authoring target normals are not unit length'
        assert np.linalg.norm(targets-expected,axis=1).max()<POSITION_TOLERANCE, 'Authoring target escapes the reviewed route envelope'
        assert np.linalg.norm(normals-expected_normal,axis=1).max()<DIRECTION_TOLERANCE, 'Authoring normals disagree with inverse-transpose route field'
        assert np.array_equal(newj,data['priorSkinIndex'].astype('<u2')) and np.array_equal(neww,data['priorSkinWeight'].astype('<f4')), 'Reroute changed existing animated skin influences'
        target_error=np.linalg.norm(newworld-targets,axis=1)
        target_normal_error=np.linalg.norm(newnormal-normals,axis=1)
        assert target_error.max()<POSITION_TOLERANCE, ('Incorrect inverse standing position solve',target_error.max())
        assert target_normal_error.max()<DIRECTION_TOLERANCE, ('Incorrect inverse standing normal solve',target_normal_error.max())
        fixed=(mask==0)&(restore==0)
        assert error[fixed].max(initial=0)<POSITION_TOLERANCE, 'Unrouted shoulder/saddle anchor moved'
        assert normal_error[fixed].max(initial=0)<DIRECTION_TOLERANCE, 'Unrouted shoulder/saddle normal changed'
        assert np.linalg.cond(newmat[:,:3,:3]).max()<10, 'Ill-conditioned standing skin operator'
        report.update(standingRoute={**route,'reroutedVertices':int(mask.sum()),'unchangedUpperVertices':int(fixed.sum()),
            'maximumStandingDisplacementDisplayedM':float(error.max()),'maximumTargetReconstructionDisplayedM':float(target_error.max()*actor_scale),
            'maximumTargetNormalDirectionError':float(target_normal_error.max()),'minimumRouteJacobianDeterminant':min_det,
            'unchangedRegionMaxDisplayedM':float(error[fixed].max(initial=0)),'skinInfluencesUnchanged':True,'sourceRestoredVertices':int((restore>0).sum())},
            restReconstructionMaxDisplayedM=float(target_error.max()*actor_scale),restNormalMaxDirectionError=float(target_normal_error.max()))
    else:
        assert error.max()<POSITION_TOLERANCE,('Standing collar moved',error.max())
        assert normal_error.max()<DIRECTION_TOLERANCE,('Standing collar normal changed',normal_error.max())
        report.update(restReconstructionMaxDisplayedM=float(error.max()),restNormalMaxDirectionError=float(normal_error.max()))
    return used,report

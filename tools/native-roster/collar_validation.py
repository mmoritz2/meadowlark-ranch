"""Independent sparse collar format and standing-surface preservation checks."""
import hashlib
import numpy as np

SOURCE_SHA='b188f5ea0c985c673c678daebf5e36daa1147a18693cec15ecc1bca439740a07'
RANGES=((0,43),(76,196),(426,531),(754,976),(3348,3428),(3601,3823),(4053,4158),(5369,5393),(5517,5690),(5826,5999),(7416,7646),(8356,8586),(9508,9738),(9782,9802),(9810,9855),(9892,10064),(11392,11412),(11522,11542),(12073,12224))

def check_collar_attachment(record,packed,used,source,decoded,ops,translation,actor_scale):
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
    oldp=decoded['position'][ids];oldn=decoded['normal'][ids].astype(float)
    oldn/=np.linalg.norm(oldn,axis=1)[:,None]
    oldmat=source['matrix'][ids];newmat=np.einsum('nw,nwij->nij',neww,ops[newj])
    oldworld=np.einsum('nij,nj->ni',oldmat,np.c_[oldp,np.ones(count)])[:,:3]+translation
    newworld=np.einsum('nij,nj->ni',newmat,np.c_[newp,np.ones(count)])[:,:3]+translation
    error=np.linalg.norm(newworld-oldworld,axis=1)*actor_scale
    assert error.max()<2e-5,('Standing collar moved',error.max())
    # Three's skin-normal chunk uses the forward weighted skin operator.
    oldnormal=np.einsum('nij,nj->ni',oldmat[:,:3,:3],oldn)
    newnormal=np.einsum('nij,nj->ni',newmat[:,:3,:3],newn)
    oldnormal/=np.linalg.norm(oldnormal,axis=1)[:,None];newnormal/=np.linalg.norm(newnormal,axis=1)[:,None]
    normal_error=np.linalg.norm(newnormal-oldnormal,axis=1)
    assert normal_error.max()<2e-5,('Standing collar normal changed',normal_error.max())
    assert np.linalg.det(newmat[:,:3,:3]).min()>0,'Reflected or degenerate skin operator'
    return used,{'vertices':count,'restReconstructionMaxDisplayedM':float(error.max()),'restNormalMaxDirectionError':float(normal_error.max()),'sourceSha256':SOURCE_SHA,'baseMorphBytes':728256,'baseMorphSha256':hashlib.sha256(packed[:728256]).hexdigest(),'protectedTackOutsideSparseIdsPreserved':True}

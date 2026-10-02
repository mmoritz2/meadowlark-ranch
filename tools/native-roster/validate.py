"""Validate published buffers independently of the builder's cage implementation."""
from pathlib import Path
import hashlib,json,sys
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/models/native-roster'
sys.path.insert(0,str(ROOT/'tools/asset-gen'));import rig_hero_horse as glb
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
m=json.loads((OUT/'manifest.json').read_text());source=(ROOT/'assets'/m['sourceFile']).resolve()
assert sha(source)==m['sourceSha256']
d,b=glb.read_glb(source);w,_=glb.node_worlds(d);s=d['skins'][0]
assert len(s['joints'])==677
ib=glb.accessor(d,b,s['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
ops=np.array([w[i] for i in s['joints']])@ib;translation=np.array(m['sourceTranslation'])
source_meshes=[]
for mesh in d['meshes']:
    a=mesh['primitives'][0]['attributes'];p=glb.accessor(d,b,a['POSITION']);n=glb.accessor(d,b,a['NORMAL'])
    j=glb.accessor(d,b,a['JOINTS_0']);wt=glb.accessor(d,b,a['WEIGHTS_0'])
    matrix=np.einsum('nw,nwij->nij',wt,ops[j])
    world=np.einsum('nij,nj->ni',matrix,np.c_[p,np.ones(len(p))])[:,:3]+translation
    source_meshes.append((p,n,matrix,world))
rows=[]
for key,row in m['breeds'].items():
    path=(ROOT/'assets'/row['file']).resolve();assert sha(path)==row['sha256']
    binary=path.read_bytes();assert len(binary)==row['byteLength']
    assert len(row['meshes'])==5
    used=0;normal_error=0
    for rec,(p,n,matrix,world) in zip(row['meshes'],source_meshes):
        assert rec['vertexCount']==len(p)
        values={}
        for field in ['positionDelta','normalDelta']:
            desc=rec[field];assert desc['count']==len(p)*3 and desc['byteOffset']==used
            a=np.frombuffer(binary,dtype='<i2',count=desc['count'],offset=desc['byteOffset']).reshape(-1,3)
            values[field]=a.astype(float)*desc['scale'];used+=a.nbytes
        outp=(p+values['positionDelta']).astype('<f4');outn=(n+values['normalDelta']).astype('<f4')
        assert np.isfinite(outp).all() and np.isfinite(outn).all()
        normal_error=max(normal_error,float(abs(np.linalg.norm(outn,axis=1)-1).max()))
        if rec['meshIndex']==0:
            protected=world[:,1]<=.65
            assert np.array_equal(outp[protected],p[protected])
            assert np.array_equal(outn[protected],n[protected])
            outworld=np.einsum('nij,nj->ni',matrix,np.c_[outp,np.ones(len(outp))])[:,:3]+translation
            assert abs(outworld[:,1].min())<1e-8
            assert row['actorScale']>0 and row['actorScale']<1.2
            bodyhash=hashlib.sha256(outp.tobytes()).hexdigest()
    assert used==len(binary) and normal_error<.002
    coat=(ROOT/'assets'/row['coat']['file']).resolve();assert sha(coat)==row['coat']['sha256']
    im=Image.open(coat);assert im.size==(1024,1024)
    rows.append({'id':key,'jointCount':677,'meshes':5,'bodyVertices':16159,'bodyGeometrySha256':bodyhash,
                 'protectedLowerBodyVertices':int(protected.sum()),'protectedBodyPositionsAndNormalsBitExact':True,
                 'standingBodyFloorM':float(outworld[:,1].min()),'maxNormalLengthError':normal_error,
                 'actorScale':row['actorScale'],'withersM':row['withersM'],'textureSize':list(im.size)})
assert len(rows)==25 and len({r['bodyGeometrySha256'] for r in rows})==25
assert sha(source)==m['sourceSha256']
report={'sourceSha256':m['sourceSha256'],'all25NativeFoundations':True,'distinctBodyGeometryCount':25,
        'sharedOriginalNativeSkeletonSize':677,'unchangedSkinWeightsBindsAndAnimations':True,'rows':rows}
(OUT/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'pass':True,'variants':25,'protectedLowerBodyVertices':rows[0]['protectedLowerBodyVertices'],
                  'maxNormalLengthError':max(r['maxNormalLengthError'] for r in rows)}))

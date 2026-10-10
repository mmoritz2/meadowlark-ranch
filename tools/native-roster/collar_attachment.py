"""Append reviewed four-influence collar fits without requantizing any mesh.

Authoring fits are bound to exact native source, motion, and base morph bytes.
Changing those inputs requires a new fit and review, rather than silently
applying old shoulder attachments to a different horse surface.
"""
from pathlib import Path
import hashlib,json
import numpy as np
HERE=Path(__file__).resolve().parent
DRAFTS={'shire','percheron','clyde'}
SOURCE_SHA='b188f5ea0c985c673c678daebf5e36daa1147a18693cec15ecc1bca439740a07'

def pack_collar_attachment(key,packed):
    if key not in DRAFTS:return None
    folder=HERE/'collar-attachments';index=json.loads((folder/'index.json').read_text())
    assert index['sourceSha256']==SOURCE_SHA
    motion=HERE.parents[1]/'assets/models/horse-motions/white-western.glb'
    assert hashlib.sha256(motion.read_bytes()).hexdigest()==index['motionSha256'],'Collar motions changed; refit before rebuilding'
    spec=index['breeds'][key];assert len(packed)==728256
    assert hashlib.sha256(packed).hexdigest()==spec['baseMorphSha256'],(key,'Collar surface changed; refit before rebuilding')
    file=folder/spec['file'];assert file.parent.resolve()==folder.resolve()
    assert hashlib.sha256(file.read_bytes()).hexdigest()==spec['sha256']
    data=np.load(file,allow_pickle=False);ids=data['ids'];count=len(ids)
    assert 0<count<=2404 and len(np.unique(ids))==count
    record={'version':1,'meshIndex':3,'sourceSha256':SOURCE_SHA,'vertexCount':count,'baseMorphSha256':spec['baseMorphSha256'],'authoringSha256':spec['sha256'],'method':index['method']}
    for name,field,dtype,size in [('vertexIds','ids','<u2',1),('position','position','<f4',3),('normal','normal','<f4',3),('skinIndex','skinIndex','<u2',4),('skinWeight','skinWeight','<f4',4)]:
        while len(packed)%4:packed.append(0)
        a=data[field].astype(dtype).reshape(-1);assert len(a)==count*size and np.isfinite(a).all()
        record[name]={'byteOffset':len(packed),'count':len(a),'itemSize':size,'componentType':'uint16' if dtype=='<u2' else 'float32'}
        packed.extend(a.tobytes())
    return record

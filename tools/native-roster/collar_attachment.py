"""Append reviewed four-influence collar fits without requantizing any mesh.

Authoring fits are bound to exact native source, motion, and base morph bytes.
Changing those inputs requires a new fit and review, rather than silently
applying old shoulder attachments to a different horse surface. The explicit
reviewed draft leg revisions below keep all non-body morph bytes unchanged.
"""
from pathlib import Path
import hashlib,json
import numpy as np
HERE=Path(__file__).resolve().parent
DRAFTS={'shire','percheron','clyde'}
SOURCE_SHA='b188f5ea0c985c673c678daebf5e36daa1147a18693cec15ecc1bca439740a07'

# Reviewed draft-contour v5 changes only the hind body morph. The entire front
# body/contact field, fitted collar, eyes, hair, separate saddle, rig and motion
# remain unchanged. Its broad C2 blend preserves the corrected v4 lower limbs.
# Keep the authoring-base hash as provenance; unknown future morphs still fail.
BODY_MORPH_BYTES=16159*3*2*2
REVIEWED_BODY_ONLY_BASES={
 'percheron':{
  'baseMorphSha256':'d12069a7b46c7299b0d8a35a287a0c8a8edb87017efcb0fe4c2c86bb1e34a38b',
  'authoringBaseMorphSha256':'cb81418afb0b65d08b9d9cbcfea546ee0a20e48c25aa97938c64896d676a9e3d',
  'nonBodyMorphSha256':'1812e30b8e24bdb349f6dda95360da3286249560bd876ff91d636915de2bfe3b'},
 'shire':{
  'baseMorphSha256':'8bc94d0bf79af6bec8f420e7cdc582b198803dc4441d8236c471d418855efe9b',
  'authoringBaseMorphSha256':'43f19dd76574fb57fdf9f33e789c3958d667fb0de594bf007e7c8bd1321bd575',
  'nonBodyMorphSha256':'1d3c785762aa7fcac4d2f4d16844a8e9a0e6c07b80d552cd47729ad4bb59a618'},
 'clyde':{
  'baseMorphSha256':'a737671dc6f9dc2d985fb48aa04362554a0b2e4008487382c2a1bb4a555220e1',
  'authoringBaseMorphSha256':'1f1db05f21ad3f853da85dcd6a74dddbef7bb9edb4dfa963de6906fad68e679d',
  'nonBodyMorphSha256':'3e35042e5f6c5803e1487de6f20b0eacd1c959b07f332e8a6298b7ab252144a9'},
}

def pack_collar_attachment(key,packed):
    if key not in DRAFTS:return None
    folder=HERE/'collar-attachments';index=json.loads((folder/'index.json').read_text())
    assert index['sourceSha256']==SOURCE_SHA
    motion=HERE.parents[1]/'assets/models/horse-motions/white-western.glb'
    assert hashlib.sha256(motion.read_bytes()).hexdigest()==index['motionSha256'],'Collar motions changed; refit before rebuilding'
    spec=index['breeds'][key];assert len(packed)==728256
    base_hash=hashlib.sha256(packed).hexdigest();compatibility=None
    if base_hash!=spec['baseMorphSha256']:
        compatibility=REVIEWED_BODY_ONLY_BASES.get(key)
        assert compatibility and base_hash==compatibility['baseMorphSha256'] and spec['baseMorphSha256']==compatibility['authoringBaseMorphSha256'],(key,'Collar surface changed; refit before rebuilding')
        assert hashlib.sha256(packed[BODY_MORPH_BYTES:]).hexdigest()==compatibility['nonBodyMorphSha256'],(key,'Protected non-body morph changed; refit collar before rebuilding')
    file=folder/spec['file'];assert file.parent.resolve()==folder.resolve()
    assert hashlib.sha256(file.read_bytes()).hexdigest()==spec['sha256']
    data=np.load(file,allow_pickle=False);ids=data['ids'];count=len(ids)
    assert 0<count<=2404 and len(np.unique(ids))==count
    record={'version':1,'meshIndex':3,'sourceSha256':SOURCE_SHA,'vertexCount':count,'baseMorphSha256':base_hash,'authoringSha256':spec['sha256'],'method':index['method']}
    if compatibility:
        record['authoringBaseMorphSha256']=spec['baseMorphSha256']
        record['preservedNonBodyMorphSha256']=compatibility['nonBodyMorphSha256']
    for name,field,dtype,size in [('vertexIds','ids','<u2',1),('position','position','<f4',3),('normal','normal','<f4',3),('skinIndex','skinIndex','<u2',4),('skinWeight','skinWeight','<f4',4)]:
        while len(packed)%4:packed.append(0)
        a=data[field].astype(dtype).reshape(-1);assert len(a)==count*size and np.isfinite(a).all()
        record[name]={'byteOffset':len(packed),'count':len(a),'itemSize':size,'componentType':'uint16' if dtype=='<u2' else 'float32'}
        packed.extend(a.tobytes())
    return record

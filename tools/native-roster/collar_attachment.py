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

# Reviewed v8 foreleg taper keeps the entire v7 body surface and authored
# normals from 0.90m upward, the released feet through 0.18m, all four
# non-body morphs and the full collar/groom append exact. Each whole canonical
# prefix is pinned independently; unknown geometry still requires a new fit.
REVIEWED_FORELEG_BASES={
 'percheron':{
  'baseMorphSha256':'a1a0c0dfa79006e02fe6a8a2fdac64444f0dab46a7bc0ef5fb3862a2514405bc',
  'authoringBaseMorphSha256':'d0623b49ba7ac05535864db88e1886d86ccd54cad26583c0e4960d24a1268500',
  'nonBodyMorphSha256':'2d5fe1fb3a5319c2223ee7f5f73435203a1ee6703a4b0ec1deaccf9138890b36'},
 'shire':{
  'baseMorphSha256':'73c7a71d25ee5a3f9b92c4a6f0e5fa128fefefcff4398c5b650d166f3bedb7ba',
  'authoringBaseMorphSha256':'01cb7277f423287381f81cecb04a5e2bced46f8003a4db921833d28e1d55946a',
  'nonBodyMorphSha256':'86c6b5ea8e74569f0e6e823dad8fd451cecf54dff545931256eea19c2f76e993'},
 'clyde':{
  'baseMorphSha256':'f2a3823cb176193458ffc6ca79f277cf5e46daca77996073a1d1b20bd5416daa',
  'authoringBaseMorphSha256':'c9b5437f37a1232defd018d3aa90696405a14d0d3fcfa30f649112127bbecc7a',
  'nonBodyMorphSha256':'4ec5bf841eb0059b1270b54c0f5a55a69991966e7e99845ab69745458fb58182'},
}

def pack_collar_attachment(key,packed,*,baseline_prefix=None,transport=None):
    if key not in DRAFTS:return None
    folder=HERE/'collar-attachments';index=json.loads((folder/'index.json').read_text())
    assert index['sourceSha256']==SOURCE_SHA
    motion=HERE.parents[1]/'assets/models/horse-motions/white-western.glb'
    assert hashlib.sha256(motion.read_bytes()).hexdigest()==index['motionSha256'],'Collar motions changed; refit before rebuilding'
    spec=index['breeds'][key];assert len(packed)==728256
    assert (baseline_prefix is None)==(transport is None), 'Transport requires a verified canonical authoring prefix'
    verified_prefix=packed if baseline_prefix is None else baseline_prefix
    assert len(verified_prefix)==728256
    base_hash=hashlib.sha256(verified_prefix).hexdigest();compatibility=None
    if base_hash!=spec['baseMorphSha256']:
        compatibility=next((record for record in (REVIEWED_BODY_ONLY_BASES.get(key),REVIEWED_FORELEG_BASES.get(key))
                            if record and base_hash==record['baseMorphSha256']),None)
        assert compatibility and base_hash==compatibility['baseMorphSha256'] and spec['baseMorphSha256']==compatibility['authoringBaseMorphSha256'],(key,'Collar surface changed; refit before rebuilding')
        assert hashlib.sha256(verified_prefix[BODY_MORPH_BYTES:]).hexdigest()==compatibility['nonBodyMorphSha256'],(key,'Protected non-body morph changed; refit collar before rebuilding')
    file=folder/spec['file'];assert file.parent.resolve()==folder.resolve()
    assert hashlib.sha256(file.read_bytes()).hexdigest()==spec['sha256']
    with np.load(file,allow_pickle=False) as loaded:data={name:loaded[name].copy() for name in loaded.files}
    ids=data['ids'];count=len(ids)
    assert 0<count<=2404 and len(np.unique(ids))==count
    record={'version':1,'meshIndex':3,'sourceSha256':SOURCE_SHA,'vertexCount':count,'baseMorphSha256':base_hash,'authoringSha256':spec['sha256'],'method':index['method']}
    if compatibility:
        record['authoringBaseMorphSha256']=spec['baseMorphSha256']
        record['preservedNonBodyMorphSha256']=compatibility['nonBodyMorphSha256']
    if transport is not None:
        preserved={field:data[field].copy() for field in ['ids','skinIndex','skinWeight']}
        data=transport(data)
        assert all(np.array_equal(data[field],before) for field,before in preserved.items()), 'Sculpt transport may not edit collar ownership or influences'
        if 'preservedNonBodyMorphSha256' in record:record['verifiedPreSculptNonBodyMorphSha256']=record.pop('preservedNonBodyMorphSha256')
        record['verifiedPreSculptMorphSha256']=base_hash
        record['baseMorphSha256']=hashlib.sha256(packed).hexdigest()
        record['surfaceTransport']='Shared equestrian model sculpt after the reviewed v7 lower collar route; source attachment IDs and four skin influences retained.'
        record['method']+=' The validated fitted surface is transported by the same smooth model-sculpt field as body, eyes, bridle and hair.'
    for name,field,dtype,size in [('vertexIds','ids','<u2',1),('position','position','<f4',3),('normal','normal','<f4',3),('skinIndex','skinIndex','<u2',4),('skinWeight','skinWeight','<f4',4)]:
        while len(packed)%4:packed.append(0)
        a=data[field].astype(dtype).reshape(-1);assert len(a)==count*size and np.isfinite(a).all()
        record[name]={'byteOffset':len(packed),'count':len(a),'itemSize':size,'componentType':'uint16' if dtype=='<u2' else 'float32'}
        packed.extend(a.tobytes())
    return record

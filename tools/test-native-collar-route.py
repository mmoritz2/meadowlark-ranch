"""Focused real-source route validation, including corrupted reviewed inputs."""
from pathlib import Path
import argparse,copy,hashlib,json,sys,tempfile
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--report',type=Path);args=parser.parse_args()
CANDIDATE=ROOT/'tools/native-roster/collar-attachments'
sys.path.insert(0,str(ROOT/'tools/native-roster'))
import validate as v
import collar_validation as cv
manifest=json.loads((ROOT/'assets/models/native-roster/manifest.json').read_text())
doc,binary=v.glb.read_glb((ROOT/'assets'/manifest['sourceFile']).resolve())
worlds,_=v.glb.node_worlds(doc);skin=doc['skins'][0]
inverse=v.glb.accessor(doc,binary,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
ops=np.array([worlds[i] for i in skin['joints']])@inverse
primitive=doc['meshes'][3]['primitives'][0];attributes=primitive['attributes']
source={k:v.glb.accessor(doc,binary,attributes[a]) for k,a in [('position','POSITION'),('normal','NORMAL'),('joints','JOINTS_0'),('weights','WEIGHTS_0')]}
source['matrix']=np.einsum('nw,nwij->nij',source['weights'],ops[source['joints']])
translation=np.array(manifest['sourceTranslation']);cases=[]
base_index=json.loads((cv.AUTHORING/'index.json').read_text())
with tempfile.TemporaryDirectory(prefix='collar-validation-') as scratch:
    authoring=Path(scratch);cv.AUTHORING=authoring
    index={**base_index,'breeds':{}}
    sources={};metas={};decoded={}
    for key in ['shire','percheron','clyde']:
        metas[key]=copy.deepcopy(base_index['breeds'][key])
        data=np.load(CANDIDATE/(key+'.npz'),allow_pickle=False);sources[key]={k:data[k].copy() for k in data.files}
        row=manifest['breeds'][key];rec=row['meshes'][3];packed=(ROOT/'assets'/row['file']).read_bytes();values={}
        for attribute,field in [('position','positionDelta'),('normal','normalDelta')]:
            d=rec[field];delta=np.frombuffer(packed,dtype='<i2',count=d['count'],offset=d['byteOffset']).reshape(-1,3)
            values[attribute]=(source[attribute]+delta*d['scale']).astype('<f4')
        decoded[key]=values
    def check(key,mutate=None):
        data=copy.deepcopy(sources[key]);meta=copy.deepcopy(metas[key]);route=meta['standingRoute']
        if mutate:mutate(data,route)
        path=authoring/(key+'.npz');np.savez_compressed(path,**data);sha=hashlib.sha256(path.read_bytes()).hexdigest()
        index['breeds'][key]={'file':path.name,'sha256':sha,'baseMorphSha256':meta['baseMorphSha256'],'standingRoute':route}
        (authoring/'index.json').write_text(json.dumps(index))
        packed=bytearray((ROOT/'assets'/manifest['breeds'][key]['file']).read_bytes()[:728256]);count=len(data['ids'])
        record={'version':1,'meshIndex':3,'sourceSha256':cv.SOURCE_SHA,'vertexCount':count,'authoringSha256':sha,'baseMorphSha256':meta['baseMorphSha256']}
        for name,field,dtype,size in [('vertexIds','ids','<u2',1),('position','position','<f4',3),('normal','normal','<f4',3),('skinIndex','skinIndex','<u2',4),('skinWeight','skinWeight','<f4',4)]:
            while len(packed)%4:packed.append(0)
            arr=data[field].astype(dtype).reshape(-1);record[name]={'byteOffset':len(packed),'count':count*size,'itemSize':size,'componentType':'uint16' if dtype=='<u2' else 'float32'};packed.extend(arr.tobytes())
        used,result=cv.check_collar_attachment(record,packed,728256,source,decoded[key],ops,translation,manifest['breeds'][key]['actorScale'],breed=key)
        assert used==len(packed);return result
    for key in sources:
        result=check(key);cases.append({'case':key+' reviewed route accepted','pass':True,'result':result})
    def reject(label,mutate,expected):
        try:check('shire',mutate)
        except (AssertionError,ValueError) as e:
            assert expected in str(e),(label,str(e));cases.append({'case':label,'pass':True,'rejection':str(e)})
        else:raise AssertionError('Accepted invalid '+label)
    reject('unbounded lift',lambda d,r:r.update(liftM=.5),'Unbounded')
    reject('unreviewed upper region',lambda d,r:r.update(heightFade=[1.1,1.6]),'')
    reject('incorrect independent target',lambda d,r:d['standingTarget'].__setitem__((0,0),d['standingTarget'][0,0]+.01),'escapes')
    reject('incorrect inverse raw position',lambda d,r:d['position'].__setitem__((0,0),d['position'][0,0]+.01),'inverse standing position')
    def wrong_normal(d,r):
        n=d['normal'][0].copy();n=np.roll(n,1);n/=np.linalg.norm(n);d['normal'][0]=n
    reject('incorrect inverse raw normal',wrong_normal,'inverse standing normal')
    def wrong_target_normal(d,r):
        n=d['standingNormal'][0].copy();n=np.roll(n,1);d['standingNormal'][0]=n
    reject('incorrect target normal field',wrong_target_normal,'inverse-transpose')
    reject('wrong route region mask',lambda d,r:d['routeMask'].__setitem__(0,1-int(d['routeMask'][0])),'region mismatch')
    def wrong_prior(d,r):d['priorSkinIndex'][0,0]=(int(d['priorSkinIndex'][0,0])+1)%677
    reject('changed prior influences',wrong_prior,'animated skin influences')
    reject('protected fender selected',lambda d,r:d['ids'].__setitem__(0,3000),'protected tack')
    reject('nonfinite point',lambda d,r:d['position'].__setitem__((0,0),float('nan')),'')
    reject('nonfinite field',lambda d,r:r.update(forwardM=float('nan')),'')
if args.report:args.report.write_text(json.dumps({'passed':True,'tests':len(cases),'cases':cases},indent=2)+'\n')
print(json.dumps({'passed':True,'tests':len(cases),'report':str(args.report) if args.report else None}))

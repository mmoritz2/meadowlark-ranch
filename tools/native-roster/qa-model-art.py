"""Independent decoded-surface gate for the 2026-10-20 native roster model art pass.

Requires a pre-edit snapshot (manifest, all 25 bins and baseline-proof.json).
Never imports the sculpt builder or trusts its displacement/Jacobian reports.
The unchanged native GLB supplies topology/weights/binds, and both old/new bins
are decoded through those actual weighted standing skin operators.

Example:
 python3 tools/native-roster/qa-model-art.py --baseline-dir /private/tmp/sculpt-horses-20261020-baseline --report /private/tmp/native-model-art-qa.json
Numerical checks complement, not replace, front/side/quarter and motion review.
"""
from pathlib import Path
import argparse, hashlib, json, sys
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/models/native-roster'
sys.path.insert(0,str(ROOT/'tools/asset-gen'))
import rig_hero_horse as glb

PROFILES=('bay','chestnut','palomino','haflinger','grey','black','pinto','appaloosa',
    'sunset','iceland','welsh','stock','fjord','morgan','thoro','knab','vanner','marwari',
    'lipiz','sport','akhal','percheron','shire','clyde','bay-sporthorse')
BASELINE_MANIFEST_SHA='c3db2495fffe6785b7c71d8f6d73c23d2a819a99283445d840a0665c2031a7f7'
SOURCE_SHA='b188f5ea0c985c673c678daebf5e36daa1147a18693cec15ecc1bca439740a07'
TOL=2e-5

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def unit(a):return a/np.maximum(np.linalg.norm(a,axis=-1,keepdims=True),1e-20)
def transform(m,p,t):return np.einsum('nij,nj->ni',m,np.c_[p,np.ones(len(p))])[:,:3]+t

def load_source(manifest):
    source=ROOT/'assets'/manifest['sourceFile'];assert sha(source)==SOURCE_SHA==manifest['sourceSha256']
    doc,binary=glb.read_glb(source);worlds,_=glb.node_worlds(doc);skin=doc['skins'][0]
    assert len(skin['joints'])==677
    binds=glb.accessor(doc,binary,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    ops=np.array([worlds[i] for i in skin['joints']])@binds
    meshes=[]
    for model in doc['meshes']:
        prim=model['primitives'][0];a=prim['attributes'];p=glb.accessor(doc,binary,a['POSITION']).astype(float)
        normals=glb.accessor(doc,binary,a['NORMAL']).astype(float);j=glb.accessor(doc,binary,a['JOINTS_0']);w=glb.accessor(doc,binary,a['WEIGHTS_0'])
        assert j.max()<677 and np.max(abs(w.sum(axis=1)-1))<.001
        matrix=np.einsum('nw,nwij->nij',w,ops[j])
        meshes.append({'name':model['name'],'jointNames':[doc['nodes'][i]['name'] for i in skin['joints']],'p':p,'n':normals,'j':j,'w':w,'m':matrix,
            'source':transform(matrix,p,manifest['sourceTranslation']),
            'tri':glb.accessor(doc,binary,prim['indices']).reshape(-1,3).astype(int)})
    return meshes,ops

def descriptor(data,d,dtype):
    offset,count=d['byteOffset'],d['count'];size=np.dtype(dtype).itemsize
    assert isinstance(offset,int) and offset>=0 and isinstance(count,int) and count>=0 and offset+count*size<=len(data)
    return np.frombuffer(data,dtype=dtype,count=count,offset=offset)

def decode(data,row,mesh,index,ops,translation):
    record=row['meshes'][index];assert record['vertexCount']==len(mesh['p']) and record['meshIndex']==index
    values={}
    for key,base in [('positionDelta','p'),('normalDelta','n')]:
        d=record[key];delta=descriptor(data,d,'<i2').reshape(-1,3).astype(float)*d['scale']
        assert delta.shape==mesh[base].shape and np.isfinite(delta).all()
        values[base]=(mesh[base]+delta).astype('<f4').astype(float)
    matrix=mesh['m']
    # Match the actual sparse native collar override, retaining its inherited
    # reviewed weight authoring. It is NOT part of the untouched body skeleton.
    attachment=row.get('tackAttachment')
    if attachment and attachment['meshIndex']==index:
        ids=descriptor(data,attachment['vertexIds'],'<u2').astype(int)
        assert len(np.unique(ids))==len(ids) and ids.max()<len(mesh['p'])
        matrix=matrix.copy()
        values['p'][ids]=descriptor(data,attachment['position'],'<f4').reshape(-1,3)
        values['n'][ids]=descriptor(data,attachment['normal'],'<f4').reshape(-1,3)
        joints=descriptor(data,attachment['skinIndex'],'<u2').reshape(-1,4)
        weights=descriptor(data,attachment['skinWeight'],'<f4').reshape(-1,4)
        matrix[ids]=np.einsum('nw,nwij->nij',weights,ops[joints])
    return {'raw':values['p'],'world':transform(matrix,values['p'],translation),
        'normal':unit(np.einsum('nij,nj->ni',matrix[:,:3,:3],unit(values['n'])))}

def appearance_descriptors(value,prefix=''):
    # UV/index/skin arrays of additive groom/collar geometry must remain exact,
    # even if co-fitting its positions changes the descriptor offsets.
    out={}
    if not isinstance(value,dict):return out
    for name,child in value.items():
        path=prefix+'/'+name
        if isinstance(child,dict) and 'byteOffset' in child and name in {'uv','skinIndex','skinWeight','index','sourceVertex','vertexIds','outer'}:out[path]=child
        elif isinstance(child,dict):out.update(appearance_descriptors(child,path))
    return out

def surface_metrics(before,after,tri,source):
    old_edges=before[tri[:,1:]]-before[tri[:,0,None]]
    new_edges=after[tri[:,1:]]-after[tri[:,0,None]]
    old_cross=np.cross(old_edges[:,0],old_edges[:,1]);new_cross=np.cross(new_edges[:,0],new_edges[:,1])
    old_area=np.linalg.norm(old_cross,axis=1)*.5;new_area=np.linalg.norm(new_cross,axis=1)*.5
    moved=np.linalg.norm(after-before,axis=1)>TOL
    meaningful=(old_area>=1e-7)&moved[tri].any(axis=1)
    ids=np.flatnonzero(meaningful)
    if not len(ids):return {'triangles':0,'inverted':0,'minStretch':1.,'maxStretch':1.,'maxEdgeGradient':0.,'maxWeldDeltaM':0.}
    a,b=old_edges[ids,0],old_edges[ids,1];length=np.linalg.norm(a,axis=1);ex=a/length[:,None]
    bx=(b*ex).sum(axis=1);by=np.linalg.norm(b-bx[:,None]*ex,axis=1)
    basis=np.zeros((len(ids),2,2));basis[:,0,0]=length;basis[:,0,1]=bx;basis[:,1,1]=by
    gradient=np.transpose(new_edges[ids],(0,2,1))@np.linalg.inv(basis)
    stretches=np.linalg.svd(gradient,compute_uv=False)
    orientation=(unit(old_cross[ids])*unit(new_cross[ids])).sum(axis=1)
    edges=np.unique(np.sort(np.vstack([tri[:,[0,1]],tri[:,[1,2]],tri[:,[2,0]]]),axis=1),axis=0)
    e0,e1=edges.T;length=np.linalg.norm(before[e1]-before[e0],axis=1)
    delta=after-before;good=length>1e-4
    edge_gradient=np.linalg.norm(delta[e1[good]]-delta[e0[good]],axis=1)/length[good]
    # A source duplicate is not necessarily a current seam: reviewed sparse
    # collar fitting can place those vertices on distinct leather layers. Only
    # require continuity where BOTH the source and the decoded baseline agree.
    weld_key=np.c_[np.round(source,7),np.round(before,7)]
    _,weld=np.unique(weld_key,axis=0,return_inverse=True)
    low=np.full((weld.max()+1,3),np.inf);high=-low.copy()
    np.minimum.at(low,weld,delta);np.maximum.at(high,weld,delta)
    weld_delta=np.linalg.norm(high-low,axis=1)
    worst=ids[np.argsort(stretches[:,-1])[:8]]
    return {'triangles':len(ids),'inverted':int((orientation<=0).sum()),'minOrientationDot':float(orientation.min()),
        'minStretch':float(stretches[:,-1].min()),'maxStretch':float(stretches[:,0].max()),
        'maxEdgeGradient':float(edge_gradient.max(initial=0)), 'edgeGradient99':float(np.quantile(edge_gradient,.99)),
        'maxWeldDeltaM':float(weld_delta.max(initial=0)),
        'worstCompressionTriangleIds':worst.tolist(),'worstCompressionBeforeAreaM2':old_area[worst].tolist(),
        'worstCompressionAfterAreaM2':new_area[worst].tolist()}

def similarity_residual(before,after):
    a=before-before.mean(0);b=after-after.mean(0);u,s,vh=np.linalg.svd(a.T@b);rotation=u@vh
    if np.linalg.det(rotation)<0:u[:,-1]*=-1;rotation=u@vh
    scale=float(np.trace((a@rotation).T@b)/np.sum(a*a));error=b-a@rotation*scale
    return {'bestUniformScale':scale,'rmsResidualM':float(np.sqrt(np.mean(np.sum(error*error,axis=1)))),
        'rmsDisplacementM':float(np.sqrt(np.mean(np.sum((after-before)**2,axis=1))))}

def rigid_shape_metrics(before,after):
    """Measure intrinsic ear shape, permitting coherent poll translation/rotation."""
    a=before-before.mean(0);b=after-after.mean(0)
    u,_,vh=np.linalg.svd(a.T@b);rotation=u@vh
    if np.linalg.det(rotation)<0:u[:,-1]*=-1;rotation=u@vh
    aligned=b@rotation.T;error=np.linalg.norm(aligned-a,axis=1)
    _,_,axes=np.linalg.svd(a,full_matrices=False)
    # Two long principal spans measure ear length/width. The very thin inner
    # and outer surfaces are governed by the absolute residual, avoiding an
    # unstable division by a near-zero thickness.
    before_spans=np.ptp(a@axes[:2].T,axis=0)
    after_spans=np.ptp(aligned@axes[:2].T,axis=0)
    return {'vertices':len(a),'maxRigidResidualM':float(error.max()),
        'rmsRigidResidualM':float(np.sqrt(np.mean(error*error))),
        'maxLengthWidthRatioChange':float(np.max(abs(after_spans/before_spans-1))),
        'beforePrincipalSpansM':before_spans.tolist(),'afterPrincipalSpansM':after_spans.tolist(),
        'centreTranslationM':float(np.linalg.norm(after.mean(0)-before.mean(0)))}

def region_stats(before,after,mask,axis,scale):
    distance=np.linalg.norm(after[mask]-before[mask],axis=1)*scale
    old=before[mask]@axis;new=after[mask]@axis
    old_span=np.quantile(old,.95)-np.quantile(old,.05);new_span=np.quantile(new,.95)-np.quantile(new,.05)
    return {'vertices':int(mask.sum()),'movedOver1mm':int((distance>.001).sum()),'movedOver2_5mm':int((distance>.0025).sum()),
        'movedOver5mm':int((distance>.005).sum()),'maxDeltaM':float(distance.max(initial=0)),
        'meanDeltaM':float(distance.mean()),'spanBeforeM':float(old_span*scale),'spanAfterM':float(new_span*scale),
        'spanRatio':float(new_span/old_span)}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--baseline-dir',type=Path,required=True)
    parser.add_argument('--only',default=','.join(PROFILES));parser.add_argument('--report',type=Path);parser.add_argument('--baseline-check',action='store_true');args=parser.parse_args()
    keys=args.only.split(',');assert set(keys)<=set(PROFILES) and len(set(keys))==len(keys)
    proof=json.loads((args.baseline_dir/'baseline-proof.json').read_text());old=json.loads((args.baseline_dir/'manifest.json').read_text());current=json.loads((OUT/'manifest.json').read_text())
    assert sha(args.baseline_dir/'manifest.json')==BASELINE_MANIFEST_SHA, 'Expected frozen pre-sculpt manifest from022bf4d'
    assert set(old['breeds'])==set(current['breeds'])==set(PROFILES), 'Native roster membership changed'
    for file,digest in proof['copied'].items():assert sha(args.baseline_dir/file)==digest,('Baseline snapshot changed',file)
    for file,digest in proof['protectedFiles'].items():assert sha(ROOT/file)==digest,('Source rig/clip/UV/weights or coat texture changed',file)
    assert old['sourceSha256']==current['sourceSha256']==SOURCE_SHA and old['jointCount']==current['jointCount']==677
    for key,digest in proof['allVariantHashes'].items():
        assert digest==old['breeds'][key]['sha256'],('Snapshot proof differs from frozen manifest',key)
        assert sha(args.baseline_dir/(key+'.bin'))==digest,('Frozen baseline bin changed',key)
    meshes,ops=load_source(old);source=meshes[0]['source'];translation=old['sourceTranslation']
    # Guard observability: no-op and uniform scaling cannot satisfy the sculpt
    # gate. A reflected triangle must be recognized as an orientation failure.
    identity=similarity_residual(source,source);scaled=similarity_residual(source,source*1.1+[.1,.2,-.3])
    assert identity['rmsResidualM']<1e-12 and scaled['rmsResidualM']<1e-12
    triangle=np.array([[0.,0.,0.],[1.,0.,0.],[0.,1.,0.]])
    reflection=surface_metrics(triangle,triangle[[0,2,1]],np.array([[0,1,2]]),triangle)
    assert reflection['inverted']==1
    seam=np.vstack([triangle,triangle[0]])
    torn=seam.copy();torn[3,2]=.001
    seam_tri=np.array([[0,1,2],[3,1,2]])
    assert surface_metrics(seam,torn,seam_tri,seam)['maxWeldDeltaM']>.0009
    # Two intentionally separated leather layers are not a welded seam.
    separated=seam.copy();separated[3,2]=.02
    transported=separated.copy();transported[3,2]+=.001
    assert surface_metrics(separated,transported,seam_tri,seam)['maxWeldDeltaM']==0
    ear=np.array([[0.,0.,0.],[.02,0.,0.],[-.02,0.,0.],[0.,.10,0.],[.012,.08,.004],[-.012,.08,-.004]])
    assert rigid_shape_metrics(ear,ear+[.02,.03,-.01])['maxRigidResidualM']<1e-12
    curled=ear.copy();curled[-1,2]+=.01
    assert rigid_shape_metrics(ear,curled)['maxRigidResidualM']>.0005
    if args.baseline_check:
        print(json.dumps({'pass':True,'baseline':str(args.baseline_dir),'sourceVertices':len(source),'protectedFiles':len(proof['protectedFiles']),'uniformScaleFoldWeldAndEarNegativeControls':True}));return
    rows=[];failures=[]
    def require(value,message):
        if not value:failures.append(message)
    for key in keys:
        before_row=old['breeds'][key];row=current['breeds'][key];data=(ROOT/'assets'/row['file']).read_bytes();before_data=(args.baseline_dir/(key+'.bin')).read_bytes()
        require(hashlib.sha256(data).hexdigest()==row['sha256'],key+': current manifest checksum')
        require(row['actorScale']==before_row['actorScale'] and row['withersM']==before_row['withersM'],key+': uniform actor scaling changed')
        require(row['sourceSeat']==before_row['sourceSeat'],key+': seat anchor changed')
        require(row['coat']==before_row['coat'],key+': coat metadata/texture changed during geometry work')
        old_desc=appearance_descriptors(before_row);new_desc=appearance_descriptors(row)
        require(old_desc.keys()==new_desc.keys(),key+': additive rig/UV/topology descriptor set changed')
        for path,d in old_desc.items():
            n=new_desc.get(path)
            if not n:continue
            dtype='<u2' if d['componentType']=='uint16' else '<f4'
            require(n['count']==d['count'] and n['componentType']==d['componentType'] and np.array_equal(descriptor(data,n,dtype),descriptor(before_data,d,dtype)),key+': protected additive '+path+' changed')
        decoded=[decode(data,row,m,i,ops,translation) for i,m in enumerate(meshes)]
        baseline=[decode(before_data,before_row,m,i,ops,translation) for i,m in enumerate(meshes)]
        a,b=baseline[0]['world'],decoded[0]['world'];delta=np.linalg.norm(b-a,axis=1);scale=row['actorScale']
        # All variants share the original source frame, including profiles that
        # did not receive the earlier family-specific head refinement.
        head=before_row.get('headShape') or old['breeds']['percheron']['headShape'];axes=np.array([head['sourceAxes'][name] for name in ['lateral','longitudinal','dorsal']]);local=(source-head['sourceOriginM'])@axes.T;t=local[:,1]
        hm=(source[:,1]>1.45)&(source[:,2]>.90)
        masks={'head':hm,'forehead':hm&(t>.02)&(t<.15),'midface':hm&(t>.15)&(t<.30),'muzzle':hm&(t>.38),
            'neck':(source[:,1]>1.5)&(source[:,1]<2.)&(source[:,2]>.4)&(source[:,2]<.85),
            'barrel':(source[:,1]>1.15)&(source[:,1]<1.7)&(source[:,2]>-.55)&(source[:,2]<.15)}
        regions={name:region_stats(a,b,mask,axes[1] if name in {'head','muzzle'} else axes[0],scale) for name,mask in masks.items()}
        require(regions['head']['movedOver5mm']>=100 and regions['head']['maxDeltaM']>=.015,key+': head sculpt is not visibly substantial')
        require(max(regions['neck']['movedOver2_5mm'],regions['barrel']['movedOver2_5mm'])>=100,key+': no substantial neck/body sculpt')
        proportion=max(abs(regions[name]['spanRatio']-1) for name in ['head','forehead','midface','muzzle'])
        require(proportion>=.035,key+': head proportion change below3.5%')
        fit=similarity_residual(a,b);require(fit['rmsResidualM']*scale>.003 and fit['rmsResidualM']>fit['rmsDisplacementM']*.35,key+': only uniform scale/rigid placement, not regional model art')
        protected={}
        for name,mask in [('hooves',source[:,1]<=.18),('lowerLegs',source[:,1]<=.65)]:
            maximum=float(delta[mask].max(initial=0));protected[name]=maximum;require(maximum<TOL,key+': protected '+name+' drift '+str(maximum))
        for name,(lo,hi) in {'leftIron':(2792,2845),'rightIron':(2716,2769)}.items():
            maximum=float(np.linalg.norm(decoded[3]['world'][lo:hi+1]-baseline[3]['world'][lo:hi+1],axis=1).max());protected[name]=maximum;require(maximum<TOL,key+': protected '+name+' changed')
        ears=[]
        for side in ['l','r']:
            ids=[i for i,name in enumerate(meshes[0]['jointNames']) if name.startswith(('ear_01_'+side+'_','ear_02_'+side+'_'))]
            influence=(np.isin(meshes[0]['j'],ids)*meshes[0]['w']).sum(axis=1)
            mask=influence>.01
            require(mask.sum()>=364,key+': original ear surface missing')
            metric=rigid_shape_metrics(a[mask],b[mask]);metric['side']=side
            require(metric['maxRigidResidualM']<=.0005,key+': ear shape bent/curling on '+side)
            require(metric['maxLengthWidthRatioChange']<=.005,key+': ear length/width changed on '+side)
            ears.append(metric)
        surfaces=[]
        for i in [0,1,3,4]:
            aa,bb=baseline[i],decoded[i];require(np.isfinite(bb['world']).all() and np.isfinite(bb['normal']).all(),key+': nonfinite decoded surface')
            metric=surface_metrics(aa['world'],bb['world'],meshes[i]['tri'],meshes[i]['source']);metric['meshIndex']=i
            require(metric['inverted']==0,key+': rest triangle inversion on mesh'+str(i))
            require(metric['minStretch']>=.30 and metric['maxStretch']<=3.,key+': severe local rest compression/stretch on mesh'+str(i))
            require(metric['maxWeldDeltaM']<TOL*2,key+': welded surface tears on mesh'+str(i))
            if i==0:require(metric['maxEdgeGradient']<1.5,key+': abrupt body displacement gradient')
            normal_angle=np.degrees(np.arccos(np.clip((aa['normal']*bb['normal']).sum(axis=1),-1,1)))
            metric['normalChange95Deg']=float(np.quantile(normal_angle,.95));metric['normalChangeMaxDeg']=float(normal_angle.max())
            require(metric['normalChangeMaxDeg']<75,key+': excessive shading-normal rotation on mesh'+str(i));surfaces.append(metric)
        rows.append({'id':key,'newSHA256':row['sha256'],'regions':regions,'similarityFit':fit,'protectedMaxDeltaM':protected,'ears':ears,'surfaces':surfaces})
    result={'pass':not failures,'baseline':str(args.baseline_dir),'sourceRigHash':SOURCE_SHA,'protectedTextureAndSourceFiles':len(proof['protectedFiles']),'profilesChecked':len(keys),'profilesNotExamined':[key for key in PROFILES if key not in keys],'rows':rows,'failures':failures,
        'limits':'Standing decoded-surface gate. Animated folds and eye/bridle/collar contact require the independent motion/fit suite and visual review.'}
    if args.report:args.report.write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
    print(json.dumps({'pass':result['pass'],'profiles':keys,'failures':failures,'report':str(args.report) if args.report else None},indent=2))
    if failures:raise SystemExit(1)

if __name__=='__main__':main()

"""Private major-joint rotation-delta retarget, preserving WildMesh 677-joint skin."""
from pathlib import Path
import copy, importlib.util, json, hashlib, re
import numpy as np
from scipy.spatial.transform import Rotation as R, Slerp
from scipy.optimize import least_squares

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/mesh2motion-retarget'
OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('glb',ROOT/'tools/asset-gen/rig_hero_horse.py')
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
SRC=ROOT/'assets/models/horse-motion-sources/mesh2motion/horse-animations.glb'
DST=ROOT/'assets/models/horse-imports/wildmesh-white-western/game/native-candidate/native-white-western-candidate.glb'
s,sb=g.read_glb(SRC);d,db=g.read_glb(DST)
sw,sp=g.node_worlds(s);dw,dp=g.node_worlds(d)
sn={n['name']:i for i,n in enumerate(s['nodes']) if 'name'in n}
dn={n['name']:i for i,n in enumerate(d['nodes']) if 'name'in n}
def rot(m):
    u,_,v=np.linalg.svd(m[:3,:3]);return R.from_matrix(u@v)
sr={i:rot(w) for i,w in sw.items()};dr={i:rot(w) for i,w in dw.items()}
st={i:np.array(n.get('translation',[0,0,0]),float) for i,n in enumerate(s['nodes'])}
sq={i:R.from_quat(n.get('rotation',[0,0,0,1])) for i,n in enumerate(s['nodes'])}
ss={i:np.array(n.get('scale',[1,1,1]),float) for i,n in enumerate(s['nodes'])}
dt={i:np.array(n.get('translation',[0,0,0]),float) for i,n in enumerate(d['nodes'])}
dq={i:R.from_quat(n.get('rotation',[0,0,0,1])) for i,n in enumerate(d['nodes'])}
ds={i:np.array(n.get('scale',[1,1,1]),float) for i,n in enumerate(d['nodes'])}

# Values identify anatomical segment orientation, not similarly named bones.
mapping={'pelvis_08':'hips','spine_01_09':'spine_1','spine_02_010':'spine_2','spine_03_011':'spine_3','spine_04_012':'spine_4','head_019':'head',
 'clavicle_l_0203':'front_scapula_l','upperarm_l_0204':'front_humerus_l','lowerarm_l_0205':'front_leg_upper_l','hand_l_0206':'front_leg_lower_l','fingers_01_l_0187':'front_leg_ankle_l','fingers_02_l_0208':'front_leg_foot_l',
 'clavicle_r_0269':'front_scapula_r','upperarm_r_0270':'front_humerus_r','lowerarm_r_0271':'front_leg_upper_r','hand_r_0272':'front_leg_lower_r','fingers_01_r_0273':'front_leg_ankle_r','fingers_02_r_0274':'front_leg_foot_r',
 'upperleg_l_0405':'back_leg_upper_l','lowerleg_l_0406':'back_leg_lower_l','foot_l_0407':'back_leg_ankle_l','toes_01_l_0408':'back_leg_foot_l','toes_02_l_0409':'back_leg_toe_l',
 'upperleg_r_0474':'back_leg_upper_r','lowerleg_r_0475':'back_leg_lower_r','foot_r_0476':'back_leg_ankle_r','toes_01_r_0477':'back_leg_foot_r','toes_02_r_0478':'back_leg_toe_r',
 'tail_01_0367':'tail_1','tail_02_0368':'tail_2','tail_03_0369':'tail_3','tail_04_0370':'tail_4','tail_05_0371':'tail_leaf'}
neck={'neckOff_01_013':('spine_4','spine_5',.3),'neck_01_014':('spine_5','spine_6',.12),'neck_02_015':('spine_5','spine_6',.48),'neck_03_016':('spine_5','spine_6',.8),'neck_04_017':('spine_6','head',.28),'neck_05_018':('spine_6','head',.67)}
mapped={dn[a]:sn[b] for a,b in mapping.items()}
neckmap={dn[a]:(sn[b],sn[c],t) for a,(b,c,t) in neck.items()}
translation_scale=float(dw[dn['pelvis_08']][1,3]/sw[sn['hips']][1,3])
source_qa=json.loads((ROOT/'output/mesh2motion-source-qa/report.json').read_text())
body_node=next(i for i,n in enumerate(d['nodes']) if 'mesh'in n and d['accessors'][d['meshes'][n['mesh']]['primitives'][0]['attributes']['POSITION']]['count']==16159)
prim=d['meshes'][d['nodes'][body_node]['mesh']]['primitives'][0]
pos=g.accessor(d,db,prim['attributes']['POSITION']);skinidx=g.accessor(d,db,prim['attributes']['JOINTS_0']).astype(int);weight=g.accessor(d,db,prim['attributes']['WEIGHTS_0']);skin=d['skins'][d['nodes'][body_node]['skin']];ibm=g.accessor(d,db,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
pv=np.c_[pos,np.ones(len(pos))];jointnodes=np.array(skin['joints'])
restops=np.array([dw[i] for i in skin['joints']])@ibm
restskin=np.sum(np.einsum('ncij,nj->nci',restops[skinidx],pv)*weight[:,:,None],axis=1)[:,:3]
floor=float(restskin[:,1].min())
feet={
 'FL':{'marker':'fingers_02_l_0208','chain':['upperarm_l_0204','lowerarm_l_0205','hand_l_0206'],'terminal':'fingers_01_l_0187'},
 'FR':{'marker':'fingers_02_r_0274','chain':['upperarm_r_0270','lowerarm_r_0271','hand_r_0272'],'terminal':'fingers_01_r_0273'},
 'HL':{'marker':'toes_02_l_0409','chain':['upperleg_l_0405','lowerleg_l_0406','foot_l_0407'],'terminal':'toes_01_l_0408'},
 'HR':{'marker':'toes_02_r_0478','chain':['upperleg_r_0474','lowerleg_r_0475','foot_r_0476'],'terminal':'toes_01_r_0477'}}
footkeys=list(feet);markers=np.array([dw[dn[feet[k]['marker']]][:3,3] for k in footkeys]);which=((restskin[:,None,[0,2]]-markers[None,:,[0,2]])**2).sum(axis=2).argmin(axis=1)
for k,info in feet.items():
 ids=np.where((restskin[:,1]<floor+.115)&(which==footkeys.index(k)))[0];info['vertices']=ids;info['restCentroid']=restskin[ids].mean(axis=0);info['chain']=[dn[n] for n in info['chain']];info['terminal']=dn[info['terminal']]

def source_sole(clipname,t,duration,key,loop_u=None):
    if loop_u is not None:
        a=source_qa['clips'][clipname]['last']['feet'][key];b=source_qa['clips'][clipname]['first']['feet'][key]
        return np.asarray(a['centroid'])*(1-loop_u)+np.asarray(b['centroid'])*loop_u,float(a['minY']*(1-loop_u)+b['minY']*loop_u)
    rows=source_qa['clips'][clipname]['rows'];p=t/duration*96;j=int(np.floor(p));u=p-j
    a=rows[min(j,95)]['feet'][key];b=(rows[j+1] if j<95 else source_qa['clips'][clipname]['last'])['feet'][key]
    cent=np.asarray(a['centroid'])*(1-u)+np.asarray(b['centroid'])*u;low=a['minY']*(1-u)+b['minY']*u
    return cent,float(low)

def fit_feet(localrot,localpos,clipname,t,duration,loop_u=None):
    cache={}
    def world(i):
        if i in cache:return cache[i]
        if 'matrix'in d['nodes'][i]:m=g.local_matrix(d['nodes'][i])
        else:
            m=np.eye(4);m[:3,:3]=localrot[i].as_matrix()*ds[i][None,:];m[:3,3]=localpos[i]
        cache[i]=(world(dp[i]) if i in dp else np.eye(4))@m;return cache[i]
    maxerr=0;maxangle=0
    for k,info in feet.items():
        chain=info['chain'];terminal=info['terminal'];ids=info['vertices'];influences=np.unique(skinidx[ids]);cache.clear();original_q={i:localrot[i] for i in chain};terminal_world=rot(world(terminal));base_parent={i:rot(world(dp[i])) for i in chain}
        sc,low=source_sole(clipname,t,duration,k,loop_u);rest_sc=np.asarray(source_qa['clips']['Rest_Pose']['rows'][0]['feet'][k]['centroid'])
        goalz=info['restCentroid'][2]+(sc[2]-rest_sc[2])*translation_scale;goaly=floor+max(0.,low)
        def trial(angles):
            cache.clear()
            for i,angle in zip(chain,angles):
                # Rotate about the horse's global lateral axis while retaining
                # the native bone's local axes and roll.
                parent=rot(world(dp[i]));localrot[i]=parent.inv()*R.from_rotvec([angle,0,0])*parent*original_q[i]
                cache.clear()
            localrot[terminal]=rot(world(dp[terminal])).inv()*terminal_world;cache.clear()
            ops=np.array([world(int(jointnodes[i]))@ibm[i] for i in influences]);lut={i:j for j,i in enumerate(influences)};chosen=np.vectorize(lut.get)(skinidx[ids]);points=np.sum(np.einsum('ncij,nj->nci',ops[chosen],pv[ids])*weight[ids,:,None],axis=1)[:,:3]
            return points
        def residual(angles):
            pts=trial(angles);return np.r_[(pts[:,1].min()-goaly)*60,(pts[:,2].mean()-goalz)*60,angles*.25]
        solved=least_squares(residual,np.zeros(3),bounds=(-.8,.8),max_nfev=35,xtol=2e-5,ftol=2e-5,gtol=2e-5);pts=trial(solved.x);maxerr=max(maxerr,abs(float(pts[:,1].min()-goaly)),abs(float(pts[:,2].mean()-goalz)));maxangle=max(maxangle,float(abs(solved.x).max()))
    return maxerr,maxangle

def channels(clip):
    rows=[]
    for c in clip['channels']:
        z=clip['samplers'][c['sampler']];times=g.accessor(s,sb,z['input']).ravel().astype(float);vals=g.accessor(s,sb,z['output']).astype(float)
        rows.append((c['target']['node'],c['target']['path'],times,vals,z.get('interpolation','LINEAR')))
    return rows
def sample(ch,t):
    ts=copy.copy(st);qs=copy.copy(sq);sc=copy.copy(ss)
    for i,path,times,vals,kind in ch:
        j=int(np.searchsorted(times,t,side='right')-1);j=max(0,min(j,len(times)-1));k=min(j+1,len(times)-1)
        u=0 if times[k]==times[j] or kind=='STEP' else float(np.clip((t-times[j])/(times[k]-times[j]),0,1))
        if path=='rotation':qs[i]=Slerp([0,1],R.from_quat(vals[[j,k]]))([u])[0] if j!=k else R.from_quat(vals[j])
        elif path=='translation':ts[i]=vals[j]*(1-u)+vals[k]*u
        elif path=='scale':sc[i]=vals[j]*(1-u)+vals[k]*u
    mats={};rots={}
    def world(i):
        if i in mats:return mats[i]
        m=np.eye(4);m[:3,:3]=qs[i].as_matrix()*sc[i][None,:];m[:3,3]=ts[i]
        mats[i]=(world(sp[i]) if i in sp else np.eye(4))@m;rots[i]=rot(mats[i]);return mats[i]
    for i in range(len(s['nodes'])):world(i)
    return mats,rots

def append(values,kind):
    a=np.asarray(values,dtype='<f4');db.extend(b'\0'*((-len(db))%4));offset=len(db);db.extend(a.tobytes());view=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':a.nbytes});index=len(d['accessors']);acc={'bufferView':view,'componentType':5126,'count':len(a),'type':kind}
    if kind=='SCALAR':acc['min']=[float(a.min())];acc['max']=[float(a.max())]
    d['accessors'].append(acc);return index

original_binary_len=len(db)
hair=[]
for i,n in enumerate(d['nodes']):
    name=n.get('name','')
    if re.match(r'^dyn_(?:new_(?:head_)?neck|head_end|(?:bounce_)?tail)',name):hair.append(i)
report={'source':str(SRC.relative_to(ROOT)),'target':str(DST.relative_to(ROOT)),'translationScale':translation_scale,'mapping':mapping,'neckInterpolation':neck,'preservedTargetSections':['nodes','meshes','skins','materials','textures','images'],'gaits':{},'hairDetailJoints':len(hair),'contactFit':'Sagittal three-joint fit to source sole trajectories; source ground penetration clamped to standing floor; terminal hoof orientation retained.','targetFloorY':floor}
for name in ['Walk','Trot','Run']:
    clip=next(a for a in s['animations'] if a['name']==name);ch=channels(clip);duration=max(float(row[2][-1]) for row in ch);times=np.linspace(0,duration,97)
    keyed=sorted(set(mapped)|set(neckmap)|set(hair));qvalues={i:[] for i in keyed};tvalues=[];body_heights=[];fit_errors=[];fit_angles=[]
    for t in times:
        # Remove source's initial one-frame hold and use that frame at the end
        # as an interpolated wrap bridge, preserving nominal cycle duration.
        source_start=1/30;source_time=min(float(t)+source_start,duration);loop_u=None
        if t>duration-source_start:
            u=(t-(duration-source_start))/source_start;loop_u=u;sm0,r0=sample(ch,duration);sm1,r1=sample(ch,source_start);sm={i:sm0[i].copy() for i in sm0};srot={i:Slerp([0,1],R.from_quat([r0[i].as_quat(),r1[i].as_quat()]))([u])[0] for i in r0}
            for i in sm:sm[i][:3,3]=sm0[i][:3,3]*(1-u)+sm1[i][:3,3]*u
        else:sm,srot=sample(ch,source_time)
        delta={i:srot[i]*sr[i].inv() for i in srot};worldrot={};localrot={};localpos=copy.copy(dt)
        # Transfer vertical/lateral pelvis excursion about the source standing
        # reference. Forward root travel is omitted for an in-place review.
        shift=(sm[sn['hips']][:3,3]-sw[sn['hips']][:3,3])*translation_scale;shift[2]=0
        pi=dn['pelvis_08'];parent=dp[pi];localpos[pi]=dt[pi]+np.linalg.inv(dw[parent][:3,:3])@shift
        def pose(i):
            if i in worldrot:return worldrot[i]
            pr=pose(dp[i]) if i in dp else R.identity()
            if i in mapped:desired=delta[mapped[i]]*dr[i];q=pr.inv()*desired
            elif i in neckmap:
                a,b,u=neckmap[i];de=Slerp([0,1],R.from_quat([delta[a].as_quat(),delta[b].as_quat()]))([u])[0];q=pr.inv()*(de*dr[i])
            else:q=dq[i]
            if i in hair:
                serial=int(re.search(r'_(\d+)$',d['nodes'][i]['name']).group(1));phase=2*np.pi*t/duration;tail='tail'in d['nodes'][i]['name'];gain={'Walk':.75,'Trot':1.,'Run':1.3}[name];amp=(.026 if tail else .018)*gain
                q=q*R.from_euler('xyz',[amp*np.sin((1 if tail else 2)*phase-serial*.17),0,amp*.55*np.sin(phase+serial*.22)])
            localrot[i]=q;worldrot[i]=pr*q;return worldrot[i]
        for i in range(len(d['nodes'])):pose(i)
        # Last wrap frame repeats the first fitted frame exactly, so the baked
        # target chain does not jump at its boundary.
        if t==times[-1]:
            for i in keyed:localrot[i]=R.from_quat(qvalues[i][0])
            localpos[pi]=np.asarray(tvalues[0]);err,angle=0,0
        else:err,angle=fit_feet(localrot,localpos,name,source_time,duration,loop_u)
        fit_errors.append(err);fit_angles.append(angle)
        for i in keyed:qvalues[i].append(localrot[i].as_quat())
        tvalues.append(localpos[pi]);body_heights.append(float(shift[1]))
    inputacc=append(times.reshape(-1,1),'SCALAR');new={'name':'M2M '+name,'samplers':[],'channels':[]}
    for i in keyed:
        q=np.asarray(qvalues[i]);
        for j in range(1,len(q)):
            if np.dot(q[j-1],q[j])<0:q[j]*=-1
        sampler=len(new['samplers']);new['samplers'].append({'input':inputacc,'output':append(q,'VEC4'),'interpolation':'LINEAR'});new['channels'].append({'sampler':sampler,'target':{'node':i,'path':'rotation'}})
    sampler=len(new['samplers']);new['samplers'].append({'input':inputacc,'output':append(tvalues,'VEC3'),'interpolation':'LINEAR'});new['channels'].append({'sampler':sampler,'target':{'node':pi,'path':'translation'}});d['animations'].append(new)
    report['gaits'][name]={'duration':duration,'frames':len(times),'targetTracks':len(new['channels']),'pelvisVerticalDeltaM':[min(body_heights),max(body_heights)],'contactFitMaxErrorM':max(fit_errors),'maxFitAngleDegrees':float(np.rad2deg(max(fit_angles))),'loop':'First source key shifted to t=0; last one-frame interval bridges to first target pose.'}
d['asset'].setdefault('extras',{})['privateRetargetProof']='Mesh2Motion CC0 Walk/Trot/Run world-orientation deltas on original WildMesh rig; original meshes, skin weights, binds, materials and tack preserved. No gameplay release.'
candidate=OUT/'white-mesh2motion-retarget.glb';g.write_glb(candidate,d,db)
report['candidateBytes']=candidate.stat().st_size;report['candidateSha256']=hashlib.sha256(candidate.read_bytes()).hexdigest();report['originalBinaryBytesPreserved']=original_binary_len
(OUT/'build-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report['gaits'],indent=2))

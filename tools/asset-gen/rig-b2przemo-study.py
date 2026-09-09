"""Fresh B2 anatomy rig and baked walk study; never overwrites the source study.

Blender: X left/right, -Y forward, Z up. Export: +Z forward, +Y up.
Run Blender --background --disable-autoexec --python this-file.py.
"""
import bpy, math, json, pathlib, hashlib
import numpy as np
from mathutils import Vector

ROOT=pathlib.Path(__file__).resolve().parents[2]
SOURCE=ROOT/'assets/models/horse-candidates/b2przemo/horse-finished-study.blend'
OUT=ROOT/'assets/models/horse-candidates/b2przemo/rig-study'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
names=['Artist body — preserved quad topology','Groom — individual geometry strands','Seated left eye','Seated right eye','Horizontal pupil -1','Horizontal pupil 1']
objects=[bpy.data.objects[n] for n in names]
body,hair=objects[:2]
for o in list(bpy.context.scene.objects):
    if o not in objects:bpy.data.objects.remove(o,do_unlink=True)
for o in objects:
    o.animation_data_clear()
    matrix=o.matrix_world.copy()
    for v in o.data.vertices:v.co=matrix@v.co
    o.matrix_world.identity()
P=np.array([v.co[:] for v in body.data.vertices])

def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)

def cross_center(height,front,side):
    mask=(abs(P[:,2]-height)<.026)&(P[:,0]*side>.075)
    mask&=(P[:,1]<-.1) if front else (P[:,1]>.65)
    p=P[mask]
    assert len(p)>20,(height,front,side,len(p))
    return np.array([float(np.median(p[:,0])),float(np.median(p[:,1])),height])

bones={}
def bone(name,a,b,parent=None,deform=True):
    bones[name]={'head':np.array(a,dtype=float),'tail':np.array(b,dtype=float),'parent':parent,'deform':deform}

bone('ROOT',(0,0,0),(0,0,.28),deform=False)
bone('pelvis',(0,.84,1.38),(0,.34,1.34),'ROOT')
bone('spine',(0,.34,1.34),(0,-.10,1.34),'pelvis')
bone('chest',(0,-.10,1.34),(0,-.36,1.42),'spine')
bone('neck.lower',(0,-.36,1.42),(0,-.69,1.70),'chest')
bone('neck.upper',(0,-.69,1.70),(0,-.96,1.97),'neck.lower')
bone('head',(0,-.96,1.97),(0,-1.24,1.71),'neck.upper')
bone('jaw',(0,-1.04,1.87),(0,-1.26,1.70),'head')
for side,label in [(-1,'L'),(1,'R')]:
    bone('ear.'+label,(side*.077,-.955,2.055),(side*.122,-1.02,2.185),'head')
tail_points=[(0,1.13,1.44),(0,1.27,1.18),(0,1.40,.82),(0,1.38,.43),(0,1.29,.12)]
for i in range(4):bone('tail.'+str(i+1),tail_points[i],tail_points[i+1],'pelvis' if i==0 else 'tail.'+str(i))

legs=[]
for front in (True,False):
    for side,label in [(-1,'L'),(1,'R')]:
        name=('F' if front else 'H')+label
        fetlock=cross_center(.20,front,side)
        hoof=cross_center(.085,front,side)
        # Joint centers are fitted to the actual B2 cross sections, separately
        # for each limb. Proximal joints follow visible scapula/stifle anatomy.
        if front:
            carpus=cross_center(.50,True,side)
            elbow=cross_center(.83,True,side)
            elbow[1]+=.035
            shoulder=np.array((side*.165,-.375,1.185))
            scapula=np.array((side*.13,-.16,1.47))
            points=[scapula,shoulder,elbow,carpus,fetlock,hoof,hoof+np.array((0,-.095,-.018))]
            suffix=['scapula','upperarm','forearm','cannon','pastern','hoof']
        else:
            hock=cross_center(.59,False,side)
            stifle=np.array((side*.194,.825,1.015))
            hip=np.array((side*.19,.88,1.415))
            points=[hip,stifle,hock,fetlock,hoof,hoof+np.array((0,-.095,-.018))]
            suffix=['thigh','shin','cannon','pastern','hoof']
        chain=[]
        for i,s in enumerate(suffix):
            bn=name+'.'+s;bone(bn,points[i],points[i+1],('chest' if front else 'pelvis') if i==0 else chain[-1]);chain.append(bn)
        control=name+'.IK'
        bone(control,fetlock,fetlock+np.array((0,0,.12)),'ROOT',False)
        legs.append({'name':name,'front':front,'side':side,'chain':chain,'points':np.array(points),'target':control,'fetlock':fetlock,'hoof':hoof})

armdata=bpy.data.armatures.new('B2 authored anatomy — editable IK')
rig=bpy.data.objects.new('B2 Equine Rig',armdata);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,s in bones.items():
    b=armdata.edit_bones.new(name);b.head=s['head'];b.tail=s['tail'];b.use_deform=s['deform']
    if s['parent']:b.parent=armdata.edit_bones[s['parent']]
    b.use_connect=False
    # Align local Z with lateral X so leg flexion lies in a sagittal plane.
    b.align_roll(Vector((1,0,0)))
bpy.ops.object.mode_set(mode='POSE')
for pb in rig.pose.bones:pb.rotation_mode='QUATERNION'
for leg in legs:
    pb=rig.pose.bones[leg['name']+'.cannon'];ik=pb.constraints.new('IK');ik.name='Planted fetlock — three anatomical segments';ik.target=rig;ik.subtarget=leg['target'];ik.chain_count=3;ik.use_stretch=False;ik.iterations=160
    # Preserve the source chain's anatomical rest bend. A locked twist axis and
    # high lateral stiffness permit millimetre corrections without knee twist.
    chain=leg['chain'][1:4] if leg['front'] else leg['chain'][:3]
    for j,bn in enumerate(chain):
        p=rig.pose.bones[bn];p.lock_ik_x=False;p.ik_stiffness_x=.97;p.lock_ik_y=True;p.ik_stiffness_z=.2 if j==1 else .35
    # Pastern and hoof keep their rest orientation while the lower leg bends.
bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front=True;armdata.display_type='OCTAHEDRAL'

def capsule(points,a,b):
    d=b-a;t=np.clip((points-a)@d/max(1e-8,d@d),0,1)
    return np.linalg.norm(points-(a+t[:,None]*d),axis=1),t

deform=[name for name,s in bones.items() if s['deform']]
idx={name:i for i,name in enumerate(deform)}
def weights_for(points):
    n=len(points);w=np.zeros((n,len(deform)));x,y,z=points.T;forward=-y
    pelvis=smooth(.15,.72,y);chest=1-smooth(-.35,.12,y);middle=np.maximum(0,1-pelvis-chest)
    w[:,idx['pelvis']]=pelvis;w[:,idx['spine']]=middle;w[:,idx['chest']]=chest
    w/=np.maximum(w.sum(1)[:,None],1e-10)
    neck=smooth(.28,.62,forward)*smooth(1.22,1.48,z)
    upper=smooth(.56,.9,forward);head=smooth(.91,1.055,forward)*smooth(1.52,1.70,z)
    nw=np.zeros_like(w);nw[:,idx['neck.lower']]=1-upper;nw[:,idx['neck.upper']]=upper
    nw*=1-head[:,None];nw[:,idx['head']]+=head
    w=w*(1-neck[:,None])+nw*neck[:,None]
    for leg in legs:
        pts=leg['points'];chain=leg['chain'];dist=[];ts=[]
        for j in range(len(chain)):
            d,t=capsule(points,pts[j],pts[j+1]);dist.append(d);ts.append(t)
        distances=np.stack(dist,axis=1);nearest=distances.argmin(1)
        lengths=np.linalg.norm(np.diff(pts,axis=0),axis=1);stations=np.r_[0,np.cumsum(lengths)]
        along=stations[nearest]+np.stack(ts,axis=1)[np.arange(n),nearest]*lengths[nearest]
        lw=np.zeros_like(w);trans=[]
        for j in range(1,len(chain)):
            band=.06 if j<len(chain)-2 else .035
            trans.append(smooth(stations[j]-band,stations[j]+band,along))
        trans=np.minimum.accumulate(np.array(trans),axis=0)
        lw[:,idx[chain[0]]]=1-trans[0]
        for j in range(1,len(chain)-1):lw[:,idx[chain[j]]]=trans[j-1]-trans[j]
        lw[:,idx[chain[-1]]]=trans[-1]
        side=smooth(.02,.10,x*leg['side'])
        if leg['front']:
            # The visible upper shoulder belongs largely to the rib cage;
            # pulling it entirely with the humerus produces an axillary crease.
            region=(1-smooth(-.06,.15,y))*(1-smooth(.79,1.32,z))*side
        else:
            region=smooth(.58,.83,y)*(1-smooth(1.1,1.44,z))*side
        # A proximal capsule keeps a shoulder/haunch transition contained.
        d=np.min(distances[:,:-2],axis=1);radius=.23 if leg['front'] else .30
        region*=1-smooth(radius,radius+.17,d)*(smooth(.82,1.05,z))
        w=w*(1-region[:,None])+lw*region[:,None]
        rigid=(z<.115)&(x*leg['side']>.06)&((y<-.1) if leg['front'] else (y>.65))
        w[rigid]=0;w[rigid,idx[chain[-1]]]=1
    for side,label in [(-1,'L'),(1,'R')]:
        ew=smooth(2.02,2.095,z)*smooth(.035,.068,x*side)*(1-smooth(-.78,-.65,y))
        w*=1-ew[:,None];w[:,idx['ear.'+label]]+=ew
    tail=(1-smooth(.05,.09,abs(x)))*smooth(1.12,1.23,y)*smooth(.9,1.18,z)
    tw=np.zeros_like(w)
    for i in range(4):
        d,_=capsule(points,bones['tail.'+str(i+1)]['head'],bones['tail.'+str(i+1)]['tail']);tw[:,idx['tail.'+str(i+1)]]=np.exp(-d*d/.03)
    tw/=np.maximum(tw.sum(1)[:,None],1e-10);w=w*(1-tail[:,None])+tw*tail[:,None]
    return w/np.maximum(w.sum(1)[:,None],1e-10)

weights=weights_for(P)
# Smooth on the actual authored edge graph. Three adjacency passes span two to
# three subdivided vertex rings, not nearby unrelated opposing limbs.
edges=np.array([e.vertices[:] for e in body.data.edges],dtype=int);a,b=edges.T
degree=np.bincount(np.r_[a,b],minlength=len(P)).astype(float)
rigid=P[:,2]<.115
for _ in range(3):
    accum=np.zeros_like(weights);np.add.at(accum,a,weights[b]);np.add.at(accum,b,weights[a]);avg=accum/np.maximum(degree[:,None],1)
    weights[~rigid]=.62*weights[~rigid]+.38*avg[~rigid]

def bind(o,w):
    # Runtime skin cap: retain four strongest influences and renormalize.
    keep=np.argpartition(w,-4,axis=1)[:,-4:];limited=np.zeros_like(w)
    for col in range(4):limited[np.arange(len(w)),keep[:,col]]=w[np.arange(len(w)),keep[:,col]]
    limited/=np.maximum(limited.sum(1)[:,None],1e-10)
    for j,name in enumerate(deform):
        group=o.vertex_groups.new(name=name)
        for i in np.flatnonzero(limited[:,j]>1e-7):group.add([int(i)],float(limited[i,j]),'REPLACE')
    # glTF uses linear skinning; match it in Blender so review renders expose
    # the same joint-volume behaviour as the game runtime.
    mod=o.modifiers.new('B2 authored anatomy skin','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=False
    o.parent=rig
    return limited
weights=bind(body,weights)
HP=np.array([v.co[:] for v in hair.data.vertices]);hw=weights_for(HP)
# Hair strands are disconnected components. Assign mane/forelock from their
# highest root vertex so entire strands follow the neck/head without shearing.
adj=[[] for _ in range(len(HP))]
for e in hair.data.edges:a,b=e.vertices;adj[a].append(b);adj[b].append(a)
seen=np.zeros(len(HP),bool);components=0
for seed in range(len(HP)):
    if seen[seed]:continue
    todo=[seed];seen[seed]=True;component=[]
    while todo:
        i=todo.pop();component.append(i)
        for j in adj[i]:
            if not seen[j]:seen[j]=True;todo.append(j)
    components+=1;ids=np.array(component);top=ids[HP[ids,2].argmax()]
    if HP[top,1]<.6:hw[ids]=hw[top]
    else:
        for i in ids:
            d=np.array([capsule(HP[i:i+1],bones['tail.'+str(j+1)]['head'],bones['tail.'+str(j+1)]['tail'])[0][0] for j in range(4)])
            h=np.exp(-(d-d.min())**2/.024);h/=h.sum();hw[i]=0
            for j in range(4):hw[i,idx['tail.'+str(j+1)]]=h[j]
bind(hair,hw)
for o in objects[2:]:
    ew=np.zeros((len(o.data.vertices),len(deform)));ew[:,idx['head']]=1;bind(o,ew)

scene=bpy.context.scene;scene.render.fps=30
PERIOD=1.6;SPEED=.52;DUTY=.72;FRAMES=49
phase_offsets={'HL':0,'FL':.25,'HR':.5,'FR':.75}
targets=[]
sole_indices={}
for leg in legs:
    region=(P[:,0]*leg['side']>.06)&((P[:,1]<-.1) if leg['front'] else (P[:,1]>.65))
    low=P[region,2].min();sole_indices[leg['name']]=np.flatnonzero(region&(P[:,2]<low+.008))
    leg['sole_height']=float(low)
def pose_controls(frame,walk=False,root_motion=False,rest=False):
    t=(frame-1)/30;phase=(t/PERIOD)%1
    for pb in rig.pose.bones:pb.location=(0,0,0);pb.rotation_quaternion=(1,0,0,0);pb.scale=(1,1,1)
    for leg in legs:rig.pose.bones[leg['name']+'.cannon'].constraints[0].influence=0 if rest else 1
    if rest:
        bpy.context.view_layer.update();return t
    root_bone=rig.pose.bones['ROOT']
    root_bone.location=root_bone.bone.matrix_local.to_quaternion().inverted()@Vector((0,-SPEED*t if root_motion else 0,0))
    # Small shoulder and pelvic vertical movement; forelimbs retain slight bend.
    pelvis=rig.pose.bones['pelvis'];pelvis.location=pelvis.bone.matrix_local.to_quaternion().inverted()@Vector((0,0,(-.064+.006*math.cos(phase*math.tau*2)) if walk else .002*math.sin(t*math.tau/3.2)))
    for leg in legs:
        ph=(phase-phase_offsets[leg['name']])%1
        stance=ph<DUTY if walk else True
        y=0;lift=-leg['sole_height']
        if walk:
            span=SPEED*PERIOD*DUTY
            if stance:y=-span*.5+SPEED*PERIOD*ph
            else:
                u=(ph-DUTY)/(1-DUTY);e=u*u*u*(10+u*(-15+6*u));tangent=u*(1+16*u)*(1-u)**16-(1-u)*(1+16*(1-u))*u**16
                y=span*.5-span*e+SPEED*PERIOD*(1-DUTY)*tangent;lift+=(.095 if leg['front'] else .075)*math.sin(math.pi*u)**2
            if leg['front']:y-=.08
        pb=rig.pose.bones[leg['target']]
        pb.location=pb.bone.matrix_local.to_quaternion().inverted()@Vector((0,y,lift))
        # Counter-rotate the short pastern/hoof as a unit after IK evaluation.
    bpy.context.view_layer.update()
    for leg in legs:
        for suffix in ('pastern','hoof'):
            pb=rig.pose.bones[leg['name']+'.'+suffix]
            matrix=pb.matrix.copy()
            head=matrix.translation.copy();rest=pb.bone.matrix_local.copy();rest.translation=head;pb.matrix=rest
            bpy.context.view_layer.update()
    # Low amplitude head settling and ears keep idle alive without distortions.
    from mathutils import Quaternion
    for bn,amount in [('neck.lower',.007),('neck.upper',-.007),('head',.004)]:
        pb=rig.pose.bones[bn];pb.rotation_quaternion=Quaternion((0,0,1),amount*math.sin((phase*math.tau if walk else t*math.tau/3.2)+.35))
    for bn,amount in [('ear.L',.035),('ear.R',-.027),('tail.1',.014),('tail.2',.020),('tail.3',.024),('tail.4',.028)]:
        pb=rig.pose.bones[bn];pb.rotation_quaternion=Quaternion((0,1,0),amount*math.sin(phase*math.tau if walk else t*math.tau/3.2))
    bpy.context.view_layer.update()
    return t

actions=[];metrics=[]
for name,walk,moving,count in [('Rest',False,False,2),('Idle',False,False,97),('Walk_InPlace',True,False,FRAMES),('Walk_Forward',True,True,FRAMES)]:
    rig.animation_data_create();action=bpy.data.actions.new(name);rig.animation_data.action=action
    for frame in range(1,count+1):
        scene.frame_set(frame);t=pose_controls(frame,walk,moving,name=='Rest')
        for pb in rig.pose.bones:
            pb.keyframe_insert('location',frame=frame,group=pb.name);pb.keyframe_insert('rotation_quaternion',frame=frame,group=pb.name)
        for leg in legs:rig.pose.bones[leg['name']+'.cannon'].constraints[0].keyframe_insert('influence',frame=frame)
        if moving:
            evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());coords=np.empty((len(P),3),dtype=np.float32);evaluated.data.vertices.foreach_get('co',coords.ravel())
            for leg in legs:
                ph=((t/PERIOD)-phase_offsets[leg['name']])%1
                endpoint=rig.pose.bones[leg['name']+'.cannon'].tail
                target=rig.pose.bones[leg['target']].head
                sole=coords[sole_indices[leg['name']]];center=sole.mean(0)
                metrics.append({'frame':frame,'leg':leg['name'],'phase':ph,'contact':ph<DUTY,'ankle_error':(endpoint-target).length,'ankle':list(endpoint),'target':list(target),'sole_center':center.tolist(),'sole_min_height':float(sole[:,2].min())})
    action.use_fake_user=True;actions.append(action)

rig.animation_data.action=actions[0];scene.frame_set(1);pose_controls(1,False,False,True)
report={'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'author':'b2przemo','license':'CC BY 3.0','orientation':'Blender -Y forward Z up; glTF +Z forward Y up','bones':{n:{'head':s['head'].tolist(),'tail':s['tail'].tolist(),'parent':s['parent'],'deform':s['deform']} for n,s in bones.items()},'body_vertices':len(P),'hair_components':components,'body_weight_sum_max_error':float(abs(weights.sum(1)-1).max()),'body_max_influences':int((weights>1e-7).sum(1).max()),'hoof_below_0_115_rigid':bool(np.all((weights[rigid]>1e-7).sum(1)==1)),'walk_period_seconds':PERIOD,'walk_speed_mps':SPEED,'clips':[a.name for a in actions],'max_ik_target_error':max(m['ankle_error'] for m in metrics),'metrics':metrics}
contact=[m for m in metrics if m['contact']]
drifts=[]
for leg in legs:
    samples=[m for m in metrics if m['leg']==leg['name']]
    for a,b in zip(samples,samples[1:]):
        if a['contact'] and b['contact'] and b['phase']>a['phase']:
            drifts.append(float(np.linalg.norm(np.array(a['sole_center'])[:2]-np.array(b['sole_center'])[:2])))
report['max_contact_sole_drift_per_frame']=max(drifts)
report['contact_sole_height_range']=[min(m['sole_min_height'] for m in contact),max(m['sole_min_height'] for m in contact)]

# Asset-only export. Blender evaluates IK constraints per frame; the GLB carries
# sampled deform-bone transforms and does not require Blender constraints.
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=rig
params={'filepath':str(OUT/'horse-rig-study.glb'),'export_format':'GLB','use_selection':True,'export_animations':True,'export_yup':True,'export_force_sampling':True,'export_animation_mode':'ACTIONS','export_bake_animation':True,'export_frame_range':False,'export_skins':True,'export_all_influences':False,'export_anim_slide_to_zero':True,'export_current_frame':True}
valid=bpy.ops.export_scene.gltf.get_rna_type().properties.keys();params={k:v for k,v in params.items() if k in valid}
bpy.ops.export_scene.gltf(**params)

# Reusable edit source retains the actual IK targets, constraints and actions.
scene.frame_start=1;scene.frame_end=FRAMES
scene.world=bpy.data.worlds.new('Neutral rig review');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.25,.28,.31,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1300;scene.render.resolution_y=950;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
def aim(o,p):o.rotation_euler=(p-o.location).to_track_quat('-Z','Y').to_euler()
for pos,power,size in [((3,-4,5),500,4),((-3,-2,3),400,4),((2,3,4),600,3)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;aim(o,Vector((0,0,1)))
bpy.ops.mesh.primitive_plane_add(size=30,location=(0,0,-.012));ground=bpy.context.object;ground.name='Review ground only';m=bpy.data.materials.new('Review matte ground');m.diffuse_color=(.13,.16,.19,1);ground.data.materials.append(m)
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=3.8;scene.camera=cam
rig.animation_data.action=actions[-1]
for frame in (1,10,19,28,37):
    scene.frame_set(frame);t=pose_controls(frame,True,True);target=Vector((0,-SPEED*t,1.12))
    for view,offset in [('side',(4,0,.05)),('front',(.15,-5,.18))]:
        cam.location=target+Vector(offset);aim(cam,target);scene.render.filepath=str(OUT/(view+'-'+str(frame).zfill(2)+'.png'));bpy.ops.render.render(write_still=True)
rig.animation_data.action=actions[0];scene.frame_set(1);pose_controls(1,False,False,True)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'horse-rig-study.blend'))
(OUT/'report.json').write_text(json.dumps(report,indent=2));print('RIG_STUDY_READY',json.dumps({k:v for k,v in report.items() if k not in ('bones','metrics')}),flush=True)

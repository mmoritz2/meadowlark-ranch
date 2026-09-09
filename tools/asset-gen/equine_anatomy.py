"""Shared anatomical surface authoring for the second horse master.

Runs inside Blender only. Shapes are original procedural sculpts in the
generator's Blender rest space (+X forward, +Z up), not downloaded assets.
"""
import bpy, bmesh, math
import numpy as np
from mathutils import Vector

P=np.array([.730,-.060,.655]);Q=np.array([.962,-.115,.424])
AXIS=Q-P
DIR=np.array([AXIS[0],0,AXIS[2]]);DIR/=np.linalg.norm(DIR)
UP=np.array([-DIR[2],0,DIR[0]])
TS=np.array([-.20,-.08,.06,.20,.38,.57,.75,.90,1.04,1.16])
DORSAL=np.array([.003,.047,.059,.057,.045,.036,.036,.046,.046,.002])
VENTRAL=np.array([.003,.092,.120,.133,.094,.063,.052,.067,.052,.002])
WIDTH=np.array([.003,.057,.089,.108,.087,.058,.061,.080,.069,.002])

def profile(t,ys):
    i=int(np.clip(np.searchsorted(TS,t)-1,0,len(TS)-2));d=TS[i+1]-TS[i];u=(t-TS[i])/d
    slopes=np.gradient(ys,TS)
    return max(.0005,(2*u**3-3*u*u+1)*ys[i]+(u**3-2*u*u+u)*d*slopes[i]+(-2*u**3+3*u*u)*ys[i+1]+(u**3-u*u)*d*slopes[i+1])

def section(t,a):
    c=math.cos(a);sn=math.sin(a);rad=profile(t,DORSAL if c>=0 else VENTRAL)
    # Soft planar cheek and nasal surfaces, with a fuller lower jaw. The
    # fractional powers are modest so transitions do not become box corners.
    lateral=math.copysign(abs(sn)**.82,sn)*profile(t,WIDTH)
    v=P+AXIS*t+UP*(c*rad);v[1]+=lateral
    return v

def head_loft():
    verts=[];faces=[];rows=58;around=56
    for j in range(rows+1):
        t=float(TS[0]+(TS[-1]-TS[0])*j/rows)
        for k in range(around):verts.append(section(t,k/around*math.tau))
    for j in range(rows):
        for k in range(around):
            a=j*around+k;b=j*around+(k+1)%around;faces.append((a,b,b+around,a+around))
    faces.extend([tuple(range(around-1,-1,-1)),tuple(rows*around+k for k in range(around))])
    mesh=bpy.data.meshes.new('Jaw, cheek and nasal master');mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new('Equine head master loft',mesh);bpy.context.collection.objects.link(obj)
    return obj

def poll_transition():
    """Closed upper-neck volume with a continuous taper into the poll."""
    a=np.array([.285,-.023,.375]);b=np.array([.707,-.057,.661]);axis=b-a
    d=axis.copy();d[1]=0;d/=np.linalg.norm(d);up=np.array([-d[2],0,d[0]])
    verts=[];faces=[];rows=40;around=48
    for j in range(rows+1):
        t=-.08+1.20*j/rows;tc=float(np.clip(t,0,1))
        dorsal=np.interp(tc,[0,.4,.76,1],[.154,.122,.078,.045])
        ventral=np.interp(tc,[0,.4,.76,1],[.187,.144,.086,.049])
        width=np.interp(tc,[0,.4,.76,1],[.131,.107,.079,.057])
        taper=1 if t<1 else max(.2,1-(t-1)*4)
        for k in range(around):
            ang=k/around*math.tau;c=math.cos(ang)
            p=a+axis*t+up*(c*(dorsal if c>=0 else ventral)*taper)
            p[1]+=math.sin(ang)*width*taper;verts.append(p)
    for j in range(rows):
        for k in range(around):
            i=j*around+k;n=j*around+(k+1)%around;faces.append((i,n,n+around,i+around))
    faces.extend([tuple(range(around-1,-1,-1)),tuple(rows*around+k for k in range(around))])
    mesh=bpy.data.meshes.new('Continuous crest and throatlatch');mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new('Continuous upper neck',mesh);bpy.context.collection.objects.link(obj);return obj

def ellipsoid(name,center,radii,segments=36,rings=22):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1)
    obj=bpy.context.object;obj.name=name
    for v in obj.data.vertices:v.co=Vector(center)+Vector([v.co[i]*radii[i] for i in range(3)])
    return obj

def join_into(target,objects):
    bpy.ops.object.select_all(action='DESELECT');target.hide_set(False);target.select_set(True)
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=target;bpy.ops.object.join()

def prepare_master(target):
    # Remove the old capsule head and the last blunt remnants of generated tail
    # hair; fresh closed volumes below intersect the retained neck/rump.
    bm=bmesh.new();bm.from_mesh(target.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00003)
    loose=[v for v in bm.verts if not v.link_faces]
    if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
    remove=[v for v in bm.verts if (v.co.x>.654 and v.co.z>.355) or (v.co.x>.37 and v.co.z>.49) or (v.co.x<-.780 and .190<v.co.z<.50)]
    bmesh.ops.delete(bm,geom=remove,context='VERTS')
    boundary=[e for e in bm.edges if e.is_boundary]
    if boundary:bmesh.ops.holes_fill(bm,edges=boundary,sides=0)
    bm.to_mesh(target.data);bm.free()
    forms=[head_loft(),poll_transition(),
      ellipsoid('Soft upper lip',(.976,-.115,.431),(.038,.074,.029)),
      ellipsoid('Lower lip and chin',(.951,-.113,.395),(.039,.061,.021)),
      ellipsoid('Continuous rump at tail dock',(-.733,.016,.256),(.159,.142,.141))]
    join_into(target,forms)

def densify_head(target):
    # Preserve a curved close-up silhouette after the body decimation. This
    # happens before recesses, so subdivision cannot soften the eyelid openings.
    bm=bmesh.new();bm.from_mesh(target.data)
    edges=[e for e in bm.edges if all(v.co.x>.51 and v.co.z>.315 for v in e.verts)]
    bmesh.ops.subdivide_edges(bm,edges=edges,cuts=1,use_grid_fill=True,smooth=.20)
    verts=[v for v in bm.verts if v.co.x>.51 and v.co.z>.315]
    for _ in range(2):bmesh.ops.smooth_vert(bm,verts=verts,factor=.13,use_axis_x=True,use_axis_y=True,use_axis_z=True)
    bm.to_mesh(target.data);bm.free()

def refine_muzzle(target):
    for v in target.data.vertices:
        x,y,z=v.co
        if x>.88 and z<.54:
            u=float(np.clip((x-.88)/.07,0,1));u=u*u*(3-2*u)
            v.co.z=.425+(z-.425)*(1+.28*u)

def blend_dock(target):
    """Relax the reconstructed rear patch into the gluteal surface."""
    bm=bmesh.new();bm.from_mesh(target.data);bm.verts.ensure_lookup_table()
    selected=[v for v in bm.verts if v.co.x<-.61 and v.co.z>.07]
    weights={v:max(0,min(1,(-v.co.x-.61)/.12))*max(0,min(1,(v.co.z-.07)/.10)) for v in selected}
    # A compact diffusion pass removes the hard oval border left by the old
    # cut-and-cap surface while retaining the surrounding haunch silhouette.
    for _ in range(70):
        updates={}
        for v in selected:
            neighbors=[e.other_vert(v) for e in v.link_edges]
            if neighbors:updates[v]=v.co.lerp(sum((n.co for n in neighbors),Vector())/len(neighbors),.48*weights[v])
        for v,p in updates.items():v.co=p
    bm.to_mesh(target.data);bm.free()

def boolean_cut(target,cutter):
    bpy.ops.object.select_all(action='DESELECT');target.select_set(True);bpy.context.view_layer.objects.active=target
    mod=target.modifiers.new('Sculpt anatomical recess','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)

def curve_tube(name,points,radius):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=6;curve.bevel_depth=radius;curve.bevel_resolution=3;curve.use_fill_caps=True
    spl=curve.splines.new('BEZIER');spl.bezier_points.add(len(points)-1)
    for b,p in zip(spl.bezier_points,points):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH')
    return bpy.context.object

def cut_features(target):
    eyes=[];nostrils=[];mouths=[]
    # A broad supraorbital shelf supports the upper eyelid in flesh. The jaw
    # has a softer masseter plane below it, not a separate eye-ring accessory.
    for v in target.data.vertices:
        x,y,z=v.co;side=-1 if y<-.06 else 1
        if .66<x<.85 and .56<z<.71:
            brow=.008*math.exp(-((x-.755)/.044)**2-((z-.667)/.014)**2)
            cheek=.004*math.exp(-((x-.728)/.048)**2-((z-.595)/.024)**2)
            v.co.y+=side*(brow+cheek)
    target.data.update()
    def surface(x,z,side):
        target.data.update();bpy.context.view_layer.update()
        hit,point,normal,index=target.ray_cast(Vector((x,side*2,z)),Vector((0,-side,0)))
        if not hit:raise RuntimeError('Anatomical surface ray missed '+str((x,z,side)))
        return np.array(point[:])
    for side in (-1,1):
        eye=surface(.762,.646,side)
        # A shaped opening cut into the skull leaves its own thick, integrated
        # upper/lower skin edges; no separate torus or metal-like eye ring.
        cut=ellipsoid('Eye socket cutter',eye+np.array([0,side*.009,0]),(.026,.017,.0115))
        boolean_cut(target,cut);eyes.append(eye.tolist())
        nostril=surface(.967,.449,side)
        cut=ellipsoid('Nostril opening cutter',nostril+np.array([0,side*.006,0]),(.020,.026,.018))
        cut.rotation_euler.y=-.25
        # Rotation around object origin would move baked vertices, so retain the
        # clean oval orientation instead of rotating an off-origin mesh.
        cut.rotation_euler=(0,0,0);boolean_cut(target,cut);nostrils.append(nostril.tolist())
        # A neutral, shallow lip crease avoids the self-intersecting miniature
        # Boolean tube that made the previous commissures jagged and smiling.
        points=[surface(x,z,side)+np.array([0,-side*.0007,0]) for x,z in [(.936,.403),(.953,.403),(.973,.403),(.991,.403)]]
        mouths.append([p.tolist() for p in points])
    bm=bmesh.new();bm.from_mesh(target.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.00001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(target.data);bm.free()
    for f in target.data.polygons:f.use_smooth=True
    return {'eyes':eyes,'nostrils':nostrils,'mouthLeft':mouths[0],'mouthRight':mouths[1],'poll':[[.718,-.054,.722]],'muzzle':[[.972,-.115,.422]],'tail':[[-.886,.014,.300],[-.908,.012,.191],[-.938,.001,-.070],[-.931,-.007,-.373],[-.923,-.015,-.676]]}

def warped_mesh(name,verts,faces,arm,p,warp,mat,body_uv,bone='bone_5'):
    points=warp(verts,p);mesh=bpy.data.meshes.new(name);mesh.from_pydata(points.tolist(),[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);mesh.materials.append(mat)
    uv=mesh.uv_layers.new()
    for loop in mesh.loops:uv.data[loop.index].uv=body_uv
    for f in mesh.polygons:f.use_smooth=True
    g=obj.vertex_groups.new(name=bone);g.add(list(range(len(verts))),1,'REPLACE');mod=obj.modifiers.new('Existing horse skin','ARMATURE');mod.object=arm;obj.parent=arm
    return obj

def eye_globe(center,arm,p,warp,mat,body_uv,side):
    # A closed shallow corneal lens is confined to the aperture. A whole sphere
    # intersects the skull's taper above the eye and produces a second patch.
    center=np.array(center)-np.array([0,side*.006,0])
    obj=ellipsoid('Recessed living eye',center,(.028,.009,.013),32,20)
    for v in obj.data.vertices:v.co=warp([v.co[:]],p)[0]
    obj.data.materials.append(mat)
    for f in obj.data.polygons:f.use_smooth=True
    group=obj.vertex_groups.new(name='bone_5');group.add(list(range(len(obj.data.vertices))),1,'REPLACE');mod=obj.modifiers.new('Existing horse skin','ARMATURE');mod.object=arm;obj.parent=arm
    return obj

def mouth_seam(points,arm,p,warp,mat):
    obj=curve_tube('Fine neutral mouth crease',points,.00125)
    for v in obj.data.vertices:v.co=warp([v.co[:]],p)[0]
    obj.data.materials.append(mat)
    for f in obj.data.polygons:f.use_smooth=True
    group=obj.vertex_groups.new(name='bone_6');group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    mod=obj.modifiers.new('Existing horse skin','ARMATURE');mod.object=arm;obj.parent=arm
    return obj

def refine_limbs(target,bones):
    """Shape existing surfaces into flatter cannons and sloped hoof walls."""
    pts=np.array([v.co[:] for v in target.data.vertices]);out=pts.copy()
    for chain in ([7,8,9,10,11,12],[13,14,15,16,17,18],[23,24,25,26,27],[28,29,30,31,32]):
        front=chain[0]<20;left=chain[0] in (7,23);x,y,z=pts.T
        mask=(x>-.2 if front else x<-.35)&(y>-.015 if left else y<-.015)&(z<-.26)
        seq=np.array([bones['bone_'+str(i)][0] for i in chain]);seq=seq[np.argsort(seq[:,2])]
        cx=np.interp(z,seq[:,2],seq[:,0]);cy=np.interp(z,seq[:,2],seq[:,1])
        # Flatten the lateral face of the cannon and quiet the spherical
        # fetlock. The posterior tendon remains a straight rear contour.
        cannon=np.exp(-((z+.535)/.102)**4)*mask
        fetlock=np.exp(-((z+.650)/.049)**2)*mask
        out[:,1]+=(y-cy)*(-.16*cannon-.10*fetlock)
        out[:,0]+=(x-cx)*(-.055*cannon-.10*fetlock)
        # Hoof capsule: sloping toe wall, wider bearing edge, a level sole.
        ids=np.where(mask&(z<-.726))[0]
        if not len(ids):continue
        sole=float(z[ids].min());coronet=-.735
        h=np.clip((coronet-z[ids])/(coronet-sole),0,1)
        blend=np.clip((-.712-z[ids])/.027,0,1);blend=blend*blend*(3-2*blend)
        hx=float(bones['bone_'+str(chain[-1])][0][0]);hy=float(bones['bone_'+str(chain[-1])][0][1])
        dx=x[ids]-hx;dy=y[ids]-hy
        out[ids,0]+=(dx*(.88+.12*h)-dx+.012*h)*blend
        out[ids,1]+=(dy*(.92+.10*h)-dy)*blend
        bottom=np.clip((sole+.026-z[ids])/.026,0,1)
        out[ids,2]-=(z[ids]-sole)*bottom**.6
    for v,p in zip(target.data.vertices,out):v.co=p

def clean_export(target):
    # Resolve tiny degeneracies after each breed's nonuniform deformation, so
    # GLB triangle tessellation cannot collapse them differently per breed.
    bm=bmesh.new();bm.from_mesh(target.data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='BEAUTY',ngon_method='BEAUTY')
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.00001)
    bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='BEAUTY',ngon_method='BEAUTY')
    # Exact opposite triangle pairs are zero-thickness Boolean slivers. Remove
    # both sides; retaining either leaves a spur with a nonmanifold root edge.
    pairs={}
    for f in bm.faces:
        key=tuple(sorted(tuple(round(c,6) for c in v.co) for v in f.verts))
        pairs.setdefault(key,[]).append(f)
    discard=[]
    for faces in pairs.values():
        if len(faces)==2:discard.extend(faces)
    if discard:bmesh.ops.delete(bm,geom=discard,context='FACES_ONLY')
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(target.data);bm.free()
    for f in target.data.polygons:f.use_smooth=True

def nostril_bowl(surface,side,arm,p,warp,mat,body_uv):
    verts=[];faces=[];rows=9;around=28
    # Open concave lining set inside the boolean-cut nostril wing, not a raised
    # oval stuck on the muzzle. The opening widens toward the skin surface.
    for j in range(rows+1):
        theta=.035+(math.pi/2-.035)*j/rows;r=math.sin(theta);depth=math.cos(theta)
        for k in range(around):
            a=k/around*math.tau
            verts.append([surface[0]+.018*r*math.cos(a),surface[1]-side*(.021*depth+.0025),surface[2]+.016*r*math.sin(a)])
    for j in range(rows):
        for k in range(around):
            a=j*around+k;b=j*around+(k+1)%around;faces.append((a,b,b+around,a+around))
    # Give the cavity a closed thin backing without covering its concave face.
    count=len(verts);original=list(faces)
    verts.extend([[x,y-side*.002,z] for x,y,z in verts[:count]])
    faces.extend([tuple(i+count for i in reversed(f)) for f in original])
    for ring in (0,rows*around):
        for k in range(around):
            a=ring+k;b=ring+(k+1)%around;faces.append((a,b,b+count,a+count))
    return warped_mesh('Inset nostril lining',verts,faces,arm,p,warp,mat,body_uv,'bone_6')

def ear(side,arm,p,warp,coat,inner,body_uv):
    # A thick pinna shell with a concave forward-facing inner bowl and rolled
    # edge. Inner and outer sheets are joined around the full outline.
    rows=18;across=14;verts=[];faces=[];mats=[];height=.116*p['ear']
    base=np.array([.730,-.051+side*.051,.690])
    for back in (False,True):
        for j in range(rows+1):
            t=j/rows;width=.028*(math.sin(math.pi*(.04+.96*t))**.72)
            if p.get('marwari'):bend=-side*.039*t*t
            else:bend=side*.007*t
            for k in range(across+1):
                u=-1+2*k/across;edge=abs(u)**2.5
                # Open cup faces +X: interior is recessed behind its side rims.
                thickness=.010*(1-t)**.65
                xx=.024*t-.012*math.sin(math.pi*t)
                xx+=(-thickness*.5 if back else thickness*.5-.012*(1-edge)*math.sin(math.pi*t))
                verts.append(base+np.array([xx,bend+u*width,height*t]))
    stride=across+1;sheet=(rows+1)*stride
    for back in (0,1):
        for j in range(rows):
            for k in range(across):
                a=back*sheet+j*stride+k;b=a+1;c=b+stride;d=a+stride
                faces.append((a,d,c,b) if back else (a,b,c,d));mats.append(0 if back else 1)
    border=list(range(stride))+[j*stride+across for j in range(1,rows+1)]+[rows*stride+k for k in range(across-1,-1,-1)]+[j*stride for j in range(rows-1,0,-1)]
    for a,b in zip(border,border[1:]+border[:1]):faces.append((a,a+sheet,b+sheet,b));mats.append(0)
    obj=warped_mesh('Cupped equine pinna',verts,faces,arm,p,warp,coat,body_uv);obj.data.materials.append(inner)
    for f,i in zip(obj.data.polygons,mats):f.material_index=i
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.000001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    return obj

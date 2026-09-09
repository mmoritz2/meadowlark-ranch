"""Small anatomical surface edits on the generated hero, preserving its atlas."""
import bpy,bmesh,math,numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

def blender(p):return Vector((p[0],-p[2],p[1]))
def gltf(p):return np.array((p[0],p[2],-p[1]))

def refine_face(horse):
    # Centres follow the painted feature locations, individually on each side.
    features=[('eye',(.786,.612,.216)),('eye',(.808,.642,.005)),
              ('nostril',(.958,.406,.242)),('nostril',(.974,.403,.145))]
    deps=bpy.context.evaluated_depsgraph_get();tree=BVHTree.FromObject(horse,deps)
    landmarks=[]
    for kind,point in features:
        hit,normal,_,_=tree.find_nearest(blender(point));c=gltf(hit);n=gltf(normal);n/=np.linalg.norm(n)
        h=np.array([1.,-.18,0]);h-=n*np.dot(h,n);h/=np.linalg.norm(h);v=np.cross(n,h)
        if v[1]<0:h=-h;v=-v
        landmarks.append((kind,c,n,h,v))
    bm=bmesh.new();bm.from_mesh(horse.data)
    edges=[e for e in bm.edges if all(any(np.linalg.norm(gltf(v.co)-c)<.065 for _,c,_,_,_ in landmarks) for v in e.verts)]
    bmesh.ops.subdivide_edges(bm,edges=edges,cuts=2,use_grid_fill=True)
    bm.to_mesh(horse.data);bm.free()
    coords=np.array([gltf(v.co) for v in horse.data.vertices]);out=coords.copy()
    for kind,c,n,h,v in landmarks:
        delta=coords-c;u=delta@h;up=delta@v;depth=delta@n
        rw,rh=(.023,.014) if kind=='eye' else (.018,.027)
        radius=np.sqrt((u/rw)**2+(up/rh)**2)
        nearby=np.exp(-(depth/.035)**4)
        if kind=='eye':
            recess=-.0045*np.exp(-(radius/.83)**4)
            rim=(.0020+.0008*(up>0))*np.exp(-((radius-1.05)/.20)**2)
        else:
            recess=-.016*np.exp(-(radius/.83)**4)
            rim=(.0008+.0025*(up>0))*np.exp(-((radius-1.07)/.25)**2)
        shift=(recess+rim)*nearby*(radius<1.8)
        out+=shift[:,None]*n
    for vert,p in zip(horse.data.vertices,out):vert.co=blender(p)
    eye_mat=bpy.data.materials.new('Hero cornea — dark brown');eye_mat.use_nodes=True
    bs=eye_mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.031,.014,.004,1);bs.inputs['Roughness'].default_value=.27;bs.inputs['Metallic'].default_value=0;bs.inputs['Specular IOR Level'].default_value=.20;bs.inputs['Coat Weight'].default_value=0
    pupil_mat=eye_mat.copy();pupil_mat.name='Hero dark horizontal pupil';pupil_mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.002,.001,.0005,1)
    eyes=[]
    for kind,c,n,h,v in landmarks:
        if kind!='eye':continue
        verts=[];faces=[];rings=18;segments=36
        for j in range(rings+1):
            phi=math.pi*j/rings
            for k in range(segments):
                theta=math.tau*k/segments
                p=c-n*.0025+h*(.021*math.sin(phi)*math.cos(theta))+v*(.0120*math.sin(phi)*math.sin(theta))+n*(.006*math.cos(phi))
                verts.append(blender(p))
        for j in range(rings):
            for k in range(segments):
                a=j*segments+k;b=j*segments+(k+1)%segments;faces.append((a,b,b+segments,a+segments))
        mesh=bpy.data.meshes.new('Seated corneal lens');mesh.from_pydata(verts,[],faces);mesh.materials.append(eye_mat);mesh.materials.append(pupil_mat)
        for f in mesh.polygons:
            q=sum((gltf(mesh.vertices[i].co) for i in f.vertices),np.zeros(3))/len(f.vertices)-c
            if (np.dot(q,h)/.010)**2+(np.dot(q,v)/.0035)**2<1:f.material_index=1
        obj=bpy.data.objects.new('Seated corneal lens',mesh);bpy.context.collection.objects.link(obj)
        bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
        for f in mesh.polygons:f.use_smooth=True
        eyes.append(obj)
    return eyes,{'eyes':[c.tolist() for kind,c,*_ in landmarks if kind=='eye'],'nostrils':[c.tolist() for kind,c,*_ in landmarks if kind=='nostril']}

def remove_tail(horse):
    bm=bmesh.new();bm.from_mesh(horse.data)
    leg_y=np.array([-.91,-.805,-.715,-.460,-.160,.255])
    near_x=[-.67,-.67478,-.73279,-.74607,-.66218,-.550];near_z=[.132,.13229,.1185,.07464,.11617,.09526]
    far_x=[-.53,-.53169,-.59641,-.65977,-.65024,-.550];far_z=[-.11,-.11049,-.09859,-.09222,-.10,-.082]
    radii=[.08,.09,.075,.10,.14,.205]
    selected=[]
    for vert in bm.verts:
        x,y,z=gltf(vert.co)
        if not(x<-.735 and y<.285 and -.10<z<.17):continue
        r=np.interp(y,leg_y,radii)
        protected=any((x-np.interp(y,leg_y,xs))**2+(z-np.interp(y,leg_y,zs))**2<r*r for xs,zs in [(near_x,near_z),(far_x,far_z)])
        if not protected:selected.append(vert)
    bmesh.ops.delete(bm,geom=selected,context='VERTS')
    unseen=set(bm.verts);groups=[]
    while unseen:
        stack=[unseen.pop()];group=[]
        while stack:
            v=stack.pop();group.append(v)
            for e in v.link_edges:
                q=e.other_vert(v)
                if q in unseen:unseen.remove(q);stack.append(q)
        groups.append(group)
    largest=max(groups,key=len)
    bmesh.ops.delete(bm,geom=[v for g in groups if g is not largest for v in g],context='VERTS')
    boundary=[e for e in bm.edges if e.is_boundary]
    result=bmesh.ops.holes_fill(bm,edges=boundary,sides=0)
    for f in result.get('faces',[]):f.smooth=True
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(horse.data);bm.free()

def remove_mane(horse,crest):
    """Seat the opaque crest plate onto the bare opposite scalp without cuts."""
    from mathutils.geometry import barycentric_transform
    bm=bmesh.new();bm.from_mesh(horse.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(horse.data);bm.free()
    reference=horse.data.copy();tree=BVHTree.FromPolygons([v.co for v in reference.vertices],[tuple(p.vertices) for p in reference.polygons],all_triangles=True)
    guide=np.array(sorted(crest,key=lambda p:p[0]));gx,gy,gz=guide.T
    selected=set()
    for vert in horse.data.vertices:
        p=gltf(vert.co);x,y,z=p;top=np.interp(x,gx,gy);mid=np.interp(x,gx,gz)
        if .06<x<.716 and y>top-.145 and y<.775 and abs(z-mid)<.16:
            q=p.copy();q[1]=(top-.006-.014*math.exp(-(y-(top-.02))/.014)) if y>top-.02 else y
            t=max(0.,min(.995,(q[1]-(top-.15))/.15));q[2]=mid+(1 if z>mid else -1)*.10*math.sqrt(max(.01,1-t*t))
            w=min(1.,max(0.,(y-(top-.145))/.025))*min(1.,(x-.06)/.025)*min(1.,(.716-x)/.02)
            vert.co=blender(p*(1-w)+q*w);selected.add(vert.index)
    bm=bmesh.new();bm.from_mesh(horse.data);bm.verts.ensure_lookup_table();smooth=[bm.verts[i] for i in selected]
    for _ in range(24):bmesh.ops.smooth_vert(bm,verts=smooth,factor=.42,use_axis_x=True,use_axis_y=True,use_axis_z=True)
    bm.to_mesh(horse.data);bm.free()
    uv=horse.data.uv_layers.active.data;src=reference.uv_layers.active.data
    for face in horse.data.polygons:
        if not any(i in selected for i in face.vertices):continue
        ps=[gltf(horse.data.vertices[i].co) for i in face.vertices];c=sum(ps)/len(ps);c[1]=np.interp(c[0],gx,gy)-.20;c[2]=np.interp(c[0],gx,gz)+(1 if c[2]>np.interp(c[0],gx,gz) else -1)*.105
        hit,_,index,_=tree.find_nearest(blender(c));poly=reference.polygons[index]
        ids=list(poly.vertices);lis=list(poly.loop_indices)
        for li,p in zip(face.loop_indices,ps):
            p=c+(p-sum(ps)/len(ps))
            mapped=barycentric_transform(blender(p),*[reference.vertices[i].co for i in ids],*[Vector((*src[i].uv,0)) for i in lis])
            uv[li].uv=(mapped.x,mapped.y)
    bpy.data.meshes.remove(reference)


def remove_opposite_mane(horse,crest):
    """Project the hanging far-side mane shell onto the finished near neck."""
    from mathutils.geometry import barycentric_transform
    guide=np.array(sorted(crest,key=lambda p:p[0]));gx,gy,gz=guide.T
    source=horse.data.copy();tree=BVHTree.FromPolygons([v.co for v in source.vertices],[tuple(p.vertices) for p in source.polygons],all_triangles=True)
    selected=set();targets={}
    for vert in horse.data.vertices:
        p=gltf(vert.co);x,y,z=p;top=np.interp(x,gx,gy);mid=np.interp(x,gx,gz)
        if .035<x<.751 and top-.355<y<top+.045 and z<mid-.006:
            hit,_,_,_=tree.ray_cast(blender((x,y,mid+.5)),blender((0,0,-1)))
            if hit is None:continue
            q=gltf(hit);q[2]=2*mid-q[2]
            w=min(1.,max(0.,(y-(top-.355))/.025))*min(1.,(x-.035)/.025)*min(1.,(.751-x)/.025)
            vert.co=blender(p*(1-w)+q*w);selected.add(vert.index)
    bm=bmesh.new();bm.from_mesh(horse.data);bm.verts.ensure_lookup_table();vs=[bm.verts[i] for i in selected]
    for _ in range(28):bmesh.ops.smooth_vert(bm,verts=vs,factor=.40,use_axis_x=True,use_axis_y=True,use_axis_z=True)
    bm.to_mesh(horse.data);bm.free();uv=horse.data.uv_layers.active.data;src=source.uv_layers.active.data
    for face in horse.data.polygons:
        if not any(i in selected for i in face.vertices):continue
        ps=[gltf(horse.data.vertices[i].co) for i in face.vertices];c=sum(ps)/len(ps);c[2]=2*np.interp(c[0],gx,gz)-c[2]
        hit,_,index,_=tree.find_nearest(blender(c));poly=source.polygons[index];ids=list(poly.vertices);lis=list(poly.loop_indices)
        for li,p in zip(face.loop_indices,ps):
            p[2]=2*np.interp(p[0],gx,gz)-p[2]
            mapped=barycentric_transform(blender(p),*[source.vertices[i].co for i in ids],*[Vector((*src[i].uv,0)) for i in lis]);uv[li].uv=(mapped.x,mapped.y)
    bpy.data.meshes.remove(source)

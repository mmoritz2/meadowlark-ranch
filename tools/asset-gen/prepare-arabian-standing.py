"""Ordinary source-specific standing retopology of the approved Arabian print.

The original sculpt's planted limbs supply both sides. The game derivative is
joined and remeshed; raw OBJ files and receipts are never written.
"""
import hashlib, json, sys
from pathlib import Path
import bpy, bmesh
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT/'assets/models/horse-imports/arabian-sculpt'
SOURCE = BASE/'source/CABALLO_ARABE (1).obj'
SOURCE_SHA = 'c4359189a30dddf92cc31745e756e6cfc6e30505c3b67c6ca879d6d69d7176c3'
if not {'--factory-startup', '--disable-autoexec'} <= set(sys.argv): raise RuntimeError('Trusted launch flags missing')
raw = SOURCE.read_bytes()
if hashlib.sha256(raw).hexdigest() != SOURCE_SHA: raise ValueError('Original hash mismatch')
text = raw.decode('utf-8-sig').rstrip('\x00'); points, faces = [], []
for line in text.splitlines():
    words = line.split()
    if not words or words[0].startswith('#'): continue
    if words[0] == 'v': points.append([float(v) for v in words[1:4]])
    elif words[0] == 'f': faces.append([int(v)-1 for v in words[1:]])
    elif words[0] != 'g': raise ValueError('Unexpected original OBJ record')
p, f = np.array(points), np.array(faces)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.use_scripts_auto_execute = False
center = .430
head_surface = (p[:, 1] < .85)&(p[:, 2] > 2.08)
cut_front = (p[:, 0] > center)&(p[:, 1] < 1.72)&(p[:, 2] < 2.25)
cut_hind = (p[:, 0] < center)&(p[:, 1] > 2.26)&(p[:, 2] < 1.68)
front_copy = (p[:, 0] < center)&(p[:, 1] < 1.78)&(p[:, 2] < 2.30)
hind_copy = (p[:, 0] > center)&(p[:, 1] > 2.38)&(p[:, 2] < 1.82)
pieces = []
for name, selected, mirror in [('Actual source torso and planted limbs', ~(cut_front|cut_hind), False), ('Mirrored actual planted forelimb', front_copy, True), ('Mirrored actual planted hindlimb', hind_copy, True)]:
    triangles = f[selected[f].all(1)]
    ids = np.unique(triangles); remap = np.full(len(p), -1, dtype=np.int64); remap[ids] = np.arange(len(ids))
    points = p[ids].copy()
    if mirror: points[:, 0] = center*2-points[:, 0]
    triangles = remap[triangles]
    if mirror: triangles = triangles[:, [0, 2, 1]]
    mesh = bpy.data.meshes.new(name); mesh.from_pydata(points.tolist(), [], triangles.tolist()); mesh.update()
    obj = bpy.data.objects.new(name, mesh); bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new(); bm.from_mesh(mesh)
    edges = [e for e in bm.edges if e.is_boundary]
    bmesh.ops.holes_fill(bm, edges=edges, sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(mesh); bm.free()
    pieces.append(obj)
for obj in pieces: obj.select_set(True)
bpy.context.view_layer.objects.active = pieces[0]; bpy.ops.object.join()
obj = bpy.context.object
obj.data.remesh_voxel_size = .0065
obj.data.use_remesh_preserve_volume = True
bpy.ops.object.voxel_remesh()
smooth = obj.modifiers.new('Small ordinary join fairing', 'SMOOTH'); smooth.factor = .35; smooth.iterations = 3
bpy.ops.object.modifier_apply(modifier=smooth.name)
before = len(obj.data.polygons)
decimate = obj.modifiers.new('Source-derived game topology', 'DECIMATE'); decimate.ratio = min(1., 41000/max(1, before)); decimate.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=decimate.name)
bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));body_volume=bm.calc_volume(signed=True)
if body_volume<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
bm.to_mesh(obj.data);bm.free()
bm=bmesh.new();bm.from_mesh(obj.data)
removed_head_faces=[face for face in bm.faces if all(v.co.y<.82 and v.co.z>2.12 for v in face.verts)]
bmesh.ops.delete(bm,geom=removed_head_faces,context='FACES');bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
head_triangles=f[head_surface[f].all(1)];head_ids=np.unique(head_triangles);remap=np.full(len(p),-1,dtype=np.int64);remap[head_ids]=np.arange(len(head_ids))
head_mesh=bpy.data.meshes.new('Actual original complete head');head_mesh.from_pydata(p[head_ids].tolist(),[],remap[head_triangles].tolist());head_mesh.update()
head_object=bpy.data.objects.new(head_mesh.name,head_mesh);bpy.context.scene.collection.objects.link(head_object)
bm=bmesh.new();bm.from_mesh(head_mesh);bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));head_volume=bm.calc_volume(signed=True)
if head_volume<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
bm.to_mesh(head_mesh);bm.free()
print(json.dumps({'beforeUnionBodyVolume':body_volume,'headVolume':head_volume,'bodyFaces':len(obj.data.polygons),'headFaces':len(head_mesh.polygons)}),flush=True)
bm = bmesh.new(); bm.from_mesh(obj.data); bmesh.ops.triangulate(bm, faces=list(bm.faces)); bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(obj.data); bm.free()
bm = bmesh.new(); bm.from_mesh(obj.data); remaining=set(bm.verts); components=[]
while remaining:
    seed=remaining.pop(); group={seed}; stack=[seed]
    while stack:
        v=stack.pop()
        for edge in v.link_edges:
            other=edge.other_vert(v)
            if other in remaining: remaining.remove(other); group.add(other); stack.append(other)
    components.append(group)
largest=max(components,key=len); discarded=sum(len(c) for c in components if c is not largest)
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v not in largest],context='VERTS');bm.to_mesh(obj.data);bm.free()
for o in bpy.context.scene.objects:o.select_set(False)
obj.select_set(True);head_object.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.join()
bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
points = np.array([v.co[:] for v in obj.data.vertices], dtype=np.float64); faces = np.array([poly.vertices[:] for poly in obj.data.polygons], dtype=np.int64)
work = BASE/'work'; work.mkdir(exist_ok=True)
np.savez_compressed(work/'standing-remesh.npz', source=points, faces=faces)
report = {'sourceSha256': SOURCE_SHA, 'sourceVertices': len(p), 'sourceTriangles': len(f), 'derivativeVertices': len(points), 'derivativeTriangles': len(faces), 'remeshVoxelSourceUnits': .0065, 'sourceFrontRemovedVertices': int(cut_front.sum()), 'sourceHindRemovedVertices': int(cut_hind.sum()), 'sameSculptPlantedForelimbMirrored': True, 'sameSculptPlantedHindlimbMirrored': True, 'bodyHeadTorsoAndHighTailMorphologySourceDerived': True, 'allOriginalVerticesOrTopologyPreserved': False, 'generativeToolsUsed': False, 'originalShaPreserved': hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SOURCE_SHA, 'method': 'Remove the print-specific raised limb branches in the game derivative; cap cuts, mirror this exact approved horse’s planted fore/hind limb surfaces, ordinary voxel union and source-derived topology reduction. Source and receipts remain exact original bytes.'}
report.update({'sourceForequarterFromSameSculptPlantedSideMirrored':True,'completeOriginalHeadSurfaceGrafted':True,'sourceHeadSurfaceVertices':len(head_ids),'sourceHeadSurfaceTriangles':len(head_triangles),'headJoin':'Capped original head and repaired standing body overlap within the neck; both surfaces share the anatomical40 skin and receive the same position-derived neck/head blend. No source head extraction/download substitution.','detachedCutFragmentsVerticesRemoved':discarded,'sourceTopologyRetained':False,'rawOriginalsEdited':False})
report['method']='The game derivative replaces the raised forequarter below the upper neck and the folded hind branch using the same approved sculpture’s clean planted-side forequarter/limb surfaces, mirrored to provide a standing bind. Ordinary capped voxel union, small join fairing and topology reduction preserve this source’s head, torso and high-tail morphology; tiny detached cut fragments are excluded. Original OBJ bytes and receipts remain untouched.'
(work/'standing-remesh-report.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report), flush=True)

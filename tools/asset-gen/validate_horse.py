"""Compare shipping rigs after glTF import, including every skinned vertex."""
import bpy, json, pathlib, math
from mathutils.kdtree import KDTree
ROOT=pathlib.Path(__file__).resolve().parents[2]
def inspect(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    h=next(o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
    a=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    coords=[v.co.copy() for v in h.data.vertices]
    weights=[{h.vertex_groups[g.group].name:g.weight for g in v.groups} for v in h.data.vertices]
    bones={b.name:{'parent':b.parent.name if b.parent else None,'matrix':[v for row in b.matrix_local for v in row]} for b in a.data.bones}
    return {'coords':coords,'weights':weights,'bones':bones,'faces':len(h.data.polygons),'bounds':[[min(p[i] for p in coords) for i in range(3)],[max(p[i] for p in coords) for i in range(3)]]}
old=inspect(ROOT/'assets/models/horse_textured_rigged.glb')
new=inspect(ROOT/'assets/models/horse_showcase_rigged.glb')
kd=KDTree(len(old['coords']))
for i,p in enumerate(old['coords']):kd.insert(p,i)
kd.balance()
maxpos=0;maxweight=0;maxsum=0
for p,w in zip(new['coords'],new['weights']):
    _,idx,d=kd.find(p);maxpos=max(maxpos,d);ow=old['weights'][idx]
    maxweight=max(maxweight,max(abs(w.get(k,0)-ow.get(k,0)) for k in set(w)|set(ow)))
    maxsum=max(maxsum,abs(sum(w.values())-1))
names=list(new['bones']);same_names=names==list(old['bones'])
maxbone=max(abs(x-y) for name in names for x,y in zip(old['bones'][name]['matrix'],new['bones'][name]['matrix']))
parents=all(old['bones'][name]['parent']==new['bones'][name]['parent'] for name in names)
report={'passed':same_names and parents and maxbone<.00001 and maxpos<.00001 and maxweight<.0001 and maxsum<.0001 and old['faces']==new['faces'], 'joint_names_and_order_identical':same_names,'joint_hierarchy_identical':parents,'joint_count':len(names),'max_bind_matrix_difference':maxbone,'max_vertex_position_difference':maxpos,'max_weight_difference':maxweight,'max_weight_sum_error':maxsum,'original_triangles':old['faces'],'refined_triangles':new['faces'],'original_vertices':len(old['coords']),'refined_vertices':len(new['coords']),'original_bounds':old['bounds'],'refined_bounds':new['bounds']}
(ROOT/'output/horse-review/validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
assert report['passed'],'Horse GLB compatibility check failed'

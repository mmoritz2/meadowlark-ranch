import bpy, pathlib, numpy as np, json
root=pathlib.Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'assets/models/horse_textured_rigged.glb'))
h=next(o for o in bpy.context.scene.objects if o.type=='MESH' and len(o.data.vertices)>1000)
im=next(n.image for n in h.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE')
pix=np.array(im.pixels[:],dtype=np.float32).reshape(im.size[1],im.size[0],4)
arr=[]
for l in h.data.loops:
    v=h.data.vertices[l.vertex_index];x,y,z=v.co
    if x<.55 or z<.5:continue
    uv=h.data.uv_layers.active.data[l.index].uv
    col=pix[min(im.size[1]-1,int(uv.y*im.size[1])),min(im.size[0]-1,int(uv.x*im.size[0])),:3]
    lum=float(col@np.array([.2126,.7152,.0722]))
    if lum<.035:arr.append([round(x,3),round(y,3),round(z,3),round(lum,3)])
(root/'output/horse-review/head-dark-points.json').write_text(json.dumps(arr))
print('DARK_HEAD',arr[::max(1,len(arr)//60)])

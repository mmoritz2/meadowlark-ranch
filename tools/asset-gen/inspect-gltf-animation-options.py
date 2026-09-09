import bpy
for p in bpy.ops.export_scene.gltf.get_rna_type().properties:
 if any(s in p.identifier for s in ['slide','negative','start','frame','zero']):print(p.identifier,p.description)

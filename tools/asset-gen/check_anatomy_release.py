"""Check released horse surfaces, UV/tangent contracts, and physical grounding."""
import importlib.util
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[2]
path=ROOT/'tools/inspect-horse-topology.py'
spec=importlib.util.spec_from_file_location('horse_topology',path)
topology=importlib.util.module_from_spec(spec);spec.loader.exec_module(topology)
manifest_path=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'assets/models/breeds/manifest.json'
report_path=Path(sys.argv[2]) if len(sys.argv)>2 else ROOT/'output/anatomy-release-checks.json'
manifest=json.loads(manifest_path.read_text())
rows=[];errors=[]
for key,entry in manifest['breeds'].items():
    file=manifest_path.parent/entry['file'];mesh=topology.inspect(file)
    glb=topology.validator.GLB(file)
    primitives=[p for m in glb.doc['meshes'] for p in m['primitives']]
    body=max(primitives,key=lambda p:glb.doc['accessors'][p['attributes']['POSITION']]['count'])
    attributes=body['attributes'];ground=(entry['bounds']['min'][1]*entry['fitScale']+entry['fitY'])*entry['withersM']/1.45
    row={'id':key,'boundaryEdges':mesh['boundaryEdges'],'nonmanifoldEdges':mesh['nonmanifoldEdges'],
         'triangles':mesh['triangles'],'groundMetres':ground,'explicitTangents':'TANGENT' in attributes,
         'singleUVAtlas':'TEXCOORD_0' in attributes and 'TEXCOORD_1' not in attributes,
         'fileBytes':file.stat().st_size}
    rows.append(row)
    if mesh['boundaryEdges'] or mesh['nonmanifoldEdges']:errors.append(key+': surface is not closed manifold')
    if abs(ground)>.001:errors.append(key+': hoof ground error exceeds 1mm')
    if not row['explicitTangents'] or not row['singleUVAtlas']:errors.append(key+': UV/tangent contract failed')
report={'passed':not errors,'modelCount':len(rows),'manifest':str(manifest_path),'errors':errors,'models':rows}
report_path.write_text(json.dumps(report,indent=2))
print(json.dumps({'passed':report['passed'],'models':len(rows),'errors':errors,'report':str(report_path)},indent=2))
raise SystemExit(bool(errors))

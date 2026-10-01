"""Generate synchronous groom controls and exact native hierarchy from frozen White488."""
from pathlib import Path
import hashlib, json, sys
H = Path(__file__).resolve().parent
sys.path.insert(0, str(H.parents[1] / 'tools/asset-gen'))
from rig_hero_horse import read_glb
audit = json.loads((H / 'source-audit.json').read_text())
source = H.parent / 'native-white-head-kit/model.glb'
assert hashlib.sha256(source.read_bytes()).hexdigest() == audit['sourceSha256']
j, _ = read_glb(source)
parents = {c: i for i, n in enumerate(j['nodes']) for c in n.get('children', [])}
hierarchy = [[j['nodes'][i]['name'], j['nodes'][parents[i]]['name'] if i in parents else None] for i in j['skins'][0]['joints']]
keep = ('name', 'parent', 'safeDepth', 'primaryRoot', 'frequencyHz', 'dampingRatio', 'maxAddedWorldAngleDeg', 'angularInertiaGain', 'linearInertiaGain')
controls = [{k: r[k] for k in keep} for r in audit['controls']]
out = '// Generated from frozen White488 source hierarchy and audited full mesh weights.\n'
out += 'export const NATIVE_GROOM_PROFILE_IDS=Object.freeze(["white-western","bay-western","bay-sporthorse-native"]);\n'
out += 'export const NATIVE_GROOM_HIERARCHY=Object.freeze(' + json.dumps(hierarchy, separators=(',', ':')) + '.map(Object.freeze));\n'
out += 'export const NATIVE_GROOM_AUDIT=Object.freeze({sourceJointCount:677,controls:Object.freeze(' + json.dumps(controls, separators=(',', ':')) + '.map(Object.freeze))});\n'
(H / 'native-groom-controls.mjs').write_text(out)
print('Generated', len(hierarchy), 'source joints,', len(controls), 'safe controls')

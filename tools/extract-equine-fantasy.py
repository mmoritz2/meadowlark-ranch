"""One-time extraction of the existing game fantasy artwork into a reusable module.

The runtime module is maintained independently after extraction. This deliberately
keeps the established wing geometry, feather layering and magical coat treatments.
"""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = (root / 'ranch3d.html').read_text(encoding='utf-8')

def between(a, b):
    return source[source.index(a):source.index(b, source.index(a))]

coat = between('const FANTASY_CFG=', 'function fantasyCoatRig(')
factory = between('function fantasyCoatRig(', '/* Tint the pegasus wings')
start = factory.index(' const cfg=')
factory = 'export function createEquineFantasyCoat(THREE, baseMat, type, scaly=false){\n' + factory[start:]
factory = factory.replace('RIG.baseMat.clone()', 'baseMat.clone()')
factory = factory.replace(' m.onBeforeCompile=sh=>{', " const time={value:0};\n m.name='EquineFantasy_'+type+(scaly?'_scales':'');\n m.userData.update=t=>{time.value=t;};\n m.customProgramCacheKey=()=>m.name;\n m.onBeforeCompile=sh=>{")
factory = factory.replace("sh.uniforms.uTime={value:0};", "sh.uniforms.uTime=time;")
factory = factory.replace('  (RIG._fcrShaders=RIG._fcrShaders||[]).push(sh);\n', '')
factory = factory.replace('m.needsUpdate=true; RIG._fcr[key]=m; return m;', 'm.needsUpdate=true; return m;')
wings = between('const featherTex=', '/* ===== Dragon breath =====')
wings += between('function buildPegasusWings(){', 'function makeHorse(cfg){')
tints = between('const DRAGON_TINT=', "function tintWings(type){")
# Seed the small generated texture details. A different page should not grow
# different feathers for the same horse.
wings = wings.replace('Math.random()', 'random()')
wrapper = '''
export function createEquineWingLibrary(THREE, {camera, sun}) {
 let seed=19088743;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
'''
tail = '''
 function disposePair(pair) {
  const geos=new Set(), mats=new Set();
  for(const wing of pair||[]) {
   wing.removeFromParent();
   wing.traverse(o=>{if(o.isMesh){if(o.geometry!==FEATHER_GEO)geos.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);}});
  }
  for(const g of geos)g.dispose();for(const m of mats)m.dispose();
 }
 return {buildPegasusWings,buildDragonWings,poseWings,tintWingMats,disposePair,
   dispose(){FEATHER_GEO.dispose();featherTex.dispose();dragonWebTex.dispose();}};
}
'''
(root/'assets/equine-fantasy.js').write_text('// Shared fantasy horse artwork, extracted from the ranch renderer.\n'+coat+factory+wrapper+wings+tints+tail,encoding='utf-8')
print('Created assets/equine-fantasy.js')

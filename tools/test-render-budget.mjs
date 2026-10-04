import assert from 'node:assert/strict';
import {renderPixelRatio} from '../assets/render-budget.js';
for(const [tier,budget] of [['high',1650000],['medium',1100000],['low',850000]]){
 for(const [w,h,dpr] of [[900,650,1],[1280,850,2],[1920,1080,2],[3840,2160,2],[390,844,3]]){
  const ratio=renderPixelRatio(w,h,dpr,tier);
  assert(ratio>0&&ratio<=dpr,'Never exceed screen density');
  assert(w*h*ratio*ratio<=budget+.001,`${tier} pixel work stays bounded after resize`);
 }
}
assert.equal(renderPixelRatio(900,650,1,'high'),1,'Preserve ordinary display sharpness');
assert(renderPixelRatio(1280,850,2,'high')>renderPixelRatio(1280,850,2,'medium'),'High retains more resolution');
console.log('Graphics pixel budgets passed for laptop, Retina, 4K and phone viewports.');

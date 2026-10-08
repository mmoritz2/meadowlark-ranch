import test from 'node:test';
import assert from 'node:assert/strict';
import {grazedTuftScale} from '../assets/meadow-tufts.mjs';
import {meadowGrazingAt,westMeadowSwardAt,WEST_MEADOW_SWARD_RECOVERY} from '../assets/pastoral-fields.mjs';

test('fully grazed fields cap tall tussocks without enlarging already short grass',()=>{
  for(const [x,z]of [[65,-145],[64,-98],[172,34],[53,231],[237,133]]){
    assert.equal(meadowGrazingAt(x,z),1);
    for(const height of [.42,.85,1.55,2]){
      const scale=grazedTuftScale(x,z,height),after=height*scale;
      assert.ok(scale>0&&scale<1);
      assert.ok(after>=.26-1e-12&&after<=.34+1e-12);
    }
    assert.equal(grazedTuftScale(x,z,.18),1);
  }
});

test('unmown sites stay exact and west meadow retains its intentional recovered sward',()=>{
  for(const [x,z]of [[23,-104],[-150,40],[350,-80],[0,0]]){
    assert.equal(meadowGrazingAt(x,z),0);
    assert.equal(grazedTuftScale(x,z,1.5),1);
  }
  const x=-54,z=43,grazing=meadowGrazingAt(x,z);
  assert.equal(grazing,1);assert.equal(westMeadowSwardAt(x,z),1);
  const scale=grazedTuftScale(x,z,1.2);
  assert.ok(scale>=WEST_MEADOW_SWARD_RECOVERY&&scale<1,'recovery prevents a fully mown west meadow');
  assert.ok(1.2*scale>.9,'existing west sward remains appreciably taller than the field cap');
});

test('field transitions remain continuous, bounded and deterministic at riding scale',()=>{
  let transitions=0;
  for(let z=-177;z<=-82;z+=5){
    let previous=grazedTuftScale(-5,z,1.3);
    for(let x=-4.75;x<=130;x+=.25){
      const scale=grazedTuftScale(x,z,1.3),grazing=meadowGrazingAt(x,z);
      assert.ok(Number.isFinite(scale)&&scale>0&&scale<=1);
      assert.equal(scale,grazedTuftScale(x,z,1.3));
      assert.ok(Math.abs(scale-previous)<.09,'no height step across a quarter-metre stride');
      if(grazing>0&&grazing<1){transitions++;assert.ok(scale>.26/1.3);}
      previous=scale;
    }
  }
  assert.ok(transitions>100,'survey includes actual field margins');
  assert.equal(grazedTuftScale(65,-145,0),1);
  assert.throws(()=>grazedTuftScale(NaN,0,1),/Finite/);
});

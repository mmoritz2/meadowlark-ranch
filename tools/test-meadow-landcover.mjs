import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeadowGrazingPixels,extendWoodlandMask} from '../assets/meadow-landcover.mjs';
import {meadowGrazingAt} from '../assets/pastoral-fields.mjs';

test('cached grazing uses world pixel centres and positive-Z canvas rows',()=>{
  const size=1024,data=createMeadowGrazingPixels(size),step=1000/size;
  const at=(x,z)=>{
    const column=Math.floor((x+500)/step),row=Math.floor((z+500)/step);
    const index=(row*size+column)*4;
    assert.equal(data[index+2],Math.round(meadowGrazingAt(-500+(column+.5)*step,-500+(row+.5)*step)*255));
    return data[index+2];
  };
  assert.ok(at(65,-145)>240,'Clover field is present north of the ranch');
  assert.equal(at(65,145),0,'Clover is not mirrored to positive Z');
  assert.ok(at(70,-50)>240,'maintained orchard is retained');
  assert.ok(at(53,231)>240,'north-meadow positive-Z field is retained');
  assert.equal(at(0,0),0,'sandy arena does not acquire grazing');
  for(let i=0;i<data.length;i+=4){assert.equal(data[i],0);assert.equal(data[i+1],0);assert.equal(data[i+3],255);}
});

test('woodland skirt preserves existing cores and every non-red channel',()=>{
  const size=1024,data=new Uint8ClampedArray(size*size*4);
  for(let i=0;i<data.length;i+=4){data[i]=(i/4)%17;data[i+1]=(i/4)%251;data[i+2]=((i/4)%7)*31;data[i+3]=(i/4)%256;}
  const coreIndex=(512*size+512)*4;data[coreIndex]=245;
  const original=data.slice(),stats=extendWoodlandMask(data,size,[{x:.4,z:.3,s:1}]);
  assert.equal(stats.trees,1);assert.ok(stats.texelsRaised>0);assert.equal(data[coreIndex],245);
  for(let i=0;i<data.length;i+=4){
    assert.ok(data[i]>=original[i]);
    for(let c=1;c<4;c++)assert.equal(data[i+c],original[i+c]);
    if(data[i]!==original[i]){
      const pixel=i/4,x=-500+(pixel%size+.5)*1000/size,z=-500+(Math.floor(pixel/size)+.5)*1000/size;
      assert.ok(Math.hypot(x-.4,z-.3)<3.7*1.30,'no red contribution outside the authored skirt');
    }
  }
});

test('grazing and protected ground suppress added skirt without erasing old red',()=>{
  const size=1024,blank=()=>new Uint8ClampedArray(size*size*4),open=blank(),grazed=blank(),protectedGround=blank();
  for(let i=0;i<grazed.length;i+=4){grazed[i+2]=255;protectedGround[i]=19;}
  const trees=[{x:0,z:0,s:1}],sumRed=data=>{let sum=0;for(let i=0;i<data.length;i+=4)sum+=data[i];return sum;};
  extendWoodlandMask(open,size,trees);
  extendWoodlandMask(grazed,size,trees);
  const protectedBefore=protectedGround.slice(),stats=extendWoodlandMask(protectedGround,size,trees,()=>1);
  assert.ok(sumRed(open)>0);assert.ok(sumRed(grazed)<sumRed(open)*.17,'fully grazed skirt retains only a small fraction');
  assert.equal(stats.texelsRaised,0);assert.deepEqual(protectedGround,protectedBefore);
});

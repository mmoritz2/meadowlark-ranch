// Fine meadow blades at botanical scale, keeping the existing triangle budget.
// Upright tips, low spreading leaves and an occasional
// straw blade share one inexpensive tuft. Every blade tapers to a curved point.
export function createGrassTuftGeometry(THREE) {
  const P=[],N=[],C=[],U=[],I=[];
  for(let blade=0;blade<16;blade++) {
    const a=blade*2.39996,spread=.035+(blade%6)*.045;
    const ox=Math.cos(a)*spread,oz=Math.sin(a)*spread;
    const tall=blade%3===0,h=tall?.27+(blade%4)*.045:.11+(blade%5)*.025;
    const bend=tall?.09+(blade%3)*.018:.16+(blade%3)*.026,width=.009+(blade%4)*.0024;
    const ca=Math.cos(a),sa=Math.sin(a),base=P.length/3;
    for(const t of [0,.55,1])for(const side of t===1?[0]:[-1,1]){
      const w=width*(1-t*.80)*side;
      P.push(ox+ca*bend*t*t-sa*w,h*t*(1-.14*t),oz+sa*bend*t*t+ca*w);
      N.push(ca*.32,.895,sa*.32);
      const shade=.45+t*.55,dry=blade%9===0;
      C.push(shade*(dry?1.12:.88),shade*(dry?.99:1),shade*(dry?.58:.73));U.push((side+1)/2,t);
    }
    I.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));
  g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setIndex(I);g.computeBoundingSphere();return g;
}

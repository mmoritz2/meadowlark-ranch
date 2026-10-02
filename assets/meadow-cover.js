// Mixed-height pasture: low spreading leaves fill gaps between taller blades.
// Fourteen blades use 42 triangles, down from nine blades and 54 triangles.
export function createGrassTuftGeometry(THREE) {
  const P=[],N=[],C=[],U=[],I=[];
  for(let blade=0;blade<14;blade++) {
    const a=blade*2.39996, spread=.08+(blade%5)*.058;
    const ox=Math.cos(a)*spread, oz=Math.sin(a)*spread;
    const tall=blade%4===0;
    const h=tall?.31+(blade%3)*.047:.11+(blade%5)*.026;
    const bend=tall?.10:.16+(blade%3)*.036, width=.012+(blade%3)*.004;
    const ca=Math.cos(a),sa=Math.sin(a),base=P.length/3;
    for(const t of [0,.52,1]){
      const centerX=ox+ca*bend*t*t,centerZ=oz+sa*bend*t*t;
      for(const side of t===1?[0]:[-1,1]){
        const w=width*(1-t*.7)*side;
        P.push(centerX-sa*w,h*t,centerZ+ca*w);
        N.push(ca*.22,.9507,sa*.22);
        const shade=.48+t*.52, dry=blade%11===0;
        C.push(shade*(dry?1.08:.93),shade*(dry?.97:1),shade*(dry?.64:.78));U.push((side+1)/2,t);
      }
    }
    I.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));
  g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setIndex(I);g.computeBoundingSphere();return g;
}

// Curved individual grass blades. Geometry replaces alpha card silhouettes near the rider.
export function createGrassTuftGeometry(THREE) {
  const P=[],N=[],C=[],U=[],I=[];
  for(let blade=0;blade<9;blade++) {
    const a=blade*2.39996, spread=.07+(blade%3)*.055;
    const ox=Math.cos(a)*spread, oz=Math.sin(a)*spread;
    // Mixed fine fescue and broader meadow grass; distinct heights keep the
    // sward from looking like identical paper fans at the horse's feet.
    const h=.22+(blade%5)*.064, bend=.09+(blade%3)*.052, width=.011+(blade%3)*.006;
    const ca=Math.cos(a),sa=Math.sin(a),base=P.length/3;
    for(let row=0;row<4;row++){
      const t=row/3, centerX=ox+ca*bend*t*t,centerZ=oz+sa*bend*t*t;
      for(const side of [-1,1]){
        const w=width*(1-t)*side;
        P.push(centerX-sa*w,h*t,centerZ+ca*w);
        N.push(ca*.30,.955,sa*.30);
        const shade=.40+t*.60;
        const dry=blade%5===0;
        C.push(shade*(dry?1.06:.91),shade*(dry?.94:1),shade*(dry?.65:.77));U.push((side+1)/2,t);
      }
      if(row<3){const k=base+row*2;I.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));
  g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setIndex(I);g.computeBoundingSphere();return g;
}

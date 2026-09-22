// Curved individual grass blades. Geometry replaces alpha card silhouettes near the rider.
export function createGrassTuftGeometry(THREE) {
  const P=[],N=[],C=[],U=[],I=[];
  for(let blade=0;blade<7;blade++) {
    const a=blade*2.39996, spread=.07+(blade%3)*.055;
    const ox=Math.cos(a)*spread, oz=Math.sin(a)*spread;
    const h=.25+(blade%4)*.060, bend=.15+(blade%3)*.05, width=.042+(blade%2)*.012;   // was .017/.005 wide: 2 cm blades read as fuzz, a carpet needs 4-5 cm; short and even, a lawn of clumps not a hay field
    const ca=Math.cos(a),sa=Math.sin(a),base=P.length/3;
    for(let row=0;row<4;row++){
      const t=row/3, centerX=ox+ca*bend*t*t,centerZ=oz+sa*bend*t*t;
      for(const side of [-1,1]){
        const w=width*(1-t)*side;
        P.push(centerX-sa*w,h*t,centerZ+ca*w);
        N.push(ca*.30,.955,sa*.30);
        const shade=.46+t*.54;C.push(shade*.98,shade,shade*.80+.03*t);U.push((side+1)/2,t);   // darker at the root, a warm bright tip
      }
      if(row<3){const k=base+row*2;I.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));
  g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setIndex(I);g.computeBoundingSphere();return g;
}

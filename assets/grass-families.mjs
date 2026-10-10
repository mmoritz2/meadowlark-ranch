// Original modeled grass: three botanical silhouettes sharing the existing near-grass material.
// Geometry is deterministic; no imported assets, alpha cards, texture creation, or placement sampling.
export const GRASS_FAMILIES = Object.freeze([
  Object.freeze({id:0,name:'Fine arching meadow',triangles:70,leaves:14,seedStems:0}),
  Object.freeze({id:1,name:'Low fine meadow',triangles:70,leaves:14,seedStems:0}),
  Object.freeze({id:2,name:'Loose seeded meadow',triangles:70,leaves:14,seedStems:2}),
]);

export function createGrassFamilyGeometry(T,family=0) {
  if(!Number.isInteger(family)||!GRASS_FAMILIES[family])throw Error('Unknown grass family');
  const P=[],C=[],U=[],I=[];
  // Fourteen narrower leaves share the original footprint. The leafy families
  // spend five triangles per leaf; the seeded family keeps its two real stems
  // and uses three triangles per leaf. No additional instances or triangles.
  const samples=family===2?[0,.66,1]:[0,.36,.74,1];
  const roots=[[-.055,-.042],[.042,-.062],[.058,.035],[-.033,.060],[.006,.011],[-.012,-.054],[.029,.049]];
  const heading=[.18,1.08,.57,2.02,2.49,3.30,3.57,4.63,5.18,5.63,.83,2.80,4.14,5.90];
  const configurations=[
    {heights:[.41,.58,.33,.47,.36,.61,.30,.44,.38,.55,.34,.49,.42,.59],bends:[.17,.21,.25,.18,.24,.16,.23,.20,.24,.19,.26,.18,.22,.20],width:.0150,widthStep:.0007,tip:.94},
    {heights:[.22,.29,.20,.32,.25,.28,.19,.30,.22,.31,.24,.27,.21,.29],bends:[.24,.20,.26,.22,.24,.21,.27,.23,.22,.24,.25,.23,.26,.22],width:.0160,widthStep:.0007,tip:.75},
    {heights:[.38,.54,.29,.43,.34,.57,.27,.39,.35,.51,.30,.46,.36,.52],bends:[.18,.21,.24,.19,.22,.17,.25,.20,.23,.18,.24,.19,.22,.20],width:.0145,widthStep:.0006,tip:.94},
  ];
  const cfg=configurations[family],leafRanges=[];
  function vertex(point,u,v,shade=1,dry=0){P.push(...point);U.push(u,v);C.push(shade*(.90+dry*.12),shade*(1-dry*.04),shade*(.73-dry*.16));}
  for(let leaf=0;leaf<cfg.heights.length;leaf++){
    const root=roots[leaf%roots.length],rx=root[0]+(leaf<7?-.004:.006),rz=root[1]+(leaf%3-1)*.004;
    const angle=heading[leaf]+(family===1?.17:0),dx=Math.cos(angle),dz=Math.sin(angle),sx=-dz,sz=dx;
    const h=cfg.heights[leaf]*(family===0?.86:1),bend=cfg.bends[leaf],width=(cfg.width+(leaf%4)*cfg.widthStep)*(h>.50?.86:1);
    const curl=(leaf%2?-.025:.030),twist=(leaf%2?-1:1)*(.11+(leaf%3)*.045);
    const start=P.length/3,indexStart=I.length;
    // Most of the blade rises before the upper third arches: unlike a low
    // radial fan, the leaves overlap into an upright stand with unequal tops.
    const tip=cfg.tip+(leaf%3-1)*.035;
    for(let ring=0;ring<samples.length;ring++){
      const t=samples[ring],r=1-t,b1=3*r*r*t,b2=3*r*t*t,b3=t*t*t;
      const lean=bend*(.006*b1+.18*b2+b3),sideways=curl*(.12*b2+b3);
      const x=rx+dx*lean+sx*sideways,y=h*(.68*b1+1.18*b2+tip*b3),z=rz+dz*lean+sz*sideways;
      const half=width*(.52+.86*Math.sin(Math.PI*t*.90))*Math.pow(r,.82),turn=angle+twist*t*t;
      const last=ring===samples.length-1;
      for(const side of last?[0]:[-1,1])vertex([x-Math.sin(turn)*half*side,y,z+Math.cos(turn)*half*side],(side+1)/2,t,.27+.67*Math.pow(Math.sin(t*Math.PI*.5),.72),leaf===0?.30:0);
      if(ring<samples.length-2){const k=start+ring*2;I.push(k,k+1,k+2,k+1,k+3,k+2);}
      else if(ring===samples.length-2){const k=start+ring*2;I.push(k,k+1,k+2);}
    }
    leafRanges.push({vertexStart:start,vertexCount:P.length/3-start,indexStart,indexCount:I.length-indexStart});
  }
  if(family===2){
    for(let stem=0;stem<2;stem++){
      const angle=stem===0?.81:3.97,dx=Math.cos(angle),dz=Math.sin(angle),rx=stem===0?.024:-.038,rz=stem===0?-.021:.032;
      const height=stem===0?.62:.73,lean=stem===0?.15:.11,base=P.length/3;
      // Four real sides keep a fine stalk visible as the rider circles the tuft.
      for(let ring=0;ring<2;ring++)for(let side=0;side<4;side++){
        const a=angle+side*Math.PI*.5,radius=ring?.0028:.004;
        vertex([rx+dx*lean*ring+Math.cos(a)*radius,height*ring,rz+dz*lean*ring+Math.sin(a)*radius],side/3,ring,.32+ring*.54,.15);
      }
      for(let side=0;side<4;side++){const a=base+side,b=base+(side+1)%4,c=base+4+side,d=base+4+(side+1)%4;I.push(a,c,b,b,c,d);}
      // A slim three-sided grain ear: pointed at each end with no rectangular sprite.
      const seedLength=stem===0?.075:.065,seedWidth=stem===0?.009:.007;
      const x=rx+dx*lean,z=rz+dz*lean;
      const grain=[{p:[x,height-.004,z],u:.5,v:.80,shade:.95,dry:.65}];
      for(let side=0;side<3;side++){
        const a=angle+side*Math.PI*2/3;
        grain.push({p:[x+dx*.014+Math.cos(a)*seedWidth,height+seedLength*.36,z+dz*.014+Math.sin(a)*seedWidth],u:side/2,v:.9,shade:1,dry:.8});
      }
      grain.push({p:[x+dx*.038,height+seedLength,z+dz*.038],u:.5,v:1,shade:1,dry:.85});
      // Split the sharp grain facets so a shared tilted apex cannot average to a reversed normal.
      for(let side=0;side<3;side++){
        const a=1+side,b=1+(side+1)%3;
        for(const ids of [[0,a,b],[a,4,b]]){
          const at=P.length/3;
          for(const id of ids){const q=grain[id];vertex(q.p,q.u,q.v,q.shade,q.dry);}
          I.push(at,at+1,at+2);
        }
      }
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(P,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(C,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(U,2));
  geometry.setIndex(I);
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData.grassFamily={...GRASS_FAMILIES[family],vertices:P.length/3,leafRanges,bounds:{min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()}};
  return geometry;
}

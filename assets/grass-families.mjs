// Original modeled grass: three botanical silhouettes sharing the existing near-grass material.
// Geometry is deterministic; no imported assets, alpha cards, texture creation, or placement sampling.
export const GRASS_FAMILIES = Object.freeze([
  Object.freeze({id:0,name:'Fine arched fescue',triangles:70,leaves:10,seedStems:0}),
  Object.freeze({id:1,name:'Low bowed meadow',triangles:70,leaves:10,seedStems:0}),
  Object.freeze({id:2,name:'Loose seeded meadow',triangles:70,leaves:6,seedStems:2}),
]);

export function createGrassFamilyGeometry(T,family=0) {
  if(!Number.isInteger(family)||!GRASS_FAMILIES[family])throw Error('Unknown grass family');
  const P=[],C=[],U=[],I=[];
  const samples=[0,.34,.63,.84,1];
  const roots=[[-.065,-.046],[.050,-.078],[.073,.039],[-.038,.073],[.006,.011]];
  const heading=[.18,1.08,.57,2.02,2.49,3.30,3.57,4.63,5.18,5.63];
  const configurations=[
    {heights:[.59,.77,.48,.70,.55,.81,.43,.65,.52,.74],bends:[.17,.23,.16,.22,.18,.27,.14,.20,.17,.25],width:.013,widthStep:.0012,tip:.86,shoulder:1.02,crown:.63},
    {heights:[.25,.34,.20,.39,.28,.32,.23,.36,.29,.40],bends:[.28,.25,.31,.24,.30,.26,.34,.28,.25,.32],width:.016,widthStep:.0015,tip:.54,shoulder:1.0,crown:.66},
    {heights:[.44,.64,.35,.52,.41,.68],bends:[.22,.21,.25,.24,.19,.27],width:.0145,widthStep:.0015,tip:.78,shoulder:1.02,crown:.64},
  ];
  const cfg=configurations[family];
  function vertex(point,u,v,shade=1,dry=0){P.push(...point);U.push(u,v);C.push(shade*(.90+dry*.12),shade*(1-dry*.04),shade*(.73-dry*.16));}
  for(let leaf=0;leaf<cfg.heights.length;leaf++){
    const root=roots[leaf%roots.length],rx=root[0]+(leaf<5?-.004:.006),rz=root[1]+(leaf%3-1)*.004;
    const angle=heading[leaf]+(family===1?.17:0),dx=Math.cos(angle),dz=Math.sin(angle),sx=-dz,sz=dx;
    const h=cfg.heights[leaf],bend=cfg.bends[leaf],width=cfg.width+(leaf%4)*cfg.widthStep;
    const curl=(leaf%2?-.035:.043)*(family===1?1.35:.8),twist=(leaf%2?-1:1)*(.10+(leaf%3)*.045);
    const start=P.length/3;
    for(let ring=0;ring<samples.length;ring++){
      const t=samples[ring],r=1-t,b1=3*r*r*t,b2=3*r*t*t,b3=t*t*t;
      const lean=bend*(.025*b1+.45*b2+b3),sideways=curl*(.30*b2+b3);
      const x=rx+dx*lean+sx*sideways,y=h*(cfg.crown*b1+cfg.shoulder*b2+cfg.tip*b3),z=rz+dz*lean+sz*sideways;
      const half=width*(.52+.72*Math.sin(Math.PI*t*.9))*Math.pow(r,.77),turn=angle+twist*t*t;
      for(const side of ring===4?[0]:[-1,1])vertex([x-Math.sin(turn)*half*side,y,z+Math.cos(turn)*half*side],(side+1)/2,t,.57+.43*Math.sin(t*Math.PI*.5),leaf===0?.55:0);
      if(ring<3){const k=start+ring*2;I.push(k,k+1,k+2,k+1,k+3,k+2);}
      else if(ring===3){const k=start+ring*2;I.push(k,k+1,k+2);}
    }
  }
  if(family===2){
    for(let stem=0;stem<2;stem++){
      const angle=stem===0?.81:3.97,dx=Math.cos(angle),dz=Math.sin(angle),rx=stem===0?.024:-.038,rz=stem===0?-.021:.032;
      const height=stem===0?.78:.85,lean=stem===0?.13:.10,base=P.length/3;
      // Four real sides keep a fine stalk visible as the rider circles the tuft.
      for(let ring=0;ring<2;ring++)for(let side=0;side<4;side++){
        const a=angle+side*Math.PI*.5,radius=ring?.0028:.004;
        vertex([rx+dx*lean*ring+Math.cos(a)*radius,height*ring,rz+dz*lean*ring+Math.sin(a)*radius],side/3,ring,.61+ring*.30,.24);
      }
      for(let side=0;side<4;side++){const a=base+side,b=base+(side+1)%4,c=base+4+side,d=base+4+(side+1)%4;I.push(a,c,b,b,c,d);}
      // A slim three-sided grain ear: pointed at each end with no rectangular sprite.
      const seedLength=stem===0?.11:.095,seedWidth=stem===0?.011:.009;
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
  geometry.userData.grassFamily={...GRASS_FAMILIES[family],vertices:P.length/3,bounds:{min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()}};
  return geometry;
}

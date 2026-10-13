// Original physical bank-rush clump. This factory replaces one old geometry
// constructor; it neither samples randomness nor creates scene/material owners.
export const BANK_RUSH_PROFILE=Object.freeze({profile:'physical-bank-rushes-1',triangles:72,stems:2,foldedLeaves:4,fineLeaves:4,seedHeads:1,sourceRadius:Math.SQRT1_2});

export function createBankRushGeometry(T){
 const P=[],C=[],I=[],color=new T.Color();
 const vertex=(x,y,z,hex,shade=1)=>{const id=P.length/3;P.push(x,y,z);color.set(hex).multiplyScalar(shade);C.push(color.r,color.g,color.b);return id;};
 const stems=[{x:-.052,z:.025,h:1,bend:.025,a:.5,r:.010},{x:.071,z:-.033,h:.84,bend:.048,a:2.6,r:.008}];
 const center=(stem,y)=>[stem.x+Math.cos(stem.a)*stem.bend*y*y,y,stem.z+Math.sin(stem.a)*stem.bend*y*y];
 function stemTube(stem,rings){
  const base=P.length/3,sides=3;
  for(let j=0;j<=rings;j++){
   const t=j/rings,y=stem.h*t,p=center(stem,y),radius=stem.r*(1-.73*t);
   for(let k=0;k<sides;k++){const a=stem.a+k*Math.PI*2/sides;vertex(p[0]+Math.cos(a)*radius,y,p[2]+Math.sin(a)*radius,'#7a8f50',.71+.29*t);}
  }
  for(let j=0;j<rings;j++)for(let k=0;k<sides;k++){const a=base+j*sides+k,b=base+j*sides+(k+1)%sides;I.push(a,a+sides,b,b,a+sides,b+sides);}
  const p=center(stem,stem.h),top=vertex(...p,'#8b9c5b');
  for(let k=0;k<sides;k++)I.push(top,base+rings*sides+(k+1)%sides,base+rings*sides+k);
 }
 stemTube(stems[0],2);stemTube(stems[1],1);

 // Four unequal lanceolate leaves curve beyond a narrow physical crease.
 // Independent center vertices keep the two upper facets visibly folded.
 const leaves=[{a:.3,h:.79,bend:.29,w:.011,root:.0},{a:2.75,h:.91,bend:.24,w:.013,root:.0},{a:1.65,h:.66,bend:.37,w:.010,root:.06},{a:4.85,h:.59,bend:.40,w:.012,root:.035}];
 for(let i=0;i<leaves.length;i++){
  const leaf=leaves[i],ca=Math.cos(leaf.a),sa=Math.sin(leaf.a),sx=-sa,sz=ca,root=stems[i%2],t=.57;
  const mid=[root.x+ca*leaf.bend*t*t,leaf.root+leaf.h*.61,root.z+sa*leaf.bend*t*t],tip=[root.x+ca*leaf.bend,leaf.root+leaf.h*(i===2||i===3?.52:.87),root.z+sa*leaf.bend];
  const ridge=leaf.w*.40,base=P.length/3,green=i===3?'#929f60':'#7d9350';
  vertex(root.x-sx*leaf.w*.52,leaf.root,root.z-sz*leaf.w*.52,green,.60);
  vertex(root.x+sx*leaf.w*.52,leaf.root,root.z+sz*leaf.w*.52,green,.60);
  vertex(mid[0]-ca*ridge,mid[1]+ridge,mid[2]-sa*ridge,green,.92);
  vertex(mid[0]-ca*ridge,mid[1]+ridge,mid[2]-sa*ridge,green,.98);
  vertex(mid[0]-sx*leaf.w,mid[1],mid[2]-sz*leaf.w,green,.90);
  vertex(mid[0]+sx*leaf.w,mid[1],mid[2]+sz*leaf.w,green,.97);
  vertex(...tip,green,1.05);
  for(const k of [0,1,2,0,2,4,1,5,3,4,2,6,3,5,6])I.push(base+k);
 }
 // A few fine basal leaves fill the clump without another broad card plane.
 for(let i=0;i<4;i++){
  const a=.9+i*2.39996,ca=Math.cos(a),sa=Math.sin(a),sx=-sa,sz=ca,root=stems[(i+1)%2],width=.0045+i*.0005,base=P.length/3;
  vertex(root.x-sx*width,0,root.z-sz*width,'#6a8144',.73);
  vertex(root.x+sx*width,0,root.z+sz*width,'#6a8144',.78);
  vertex(root.x+ca*(.18+i*.025),.54+i*.06,root.z+sa*(.18+i*.025),'#8a9b58',.96);
  I.push(base,base+1,base+2);
 }

 // A closed six-sided brown seed head sits on the taller stem, leaving its
 // fine green terminal spike exposed. All caps and stems are real surfaces.
 {
  const stem=stems[0],lo=.755,hi=.935,r=.026,sides=6,base=P.length/3;
  for(const y of [lo,hi]){const p=center(stem,y);for(let k=0;k<sides;k++){const a=k*Math.PI*2/sides+.21;vertex(p[0]+Math.cos(a)*r,y,p[2]+Math.sin(a)*r,'#66503a',.82+(k%3)*.075);}}
  for(let k=0;k<sides;k++){const a=base+k,b=base+(k+1)%sides;I.push(a,a+sides,b,b,a+sides,b+sides);}
  const bottom=vertex(...center(stem,lo),'#59422e'),top=vertex(...center(stem,hi),'#877151');
  for(let k=0;k<sides;k++){I.push(bottom,base+k,base+(k+1)%sides);I.push(top,base+sides+(k+1)%sides,base+sides+k);}
 }
 const g=new T.BufferGeometry();g.name='Original physical bank rushes';
 g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('color',new T.Float32BufferAttribute(C,3));g.setIndex(I);g.computeVertexNormals();g.computeBoundingBox();
 // Course clearing measured the old crossed-card prototype by this sphere.
 // The new physical clump fits it; retaining the conservative source sphere
 // preserves the original gather/mow classification and instance ownership.
 g.boundingSphere=new T.Sphere(new T.Vector3(0,.5,0),Math.SQRT1_2);
 g.userData.bankRushProfile=BANK_RUSH_PROFILE;return g;
}

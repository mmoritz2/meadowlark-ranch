// Continuous camera sphere clearance against the LIVE canonical terrain triangles.
// The cells use a,b,d / d,b,c (u+v<=1), exactly as terrainH and PlaneGeometry.
export const TERRAIN_CAMERA_CLEARANCE_PROFILE='terrain-camera-clearance-1';

export function createTerrainCameraClearance({THREE:T,heights,segments,step,originX,originZ}){
 if(!T?.Vector3||!T?.Triangle||!(heights instanceof Float32Array)||!Number.isInteger(segments)||segments<1||heights.length!==(segments+1)**2||!(step>0)||!Number.isFinite(step*step)||!Number.isFinite(originX)||!Number.isFinite(originZ)||!Number.isFinite(originX+segments*step)||!Number.isFinite(originZ+segments*step))throw new TypeError('Valid live canonical terrain descriptor required');
 // CPU vectors only. They carry no UUID/GPU resource, and every query reuses them.
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),point=new T.Vector3(),closest=new T.Vector3(),triangle=new T.Triangle(a,b,c),n=segments+1;
 const EPS=1e-10,ROUND=Number.EPSILON*32;
 let ox=0,oy=0,oz=0,dx=0,dy=0,dz=0,r=0,r2=0,best=1,originBelow=false,initialOverlapSeen=false;
 let ax=0,ay=0,az=0,bx=0,by=0,bz=0,cx=0,cy=0,cz=0,nx=0,ny=0,nz=0,side=0,normalSpeed=0,denXZ=0;
 function inside(x,z){
  const px=x-ax,pz=z-az,u=(px*(cz-az)-pz*(cx-ax))/denXZ,v=((bx-ax)*pz-(bz-az)*px)/denXZ;
  return u>=-EPS&&v>=-EPS&&u+v<=1+EPS;
 }
 function vertex(x,y,z){
  const wx=ox-x,wy=oy-y,wz=oz-z,A=dx*dx+dy*dy+dz*dz,B=wx*dx+wy*dy+wz*dz,C=wx*wx+wy*wy+wz*wz-r2;
  if(!(A>0&&B<0&&C>0))return;
  const disc=B*B-A*C;
  // An isolated tangent does not penetrate the clearance sphere. Keeping it
  // traversable also permits exact-radius sliding across adjacent cell seams.
  if(disc<=ROUND*(B*B+Math.abs(A*C)))return;
  const t=C/(-B+Math.sqrt(disc));if(t>=0&&t<best)best=t;
 }
 function edge(x,y,z,ex,ey,ez){
  const len2=ex*ex+ey*ey+ez*ez,wx=ox-x,wy=oy-y,wz=oz-z,along=(wx*ex+wy*ey+wz*ez)/len2,speed=(dx*ex+dy*ey+dz*ez)/len2;
  const px=wx-along*ex,py=wy-along*ey,pz=wz-along*ez,vx=dx-speed*ex,vy=dy-speed*ey,vz=dz-speed*ez;
  const A=vx*vx+vy*vy+vz*vz,B=px*vx+py*vy+pz*vz,C=px*px+py*py+pz*pz-r2;
  if(!(A>0&&B<0&&C>0))return;
  const disc=B*B-A*C;if(disc<=ROUND*(B*B+Math.abs(A*C)))return;
  const t=C/(-B+Math.sqrt(disc));if(t<0||t>=best)return;
  const u=along+t*speed;if(u>=-EPS&&u<=1+EPS)best=t;
 }
 function face(sign){
  if(sign*normalSpeed>=0)return;
  const t=(sign*r-side)/normalSpeed;if(t<0||t>=best)return;
  if(inside(ox+dx*t-sign*r*nx,oz+dz*t-sign*r*nz))best=t;
 }
 function visit(x0,y0,z0,x1,y1,z1,x2,y2,z2,initialPossible){
  ax=x0;ay=y0;az=z0;bx=x1;by=y1;bz=z1;cx=x2;cy=y2;cz=z2;
  const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;
  nx=uy*vz-uz*vy;ny=uz*vx-ux*vz;nz=ux*vy-uy*vx;const inv=1/Math.hypot(nx,ny,nz);nx*=inv;ny*=inv;nz*=inv;
  side=(ox-ax)*nx+(oy-ay)*ny+(oz-az)*nz;normalSpeed=dx*nx+dy*ny+dz*nz;denXZ=ux*vz-vx*uz;
  if(initialPossible){
   a.set(ax,ay,az);b.set(bx,by,bz);c.set(cx,cy,cz);triangle.closestPointToPoint(point,closest);
   const sx=ox-closest.x,sy=oy-closest.y,sz=oz-closest.z,d2=sx*sx+sy*sy+sz*sz;
   if(d2<=r2+EPS*Math.max(1,r2)){
    initialOverlapSeen=true;
    // Initial overlap is not a depenetration solver. Above the face, distance
    // to this convex triangle may only increase (or remain tangent). Below a
    // face-projected center, upward/tangent escape may cross the initial face;
    // going farther underground is forbidden. Finite-edge/corner overlap must
    // also move away from its closest feature, rather than toward that edge.
    const under=side< -EPS,projectedInside=inside(ox-side*nx,oz-side*nz),away=sx*dx+sy*dy+sz*dz;
    if(under&&projectedInside){if(normalSpeed< -EPS)best=0;return;}
    if(away< -EPS||(side<=EPS&&normalSpeed< -EPS)){best=0;return;}
    return;
   }
  }
  face(1);face(-1);
  edge(ax,ay,az,bx-ax,by-ay,bz-az);edge(bx,by,bz,cx-bx,cy-by,cz-bz);edge(cx,cy,cz,ax-cx,ay-cy,az-cz);
  vertex(ax,ay,az);vertex(bx,by,bz);vertex(cx,cy,cz);
 }
 function limit(origin,end,radius){
  ox=origin?.x;oy=origin?.y;oz=origin?.z;const ex=end?.x,ey=end?.y,ez=end?.z;
  if(!Number.isFinite(ox)||!Number.isFinite(oy)||!Number.isFinite(oz)||!Number.isFinite(ex)||!Number.isFinite(ey)||!Number.isFinite(ez)||!Number.isFinite(radius)||radius<0)throw new TypeError('Finite camera segment and nonnegative radius required');
  dx=ex-ox;dy=ey-oy;dz=ez-oz;r=radius;r2=r*r;best=1;originBelow=false;initialOverlapSeen=false;point.set(ox,oy,oz);
  // Remember the actual field side. If the center is underground and not
  // touching any triangle within its sphere, it is an invalid buried origin;
  // return0 after the geometric overlap checks. Vertical depth alone is not
  // sufficient on a steep face, where normal distance can still be small.
  const gx=(ox-originX)/step,gz=(oz-originZ)/step;
  if(gx>=0&&gz>=0&&gx<=segments&&gz<=segments){
   const ix=Math.min(segments-1,Math.floor(gx)),iz=Math.min(segments-1,Math.floor(gz)),u=gx-ix,v=gz-iz,i=iz*n+ix,A=heights[i],B=heights[i+n],C=heights[i+n+1],D=heights[i+1],h=u+v<=1?A+(D-A)*u+(B-A)*v:C+(B-C)*(1-u)+(D-C)*(1-v);
   if(!Number.isFinite(h))return 0;originBelow=oy<h-EPS;
  }
  const loX=Math.max(0,Math.floor((Math.min(ox,ex)-r-originX)/step)),hiX=Math.min(segments-1,Math.floor((Math.max(ox,ex)+r-originX)/step)),loZ=Math.max(0,Math.floor((Math.min(oz,ez)-r-originZ)/step)),hiZ=Math.min(segments-1,Math.floor((Math.max(oz,ez)+r-originZ)/step));
  for(let iz=loZ;iz<=hiZ;iz++)for(let ix=loX;ix<=hiX;ix++){
   const x=originX+ix*step,z=originZ+iz*step;let near=0,far=best;
   // Segment/cell expanded-XZ slabs are broad phase only. Actual triangles,
   // finite edges and corner spheres determine every returned contact.
   if(dx===0){if(ox<x-r||ox>x+step+r)continue;}else{let t0=(x-r-ox)/dx,t1=(x+step+r-ox)/dx;if(t0>t1){const t=t0;t0=t1;t1=t;}near=Math.max(near,t0);far=Math.min(far,t1);if(near>far)continue;}
   if(dz===0){if(oz<z-r||oz>z+step+r)continue;}else{let t0=(z-r-oz)/dz,t1=(z+step+r-oz)/dz;if(t0>t1){const t=t0;t0=t1;t1=t;}near=Math.max(near,t0);far=Math.min(far,t1);if(near>far)continue;}
   const i=iz*n+ix,A=heights[i],B=heights[i+n],C=heights[i+n+1],D=heights[i+1];if(!Number.isFinite(A)||!Number.isFinite(B)||!Number.isFinite(C)||!Number.isFinite(D))return 0;
   const y0=oy+dy*near,y1=oy+dy*far,minY=Math.min(A,B,C,D),maxY=Math.max(A,B,C,D);if(Math.max(y0,y1)+r<minY||Math.min(y0,y1)-r>maxY)continue;
   const initial=near<=EPS&&oy+r>=minY&&oy-r<=maxY;
   visit(x,A,z,x,B,z+step,x+step,D,z,initial);if(best===0)return 0;
   visit(x+step,D,z,x,B,z+step,x+step,C,z+step,initial);if(best===0)return 0;
  }
  return originBelow&&!initialOverlapSeen?0:best;
 }
 return {limit};
}

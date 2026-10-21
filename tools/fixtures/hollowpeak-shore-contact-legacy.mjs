// Frozen pre-optimization contact arithmetic and live-source behavior.
export const GRID=Object.freeze({size:513,step:1000/512,origin:-500});
const area=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export function createShoreContact(geometry){
 const p=geometry.position,I=geometry.index,owners=geometry.owners,cells=new Map(),S=GRID.step;
 for(let f=0;f<I.length/3;f++){const key=owners[f*3]+','+owners[f*3+1],list=cells.get(key)||[];list.push(f);cells.set(key,list);}
 const contact=(x,z)=>{const gx=(x+500)/S,gz=(z+500)/S,ix=Math.floor(gx),iz=Math.floor(gz),xs=Math.abs(gx-Math.round(gx))<1e-9?[ix,ix-1]:[ix],zs=Math.abs(gz-Math.round(gz))<1e-9?[iz,iz-1]:[iz];let h=-Infinity;for(const cx of xs)for(const cz of zs)for(const f of cells.get(cx+','+cz)||[]){const t=[0,1,2].map(k=>{const i=I[f*3+k]*3;return[p[i],p[i+2],p[i+1]];}),a=area(...t);if(Math.abs(a)<1e-15)continue;const v=[x,z],u=area(v,t[1],t[2])/a,w=area(t[0],v,t[2])/a;if(Math.min(u,w,1-u-w)>=-1e-7)h=Math.max(h,t[0][2]*u+t[1][2]*w+t[2][2]*(1-u-w));}return h;};
 contact.profile='hollowpeak-owned-shore-contact-1';contact.registered=false;contact.physicalAdmissionAccepted=false;return contact;
}

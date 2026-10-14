import fs from'node:fs';import crypto from'node:crypto';
export const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/countryside-fields-c8cfa9c/native-fields.json',import.meta.url))),bytes=fs.readFileSync(new URL('./fixtures/countryside-fields-c8cfa9c/terrain-grid.f32',import.meta.url));
if(crypto.createHash('sha256').update(bytes).digest('hex')!==fixture.terrainSHA256)throw Error('Actual current terrain fixture drift');
const grid=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4),step=1000/512;
export const terrainH=(x,z)=>{const xx=(x+500)/step,zz=(z+500)/step,ix=Math.floor(xx),iz=Math.floor(zz),fx=xx-ix,fz=zz-iz,i=iz*513+ix,a=grid[i],b=grid[i+513],c=grid[i+514],d=grid[i+1];return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);};
export const options={terrainH,riverZ:x=>120+Math.sin(x*.012)*45,riverLevel:x=>.5-x*.009,streamX:z=>118+Math.sin(z*.03)*14+Math.sin(z*.011+3)*8,forestPoints:fixture.forest,countrysideTracks:fixture.tracks,wetAt:()=>false,chalkAt:()=>false};

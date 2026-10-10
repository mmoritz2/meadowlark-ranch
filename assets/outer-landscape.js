import {outerWatershedHeight,reseatOuterWoodland} from './outer-watershed.mjs?v=northern-watershed-2';
import {createOuterRockData,retainRockClearWoodland} from './outer-rock-clusters.mjs?v=outer-rock-clusters-3';
import {patchOuterGroundSurface} from './outer-ground-surface.mjs?v=outer-ground-sward-5';
import {outerCountrysideRelief} from './outer-countryside-relief.mjs?v=outer-countryside-relief-3';
import {selectOuterWoodland,OUTER_GROVES_GLSL} from './outer-woodland.mjs?v=branching-groves-2';
// Original foothills connect the fixed riding terrain to the distant skyline.
// The innermost ring copies every terrain edge vertex; nothing inside is altered.
import {regionalProfileAt,REGIONAL_WEIGHTS_GLSL} from './regional-landscape.mjs?v=regional-relief-1';
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
function hash(x,z){let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;}
function noise(x,z){const a=Math.floor(x),b=Math.floor(z),u=smooth(0,1,x-a),v=smooth(0,1,z-b);return mix(mix(hash(a,b),hash(a+1,b),u),mix(hash(a,b+1),hash(a+1,b+1),u),v);}
// The outer terrain and its trees share the mountain haze. Blend from normal
// scene fog at the exact terrain seam, so the join cannot become a colour line.
export function patchOuterFog(shader,blend='1.0'){
 shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',`
  #ifdef USE_FOG
   float outerFogBlend=${blend};
   #ifdef FOG_EXP2
    float outerFog=1.0-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth*mix(1.0,.70,outerFogBlend));
   #else
    float outerFog=smoothstep(fogNear,fogFar,vFogDepth);
   #endif
   gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,min(mix(1.0,.94,outerFogBlend),outerFog));
  #endif`);
}
// Only this cloned outer material receives the directional climate. The riding
// terrain keeps its own local biomes, and the shared seam still has zero extension.
export function patchOuterRegions(shader){
 const initial=shader.fragmentShader;
 const extension=/vec2 compass=normalize\(p\);[\s\S]*?canopy=max\(canopy,extend\*smoothstep\(\.50,\.72,tNoise\(p\*\.011\+81\.0\)\)\*\(1\.0-snow\)\*\(1\.0-arid\)\*\.68\);/;
 if(!extension.test(shader.fragmentShader))return false;
 shader.fragmentShader=REGIONAL_WEIGHTS_GLSL+'\n'+OUTER_GROVES_GLSL+'\n'+shader.fragmentShader.replace(extension,`
        // OUTER_GROVE_GROUND_V1: low wooded foothills share the tree layout.
        vec4 outerRegion=regionalWeights(atan(p.y,p.x));
        float cold=outerRegion.x,arid=outerRegion.y;
        float outerNorth=extend*cold;
        float outerGrove=outerGroveWeight(p);
        canyon=max(canyon,extend*arid*.94);
        // These are low foothills, not an extension of Hollowpeak's snowfield.
        // Leave the exact riding seam intact and fade out any inherited powder.
        snow*=1.0-outerNorth;
        // Bare mineral belongs on exposed slopes. The former constant northern
        // scree floor washed even flat meadow and woodland into grey gravel.
        float outerExposure=smoothstep(.25,.54,grade+(outerTuft.x-.5)*.10)*(1.0-outerGrove*.72);
        scree=max(scree,extend*outerExposure*.50);
        stone=max(stone,extend*smoothstep(.46,.84,grade+(outerFold.x-.5)*.12)*(1.0-outerGrove*.55)*.68);
        rocky=max(scree,stone);
        bank*=1.0-extend;wet*=1.0-extend;wear*=1.0-extend;
        // Thin, drained soil follows sloping shoulders; pasture remains dominant.
        float outerBank=extend*(1.0-outerGrove*.86)*smoothstep(.14,.34,grade+(outerTuft.x-.5)*.06)
          *smoothstep(.42,.72,outerFold.x*.70+macro*.30)*(.30+.22*arid);
        float outerWoodland=(.58*cold+.84*outerRegion.z+.09*arid)*(1.0-outerRegion.w*.60);
        // Replace the edge-clamped forest mask in every outer sector. Grove cores,
        // younger fringes and open meadow now follow the same authored shapes.
        canopy=mix(canopy,outerGrove*clamp(outerWoodland*1.3,0.0,1.0),extend);
        vec3 outerSward=mix(vec3(.86,1.02,.84),vec3(.76,.90,.76),outerGrove);
        turf*=mix(vec3(1.0),outerSward,extend*(1.0-arid));`);
 if(!patchOuterGroundSurface(shader)){shader.fragmentShader=initial;return false;}
 return true;
}
export function outerDistance(x,z){return Math.hypot(Math.max(0,Math.abs(x)-500),Math.max(0,Math.abs(z)-500));}
function legacyFoothillHeight(x,z,heightAt){
 const d=outerDistance(x,z),edge=heightAt(Math.max(-500,Math.min(500,x)),Math.max(-500,Math.min(500,z)));
 if(!d)return edge;
 const warp=(noise(x*.0038+41,z*.0038-13)-.5)*75;
 const broad=noise((x+warp)*.0051-8,(z-warp)*.0051+19);
 const folds=1-Math.abs(noise(x*.009+7,z*.007-31)*2-1);
 const region=regionalProfileAt(x,z),regional=smooth(20,145,d);
 const ridges=(7+24*broad+8*folds*folds)*smooth(0,145,d)*(1-smooth(370,950,d))*mix(1,region.foothillScale,regional);
 const shoulders=(noise(x*.015+51,z*.013+16)-.5)*6*smooth(12,65,d)*(1-smooth(260,650,d))*mix(1,region.foothillRoughness,regional);
 const legacyHeight=edge*(1-smooth(20,100,d))+ridges+shoulders-24*smooth(650,1150,d)
  +outerCountrysideRelief(x,z)*(1-region.valley*.62);
 return legacyHeight;
}
export function foothillHeight(x,z,heightAt){return outerWatershedHeight(x,z,legacyFoothillHeight(x,z,heightAt));}
const WOODLAND_ANCHOR_BANDS=[[0,2048],[4,2048],[12,1024],[26,1024],[42,512],[60,512],[80,512],[100,512],[122,512],[144,512],[168,512],[192,512],[216,512],[242,512],[268,512],[294,512],[322,512],[350,512],[380,512],[410,512],[450,512],[510,512],[590,512],[730,512],[950,512],[1200,512]];
// The original plain sampling mesh anchors woodland identities without making
// an extra render geometry, material, UUID or ambient random call.
function woodlandAnchorMesh(heightAt){const p=[],indices=[],rows=[];for(const [distance,n]of WOODLAND_ANCHOR_BANDS){rows.push({start:p.length/3,n});for(let i=0;i<=n;i++){const [bx,bz]=edgePoint(i,n),scale=1+distance/500,x=bx*scale,z=bz*scale;p.push(x,legacyFoothillHeight(x,z,heightAt),z);}}for(let j=0;j<rows.length-1;j++){const a=rows[j],b=rows[j+1];for(let i=0;i<b.n;i++){const c=b.start+i,d=c+1,k=a.n/b.n,x=a.start+i*k;if(k===1)indices.push(x,x+1,c,x+1,d,c);else indices.push(x,x+1,c,x+1,d,c,x+1,x+2,d);}}return{positions:new Float32Array(p),index:new Uint16Array(indices)};}
const BANDS=[[0,2048],[4,2048],[12,1024],[26,1024],[42,512],[58,512],[74,512],[90,512],[106,512],[122,512],[138,512],[154,512],[170,512],[186,512],[202,512],[218,512],[234,512],[250,512],[266,512],[282,512],[298,512],[314,512],[330,512],[346,512],[362,512],[378,512],[394,512],[410,512],[450,512],[510,512],[590,512],[730,512],[950,512],[1200,512]];
function edgePoint(i,n){const t=i/n*4,side=Math.min(3,Math.floor(t)),u=(t-side)*1000;return side===0?[-500+u,-500]:side===1?[500,-500+u]:side===2?[500-u,500]:[-500,500-u];}
export function createOuterLandscape({THREE:T,scene,heightAt,groundMesh}){
 const old=scene.getObjectByName('Horizon ground disc');
 const source=groundMesh.geometry,sourceColor=source.attributes.color,segments=Math.round(Math.sqrt(source.attributes.position.count))-1;
 const color=new T.Color(),p=[],colors=[],uv=[],indices=[],rows=[];
 const boundaryColor=(x,z)=>{const gx=(x+500)/1000*segments,gz=(z+500)/1000*segments,ix=Math.min(segments-1,Math.floor(gx)),iz=Math.min(segments-1,Math.floor(gz)),fx=gx-ix,fz=gz-iz;
  const a=iz*(segments+1)+ix,b=a+segments+1,c=b+1,d=a+1;
  for(let k=0;k<3;k++){const values=sourceColor.array;const value=fx+fz<=1?values[a*3+k]+(values[d*3+k]-values[a*3+k])*fx+(values[b*3+k]-values[a*3+k])*fz:values[c*3+k]+(values[b*3+k]-values[c*3+k])*(1-fx)+(values[d*3+k]-values[c*3+k])*(1-fz);color[['r','g','b'][k]]=value;}
 };
 for(const [distance,n]of BANDS){const start=p.length/3;rows.push({start,n});for(let i=0;i<=n;i++){
  const [bx,bz]=edgePoint(i,n),scale=1+distance/500,x=bx*scale,z=bz*scale,y=foothillHeight(x,z,heightAt);p.push(x,y,z);uv.push((x+500)/1000,(500-z)/1000);
  boundaryColor(bx,bz);
  const lum=.91+noise(x*.032,z*.032)*.09,t=smooth(0,90,distance),regional=smooth(20,145,distance),region=regionalProfileAt(x,z);
  // These are restrained multipliers of the photographed terrain, not a second
  // painted surface: warm dry shoulders, cool mineral north, muted green pasture.
  const r=lum*.94*(1+regional*(.08*region.dry+.03*region.north-.03*region.pastoral));
  const g=lum*.98*(1+regional*(-.14*region.dry+.03*region.north-.01*region.pastoral));
  const b=lum*.89*(1+regional*(-.22*region.dry+.16*region.north-.03*region.pastoral));
  colors.push(mix(color.r,r,t),mix(color.g,g,t),mix(color.b,b,t));
 }}
 for(let j=0;j<rows.length-1;j++){const a=rows[j],b=rows[j+1];for(let i=0;i<b.n;i++){
  const c=b.start+i,d=c+1,k=a.n/b.n,x=a.start+i*k;
  if(k===1)indices.push(x,x+1,c,x+1,d,c);
  else indices.push(x,x+1,c,x+1,d,c,x+1,x+2,d);
 }}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(new Float32Array(p.length),3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 // Match the original edge normals at the shared vertices, including stream cuts.
 const normals=geometry.attributes.normal,sourceNormal=source.attributes.normal;
 for(let i=0;i<=BANDS[0][1];i++){const [x,z]=edgePoint(i,BANDS[0][1]),ix=Math.round((x+500)/1000*segments),iz=Math.round((z+500)/1000*segments),id=iz*(segments+1)+ix;normals.setXYZ(i,sourceNormal.getX(id),sourceNormal.getY(id),sourceNormal.getZ(id));}
 const base=groundMesh.material,material=base.clone();material.name='Continuous countryside | ground';material.onBeforeCompile=(shader,renderer)=>{base.onBeforeCompile(shader,renderer);patchOuterRegions(shader);patchOuterFog(shader,'smoothstep(0.0,58.0,length(max(abs(terrainPosition.xz)-vec2(500.0),vec2(0.0))))');};material.customProgramCacheKey=()=>base.customProgramCacheKey()+'-outer-ground-sward-5';material.defaultAttributeValues={...base.defaultAttributeValues};material.defines={...base.defines,CHEAP_GROUND:1,OUTER_LANDSCAPE:1};material.bumpMap=null;material.bumpScale=0;
 const mesh=old||new T.Mesh();if(old){old.geometry.dispose();old.material.map?.dispose();old.material.dispose();}else scene.add(mesh);
 mesh.geometry=geometry;mesh.material=material;mesh.name='Continuous outer countryside';mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.scale.set(1,1,1);mesh.castShadow=false;mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;mesh.updateMatrix();
 // Sample the actual mesh triangles so every woodland root touches the new
 // surface. A separate hash stream leaves all in-basin placement unchanged.
 const anchorMesh=woodlandAnchorMesh(heightAt);
 const anchorSites=selectOuterWoodland({...anchorMesh,regionalProfileAt});
 const originalWoodlandSites=reseatOuterWoodland(anchorSites,geometry.attributes.position.array,geometry.index.array);
 const rockClusterData=createOuterRockData({positions:geometry.attributes.position.array,index:geometry.index.array});
 const {kept:woodlandSites,excluded:excludedRoots}=retainRockClearWoodland(originalWoodlandSites,rockClusterData);
 const rockClusters={...rockClusterData.stats,ready:false,excludedRoots,originalWoodlandTrees:originalWoodlandSites.length};
 const stats={woodlandTrees:woodlandSites.length,triangles:indices.length/3,vertices:p.length/3,draws:1,bands:BANDS.length,innerHalfSize:500,outerHalfSize:1700};
 return{mesh,woodlandSites,rockClusterData,rockClusters,edgeCount:BANDS[0][1]+1,stats};
}

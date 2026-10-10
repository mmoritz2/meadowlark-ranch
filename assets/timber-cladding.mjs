/* Original board construction using the resident Poly Haven CC0 photograph.
 * The scan contains horizontal plank joints. Sample only the interiors of six
 * photographed boards, so those joints cannot cross the modeled vertical
 * battens or a structural beam. All PBR channels use the same coordinates.
 * Source: assets/textures/builder/manifest.json, weathered_brown_planks.
 */
export const TIMBER_STRIP_CENTRES = Object.freeze([.924,.770,.616,.462,.308,.155]);
export const TIMBER_STRIP_WIDTH = .042;

export function timberSampleUV(u,v) {
  const board=Math.floor(v), hash=((board*17)%6+6)%6;
  const shift=((board*.61803398875)%1+1)%1;
  return [u+shift,TIMBER_STRIP_CENTRES[hash]+(v-board-.5)*TIMBER_STRIP_WIDTH];
}

// U follows the long wood fibres; V is one unit per physical board. This is
// evaluated before each part's rotation, including diagonal door braces.
export function setTimberBoxUV(geometry,{width,height,depth,x=0,y=0,z=0,
  siding=false,lengthMetres=2.4,boardMetres=.19}={}) {
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
  const dims=[width,height,depth],origin=[x,y,z];
  const along=siding?1:(height>width&&height>depth?1:depth>width?2:0);
  const seed=Math.floor(x*7+y*11+z*13);
  for(let i=0;i<p.count;i++) {
    const pos=[p.getX(i),p.getY(i),p.getZ(i)],normal=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))];
    const other=[0,1,2].filter(a=>a!==along);
    const across=normal[other[0]]>normal[other[1]]?other[1]:other[0];
    const u=(pos[along]+origin[along])/lengthMetres;
    let v;
    if(siding) {
      // Narrow battens sample one board interior instead of splitting down
      // their center where the wider backing wall has its board boundary.
      v=dims[across]<.065?Math.floor(origin[across]/.30)+.5+pos[across]/.30:(pos[across]+origin[across])/.30;
    } else {
      const pitch=dims[across]>.32?boardMetres:Math.max(.025,dims[across]*1.06);
      v=seed+.5+pos[across]/pitch;
    }
    uv.setXY(i,u,v);
  }
  return geometry;
}

export const TIMBER_GRAIN_GLSL = /* glsl */`
vec2 ranchTimberUV(vec2 uv) {
  float board=floor(uv.y);
  float selectBoard=mod(board*17.0,6.0);
  float centre=selectBoard<.5?.924:selectBoard<1.5?.770:selectBoard<2.5?.616:selectBoard<3.5?.462:selectBoard<4.5?.308:.155;
  return vec2(uv.x+fract(board*.61803398875),centre+(fract(uv.y)-.5)*.042);
}
vec4 ranchTimberSample(sampler2D image,vec2 uv) {
  // Derivatives come from the continuous board coordinates, not their
  // discontinuous strip offsets. Bound the footprint to stay inside a board
  // photograph even when this building occupies only a few distant pixels.
  vec2 dx=dFdx(uv)*vec2(1.0,.042),dy=dFdy(uv)*vec2(1.0,.042);
  float footprint=max(length(dx),length(dy));
  float limit=min(1.0,.009/max(footprint,.000001));
  return textureGrad(image,ranchTimberUV(uv),dx*limit,dy*limit);
}
`;

export function applyTimberGrain(material,THREE) {
  material.userData.timberGrain='board-interior-v1';
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=function(shader,renderer) {
    previous?.call(this,shader,renderer);
    shader.fragmentShader=TIMBER_GRAIN_GLSL+shader.fragmentShader;
    for(const [chunk,sampler,uv]of[
      ['map_fragment','map','vMapUv'],['normal_fragment_maps','normalMap','vNormalMapUv'],
      ['roughnessmap_fragment','roughnessMap','vRoughnessMapUv'],['aomap_fragment','aoMap','vAoMapUv'],
    ]) {
      const sample=`texture2D( ${sampler}, ${uv} )`;
      const body=THREE.ShaderChunk[chunk];
      if(!body.includes(sample))throw new Error('Timber shader chunk changed: '+chunk);
      shader.fragmentShader=shader.fragmentShader.replace('#include <'+chunk+'>',body.replaceAll(sample,`ranchTimberSample( ${sampler}, ${uv} )`));
    }
  };
  material.customProgramCacheKey=()=> 'ranch-timber-board-interiors-v1';
  material.needsUpdate=true;
  return material;
}

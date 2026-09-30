import * as THREE from 'three';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';

// Read the existing scene depth immediately after RenderPass. There is no second
// geometry render: alpha-tested foliage, animated horses and buildings all share
// the same depth and silhouette as the visible frame.
export function createWorldFinish({composer, camera}) {
  for (const target of [composer.renderTarget1, composer.renderTarget2]) {
    target.depthTexture = new THREE.DepthTexture(target.width, target.height, THREE.UnsignedIntType);
    target.depthTexture.name = 'World contact depth';
    target.depthTexture.minFilter = target.depthTexture.magFilter = THREE.NearestFilter;
  }
  const pass = new ShaderPass({
    name: 'World contact shading',
    uniforms: {
      tDiffuse: {value: null}, tDepth: {value: null},
      resolution: {value: new THREE.Vector2()},
      inverseProjection: {value: new THREE.Matrix4()},
      projection: {value: new THREE.Matrix4()},
      radius: {value: 1.15}, strength: {value: .72}, sampleCount: {value: 12},
    },
    vertexShader: `varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `precision highp float;
      varying vec2 vUv;
      uniform sampler2D tDiffuse, tDepth;
      uniform vec2 resolution;
      uniform mat4 inverseProjection, projection;
      uniform float radius, strength;
      uniform int sampleCount;
      vec3 viewPoint(vec2 uv,float depth){
        vec4 p=inverseProjection*vec4(uv*2.0-1.0,depth*2.0-1.0,1.0);
        return p.xyz/p.w;
      }
      vec3 at(vec2 uv){return viewPoint(uv,texture2D(tDepth,uv).x);}
      void main(){
        vec4 source=texture2D(tDiffuse,vUv);
        float depth=texture2D(tDepth,vUv).x;
        if(depth>=.999999){gl_FragColor=source;return;}
        vec3 p=viewPoint(vUv,depth);
        vec2 texel=1.0/resolution;
        // Choose the nearest neighbour on each axis: derivatives across a horse's
        // silhouette would invent a tilted normal and put a dark halo on the sky.
        vec3 l=at(vUv-vec2(texel.x,0.0)), r=at(vUv+vec2(texel.x,0.0));
        vec3 b=at(vUv-vec2(0.0,texel.y)), t=at(vUv+vec2(0.0,texel.y));
        vec3 dx=abs(l.z-p.z)<abs(r.z-p.z)?p-l:r-p;
        vec3 dy=abs(b.z-p.z)<abs(t.z-p.z)?p-b:t-p;
        vec3 n=normalize(cross(dx,dy));
        if(dot(n,-p)<0.0)n=-n;
        float worldRadius=min(radius,max(.22,-p.z*.055));
        vec2 screenRadius=vec2(projection[0][0],projection[1][1])*worldRadius/max(-p.z,.1)*.5;
        screenRadius=min(screenRadius,vec2(90.0)/resolution);
        float occlusion=0.0;
        // Fixed symmetric disk: no temporal noise, so slow riding and photo mode
        // do not shimmer. Samples outside the image never clamp to a false wall.
        for(int i=0;i<12;i++){
          if(i>=sampleCount)break;
          float f=(float(i)+.5)/float(sampleCount);
          float a=float(i)*2.39996323;
          vec2 uv=vUv+vec2(cos(a),sin(a))*sqrt(f)*screenRadius;
          if(uv.x<=0.0||uv.y<=0.0||uv.x>=1.0||uv.y>=1.0)continue;
          float sd=texture2D(tDepth,uv).x;
          if(sd>=.999999)continue;
          vec3 delta=viewPoint(uv,sd)-p;
          float d=length(delta);
          float horizon=max(0.0,dot(n,delta)/max(d,.001)-.075);
          float falloff=1.0-smoothstep(worldRadius*.20,worldRadius*1.7,d);
          occlusion+=horizon*falloff;
        }
        float ao=1.0-clamp(occlusion/float(sampleCount)*strength*3.4,0.0,.34);
        ao=mix(1.0,ao,1.0-smoothstep(65.0,150.0,-p.z));
        // Slightly warm bounce in contact shade, leaving emissive windows intact.
        float emissive=1.0-smoothstep(1.8,4.0,max(source.r,max(source.g,source.b)));
        vec3 shade=mix(vec3(1.0),vec3(ao,ao*.992+.008,ao*.975+.025),emissive);
        gl_FragColor=vec4(source.rgb*shade,source.a);
      }`,
  });
  pass.material.depthTest = false;
  pass.material.depthWrite = false;
  pass.setSize = (w,h) => pass.uniforms.resolution.value.set(w,h);
  const render = pass.render.bind(pass);
  pass.render = (renderer, write, read, ...args) => {
    pass.uniforms.tDepth.value = read.depthTexture;
    pass.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    pass.uniforms.projection.value.copy(camera.projectionMatrix);
    render(renderer, write, read, ...args);
  };
  composer.addPass(pass);
  return {
    pass,
    setQuality(tier) {
      pass.enabled = tier !== 'low';
      pass.uniforms.sampleCount.value = tier === 'high' ? 12 : 6;
      pass.uniforms.strength.value = tier === 'high' ? .72 : .60;
    },
  };
}

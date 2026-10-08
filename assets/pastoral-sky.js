// Original art-directed sky. Environment lighting is baked separately by Sky/PMREM.
// Keeping display colours here prevents exposure from washing a blue sky to grey.
export function createPastoralSky(THREE) {
  const color = hex => new THREE.Color(hex);
  // A repeatable smooth noise field drives two world-space cloud layers,
  // including the water reflection camera. It needs no external sky image.
  const size=256,data=new Uint8Array(size*size*4);
  const hash=(x,y)=>{let n=Math.imul(x&255,374761393)^Math.imul(y&255,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>24);};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4;data[i]=hash(x,y);data[i+1]=hash(x+37,y+17);data[i+2]=0;data[i+3]=255;}
  const cloudNoiseTexture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  cloudNoiseTexture.wrapS=cloudNoiseTexture.wrapT=THREE.RepeatWrapping;
  cloudNoiseTexture.generateMipmaps=true;cloudNoiseTexture.minFilter=THREE.LinearMipmapLinearFilter;
  cloudNoiseTexture.magFilter=THREE.LinearFilter;cloudNoiseTexture.needsUpdate=true;
  return new THREE.ShaderMaterial({
    name: 'Meadowlark daylight', side: THREE.BackSide, depthWrite: false,
    toneMapped: false,
    uniforms: {
      cloudField:{value:cloudNoiseTexture},cloudSteps:{value:12},
      sunPosition: {value: new THREE.Vector3(0.4, 0.7, 0.3)},
      day: {value: 1}, golden: {value: 0}, night: {value: 0}, rain: {value: 0}, time: {value: 0},
      zenith: {value: color('#347fae')}, horizon: {value: color('#afd0e1')},
      dusk: {value: color('#edb18a')}, darkTop: {value: color('#09162e')},
      darkHorizon: {value: color('#253857')}
    },
    vertexShader: `varying vec3 vDirection;
      void main(){vDirection=position;
        vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);
        gl_Position=p.xyww;}`,
    fragmentShader: `varying vec3 vDirection;
      uniform vec3 sunPosition,zenith,horizon,dusk,darkTop,darkHorizon;
      uniform float day,golden,night,rain,time;uniform sampler2D cloudField;uniform int cloudSteps;
      // The cloud field is world-anchored, so the main and reflected camera see
      // the same sky. Smooth deterministic samples replace per-pixel ray jitter.
      vec2 fieldNoiseChannels(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return texture2D(cloudField,(i+f+.5)/256.).rg;
      }
      float fieldNoise(vec2 p){return fieldNoiseChannels(p).r;}
      float cloudNoise(vec2 p){
        float coarse=fieldNoise(p)*.57+fieldNoise(p*2.03+11.)*.29+fieldNoise(p*4.07-7.)*.14;
        // Fine detail fades with pixel footprint instead of producing grain at
        // low resolution. All settings retain the same broad cloud placement.
        float detail=1.-smoothstep(.12,.45,max(length(dFdx(p)),length(dFdy(p))));
        if(cloudSteps>=8)coarse+=(fieldNoise(p*8.13+27.)-.5)*.045*detail;
        if(cloudSteps>=12)coarse+=(fieldNoise(p*16.3-19.)-.5)*.018*detail;
        return coarse;
      }
      vec4 cloudLayer(vec3 d,vec3 sd,float altitude,bool highLayer){
        if(d.y<=.012||cameraPosition.y>=altitude-5.)return vec4(0.);
        float distanceToLayer=(altitude-cameraPosition.y)/d.y;
        vec2 world=cameraPosition.xz+d.xz*distanceToLayer;
        vec2 wind=vec2(time*.0035,time*.0012);
        vec2 p=world*(highLayer?.0011:.0042)+wind;
        float shape,alpha;
        if(highLayer){
          p=mat2(.94,-.34,.34,.94)*p;
          vec2 warp=vec2(fieldNoise(p*.63+21.),fieldNoise(p*.71-17.))-.5;
          // Existing seeded channels vary the length and thickness of wisps.
          // One RG sample replaces the former red-only break sample.
          vec2 shapeField=fieldNoiseChannels(p*.48+9.);
          vec2 strandScale=vec2(mix(.78,1.14,shapeField.g),mix(2.65,4.20,shapeField.r));
          shape=cloudNoise(p*strandScale+warp*1.1+vec2(warp.y,-warp.x)*.45);
          float breaks=smoothstep(.30,.70,shapeField.r)*mix(.42,1.,smoothstep(.18,.72,shapeField.g));
          alpha=smoothstep(.48,.76,shape)*breaks*.48*(1.-rain*.55);
        }else{
          vec2 warp=vec2(fieldNoise(p*.42+23.),fieldNoise(p*.42-9.))-.5;
          shape=cloudNoise(p+warp*1.6);
          float coverage=mix(.54,.36,rain);
          alpha=smoothstep(coverage,coverage+.22,shape)*mix(.78,.94,rain);
        }
        alpha*=smoothstep(.025,.16,d.y);
        float daylight=smoothstep(0.,.55,day);
        float body=smoothstep(.53,.80,shape);
        vec3 lit=mix(vec3(.59,.67,.72),vec3(.90,.92,.94),highLayer? .92:1.-body*.48);
        lit+=mix(vec3(.07,.06,.04),vec3(.086,.042,.055),highLayer?.42:0.)*pow(max(dot(d,sd),0.),12.);
        lit=mix(lit,lit*vec3(1.14,.83,.66),golden*.70);
        lit=mix(vec3(.008,.014,.027),lit,daylight);
        lit*=1.-rain*.28;
        return vec4(lit*alpha,alpha);
      }
      void main(){
        vec3 d=normalize(vDirection);
        float h=pow(max(d.y,0.0),0.62);
        vec3 sky=mix(horizon,zenith,smoothstep(0.0,0.80,h));
        sky=mix(sky,dusk,golden*pow(1.0-h,3.0)*0.72);
        float daylight=smoothstep(0.0,0.55,day);
        sky=mix(mix(darkHorizon,darkTop,h),sky,daylight);
        vec3 sd=normalize(sunPosition);
        // Thin high cloud behind smaller fair-weather banks. Analytic layers
        // have no marching-step bands and remain quiet while the camera moves.
        vec4 high=cloudLayer(d,sd,1100.,true);
        vec4 low=cloudLayer(d,sd,420.,false);
        sky=sky*(1.-high.a)+high.rgb;
        sky=sky*(1.-low.a)+low.rgb;
        float cloud=1.-(1.-high.a)*(1.-low.a);
        float sunDot=max(dot(d,normalize(sunPosition)),0.0);
        sky+=vec3(0.18,0.14,0.09)*pow(sunDot,18.0)*day*(1.0-rain)*(1.-cloud);
        sky=mix(sky,vec3(1.0,0.91,0.68),smoothstep(0.99976,0.99987,sunDot)*day*(1.0-rain)*(1.-cloud));
        float l=dot(sky,vec3(0.2126,0.7152,0.0722));
        sky=mix(sky,vec3(l)*0.72,rain*0.62);
        gl_FragColor=vec4(sky,1.0);
        #include <colorspace_fragment>
      }`
  });
}

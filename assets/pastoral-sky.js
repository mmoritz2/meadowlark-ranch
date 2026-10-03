// Original art-directed sky. Environment lighting is baked separately by Sky/PMREM.
// Keeping display colours here prevents exposure from washing a blue sky to grey.
export function createPastoralSky(THREE) {
  const color = hex => new THREE.Color(hex);
  // Two noise channels encode adjacent slices of a repeatable 3D field. Cloud
  // density is sampled in world space, including by the water reflection camera.
  const size=256,data=new Uint8Array(size*size*4);
  const hash=(x,y)=>{let n=Math.imul(x&255,374761393)^Math.imul(y&255,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>24);};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4;data[i]=hash(x,y);data[i+1]=hash(x+37,y+17);data[i+2]=0;data[i+3]=255;}
  const cloudNoiseTexture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  cloudNoiseTexture.wrapS=cloudNoiseTexture.wrapT=THREE.RepeatWrapping;
  cloudNoiseTexture.minFilter=cloudNoiseTexture.magFilter=THREE.LinearFilter;cloudNoiseTexture.needsUpdate=true;
  return new THREE.ShaderMaterial({
    name: 'Meadowlark daylight', side: THREE.BackSide, depthWrite: false,
    toneMapped: false,
    uniforms: {
      cloudField:{value:cloudNoiseTexture},cloudSteps:{value:12},
      sunPosition: {value: new THREE.Vector3(0.4, 0.7, 0.3)},
      day: {value: 1}, golden: {value: 0}, night: {value: 0}, rain: {value: 0}, time: {value: 0},
      zenith: {value: color('#377ead')}, horizon: {value: color('#b4d0de')},
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
      float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
      float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float cloudNoise(vec2 p){return noise2(p)*0.56+noise2(p*2.03+5.2)*0.27+noise2(p*4.11)*0.12+noise2(p*8.2)*0.05;}
      float volumeNoise(vec3 p){
        vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        vec2 uv=i.xy+vec2(37.,17.)*i.z+f.xy;
        vec2 n=texture2D(cloudField,(uv+.5)/256.).rg;return mix(n.r,n.g,f.z);
      }
      float cloudDensity(vec3 p){
        float h=(p.y-150.)/85.;
        float profile=smoothstep(0.,.14,h)*(1.-smoothstep(.52,1.,h));
        vec3 q=vec3(p.x*.006,p.y*.014,p.z*.006)+vec3(time*.005,0.,time*.0015);
        float shape=volumeNoise(q)*.55+volumeNoise(q*2.03+11.)*.30+volumeNoise(q*4.07-7.)*.15;
        return max(0.,shape-.48)*profile*3.6;
      }
      vec4 clouds(vec3 d,vec3 sd){
        if(d.y<.015)return vec4(0.);
        float start=max(0.,(150.-cameraPosition.y)/d.y),end=(235.-cameraPosition.y)/d.y;
        if(end<=start||start>4200.)return vec4(0.);
        float stepLength=min(240.,(end-start)/float(cloudSteps));
        vec3 rgb=vec3(0.);float opacity=0.;
        float jitter=hash(floor(gl_FragCoord.xy))*.8+.1;
        for(int i=0;i<12;i++){
          if(i>=cloudSteps||opacity>.98)break;
          vec3 p=cameraPosition+d*(start+(float(i)+jitter)*stepLength);
          float density=cloudDensity(p);if(density<.005)continue;
          float sunLight=exp(-cloudDensity(p+sd*32.)*2.8);
          float upper=clamp((p.y-150.)/85.,0.,1.);
          vec3 lit=mix(vec3(.20,.27,.35),vec3(.88,.90,.92),sunLight*.72+upper*.20);
          lit+=vec3(.12,.11,.08)*pow(max(dot(d,sd),0.),12.)*sunLight;
          lit=mix(lit,lit*vec3(1.20,.82,.60),golden*.72);
          lit=mix(vec3(.016,.024,.041),lit,smoothstep(0.,.55,day));
          lit=mix(lit,lit*.64,rain*.65);
          float a=(1.-exp(-density*stepLength*.055))*(1.-opacity);
          rgb+=lit*a;opacity+=a;
        }
        float horizonFade=smoothstep(.035,.20,d.y);return vec4(rgb*horizonFade,opacity*horizonFade);
      }
      void main(){
        vec3 d=normalize(vDirection);
        float h=pow(max(d.y,0.0),0.62);
        vec3 sky=mix(horizon,zenith,smoothstep(0.0,0.80,h));
        sky=mix(sky,dusk,golden*pow(1.0-h,3.0)*0.72);
        float daylight=smoothstep(0.0,0.55,day);
        sky=mix(mix(darkHorizon,darkTop,h),sky,daylight);
        vec3 sd=normalize(sunPosition);
        vec4 volume=clouds(d,sd);float cloud=volume.a;
        sky=sky*(1.-cloud)+volume.rgb;
        // High cirrus travels independently above the lower cloud bank.
        vec2 cirrusUV=d.xz/max(d.y+.12,.08)*vec2(1.3,6.0)+vec2(time*.003,9.0);
        float cirrus=smoothstep(.62,.84,cloudNoise(cirrusUV))*smoothstep(.10,.48,d.y)*.14;
        sky=mix(sky,mix(vec3(.08,.10,.15),vec3(.79,.85,.88),daylight),cirrus*(1.0-cloud));
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

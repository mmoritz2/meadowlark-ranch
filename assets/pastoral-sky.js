// Original art-directed sky. Environment lighting is baked separately by Sky/PMREM.
// Keeping display colours here prevents exposure from washing a blue sky to grey.
export function createPastoralSky(THREE) {
  const color = hex => new THREE.Color(hex);
  return new THREE.ShaderMaterial({
    name: 'Meadowlark daylight', side: THREE.BackSide, depthWrite: false,
    toneMapped: false,
    uniforms: {
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
      uniform float day,golden,night,rain,time;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float cloudNoise(vec2 p){return noise2(p)*0.56+noise2(p*2.03+5.2)*0.27+noise2(p*4.11)*0.12+noise2(p*8.2)*0.05;}
      void main(){
        vec3 d=normalize(vDirection);
        float h=pow(max(d.y,0.0),0.62);
        vec3 sky=mix(horizon,zenith,smoothstep(0.0,0.80,h));
        sky=mix(sky,dusk,golden*pow(1.0-h,3.0)*0.72);
        float daylight=smoothstep(0.0,0.55,day);
        sky=mix(mix(darkHorizon,darkTop,h),sky,daylight);
        // Soft cloud banks, continuous in direction instead of solid floating puffs.
        vec2 cloudUV=d.xz/max(d.y+0.19,0.08)*1.8+vec2(time*0.014,time*0.004);
        float cn=cloudNoise(cloudUV)*.88+noise2(cloudUV*16.4)*.08+noise2(cloudUV*32.7)*.04;
        float cloud=smoothstep(0.54,0.70,cn)*smoothstep(0.015,0.13,d.y);
        float thickness=cloudNoise(cloudUV+vec2(.17,.26));
        vec3 cloudColor=mix(vec3(0.55,0.64,0.70),vec3(0.96,0.97,0.95),smoothstep(.39,.67,thickness));
        cloudColor=mix(cloudColor,vec3(0.95,0.66,0.42),golden*0.45);
        cloudColor=mix(vec3(0.035,0.047,0.075),cloudColor,daylight);
        sky=mix(sky,cloudColor,cloud*(1.0-rain*0.3));
        float sunDot=max(dot(d,normalize(sunPosition)),0.0);
        sky+=vec3(0.18,0.14,0.09)*pow(sunDot,18.0)*day*(1.0-rain);
        sky=mix(sky,vec3(1.0,0.91,0.68),smoothstep(0.99976,0.99987,sunDot)*day*(1.0-rain));
        float l=dot(sky,vec3(0.2126,0.7152,0.0722));
        sky=mix(sky,vec3(l)*0.72,rain*0.62);
        gl_FragColor=vec4(sky,1.0);
        #include <colorspace_fragment>
      }`
  });
}

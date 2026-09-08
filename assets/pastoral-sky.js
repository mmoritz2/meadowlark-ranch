// Original art-directed sky. Environment lighting is baked separately by Sky/PMREM.
// Keeping display colours here prevents exposure from washing a blue sky to grey.
export function createPastoralSky(THREE) {
  const color = hex => new THREE.Color(hex);
  return new THREE.ShaderMaterial({
    name: 'Meadowlark daylight', side: THREE.BackSide, depthWrite: false,
    toneMapped: false,
    uniforms: {
      sunPosition: {value: new THREE.Vector3(0.4, 0.7, 0.3)},
      day: {value: 1}, golden: {value: 0}, night: {value: 0}, rain: {value: 0},
      zenith: {value: color('#0879c2')}, horizon: {value: color('#80c5e7')},
      dusk: {value: color('#edb18a')}, darkTop: {value: color('#09162e')},
      darkHorizon: {value: color('#253857')}
    },
    vertexShader: `varying vec3 vDirection;
      void main(){vDirection=position;
        vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);
        gl_Position=p.xyww;}`,
    fragmentShader: `varying vec3 vDirection;
      uniform vec3 sunPosition,zenith,horizon,dusk,darkTop,darkHorizon;
      uniform float day,golden,night,rain;
      void main(){
        vec3 d=normalize(vDirection);
        float h=pow(max(d.y,0.0),0.32);
        vec3 sky=mix(horizon,zenith,smoothstep(0.0,0.65,h));
        sky=mix(sky,dusk,golden*pow(1.0-h,3.0)*0.72);
        float daylight=smoothstep(0.0,0.55,day);
        sky=mix(mix(darkHorizon,darkTop,h),sky,daylight);
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

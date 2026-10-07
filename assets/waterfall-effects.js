// Original, bounded waterfall particles. Their paths and fades are evaluated in
// the vertex shader; the CPU only advances the waterfall's shared clock.
const hash=(i,k)=>{let h=Math.imul(i+1,374761393)^Math.imul(k+1,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
export function createWaterfallEffects({THREE:T,time,x,z,top,bottom,width,run,name='Falls',counts={falling:90,spray:160,mist:44}}){
 const group=new T.Group();group.name='Water | '+name+' spray';
 const origin={value:new T.Vector4(x,top,z,Math.max(.1,top-bottom))};
 const shape={value:new T.Vector2(width,run)},materials=[],meshes=[];
 function particles(kind,count){
  if(!count)return;
  const geometry=new T.PlaneGeometry(1,1),seeds=new Float32Array(count*4);
  for(let i=0;i<count;i++)for(let k=0;k<4;k++)seeds[i*4+k]=hash(i,k+kind*7);
  geometry.setAttribute('fxSeed',new T.InstancedBufferAttribute(seeds,4));
  const material=new T.MeshBasicMaterial({name:'Water | '+['falling droplets','impact spray','rising water mist'][kind],color:0xffffff,transparent:true,opacity:[.40,.42,.11][kind],depthWrite:false,side:T.DoubleSide});
  material.forceSinglePass=true;
  material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,{waterfallTime:time,fallOrigin:origin,fallShape:shape});
   shader.vertexShader=`attribute vec4 fxSeed; uniform float waterfallTime; uniform vec4 fallOrigin; uniform vec2 fallShape;
    varying vec2 fxUV; varying float fxFade; varying float fxPhase;\n`+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
    vec3 center;vec2 size;vec3 tangent=vec3(0.0,-1.0,0.0);
    float phase=fract(waterfallTime*${kind===0?'(.34+fxSeed.y*.12)':kind===1?'(.85+fxSeed.y*.5)':'(.19+fxSeed.y*.09)'}+fxSeed.x);
    fxPhase=phase;fxUV=position.xy*2.0;
    ${kind===0?`
      float v=phase*phase;
      center=vec3((fxSeed.z*2.0-1.0)*fallShape.x*(1.0+v*.29),-fallOrigin.w*pow(v,1.055),fallShape.y*v*v+.10);
      tangent=vec3(0.0,-fallOrigin.w*1.055*pow(max(v,.001),.055),2.0*fallShape.y*v);
      size=vec2(.024+fxSeed.w*.038,.16+v*.39);
      fxFade=smoothstep(.02,.12,phase)*(1.0-smoothstep(.86,1.0,phase));
    `:kind===1?`
      float life=.42+fxSeed.y*.36,age=phase*life;
      float angle=fxSeed.z*6.2831853,speed=.7+fxSeed.w*2.7;
      center=vec3((fxSeed.x*2.0-1.0)*fallShape.x*.95+cos(angle)*speed*age,
        -fallOrigin.w+4.9*life*age-4.9*age*age,
        fallShape.y+sin(angle)*speed*age+.25);
      size=vec2(.025+fxSeed.w*.042,.045+fxSeed.w*.070);
      fxFade=smoothstep(0.0,.09,phase)*(1.0-smoothstep(.65,1.0,phase));
    `:`
      center=vec3((fxSeed.z*2.0-1.0)*fallShape.x+sin(fxSeed.w*6.2831853+phase)*phase*.8,
        -fallOrigin.w+.18+phase*(1.4+fxSeed.y),fallShape.y+.35+phase*1.4+(fxSeed.w-.5)*1.2);
      size=vec2(1.0+phase*2.7)*( .75+fxSeed.z*.45);
      fxFade=pow(sin(phase*3.14159265),2.0);
    `}
    center+=fallOrigin.xyz;
    vec4 mvPosition=modelViewMatrix*vec4(center,1.0);
    vec2 axis=(modelViewMatrix*vec4(tangent,0.0)).xy;
    axis=dot(axis,axis)>.00001?normalize(axis):vec2(0.0,1.0);
    ${kind===2?'axis=vec2(0.0,1.0);':''}
    vec2 right=vec2(axis.y,-axis.x);
    mvPosition.xy+=right*position.x*size.x+axis*position.y*size.y;
    fxFade*=smoothstep(1.0,3.0,-mvPosition.z)*(1.0-smoothstep(115.0,180.0,length(mvPosition.xyz)));
    gl_Position=projectionMatrix*mvPosition;
   `);
   shader.fragmentShader=`varying vec2 fxUV;varying float fxFade;varying float fxPhase;
    float sprayHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
    float sprayNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(sprayHash(i),sprayHash(i+vec2(1,0)),f.x),mix(sprayHash(i+vec2(0,1)),sprayHash(i+vec2(1,1)),f.x),f.y);}
    \n`+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`
    float radius=length(fxUV);
    ${kind===2?`
      float wisps=sprayNoise(fxUV*3.5+vec2(fxPhase*.8,fxPhase*1.3));
      float billow=sprayNoise(fxUV*7.0-vec2(fxPhase*.6,fxPhase*.4));
      diffuseColor.a*=pow(max(0.0,1.0-radius*radius),2.4)*(.24+.76*wisps)*(.5+.5*billow)*fxFade;
    `:`diffuseColor.a*=(1.0-smoothstep(.12,1.0,radius))*fxFade;`}
    if(diffuseColor.a<.001)discard;
    #include <alphatest_fragment>
   `);
  };
  material.customProgramCacheKey=()=> 'waterfall-particles-v1-'+kind;
  const mesh=new T.InstancedMesh(geometry,material,count);mesh.name=material.name;mesh.renderOrder=kind===2?4:3;
  // CPU positions stay static; this encloses every shader path and full quad.
  mesh.boundingSphere=new T.Sphere(new T.Vector3(x,(top+bottom)*.5,z+run*.5),Math.hypot(top-bottom,run,width*2)*.6+8);
  mesh.matrixAutoUpdate=false;mesh.updateMatrix();group.add(mesh);materials.push(material);meshes.push(mesh);
 }
 particles(0,counts.falling);particles(1,counts.spray);particles(2,counts.mist);
 return {group,materials,meshes,stats:{...counts,triangles:2*(counts.falling+counts.spray+counts.mist),draws:meshes.length,gpuMotion:true},origin,shape};
}

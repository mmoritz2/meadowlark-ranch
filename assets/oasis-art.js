// Original feather-palm geometry. Each frond has a curved rachis and narrow,
// drooping leaflets; the seven established oasis sites stay in the same place.
export function createOasisPalms({THREE,groundH,x,z,radius,loadTextures=true}) {
  const group=new THREE.Group();group.name='Oasis | feather palms';
  const pos=[],uv=[],colors=[],indices=[],barkPos=[],barkUV=[],barkIndices=[];
  const color=new THREE.Color(),baseY=groundH(x,z),TAU=Math.PI*2;
  const hash=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n);};
  const palms=[];
  function leaf(a,b,c,tone){
    const n=pos.length/3;pos.push(...a,...b,...c);uv.push(0,0,.5,1,1,0);
    for(const shade of [.68,1,.85]){color.setHSL(.215+tone*.025,.47,.095*shade+tone*.023);colors.push(color.r,color.g,color.b);}
    indices.push(n,n+1,n+2);
  }
  for(let k=0;k<7;k++){
    const a=k/7*TAU,px=Math.cos(a)*(radius+1.6),pz=Math.sin(a)*(radius+1.6);
    const floor=groundH(x+px,z+pz)-baseY,h=4.1+hash(k,9)*.6,lean=.45+hash(k,6)*.22;
    const crown=[px+Math.cos(a)*lean,floor+h,pz+Math.sin(a)*lean];
    palms.push({x:x+px,z:z+pz,height:h,r:.21});
    const trunkStart=barkPos.length/3,rings=24,sides=10;
    for(let j=0;j<=rings;j++)for(let n=0;n<=sides;n++){
      const t=j/rings,theta=n/sides*TAU,r=(.195-.095*t)*(1+.035*Math.sin(t*95));
      barkPos.push(px+Math.cos(a)*lean*t*t+Math.cos(theta)*r,floor+h*t,pz+Math.sin(a)*lean*t*t+Math.sin(theta)*r);
      barkUV.push(n/sides*2,t*3.2);
      if(j<rings&&n<sides){const v=trunkStart+j*(sides+1)+n;barkIndices.push(v,v+sides+1,v+1,v+1,v+sides+1,v+sides+2);}
    }
    for(let f=0;f<11;f++){
      const yaw=f/11*TAU+k*.63,dx=Math.sin(yaw),dz=Math.cos(yaw),nx=dz,nz=-dx;
      const length=2.4+hash(k,f+23)*.75,rise=.85+hash(k,f+61)*.6;
      const at=t=>[crown[0]+dx*length*t,crown[1]+rise*Math.sin(t*Math.PI*.88)-1.05*t*t,crown[2]+dz*length*t];
      // The slim central spine is part of the leaf mesh, keeping all crowns one draw.
      for(let n=0;n<12;n++){
        const t=n/12,p=at(t),q=at((n+1)/12),w=.016*(1-t)+.003;
        leaf([p[0]-nx*w,p[1],p[2]-nz*w],q,[p[0]+nx*w,p[1],p[2]+nz*w],.55);
      }
      for(let n=0;n<30;n++)for(const side of [-1,1]){
        const t=.06+n/32,p=at(t),width=(.18+.62*Math.sin(t*Math.PI))*(.84+hash(k*71+f,n)*.24);
        const tip=[p[0]+nx*width*side+dx*.22,p[1]-.13-width*.34,p[2]+nz*width*side+dz*.22];
        const root=.017+.019*Math.sin(t*Math.PI),tone=hash(k*37+f,n);
        leaf([p[0]-dx*root,p[1],p[2]-dz*root],tip,[p[0]+dx*root,p[1]+.013,p[2]+dz*root],tone);
      }
    }
  }
  function geometry(p,u,index,c){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));
    if(c)g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setIndex(index);g.computeVertexNormals();g.computeBoundingSphere();return g;
  }
  const leafMat=new THREE.MeshStandardMaterial({name:'Oasis | palm leaflets',vertexColors:true,side:THREE.DoubleSide,roughness:.85,envMapIntensity:.6});
  const barkMat=new THREE.MeshStandardMaterial({name:'Oasis | textured palm stems',color:'#baa88a',roughness:1,envMapIntensity:.5});
  if(loadTextures){
    const loader=new THREE.TextureLoader();
    const tex=(file,srgb=false)=>{const t=loader.load('./assets/textures/scanned/'+file);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t;};
    barkMat.map=tex('pine_sapling_small_bark_diff.webp',true);barkMat.normalMap=tex('pine_sapling_small_bark_nor_gl.webp');barkMat.normalScale=new THREE.Vector2(.3,.3);
  }
  for(const mesh of [new THREE.Mesh(geometry(pos,uv,indices,colors),leafMat),new THREE.Mesh(geometry(barkPos,barkUV,barkIndices),barkMat)]){
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  group.userData.oasisPalms={palms,triangles:(indices.length+barkIndices.length)/3};return group;
}

export function createOasisBank({THREE,groundH,x,z,radius,loadTextures=true}) {
  const p=[],u=[],c=[],index=[],base=groundH(x,z),segments=80;
  const rings=[{r:radius-.2,mix:0},{r:radius+.65,mix:.45},{r:radius+2.2,mix:1}];
  const inner=new THREE.Color('#777965'),outer=new THREE.Color('#b4a38c'),tint=new THREE.Color();
  rings.forEach((ring,j)=>{
    for(let n=0;n<=segments;n++){
      const a=n/segments*Math.PI*2,r=ring.r+Math.sin(a*5+.4)*.14+Math.sin(a*9)*.08;
      const px=Math.cos(a)*r,pz=Math.sin(a)*r,ground=groundH(x+px,z+pz)-base;
      p.push(px,THREE.MathUtils.lerp(.065,ground+.028,ring.mix),pz);u.push((x+px)/4,(z+pz)/4);
      tint.copy(inner).lerp(outer,ring.mix);c.push(tint.r,tint.g,tint.b);
      if(j<rings.length-1&&n<segments){const v=j*(segments+1)+n;index.push(v,v+1,v+segments+1,v+1,v+segments+2,v+segments+1);}
    }
  });
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));geo.setAttribute('color',new THREE.Float32BufferAttribute(c,3));geo.setIndex(index);geo.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.97,envMapIntensity:.5});
  if(loadTextures){const t=new THREE.TextureLoader().load('./assets/textures/ground_dirt.jpg');t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;mat.map=t;}
  const bank=new THREE.Mesh(geo,mat);bank.name='Oasis | grounded shoreline';bank.receiveShadow=true;return bank;
}

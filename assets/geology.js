/* Deterministic original sedimentary geology. Shapes are local to a ground-level
   origin; callers retain their existing world placement and collision policy. */
export function createGeology({THREE,scene=null,groundH=()=>0,loadTextures=true,
  textureRoot='assets/textures/realism/',anisotropy=8}={}) {
  if(!THREE)throw new TypeError('createGeology requires THREE');
  const loader=loadTextures?new THREE.TextureLoader():null;
  const tex=(name,color=false)=>{
    if(!loader)return null;
    const t=loader.load(textureRoot+name);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=anisotropy;
    if(color)t.colorSpace=THREE.SRGBColorSpace;return t;
  };
  const material=new THREE.MeshStandardMaterial({name:'Weathered sedimentary limestone',
    map:tex('rock_albedo.jpg',true),normalMap:tex('rock_normal.jpg'),
    roughnessMap:tex('rock_roughness.jpg'),normalScale:new THREE.Vector2(.55,.55),
    color:'#ffffff',roughness:1,metalness:0,vertexColors:true,envMapIntensity:.50});
  const TAU=Math.PI*2,PATCH=3.2;
  const rng=seed=>{let s=seed|0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};};
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  const angular=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
  const tint=new THREE.Color();
  function geometry(p,u,c,index){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
    g.setIndex(index);g.computeVertexNormals();return g;
  }
  function merge(geometries){
    const p=[],n=[],u=[],c=[],idx=[];
    for(const g of geometries){
      const base=p.length/3;
      p.push(...g.attributes.position.array);n.push(...g.attributes.normal.array);
      u.push(...g.attributes.uv.array);c.push(...g.attributes.color.array);
      if(g.index)for(const i of g.index.array)idx.push(base+i);
      else for(let i=0;i<g.attributes.position.count;i++)idx.push(base+i);
      g.dispose();
    }
    const g=geometry(p,u,c,idx);
    // Retain chosen hard cap/fragment edges and averaged ring seams.
    g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));
    g.computeBoundingBox();g.computeBoundingSphere();return g;
  }
  function finish(g,kind,seed){
    g.computeBoundingBox();g.computeBoundingSphere();
    const m=new THREE.Mesh(g,material);m.name='Geology | '+kind;m.castShadow=true;m.receiveShadow=true;
    m.userData.geology={kind,seed,triangles:g.index?g.index.count/3:g.attributes.position.count/3,
      min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()};return m;
  }
  function rockGeometry(radius,seed,{grounded=true,flatness=.72}={}){
    const random=rng(seed),phase=random()*TAU;
    const g=new THREE.BoxGeometry(2,2,2,4,4,4),pos=g.attributes.position,normal=g.attributes.normal,uv=g.attributes.uv;
    const c=[],sx=.80+random()*.25,sz=.77+random()*.25;
    let minY=Infinity;
    for(let i=0;i<pos.count;i++){
      let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
      // A bevelled fractured block, not a perturbed sphere. Continuous fields
      // keep coincident cube-face vertices in precisely the same position.
      const q=Math.pow(Math.pow(Math.abs(x),3.5)+Math.pow(Math.abs(y),3.5)+Math.pow(Math.abs(z),3.5),1/3.5);
      x/=q;y/=q;z/=q;
      const rough=1+.075*Math.sin(x*5.2+z*3.1+phase)*Math.cos(y*4.7-phase);
      x=x*rough*sx;y=y*rough*flatness;z=z*rough*sz;
      y=Math.min(y,flatness*(.77-.19*x+.12*z));
      x=Math.min(x,.88+.11*y-.08*z);
      y=Math.max(y,-flatness*.61+.06*x);
      pos.setXYZ(i,x*radius,y*radius,z*radius);minY=Math.min(minY,y*radius);
      const v=.84+.12*(.5+.5*Math.sin(x*4+z*5+phase))+.045*y;
      tint.setRGB(v,v*.98,v*.93);c.push(tint.r,tint.g,tint.b);
    }
    for(let i=0;i<pos.count;i++){
      if(grounded)pos.setY(i,pos.getY(i)-minY-radius*.035);
      const nx=Math.abs(normal.getX(i)),ny=Math.abs(normal.getY(i));
      uv.setXY(i,(nx>.5?pos.getZ(i):pos.getX(i))/PATCH,
        (ny>.5?pos.getZ(i):pos.getY(i))/PATCH);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.computeVertexNormals();return g;
  }
  function makeBoulder(radius=1,seed=1,options={}){
    if(!(radius>0))throw new RangeError('Boulder radius must be positive');
    return finish(rockGeometry(radius,seed,options),'boulder',seed);
  }
  function formation(radius,height,seed,hoodoo=false){
    if(!(radius>0&&height>0))throw new RangeError('Formation dimensions must be positive');
    const random=rng(seed),phase=random()*TAU;
    const segments=hoodoo?40:72,beds=hoodoo?12:Math.min(27,Math.max(16,Math.round(height*1.05)));
    const ellipse=.78+random()*.15;
    const fractures=Array.from({length:hoodoo?6:11},()=>({a:random()*TAU,
      width:.025+random()*.045,depth:.035+random()*.055,bend:random()*2-1}));
    const tiers=Array.from({length:beds+1},()=>random());
    const thickness=tiers.map(t=>.55+t*1.25),total=thickness.reduce((a,b)=>a+b,0);
    const levels=[-.018,0],levelLedges=[0,0];let bedHeight=0;
    for(let j=1;j<beds;j++){
      bedHeight+=thickness[j-1]/total;
      levels.push(bedHeight-.003,bedHeight,bedHeight+.004);
      levelLedges.push(0,tiers[j]>.72?1:.12,0);
    }
    levels.push(1);levelLedges.push(0);
    const outline=a=>.84+.09*Math.sin(a*3+phase)+.055*Math.sin(a*5-phase*1.7)
      +.035*Math.sin(a*9+phase*.3)+.018*Math.cos(a*17-phase);
    const radial=(a,t,ledge=0)=>{
      let r=outline(a);
      const notch=fractures.reduce((sum,f)=>{
        const d=angular(a,f.a+f.bend*.07*t+Math.sin(t*8+f.a)*.012);
        return sum+f.depth*Math.exp(-d*d/(f.width*f.width));
      },0);
      const taper=hoodoo?(.75+.24*Math.exp(-Math.pow((t-.88)/.16,2))+.15*(1-t)*(1-t)):
        1-.12*t-.12*smooth(.28,.88,t);
      r=r*taper-notch*(.45+.55*smooth(.0,.16,t));
      if(!hoodoo){
        // Offset rock benches and a broad collapsed cleft break the uninterrupted
        // drum silhouette. They remain a coherent mass rather than stacked lids.
        const bench=.36+.045*Math.sin(a*3+phase);
        r-=.07*smooth(bench,bench+.032,t);
        r-=.045*smooth(.76,.81,t)*(.65+.35*Math.sin(a*2-phase));
        r-=.095*Math.exp(-Math.pow(angular(a,phase+.7)/.35,2))*smooth(.15,.35,t);
      }
      const bed=Math.min(beds-1,Math.floor(Math.max(0,t)*beds));
      r+=ledge*(.004+tiers[bed]*.007);
      r+=.012*Math.sin(a*27+phase+t*4)+.009*Math.sin(a*41-t*9);
      return radius*r;
    };
    const upper=a=>height*(.023*Math.sin(a*3+phase)+.010*Math.sin(a*11-phase)
      -.042*Math.exp(-Math.pow(angular(a,phase+.5)/.26,2)));
    const surface=(a,t,ledge=0)=>{
      const r=radial(a,t,ledge),shear=height*.025*t;
      return [Math.cos(a)*r+Math.cos(phase)*shear,
        height*t+upper(a)*Math.pow(Math.max(t,0),5)+Math.sin(a*6+phase)*height*.003*t,
        Math.sin(a)*r*ellipse+Math.sin(phase)*shear];
    };
    const p=[],u=[],c=[],idx=[];
    const color=(a,t,ledge)=>{
      // Narrow tonal range: mineral pigment and weathering, not orange stripes.
      const v=.88+.05*Math.sin(t*height*2.1+phase)+.055*Math.sin(a*7+phase+t*2)
        +.025*ledge-.07*(1-smooth(-.02,.12,t));
      tint.setRGB(v,v*.95,v*.86);c.push(tint.r,tint.g,tint.b);
    };
    for(let j=0;j<levels.length;j++){
      const t=levels[j],ledge=levelLedges[j];
      for(let i=0;i<=segments;i++){
        const a=i/segments*TAU;const v=surface(a,t,ledge);p.push(...v);
        u.push(a*radius*.86/PATCH,v[1]/PATCH);color(a,t,ledge);
      }
    }
    for(let j=0;j<levels.length-1;j++)for(let i=0;i<segments;i++){
      const a=j*(segments+1)+i,b=a+segments+1;idx.push(a,b,a+1,a+1,b,b+1);
    }
    const body=geometry(p,u,c,idx);
    // Average cylinder unwrap seam normals so no artificial vertical join appears.
    const bn=body.attributes.normal;
    for(let j=0;j<levels.length;j++){
      const a=j*(segments+1),b=a+segments,n=new THREE.Vector3().fromBufferAttribute(bn,a)
        .add(new THREE.Vector3().fromBufferAttribute(bn,b)).normalize();
      bn.setXYZ(a,n.x,n.y,n.z);bn.setXYZ(b,n.x,n.y,n.z);
    }
    const topP=[],topU=[],topC=[],topI=[],topRings=[1,.82,.5,.22,0];
    for(const f of topRings)for(let i=0;i<=segments;i++){
      const a=i/segments*TAU,edge=surface(a,1),cx=Math.cos(phase)*height*.025,cz=Math.sin(phase)*height*.025;
      const x=cx+(edge[0]-cx)*f,z=cz+(edge[2]-cz)*f;
      const y=height+(edge[1]-height)*f+height*.017*(1-f)+Math.sin(a*5+phase)*height*.005*f*(1-f);
      topP.push(x,y,z);topU.push(x/PATCH,z/PATCH);
      const v=.98+.035*Math.sin(a*8+phase)*f;topC.push(v,v*.955,v*.88);
    }
    for(let j=0;j<topRings.length-1;j++)for(let i=0;i<segments;i++){
      const a=j*(segments+1)+i,b=a+segments+1;topI.push(a,b,a+1);
      if(topRings[j+1]!==0)topI.push(a+1,b,b+1);
    }
    const pieces=[body,geometry(topP,topU,topC,topI)];
    // Irregular talus apron: low contact at its outer edge, stone fragments over
    // the slope. It shares the cliff material, eliminating colored cone skirts.
    const tp=[],tu=[],tc=[],ti=[],fans=[{r:.78,y:.09},{r:1.02,y:.038},{r:1.24,y:-.008}];
    for(const fan of fans)for(let i=0;i<=segments;i++){
      const a=i/segments*TAU,rr=radius*fan.r*(outline(a)+.02*Math.sin(a*23));
      const x=Math.cos(a)*rr,z=Math.sin(a)*rr*ellipse,y=height*fan.y*(.88+.12*Math.sin(a*9+phase));
      tp.push(x,y,z);tu.push(x/PATCH,z/PATCH);tc.push(.87,.845,.78);
    }
    for(let j=0;j<fans.length-1;j++)for(let i=0;i<segments;i++){
      const a=j*(segments+1)+i,b=a+segments+1;ti.push(a,a+1,b,a+1,b+1,b);
    }
    pieces.push(geometry(tp,tu,tc,ti));
    const count=hoodoo?9:22;
    for(let k=0;k<count;k++){
      const a=random()*TAU,rr=radius*(.74+random()*.34)*outline(a);
      const size=radius*(hoodoo?.075:.065)*( .45+random()*.90);
      const frag=rockGeometry(size,seed+k*977,{grounded:true,flatness:.50+random()*.35});
      const y=Math.max(-.025,height*.065*(1-(rr/radius-.7)/.45));
      const matrix=new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a)*rr,y,Math.sin(a)*rr*ellipse),
        new THREE.Quaternion().setFromEuler(new THREE.Euler((random()-.5)*.18,random()*TAU,(random()-.5)*.2)),new THREE.Vector3(1,1,1));
      frag.applyMatrix4(matrix);pieces.push(frag);
    }
    const combined=merge(pieces);combined.userData.unwrapSeam={segments,levels:levels.length};
    const mesh=finish(combined,hoodoo?'weathered spire':'layered mesa',seed);
    mesh.userData.geology.radius=radius;mesh.userData.geology.height=height;
    mesh.userData.geology.texturePatchMetres=PATCH;
    const group=new THREE.Group();group.name=mesh.name;group.add(mesh);group.userData.geology=mesh.userData.geology;
    return group;
  }
  const makeMesa=(radius,height,seed=1)=>formation(radius,height,seed,false);
  const makeHoodoo=(radius,height,seed=1)=>formation(radius,height,seed,true);
  function makeWaterfallCliff({width=34,lip=15,foot=0,seed=9031,notchWidth=6.4}={}){
    const height=lip-foot,half=width/2;
    if(!(height>2&&width>notchWidth+4))throw new RangeError('Waterfall cliff needs positive height and room beside its notch');
    const random=rng(seed),pieces=[],X=30,ROWS=25,phase=random()*TAU;
    const gap=t=>notchWidth/2+1.2*(1-t)*(1-t);
    const shade=(x,y,z)=>{
      const v=.86+.055*Math.sin(x*.71+y*.9+phase)+.035*Math.sin(z*.85-x*.43);
      return[v*.98,v,v*.97];
    };
    // Two separate solid, tapered rock shoulders. Their ragged upper profiles
    // and curved fronts replace the old four-sided paper rectangle completely.
    for(const side of[-1,1]){
      const ph=phase+side*1.7;
      const surface=(u,t,back=false)=>{
        const inner=gap(t)+.075*Math.sin(t*17+ph),outer=half*(.99-.17*t*t);
        const x=side*(inner+(outer-inner)*u+.14*Math.sin(u*17+ph)*Math.sin(Math.PI*u));
        const crown=height*(.92+.13*Math.sin(Math.PI*u)+.036*Math.sin(u*13+ph)
          -.22*smooth(.76,1,u)+(side<0?.025:-.012));
        const y=-.65+(crown+.65)*t+.12*Math.sin(u*24+ph+t*6)*t*(1-t)-(back?height*.055*t*t*t:0);
        let z=.05+6.25*Math.pow(u,1.75)+.85*Math.sin(u*8+ph)*Math.sin(Math.PI*u)
          +.35*Math.sin(u*21+ph+t*4)+.14*Math.sin(t*height*1.8)-.70*t;
        // Deep weathering clefts and offsets have visible depth at grazing angles.
        z-=.72*Math.exp(-Math.pow((u-.31-.035*Math.sin(t*3+ph))/.065,2));
        z+=.65*smooth(.33,.40,t)*Math.sin(u*6+ph)*Math.sin(Math.PI*u);
        if(back)z-=5.3+3.9*Math.sin(Math.PI*u)+.35*Math.sin(u*9+ph);
        return[x,y,z];
      };
      const p=[],u=[],c=[],indices=[],frontCount=(X+1)*(ROWS+1);
      for(const back of[false,true])for(let j=0;j<=ROWS;j++)for(let i=0;i<=X;i++){
        const v=surface(i/X,j/ROWS,back);p.push(...v);u.push(v[0]/PATCH,v[1]/PATCH);c.push(...shade(...v));
      }
      for(let j=0;j<ROWS;j++)for(let i=0;i<X;i++){
        const a=j*(X+1)+i,b=a+X+1;
        // Parameter u runs inward-to-outward, reversing direction on the left.
        if(side>0){indices.push(a,a+1,b,a+1,b+1,b);indices.push(a+frontCount,b+frontCount,a+1+frontCount,a+1+frontCount,b+frontCount,b+1+frontCount);}
        else{indices.push(a,b,a+1,a+1,b,b+1);indices.push(a+frontCount,a+1+frontCount,b+frontCount,a+1+frontCount,b+1+frontCount,b+frontCount);}
      }
      // Close the buried underside. End walls get their own metre-scaled UVs
      // below, rather than inheriting collapsed front-face UV coordinates.
      for(let i=0;i<X;i++){
        const a=i,b=i+1,ab=a+frontCount,bb=b+frontCount;
        if(side>0)indices.push(a,ab,b,b,ab,bb);else indices.push(a,b,ab,b,bb,ab);
      }
      pieces.push(geometry(p,u,c,indices));
      for(const end of[0,1]){
        const ep=[],eu=[],ec=[],ei=[],D=5,outward=end===1?side:-side;
        for(let j=0;j<=ROWS;j++)for(let k=0;k<=D;k++){
          const f=k/D,a=surface(end,j/ROWS,false),b=surface(end,j/ROWS,true);
          const v=a.map((n,i)=>n*(1-f)+b[i]*f);
          // Mild lateral fractures interrupt what would otherwise be flat ends.
          v[0]+=outward*.14*Math.sin(j/ROWS*19+ph)*Math.sin(Math.PI*f);
          ep.push(...v);eu.push(v[2]/PATCH,v[1]/PATCH);ec.push(...shade(...v));
        }
        for(let j=0;j<ROWS;j++)for(let k=0;k<D;k++){
          const a=j*(D+1)+k,b=a+D+1;
          if(outward>0)ei.push(a,a+1,b,a+1,b+1,b);else ei.push(a,b,a+1,a+1,b,b+1);
        }
        pieces.push(geometry(ep,eu,ec,ei));
      }
      // A closed, uneven rock crown extends all the way to the back surface.
      const tp=[],tu=[],tc=[],ti=[],DEPTH=5;
      for(let j=0;j<=DEPTH;j++)for(let i=0;i<=X;i++){
        const f=j/DEPTH,v=i/X,a=surface(v,1,false),b=surface(v,1,true);
        const x=a[0]*(1-f)+b[0]*f,z=a[2]*(1-f)+b[2]*f;
        const y=a[1]*(1-f)+b[1]*f+.23*Math.sin(Math.PI*f)*Math.sin(v*11+ph);
        tp.push(x,y,z);tu.push(x/PATCH,z/PATCH);tc.push(...shade(x,y,z).map(v=>v*1.06));
      }
      for(let j=0;j<DEPTH;j++)for(let i=0;i<X;i++){
        const a=j*(X+1)+i,b=a+X+1;
        if(side>0)ti.push(a,a+1,b,a+1,b+1,b);else ti.push(a,b,a+1,a+1,b,b+1);
      }
      pieces.push(geometry(tp,tu,tc,ti));
      // Larger rock shoulders and fallen blocks sit into the foot of each side.
      for(let i=0;i<20;i++){
        const t=.10+random()*.78,edge=surface(t,0,false),size=.48+random()*1.15;
        const g=rockGeometry(size,seed+side*401+i*89,{grounded:true,flatness:.55+random()*.4});
        const matrix=new THREE.Matrix4().compose(new THREE.Vector3(edge[0],-.12,edge[2]+.5+random()*1.6),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),random()*TAU),new THREE.Vector3(1,1,1));
        g.applyMatrix4(matrix);pieces.push(g);
      }
    }
    // Recessed rock behind the water supports its source; its face remains well
    // behind the existing sheet at local z=.45..2.85, never covering the flow.
    const throat=rockGeometry(1,seed+873,{grounded:false,flatness:.72});
    const pt=throat.attributes.position;
    for(let i=0;i<pt.count;i++){
      const ox=pt.getX(i),oy=pt.getY(i),oz=pt.getZ(i);
      const y=(oy+.47)/1.07*(height-.95)-.30;
      pt.setXYZ(i,ox*(notchWidth*.65),Math.min(height-.88,y),-4.9+oz*3.1);
      throat.attributes.uv.setXY(i,(Math.abs(throat.attributes.normal.getX(i))>.5?(-4.9+oz*3.1):ox*notchWidth*.65)/PATCH,
        (Math.abs(throat.attributes.normal.getY(i))>.5?(-4.9+oz*3.1):y)/PATCH);
    }
    throat.computeVertexNormals();pieces.push(throat);
    // Source shelf has a shallow worn channel, rather than a detached foam bar.
    const shelf=new THREE.BoxGeometry(notchWidth+1.7,.65,3.25,8,1,4),sp=shelf.attributes.position,sc=[];
    for(let i=0;i<sp.count;i++){
      const x=sp.getX(i),y=sp.getY(i),z=sp.getZ(i);
      const py=height-1.05+y-.12*Math.exp(-x*x/5),pz=z-1.40+.10*Math.sin(x*3)+.065*Math.cos(x*7);
      sp.setXYZ(i,x,py,pz);
      shelf.attributes.uv.setXY(i,(Math.abs(shelf.attributes.normal.getX(i))>.5?pz:x)/PATCH,
        (Math.abs(shelf.attributes.normal.getY(i))>.5?pz:py)/PATCH);sc.push(.85,.87,.84);
    }
    shelf.setAttribute('color',new THREE.Float32BufferAttribute(sc,3));shelf.computeVertexNormals();pieces.push(shelf);
    const mesh=finish(merge(pieces),'waterfall amphitheatre',seed);
    const group=new THREE.Group();group.name='Hollowpeak stone amphitheatre';group.add(mesh);
    group.userData.geology={...mesh.userData.geology,width,height,lip,foot,notchWidth,origin:'place at (FX, foot, FZ)'};
    return group;
  }
  function groundAt(group,x,z){
    const base=groundH(x,z),height=group.userData.geology?.height||1;
    group.traverse(mesh=>{
      if(!mesh.geometry)return;
      const g=mesh.geometry,p=g.attributes.position;
      if(!g.userData.groundReference)g.userData.groundReference=new Float32Array(p.array);
      const original=g.userData.groundReference;
      for(let i=0;i<p.count;i++){
        const lx=original[i*3],ly=original[i*3+1],lz=original[i*3+2];
        const weight=1-smooth(height*.025,height*.23,ly);
        p.setXYZ(i,lx,ly+(groundH(x+lx,z+lz)-base)*weight,lz);
      }
      p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
      const seam=g.userData.unwrapSeam;
      if(seam){
        const normals=g.attributes.normal;
        for(let j=0;j<seam.levels;j++){
          const a=j*(seam.segments+1),b=a+seam.segments;
          const n=new THREE.Vector3().fromBufferAttribute(normals,a)
            .add(new THREE.Vector3().fromBufferAttribute(normals,b)).normalize();
          normals.setXYZ(a,n.x,n.y,n.z);normals.setXYZ(b,n.x,n.y,n.z);
        }
      }
    });
    group.position.set(x,base,z);group.userData.geology.grounded=true;return group;
  }
  const placeMesa=(x,z,radius,height,seed=1)=>{
    const g=groundAt(makeMesa(radius,height,seed),x,z);if(scene)scene.add(g);return g;
  };
  const placeHoodoo=(x,z,radius,height,seed=1)=>{
    const g=groundAt(makeHoodoo(radius,height,seed),x,z);if(scene)scene.add(g);return g;
  };
  return {makeMesa,makeHoodoo,makeBoulder,makeWaterfallCliff,groundAt,placeMesa,placeHoodoo,material};
}

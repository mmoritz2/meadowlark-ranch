// Original botanical harvest models. Shared templates retain the existing pickup
// roots, placement, rewards and respawn timers; no network assets or global RNG.
export function createForageArt({THREE}) {
  const templates=new Map(),TAU=Math.PI*2,Y=new THREE.Vector3(0,1,0);
  const color=new THREE.Color(),matrix=new THREE.Matrix4(),quat=new THREE.Quaternion();
  const material=(name,roughness,side=THREE.FrontSide)=>new THREE.MeshStandardMaterial({name,vertexColors:true,roughness,side,envMapIntensity:.5});
  const materials={leaf:material('Harvest | folded leaves',.94,THREE.DoubleSide),fruit:material('Harvest | fruit and flowers',.68),stem:material('Harvest | stems and husks',.96)};
  const hash=(i,s=0)=>{const n=Math.sin(i*127.1+s*311.7)*43758.5453;return n-Math.floor(n);};
  const V=(x,y,z)=>new THREE.Vector3(x,y,z);
  class Plant {
    constructor(item){this.item=item;this.batches=new Map();this.leaves=0;this.fruit=0;}
    add(geo,kind,hex,transform=null){
      if(transform)geo.applyMatrix4(transform);
      let batch=this.batches.get(kind);if(!batch){batch={p:[],n:[],c:[],u:[],i:[]};this.batches.set(kind,batch);}
      const p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv,col=geo.attributes.color,offset=batch.p.length/3;
      color.set(hex);
      for(let i=0;i<p.count;i++){
        batch.p.push(p.getX(i),p.getY(i),p.getZ(i));batch.n.push(n.getX(i),n.getY(i),n.getZ(i));
        batch.u.push(uv?uv.getX(i):0,uv?uv.getY(i):0);
        const shade=col?col.getX(i):1;batch.c.push(color.r*shade,color.g*shade,color.b*shade);
      }
      if(geo.index)for(const i of geo.index.array)batch.i.push(offset+i);else for(let i=0;i<p.count;i++)batch.i.push(offset+i);
      geo.dispose();
    }
    stem(a,b,r=.008,hex='#718047'){
      const start=V(...a),end=V(...b),delta=end.clone().sub(start),g=new THREE.CylinderGeometry(r*.65,r,delta.length(),6);
      quat.setFromUnitVectors(Y,delta.normalize());matrix.compose(start.add(end).multiplyScalar(.5),quat,V(1,1,1));this.add(g,'stem',hex,matrix);
    }
    leaf(base,yaw,length,width,lift=.13,droop=.04,hex='#527640',lobes=0){
      // A creased midrib, tapered tip and uneven curled margin. The lifted
      // centre and edge ripples catch sun and cast actual leaf-shaped shadows.
      const p=[],u=[],c=[],idx=[],rows=10,cols=4,ca=Math.cos(yaw),sa=Math.sin(yaw);
      for(let j=0;j<=rows;j++)for(let k=0;k<=cols;k++){
        const t=j/rows,v=k/cols*2-1,edge=Math.abs(v);
        const taper=Math.max(.012,Math.pow(Math.sin(Math.PI*t),.72))*(1+lobes*Math.sin(t*Math.PI*10));
        const x=v*width*.5*taper,z=t*length;
        const y=lift*Math.sin(t*Math.PI*.62)-droop*t*t+.018*length*Math.sin(t*31+yaw)*edge-Math.abs(x)*.21;
        p.push(base[0]+x*ca+z*sa,base[1]+y,base[2]+z*ca-x*sa);u.push(k/cols,t);
        const shade=(k===2?1.13:.78+.13*(1-edge))*(.87+t*.13);c.push(shade,shade,shade);
        if(j<rows&&k<cols){const a=j*(cols+1)+k;idx.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2);}
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));
      geo.setAttribute('color',new THREE.Float32BufferAttribute(c,3));geo.setIndex(idx);geo.computeVertexNormals();this.add(geo,'leaf',hex);this.leaves++;
    }
    fruitAt(at,size,hex,{rib=0,pear=0,segments=14,rings=10,stripes=false}={}){
      const geo=new THREE.SphereGeometry(1,segments,rings),p=geo.attributes.position,restNormals=geo.attributes.normal.array.slice(),shades=[];
      for(let i=0;i<p.count;i++){
        const y=p.getY(i),a=Math.atan2(p.getZ(i),p.getX(i));
        const lobe=1+rib*Math.cos(a*10),taper=1+pear*y;
        p.setXYZ(i,at[0]+p.getX(i)*size[0]*lobe*taper,at[1]+y*size[1]-(rib?Math.pow(Math.abs(y),8)*size[1]*.12*Math.sign(y):0),at[2]+p.getZ(i)*size[2]*lobe*taper);
        const shade=stripes?.58+.42*Math.pow(.5+.5*Math.sin(a*10+y*1.7),.45):.83+hash(i,3)*.14+(y+1)*.04;
        shades.push(shade,shade,shade);
      }
      geo.setAttribute('color',new THREE.Float32BufferAttribute(shades,3));geo.computeVertexNormals();
      // Sphere seams include unused pole vertices. Preserve their analytic
      // normals instead of leaving zero vectors in a shared GPU attribute.
      const normals=geo.attributes.normal;for(let i=0;i<normals.count;i++)if(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))<.5)normals.setXYZ(i,restNormals[i*3],restNormals[i*3+1],restNormals[i*3+2]);
      this.add(geo,'fruit',hex);this.fruit++;
    }
    flower(at,size=.035){
      for(let i=0;i<5;i++){const a=i*TAU/5;this.fruitAt([at[0]+Math.sin(a)*size*.65,at[1],at[2]+Math.cos(a)*size*.65],[size*.53,size*.12,size*.53],'#efe5cb',{segments:7,rings:5});}
      this.fruitAt([at[0],at[1]+.003,at[2]],[size*.24,size*.14,size*.24],'#d3a13d',{segments:7,rings:5});
    }
    finish(){
      const root=new THREE.Group();root.name='Harvest | '+this.item;let triangles=0;
      for(const [kind,b]of this.batches){
        const g=new THREE.BufferGeometry();for(const [name,key,size]of[['position','p',3],['normal','n',3],['color','c',3],['uv','u',2]])g.setAttribute(name,new THREE.Float32BufferAttribute(b[key],size));
        g.setIndex(b.i);g.computeBoundingBox();g.computeBoundingSphere();const m=new THREE.Mesh(g,materials[kind]);m.name='Harvest | '+this.item+' '+kind;m.castShadow=true;m.receiveShadow=true;root.add(m);triangles+=b.i.length/3;
      }
      root.userData.harvestArt={item:this.item,leaves:this.leaves,fruit:this.fruit,triangles,planted:true};return root;
    }
  }
  function rosette(b,{n=12,length=.27,width=.13,lift=.15,y=.025,color='#567842',lobes=0}={}){
    for(let i=0;i<n;i++){const a=i*2.39996,s=.72+hash(i,4)*.28;b.leaf([0,y+(i%3)*.015,0],a,length*s,width*s,lift*(.65+(i%3)*.2),.03,color,lobes);}
  }
  function bush(b,{n=7,height=.5,radius=.22,color='#4e713a',berry=null}={}){
    for(let i=0;i<n;i++){
      const a=i*2.39996,h=height*(.67+hash(i,4)*.33),x=Math.sin(a)*radius,z=Math.cos(a)*radius;
      b.stem([0,.015,0],[x,h,z],.008,'#6a6840');
      for(let j=0;j<4;j++){
        const t=.28+j*.19,p=[x*t,h*t,z*t];
        b.leaf(p,a+(j%2?1:-1)*.9,.12,.065,.047,.018,color,.08);
        if(berry&&j>1)for(let k=0;k<3;k++)b.fruitAt([x*t+Math.sin(a+k*2)*.032,h*t-.015,z*t+Math.cos(a+k*2)*.032],[.026,.025,.026],berry,{segments:8,rings:6});
      }
    }
  }
  function makeTemplate(item){
    const b=new Plant(item);
    switch(item){
      case 'strawberry':
        for(let i=0;i<8;i++){
          const a=i*2.39996,r=.07+hash(i)*.11,x=Math.sin(a)*r,z=Math.cos(a)*r,h=.12+hash(i,2)*.10;
          b.stem([0,.015,0],[x,h,z],.0038);
          for(let k=-1;k<=1;k++)b.leaf([x,h,z],a+k*1.0,.115,.074,.025,.028,k===0?'#557c36':'#496e35',.10);
          if(i<4){const at=[x*.8,.058+hash(i,8)*.025,z*.8];b.fruitAt(at,[.035,.048,.034],'#b63229',{pear:.30,segments:12,rings:8});for(let k=0;k<5;k++)b.leaf([at[0],at[1]+.038,at[2]],k*TAU/5,.032,.012,.003,.010,'#4b6934');}
          if(i===2||i===6)b.flower([x,h+.024,z],.025);
        }break;
      case 'berries':bush(b,{height:.54,radius:.23,berry:'#343454'});break;
      case 'orange':
        bush(b,{n:6,height:.70,radius:.25,color:'#476636'});
        for(let i=0;i<5;i++){const a=i*2.4,x=Math.sin(a)*.18,z=Math.cos(a)*.18,h=.29+(i%3)*.10;b.fruitAt([x,h,z],[.057,.06,.055],'#d58a22');}
        break;
      case 'lettuce':
        rosette(b,{n:9,length:.27,width:.19,lift:.14,color:'#718f45',lobes:.14});
        rosette(b,{n:8,length:.17,width:.16,lift:.23,y:.035,color:'#91a957',lobes:.09});
        rosette(b,{n:5,length:.075,width:.09,lift:.19,y:.095,color:'#b2bf76',lobes:.07});break;
      case 'cress':case 'snowmoss':
        for(let i=0;i<13;i++){
          const a=i*2.39996,r=Math.sqrt(hash(i,7))*.18,x=Math.sin(a)*r,z=Math.cos(a)*r,h=.08+hash(i,3)*.08;
          b.stem([x,0,z],[x,h,z],.0025);
          for(let j=0;j<4;j++)b.leaf([x,h*(.35+j*.17),z],a+(j%2?1.4:-1.4),.045,.025,.013,.013,item==='snowmoss'?'#91ad80':'#65844b');
        }break;
      case 'sweetpea':
        for(let i=0;i<4;i++){
          const a=i*2.399,x=Math.sin(a)*.065,z=Math.cos(a)*.065,h=.48+i*.05;b.stem([x,0,z],[x,h,z],.005);
          for(let j=0;j<4;j++){
            b.leaf([x,h*(.26+j*.19),z],a+j*1.5,.095,.05,.045,.025,'#6a8b4d');
            if(j>1){b.fruitAt([x+.028,h*(.26+j*.19),z+.025],[.016,.073,.019],'#82a452',{segments:8,rings:8});}
          }
          b.flower([x,h,z],.022);
        }break;
      case 'corn':
        b.stem([0,0,0],[.016,1.34,0],.017,'#728648');
        for(let i=0;i<8;i++)b.leaf([0,.19+i*.12,0],i*2.399,.46,.075,.20,.22,'#728847');
        for(let i=0;i<2;i++){
          const x=i?.07:-.075,y=.63+i*.22;b.fruitAt([x,y,0],[.040,.15,.04],'#c8ae53',{rib:.10,segments:14,rings:14});
          for(let j=0;j<3;j++)b.leaf([x,y-.13,0],j*2.1,.12,.04,.22,.015,'#9f9f54');
        }
        for(let i=0;i<7;i++){const a=i*2.399;b.stem([.016,1.15,0],[Math.sin(a)*.10,1.40+hash(i)*.08,Math.cos(a)*.10],.004,'#b5a575');}break;
      case 'carrot':case 'daikon':
        b.fruitAt([0,item==='carrot'?-.065:.045,0],item==='carrot'?[.055,.105,.05]:[.063,.18,.06],item==='carrot'?'#c67b30':'#d9d5bf',{pear:.55});
        if(item==='daikon')rosette(b,{n:8,length:.25,width:.085,lift:.29,y:.095,color:'#618043',lobes:.20});
        else for(let i=0;i<7;i++){
          const a=i*2.39996,h=.28+hash(i,2)*.15,x=Math.sin(a)*.22,z=Math.cos(a)*.22;b.stem([0,.025,0],[x,h,z],.0038);
          for(let j=0;j<6;j++)for(const side of[-1,1]){
            const t=.24+j*.13,length=.105*Math.sin(t*Math.PI);
            b.leaf([x*t,.025+(h-.025)*t,z*t],a+side*1.3,length,.027,.025,.016,'#64833f',.22);
          }
        }break;
      case 'pumpkin':
        b.fruitAt([0,.205,0],[.265,.205,.25],'#bf7529',{rib:.065,segments:40,rings:18});
        b.stem([0,.38,0],[.025,.49,.012],.025,'#5d6737');
        for(let i=0;i<4;i++)b.leaf([.12,.025,.1],i*2.399,.24,.19,.065,.025,'#597442',.20);break;
      case 'watermelon':
        b.fruitAt([0,.17,0],[.27,.17,.22],'#7d9149',{stripes:true,segments:32,rings:18});
        for(let i=0;i<4;i++)b.leaf([-.19,.03,-.10],i*2.4,.20,.12,.055,.018,'#657a4b',.32);break;
      case 'zucchini':
        rosette(b,{n:7,length:.30,width:.21,lift:.23,color:'#648046',lobes:.24});
        b.fruitAt([.13,.065,.12],[.054,.051,.19],'#455f32',{rib:.045});b.flower([.13,.075,.30],.035);break;
      case 'grapes':
        b.stem([0,0,0],[.035,.8,0],.012,'#706244');
        for(let i=0;i<5;i++)b.leaf([.018,.28+i*.11,0],i*2.399,.15,.15,.065,.055,'#637d42',.17);
        for(let i=0;i<24;i++){const a=i*2.399,t=i/24,r=.065*(1-t*.8);b.fruitAt([Math.sin(a)*r,.52-t*.22,.085+Math.cos(a)*r],[.029,.032,.029],'#504563',{segments:8,rings:6});}break;
      case 'apple':
        for(let i=0;i<2;i++){const x=i*.15,y=.078-i*.012,z=i*.05;b.fruitAt([x,y,z],[.071,.070,.065],i?'#9d4930':'#b34d32',{rib:.025});b.stem([x,y+.058,z],[x+.008,y+.093,z],.0045,'#61543a');b.leaf([x,y+.09,z],i*2+.6,.055,.026,.012,.012,'#63773b');}break;
      case 'truffle':
        for(let i=0;i<3;i++)b.fruitAt([i*.095-.10,.048+i*.013,(i%2)*.05],[.076,.061,.071],i?'#65533b':'#4f4635',{rib:.10,segments:12,rings:10});
        for(let i=0;i<4;i++)b.leaf([0,.009,0],i*2.399,.16,.056,.012,.012,'#776a43',.16);break;
      case 'chestnut':
        b.fruitAt([0,.06,0],[.065,.060,.064],'#806541',{rib:.06});
        b.fruitAt([.105,.037,.035],[.039,.034,.036],'#7c4a2d');
        for(let i=0;i<22;i++){const a=i*2.399,t=(i+.5)/22,y=(t*2-1),r=Math.sqrt(1-y*y);const p=[Math.sin(a)*r*.063,.06+y*.057,Math.cos(a)*r*.063];b.stem(p,[p[0]*1.28,.06+(p[1]-.06)*1.28,p[2]*1.28],.0024,'#9c9260');}break;
      case 'pricklypear':
        for(const [x,y,z,w,h]of[[0,.19,0,.10,.19],[.13,.40,.01,.075,.15],[-.09,.39,-.02,.072,.15]]){
          b.fruitAt([x,y,z],[w,h,.033],'#7d915c',{segments:16,rings:12});
          for(let i=0;i<14;i++){const a=i*2.399,r=Math.sqrt(hash(i,8))*.7;b.fruitAt([x+Math.sin(a)*w*r,y+Math.cos(a)*h*r,z+.032],[.0028,.0028,.003],'#c1b585',{segments:5,rings:4});}
        }
        for(const [x,y,z]of[[.13,.56,.01],[-.09,.55,-.02]]){b.fruitAt([x,y,z],[.034,.058,.03],'#ac5363');b.flower([x,y+.051,z],.013);}break;
      case 'honey':case 'royaljelly':{
        // A harvest basket beside the hive gives these rewards a grounded form.
        const g=new THREE.CylinderGeometry(.10,.08,.12,12);matrix.makeTranslation(0,.061,0);b.add(g,'stem','#a58652',matrix);
        for(let i=0;i<4;i++){const y=.025+i*.028,ring=new THREE.TorusGeometry(.083+i*.004,.006,5,16);matrix.makeRotationX(Math.PI/2);matrix.setPosition(0,y,0);b.add(ring,'stem','#c0a377',matrix);}
        for(let i=0;i<3;i++)b.fruitAt([Math.sin(i*2.1)*.036,.137,Math.cos(i*2.1)*.036],[.034,.055,.028],item==='honey'?'#c4a25c':'#ddd0a7',{segments:6,rings:6});
        break;
      }
      default:throw new Error('Unknown harvest model: '+item);
    }
    return b.finish();
  }
  const make=item=>{if(!templates.has(item))templates.set(item,makeTemplate(item));return templates.get(item).clone(true);};
  return {make,makers:items=>Object.fromEntries(items.map(item=>[item,()=>make(item)])),templates};
}

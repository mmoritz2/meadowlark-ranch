/* Original ranch architecture. Metre-scaled materials, real wall openings and
   batched static details. No scene placement, navigation or collisions here. */
export function createRanchArchitecture({THREE, glowPanes = [], loadTextures = true,
  textureRoot = 'assets/textures/realism/', anisotropy = 8} = {}) {
  if (!THREE) throw new TypeError('createRanchArchitecture requires THREE');
  const loader = loadTextures ? new THREE.TextureLoader() : null;
  const maps = new Map(), materials = new Map();
  const map = (file, color = false) => {
    if (!loader) return null;
    if (!maps.has(file)) {
      const t = loader.load(textureRoot + file);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = anisotropy;
      if (color) t.colorSpace = THREE.SRGBColorSpace;
      maps.set(file, t);
    }
    return maps.get(file);
  };
  const material = (name, options, patch = 1) => {
    if (!materials.has(name)) {
      const m = new THREE.MeshStandardMaterial(options);
      m.name = name; m.userData.patchMetres = patch;
      materials.set(name, m);
    }
    return materials.get(name);
  };
  const siding = material('Ranch | weathered timber siding', {
    color: '#ffffff', map: map('siding_albedo.jpg', true),
    normalMap: map('siding_normal.jpg'), normalScale: new THREE.Vector2(.22,.22),
    roughnessMap: map('siding_roughness.jpg'), roughness: 1, envMapIntensity: .55,
  }, 2.4);
  const roof = material('Ranch | aged cedar shingles', {
    color: '#ffffff', map: map('roof_albedo.jpg', true),
    normalMap: map('roof_normal.jpg'), normalScale: new THREE.Vector2(.24,.24),
    roughnessMap: map('roof_roughness.jpg'), roughness: 1, envMapIntensity: .45,
  }, 1.8);
  const trim = material('Ranch | warm painted joinery', {color:'#dcdad0',roughness:.83});
  const wood = material('Ranch | oiled oak doors', {color:'#69513d',roughness:.8,
    map:map('siding_albedo.jpg',true)},2.4);
  const metal = material('Ranch | dark ironwork', {color:'#333a38',roughness:.66,metalness:.58});
  const stone = material('Ranch | foundation stone', {color:'#72716a',roughness:1});
  const stoneLight = material('Ranch | dressed limestone', {color:'#939087',roughness:.97});
  const mortar = material('Ranch | stone mortar', {color:'#555954',roughness:1});
  const brick = material('Ranch | chimney brick', {color:'#756353',roughness:.98});
  const dark = material('Ranch | window recess', {color:'#161f22',roughness:1});
  const glass = new THREE.MeshPhysicalMaterial({name:'Ranch | window glass',
    color:'#9eafb0',roughness:.17,metalness:.22,transparent:true,opacity:.28,
    depthWrite:false,envMapIntensity:1.1});
  const lit = new THREE.MeshBasicMaterial({name:'Ranch | window interior',color:'#202b2c'});
  glowPanes.push({mat:lit,day:new THREE.Color('#202b2c'),night:new THREE.Color(.80,.45,.18)});
  const lamp = material('Ranch | lantern glass', {color:'#bbaa7c',roughness:.35,
    emissive:'#b28a39',emissiveIntensity:.12});
  const Y = new THREE.Vector3(0,1,0);

  // One geometry per material, retaining world-size UVs on individual panels.
  // This avoids hundreds of draw calls for battens, mullions and hinges.
  class Builder {
    constructor(name) { this.group=new THREE.Group(); this.group.name=name; this.batches=new Map(); this.parts=0; }
    geometry(g,m,matrix = new THREE.Matrix4()) {
      g.applyMatrix4(matrix);
      let b=this.batches.get(m); if(!b){b={p:[],n:[],u:[],i:[]};this.batches.set(m,b);}
      const offset=b.p.length/3;
      b.p.push(...g.attributes.position.array);b.n.push(...g.attributes.normal.array);
      b.u.push(...g.attributes.uv.array);
      if(g.index) for(const i of g.index.array)b.i.push(i+offset);
      else for(let i=0;i<g.attributes.position.count;i++)b.i.push(i+offset);
      this.parts++;g.dispose();
    }
    box(w,h,d,m,x=0,y=0,z=0,rotation=null,frame=null) {
      if(w<=0||h<=0||d<=0)return;
      const g=new THREE.BoxGeometry(w,h,d),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
      const patch=m.userData.patchMetres||1;
      for(let i=0;i<p.count;i++) {
        const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));
        uv.setXY(i,(nx>.5?p.getZ(i)+z:p.getX(i)+x)/patch,
          (ny>.5?p.getZ(i)+z:p.getY(i)+y)/patch);
      }
      const q=rotation instanceof THREE.Quaternion?rotation:new THREE.Quaternion().setFromEuler(rotation||new THREE.Euler());
      const transform=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),q,new THREE.Vector3(1,1,1));
      if(frame)transform.premultiply(frame);
      this.geometry(g,m,transform);
    }
    beam(a,b,width,depth,m,frame=null) {
      const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),dir=end.clone().sub(start);
      const mid=start.clone().add(end).multiplyScalar(.5);
      this.box(width,dir.length(),depth,m,mid.x,mid.y,mid.z,new THREE.Quaternion().setFromUnitVectors(Y,dir.normalize()),frame);
    }
    pipe(a,b,r,m) {
      const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),dir=end.clone().sub(start);
      const g=new THREE.CylinderGeometry(r,r,dir.length(),8,1);
      const matrix=new THREE.Matrix4().compose(start.clone().add(end).multiplyScalar(.5),
        new THREE.Quaternion().setFromUnitVectors(Y,dir.normalize()),new THREE.Vector3(1,1,1));
      this.geometry(g,m,matrix);
    }
    finish(metadata) {
      let triangles=0;
      for(const [m,b]of this.batches) {
        const g=new THREE.BufferGeometry();
        g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));
        g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));
        g.setAttribute('uv',new THREE.Float32BufferAttribute(b.u,2));g.setIndex(b.i);
        g.computeBoundingBox();g.computeBoundingSphere();triangles+=b.i.length/3;
        const mesh=new THREE.Mesh(g,m);mesh.name=m.name;
        mesh.castShadow=m!==glass&&m!==lit;mesh.receiveShadow=m!==lit;
        if(m===glass)mesh.renderOrder=1;
        this.group.add(mesh);
      }
      this.group.userData.architecture={...metadata,parts:this.parts,drawCalls:this.batches.size,triangles};
      return this.group;
    }
  }
  const face=(x,z,angle)=>new THREE.Matrix4().compose(new THREE.Vector3(x,0,z),
    new THREE.Quaternion().setFromAxisAngle(Y,angle),new THREE.Vector3(1,1,1));

  function shellWall(b,width,height,frame,openings) {
    // Slice wall into rectangles around each opening. Frames/glass sit inside
    // a true recess, so oblique views show jamb depth rather than painted squares.
    const xs=[-width/2,width/2];
    for(const o of openings)xs.push(o.x-o.w/2,o.x+o.w/2);
    xs.sort((a,b)=>a-b);
    for(let i=0;i<xs.length-1;i++) {
      const left=xs[i],right=xs[i+1]; if(right-left<.001)continue;
      const mid=(left+right)/2;
      const cuts=openings.filter(o=>mid>o.x-o.w/2&&mid<o.x+o.w/2).sort((a,b)=>a.y-b.y);
      let bottom=.16;
      const panel=(low,high)=> {
        if(high-low<.005)return;
        b.box(right-left,high-low,.18,siding,mid,(low+high)/2,0,null,frame);
        // Slim batten strips catch grazing light. Stay within this wall rectangle.
        for(let u=Math.ceil(left/.30)*.30;u<right-.025;u+=.30)
          if(u>left+.025)b.box(.029,high-low,.029,trim,u,(low+high)/2,.102,null,frame);
      };
      for(const o of cuts){panel(bottom,o.y-o.h/2);bottom=o.y+o.h/2;}
      panel(bottom,height);
    }
    for(const o of openings) {
      if(o.type==='door')door(b,o,frame);
      else if(o.type==='open-door')doorFrame(b,o,frame);
      else window(b,o,frame);
    }
  }
  function window(b,o,f) {
    const {x,y,w,h}=o;
    b.box(w-.02,h-.02,.016,dark,x,y,-.105,null,f);
    b.box(w-.09,h-.09,.014,lit,x,y,-.087,null,f);
    b.box(w-.10,h-.10,.008,glass,x,y,-.055,null,f);
    // Recessed frame, outer casing, central mullion and horizontal meeting rail.
    for(const s of[-1,1]) {
      b.box(.055,h,.16,trim,x+s*(w/2-.025),y,-.01,null,f);
      b.box(w,.055,.16,trim,x,y+s*(h/2-.025),-.01,null,f);
      b.box(.075,h+.14,.07,trim,x+s*(w/2+.015),y,.13,null,f);
    }
    b.box(w+.15,.075,.09,trim,x,y+h/2+.025,.14,null,f);
    b.box(.035,h-.07,.055,trim,x,y,-.005,null,f);
    b.box(w-.07,.035,.055,trim,x,y-.025,-.005,null,f);
    b.box(w+.21,.10,.29,stoneLight,x,y-h/2-.045,.12,null,f);
    b.box(w+.24,.025,.18,metal,x,y+h/2+.077,.19,null,f);
  }
  function door(b,o,f) {
    const {x,y,w,h}=o, leaves=o.double?2:1;
    b.box(w,h,.025,dark,x,y,-.06,null,f);
    for(let k=0;k<leaves;k++) {
      const lw=w/leaves-.015,cx=x-w/2+(k+.5)*w/leaves;
      b.box(lw,h-.02,.09,wood,cx,y,.015,null,f);
      const boards=Math.ceil(lw/.19);
      for(let i=0;i<=boards;i++)b.box(.009,h-.035,.012,metal,cx-lw/2+i*lw/boards,y,.065,null,f);
      for(const yy of[y-h*.33,y+h*.33]) {
        b.box(lw-.08,.105,.07,wood,cx,yy,.095,null,f);
        b.box(.28,.032,.028,metal,cx+(k===0?-.24:.24)*lw,yy,.139,null,f);
      }
      b.beam([cx-lw*.42,y-h*.33,.10],[cx+lw*.42,y+h*.33,.10],.078,.035,wood,f);
      b.box(.045,.17,.045,metal,cx+(o.double?(k===0?1:-1):1)*lw*.32,y+.02,.122,null,f);
    }
    doorFrame(b,o,f);
  }
  function doorFrame(b,o,f) {
    // A separate frame allows gameplay to retain its own moving door leaves.
    // There is deliberately no recess/backing panel across an open doorway.
    const {x,y,w,h}=o;
    for(const s of[-1,1])b.box(.135,h+.13,.19,trim,x+s*(w/2+.055),y+.025,.10,null,f);
    b.box(w+.35,.15,.21,trim,x,y+h/2+.06,.11,null,f);
    b.box(w+.3,.095,.50,stoneLight,x,.06,.20,null,f);
    b.box(w+.6,.065,.30,stone,x,.029,.56,null,f);
    if(o.double) {
      b.box(w+1.1,.045,.045,metal,x,y+h/2+.22,.22,null,f);
      for(const xx of[x-w*.35,x+w*.35])b.box(.04,.23,.055,metal,xx,y+h/2+.12,.22,null,f);
    }
  }
  function foundation(b,w,d) {
    b.box(w+.17,.24,d+.17,mortar,0,.08,0);
    for(const s of[-1,1]) {
      for(let x=-w/2+.25;x<w/2;x+=.50)b.box(Math.min(.47,w/2-x+.25),.18,.12,
        Math.floor((x+w)*5)%3?stone:stoneLight,x,.11,s*(d/2+.055));
      for(let z=-d/2+.24;z<d/2;z+=.48)b.box(.12,.18,.45,stone,s*(w/2+.055),.11,z);
    }
  }
  function gable(b,d,eave,ridge,f) {
    const p=[],u=[],idx=[];
    for(const z of[-.09,.09])for(const [x,y]of[[-d/2,eave],[d/2,eave],[0,ridge]]){
      p.push(x,y,z);u.push(x/2.4,y/2.4);
    }
    idx.push(0,2,1,3,4,5,0,1,4,0,4,3,1,2,5,1,5,4,2,0,3,2,3,5);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));g.setIndex(idx);g.computeVertexNormals();b.geometry(g,siding,f);
    const ventY=eave+(ridge-eave)*.38,ventW=Math.min(.82,d*.25),ventH=.32;
    b.box(ventW,ventH,.025,dark,0,ventY,.107,null,f);
    for(let i=0;i<5;i++)b.box(ventW,.031,.068,trim,0,ventY-ventH/2+i*.07,.132,new THREE.Euler(.26,0,0),f);
  }
  function roofAssembly(b,w,d,eave,ridge,cottage=false) {
    const over=cottage?.24:.38,half=d/2+over,pitch=Math.atan2(ridge-eave,d/2);
    const low=ridge-half*Math.tan(pitch),length=half/Math.cos(pitch);
    for(const s of[-1,1]) {
      b.box(w+over*2,.12,length+.05,roof,0,(ridge+low)/2,s*half/2,new THREE.Euler(s*pitch,0,0));
      b.box(w+over*2+.08,.19,.12,trim,0,low-.035,s*half);
      b.box(w+.12,.045,over+.14,trim,0,eave-.085,s*(d/2+over*.4));
      // Open U-shaped gutter: bottom and two lips, not a solid oversized tube.
      b.box(w+over*2,.026,.115,metal,0,low-.14,s*(half+.025));
      for(const lip of[-1,1])b.box(w+over*2,.06,.016,metal,0,low-.105,s*(half+.025)+lip*.05);
      const px=w/2+over*.6,pz=s*(half+.03);
      b.pipe([px,low-.14,pz],[px,low-.36,pz],.038,metal);
      b.pipe([px,low-.36,pz],[w/2+.09,low-.56,s*(d/2+.10)],.038,metal);
      b.pipe([w/2+.09,low-.56,s*(d/2+.10)],[w/2+.09,.19,s*(d/2+.10)],.038,metal);
    }
    // Ridge cap follows the two roof planes; end rakes cover the roof thickness.
    for(const s of[-1,1])b.box(w+over*2+.08,.075,.23,metal,0,ridge+.035,s*.082,new THREE.Euler(s*pitch,0,0));
    for(const x of[-w/2-over,w/2+over])for(const s of[-1,1])
      b.beam([x,low-.015,s*half],[x,ridge+.005,0],.13,.15,trim);
  }
  function cornerPosts(b,w,d,h) {
    for(const x of[-1,1])for(const z of[-1,1]){
      b.box(.15,h-.15,.15,trim,x*(w/2+.015),(h+.15)/2,z*(d/2+.015));
      b.box(.20,.095,.20,stoneLight,x*(w/2+.015),.225,z*(d/2+.015));
    }
  }
  function lantern(b,x,y,z) {
    b.box(.07,.22,.07,metal,x,y+.1,z-.09);
    b.box(.10,.04,.23,metal,x,y+.22,z);
    b.box(.15,.23,.14,lamp,x,y,z+.07);
    for(const yy of[y-.13,y+.13])b.box(.21,.04,.19,metal,x,yy,z+.07);
    for(const xx of[x-.084,x+.084])b.box(.021,.24,.022,metal,xx,y,z+.143);
  }
  function buildBarn() {
    const b=new Builder('Meadowlark timber barn'),w=7,d=5.5,h=4.2,ridge=6.05;
    foundation(b,w,d);
    shellWall(b,w,h,face(0,d/2,0),[
      {type:'door',x:0,y:1.49,w:1.9,h:2.66,double:true},
      ...[-2.32,2.32].map(x=>({x,y:2.23,w:1.10,h:1.13}))]);
    shellWall(b,w,h,face(0,-d/2,Math.PI),[-2.2,0,2.2].map(x=>({x,y:2.15,w:1.1,h:1.1})));
    for(const s of[-1,1]) {
      const f=face(s*w/2,0,s*Math.PI/2);
      shellWall(b,d,h,f,[-1.45,1.45].map(x=>({x,y:2.1,w:1.07,h:1.13})));
      gable(b,d,h,ridge,f);
    }
    cornerPosts(b,w,d,h);roofAssembly(b,w,d,h,ridge);
    for(const x of[-1.4,1.4])lantern(b,x,2.60,d/2+.18);
    return b.finish({kind:'barn',width:w,depth:d,wallHeight:h,ridgeHeight:ridge,windows:9});
  }
  function buildCottage({variant=0}={}) {
    const b=new Builder('Cottonwood cottage '+variant),w=3.4,d=2.8,h=2.4,ridge=3.42;
    foundation(b,w,d);
    shellWall(b,w,h,face(0,d/2,0),[
      {type:'door',x:0,y:1.15,w:.88,h:1.98},
      ...[-1.05,1.05].map(x=>({x,y:1.46,w:.68,h:.79}))]);
    shellWall(b,w,h,face(0,-d/2,Math.PI),[{x:0,y:1.42,w:.98,h:.90}]);
    for(const s of[-1,1]) {
      const f=face(s*w/2,0,s*Math.PI/2);
      shellWall(b,d,h,f,[{x:-.20,y:1.42,w:.80,h:.90}]);gable(b,d,h,ridge,f);
    }
    cornerPosts(b,w,d,h);roofAssembly(b,w,d,h,ridge,true);
    // Chimney has distinct masonry courses, flashing, a cap and a recessed flue.
    for(let i=0;i<6;i++)b.box(.44+(i%2)*.018,.122,.44,brick,1.10,3.13+i*.122,-.50);
    b.box(.58,.055,.58,metal,1.10,3.15,-.50);
    b.box(.60,.095,.60,stoneLight,1.10,3.87,-.50);
    b.box(.34,.022,.34,dark,1.10,3.925,-.50);
    lantern(b,.65,1.91,d/2+.18);
    return b.finish({kind:'cottage',variant,width:w,depth:d,wallHeight:h,ridgeHeight:ridge,windows:5});
  }
  function buildOutbuilding({width=4.6,depth=3.2,height=3.4,
    animatedDoorOpening={width:2.3,height:2.5},name='Meadowlark stable outbuilding'}={}) {
    const w=width,d=depth,h=height;
    if(![w,d,h].every(v=>Number.isFinite(v)&&v>1))
      throw new RangeError('Outbuilding dimensions must be finite and greater than one metre');
    const spec=animatedDoorOpening===true?{}:(animatedDoorOpening||{});
    const dw=spec.width??spec.w??Math.min(2.3,w*.5);
    const dh=spec.height??spec.h??Math.min(2.5,h-.55);
    const dx=spec.x??0;
    if(![dw,dh,dx].every(Number.isFinite)||dw<=0||dh<=0||
      dw+Math.abs(dx)*2>w-.42||dh>h-.27)
      throw new RangeError('The outbuilding doorway must fit inside its front wall');
    const b=new Builder(name),ridge=h+Math.min(1.15,d*.31);
    const opening={type:'open-door',x:dx,y:dh/2,w:dw,h:dh};
    foundation(b,w,d);

    // Low inset floor and roof trusses make the open entrance read as a room.
    // Neither can occupy the door aperture used by the game's animated leaves.
    b.box(w-.23,.026,d-.23,wood,0,.205,0);
    for(const x of[-w*.28,w*.28]) {
      b.box(.11,.15,d-.2,wood,x,h-.15,0);
      for(const s of[-1,1])b.beam([x,h-.15,s*(d/2-.12)],
        [x,ridge-.14,0],.095,.10,wood);
    }

    const frontWindows=[];
    for(const s of[-1,1]) {
      const inner=dx+s*dw/2,outer=s*w/2;
      const clear=Math.abs(outer-inner);
      if(clear>.86)frontWindows.push({x:(inner+outer)/2,
        y:Math.min(h-.60,dh*.69+.16),w:Math.min(.68,clear-.48),
        h:Math.min(.90,h*.34)});
    }
    shellWall(b,w,h,face(0,d/2,0),[opening,...frontWindows]);

    // Rear faces are prominent from the arrival arena; give them the same
    // recessed casements, sills, cladding and rainwater detailing as the front.
    const backWindows=(w>4?[-w*.24,w*.24]:[0]).map(x=>({x,
      y:Math.min(h-.75,h*.58),w:Math.min(1.02,w*.25),h:Math.min(1.02,h*.36)}));
    shellWall(b,w,h,face(0,-d/2,Math.PI),backWindows);
    for(const s of[-1,1]) {
      const f=face(s*w/2,0,s*Math.PI/2);
      shellWall(b,d,h,f,[{x:0,y:Math.min(h-.75,h*.58),
        w:Math.min(.90,d*.32),h:Math.min(1.0,h*.36)}]);
      gable(b,d,h,ridge,f);
    }
    cornerPosts(b,w,d,h);roofAssembly(b,w,d,h,ridge,true);
    lantern(b,dx,Math.min(h-.30,dh+.36),d/2+.18);
    return b.finish({kind:'outbuilding',width:w,depth:d,wallHeight:h,
      ridgeHeight:ridge,windows:frontWindows.length+backWindows.length+2,
      animatedDoorOpening:{x:dx,width:dw,height:dh,bottomY:0,frontZ:d/2},
      suggestedLabelY:ridge+.28});
  }
  function buildOpenStall() {
    // The barn row faces -X. Its clear horse entrance, 1.9 x 3.2 footprint
    // and sloping roof match the original placement and turnout animation.
    const b=new Builder('Meadowlark open timber stall');
    const backX=.9,frontX=-.9,halfZ=1.6,wallHeight=2.3;
    shellWall(b,3.2,wallHeight,face(backX,0,Math.PI/2),[
      {x:0,y:1.42,w:1.06,h:.85}]);
    b.box(.24,.15,3.23,stone,backX,.075,0);

    for(const s of[-1,1]) {
      const z=s*halfZ;
      // Low boarded dividers and spaced upper rails keep the side partitions
      // readable without closing the stalls into opaque boxes.
      b.box(1.81,.52,.085,siding,0,.46,z);
      for(const y of[.79,1.48,2.26])b.box(1.9,.105,.12,wood,0,y,z);
      for(let x=-.70;x<=.71;x+=.28)b.box(.046,.61,.055,trim,x,1.12,z);
      for(const x of[frontX,backX]) {
        const top=x<0?2.58:2.38;
        b.box(.145,top,.145,wood,x,top/2,z);
        b.box(.19,.17,.19,stoneLight,x,.085,z);
      }
      // Small braces connect the high front posts to the roof supports.
      b.beam([frontX,2.12,z],[frontX+.35,2.54,z],.075,.075,wood);
      b.beam([frontX,2.12,z],[frontX,2.52,z-s*.38],.075,.075,wood);
    }
    b.box(.13,.16,3.26,wood,frontX,2.50,0);
    b.box(.12,.13,3.24,wood,backX,2.33,0);

    const roofW=2.6,roofD=3.5,roofX=.1,roofY=2.55,angle=-.12;
    const slope=new THREE.Euler(0,0,angle),roofHalfX=Math.cos(angle)*roofW/2;
    b.box(roofW,.14,roofD,roof,roofX,roofY,0,slope);
    for(const s of[-1,1]) {
      b.box(roofW+.04,.14,.10,trim,roofX,roofY-.025,s*(roofD/2+.012),slope);
      const x=roofX+s*roofHalfX,y=roofY+s*Math.sin(angle)*roofW/2;
      b.box(.105,.17,roofD+.12,trim,x,y-.035,0);
    }
    // Rainwater drains at the low rear roof edge, away from the entrance.
    const gutterX=roofX+roofHalfX+.07,gutterY=roofY+Math.sin(angle)*roofW/2-.145;
    b.box(.13,.023,roofD+.07,metal,gutterX,gutterY,0);
    for(const s of[-1,1])b.box(.018,.066,roofD+.07,metal,gutterX+s*.059,gutterY+.028,0);
    const drainZ=-halfZ+.14;
    b.pipe([gutterX,gutterY,drainZ],[gutterX,gutterY-.19,drainZ],.029,metal);
    b.pipe([gutterX,gutterY-.19,drainZ],[backX+.13,gutterY-.38,drainZ],.029,metal);
    b.pipe([backX+.13,gutterY-.38,drainZ],[backX+.13,.16,drainZ],.029,metal);
    return b.finish({kind:'open-stall',width:1.9,depth:3.2,wallHeight,
      roofCenter:[roofX,roofY,0],roofRotationZ:angle,openFrontX:frontX,
      backWallX:backX,windows:1,maximumHeight:2.78});
  }
  function detailRunIn(group,{width=6,depth=3.2,height=2.6,
    roofCenterY=2.95,roofAngle=-.18,roofDepth=4.2}={}) {
    // Additive only. Existing open entrance, shelter walls and placement remain.
    if(group.userData.ranchDetails)return group.userData.ranchDetails;
    const b=new Builder('Run-in shelter joinery');
    const frontHeight=roofCenterY-Math.sin(roofAngle)*roofDepth/2-.03;
    for(const s of[-1,1]) {
      b.box(.16,frontHeight,.18,trim,s*width/2,frontHeight/2,depth/2);
      b.box(.16,height,.18,trim,s*width/2,height/2,-depth/2);
      b.beam([s*width/2,frontHeight-.6,depth/2],[s*(width/2-.50),frontHeight-.1,depth/2],.09,.09,wood);
    }
    b.box(width+.18,.22,.20,wood,0,frontHeight-.10,depth/2);
    b.box(width+.16,.17,.18,stone,0,.07,-depth/2);
    b.box(width+.65,.18,.10,trim,0,frontHeight,depth/2+.53);
    const g=b.finish({kind:'run-in-details',width,depth});group.add(g);
    group.userData.ranchDetails=g;return g;
  }
  return {buildBarn,buildCottage,buildOutbuilding,buildOpenStall,detailRunIn,materials,maps,
    sidingMaterial:siding,roofMaterial:roof};
}

import {recordSolidPart} from './solid-collisions.js?v=solid-world-1';
/* Original ranch architecture. Metre-scaled materials, real wall openings and
   batched static details. Collision part bounds are retained before batching;
   placement and collision resolution belong to the world. */
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
  /* The siding photo is white-painted weathered board, and untinted it made every barn in the
     valley a cold grey — the single biggest difference between the ranch you spawn into and the
     warm timber of the riding game this is modelled on, whose cabins, pavilions and stalls are all
     natural wood. Multiplying the photo by a honey-oak tint keeps every board line and scuff and
     turns the paint into stain; the joinery stays white, which is the classic ranch pairing. */
  const siding = material('Ranch | weathered timber siding', {
    color: '#b39578', map: map('siding_albedo.jpg', true),
    normalMap: map('siding_normal.jpg'), normalScale: new THREE.Vector2(.48,.48),
    roughnessMap: map('siding_roughness.jpg'), roughness: 1, envMapIntensity: .55,
  }, 2.4);
  const cottageWalls=['#f7e9cc','#e5ead7','#f0d7c3'].map((color,i)=>material('Village | limewashed plaster '+i,{
    color:new THREE.Color(color).multiplyScalar(1.7),map:map('../village/painted_plaster_wall_diff.webp',true),roughness:1,
    normalMap:map('../village/painted_plaster_wall_nor_gl.webp'),normalScale:new THREE.Vector2(.32,.32),
    roughnessMap:map('../village/painted_plaster_wall_arm.webp'),envMapIntensity:.6,
  },2));
  const shutters=['#4c6659','#526a77','#766650'].map((color,i)=>material('Village | painted shutters '+i,{
    color,roughness:.9,normalMap:map('../builder/coated_pine_nor_gl.webp'),normalScale:new THREE.Vector2(.22,.22),
  },1));
  const roof = material('Ranch | aged cedar shingles', {
    color: '#b9b4a6', map: map('roof_albedo.jpg', true),
    normalMap: map('roof_normal.jpg'), normalScale: new THREE.Vector2(.52,.52),
    roughnessMap: map('roof_roughness.jpg'), roughness: 1, envMapIntensity: .45,
  }, 1.8);
  const slate = material('Village | blue grey slate', {
    color:'#d0dce2',map:map('../village/roof_slates_03_diff.webp',true),
    normalMap:map('../village/roof_slates_03_nor_gl.webp'),normalScale:new THREE.Vector2(.68,.68),
    roughnessMap:map('../village/roof_slates_03_arm.webp'),roughness:1,envMapIntensity:.5,
  },3);
  const clay=material('Village | weathered clay tiles',{
    color:'#ead8c3',map:map('../village/clay_roof_tiles_diff.webp',true),
    normalMap:map('../village/clay_roof_tiles_nor_gl.webp'),normalScale:new THREE.Vector2(.75,.75),
    roughnessMap:map('../village/clay_roof_tiles_arm.webp'),roughness:1,envMapIntensity:.5,
  },4);
  const clayEdge=material('Village | clay ridge caps',{color:'#995f3d',roughness:.95});
  const canvas = material('Village | woven awning', {color:'#e9dcc3',roughness:1});
  const trim = material('Ranch | warm painted joinery', {color:'#dcdad0',roughness:.87,
    normalMap:map('../builder/coated_pine_nor_gl.webp'),normalScale:new THREE.Vector2(.20,.20),
    roughnessMap:map('../builder/coated_pine_arm.webp')});
  const wood = material('Ranch | oiled oak doors', {color:'#69513d',roughness:.8,
    map:map('siding_albedo.jpg',true)},2.4);
  const metal = material('Ranch | dark ironwork', {color:'#333a38',roughness:.66,metalness:.58});
  const stone = material('Ranch | foundation stone', {color:'#949084',roughness:1,
    map:map('rock_albedo.jpg',true),normalMap:map('rock_normal.jpg'),normalScale:new THREE.Vector2(.42,.42)},1.6);
  const stoneLight = material('Ranch | dressed limestone', {color:'#bbb5a5',roughness:.97,
    map:map('rock_albedo.jpg',true),normalMap:map('rock_normal.jpg'),normalScale:new THREE.Vector2(.24,.24)},1.6);
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
    geometry(g,m,matrix = new THREE.Matrix4(),solid = true) {
      if(solid)recordSolidPart(THREE,this.group,g,m,matrix);
      g.applyMatrix4(matrix);
      let b=this.batches.get(m); if(!b){b={p:[],n:[],u:[],i:[]};this.batches.set(m,b);}
      const offset=b.p.length/3;
      b.p.push(...g.attributes.position.array);b.n.push(...g.attributes.normal.array);
      b.u.push(...g.attributes.uv.array);
      if(g.index) for(const i of g.index.array)b.i.push(i+offset);
      else for(let i=0;i<g.attributes.position.count;i++)b.i.push(i+offset);
      this.parts++;g.dispose();
    }
    box(w,h,d,m,x=0,y=0,z=0,rotation=null,frame=null,turnUV=false) {
      if(w<=0||h<=0||d<=0)return;
      const g=new THREE.BoxGeometry(w,h,d),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
      const patch=m.userData.patchMetres||1;
      for(let i=0;i<p.count;i++) {
        const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));
        // Dormer and porch ridges run perpendicular to the main roof. Keep
        // slate courses across each slope, with the photographed 3 m scale.
        uv.setXY(i,((ny>.5&&turnUV)||nx>.5?p.getZ(i)+z:p.getX(i)+x)/patch,
          (ny>.5?(turnUV?p.getX(i)+x:p.getZ(i)+z):p.getY(i)+y)/patch);
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

  function shellWall(b,width,height,frame,openings,wall=siding,base=.16) {
    // Slice wall into rectangles around each opening. Frames/glass sit inside
    // a true recess, so oblique views show jamb depth rather than painted squares.
    const xs=[-width/2,width/2];
    for(const o of openings)xs.push(o.x-o.w/2,o.x+o.w/2);
    xs.sort((a,b)=>a-b);
    for(let i=0;i<xs.length-1;i++) {
      const left=xs[i],right=xs[i+1]; if(right-left<.001)continue;
      const mid=(left+right)/2;
      const cuts=openings.filter(o=>mid>o.x-o.w/2&&mid<o.x+o.w/2).sort((a,b)=>a.y-b.y);
      let bottom=base;
      const panel=(low,high)=> {
        if(high-low<.005)return;
        b.box(right-left,high-low,.18,wall,mid,(low+high)/2,0,null,frame);
        // Slim batten strips catch grazing light. Stay within this wall rectangle.
        for(let u=Math.ceil(left/.30)*.30;wall===siding&&u<right-.025;u+=.30)
          if(u>left+.025)b.box(.038,high-low,.029,siding,u,(low+high)/2,.102,null,frame);
      };
      for(const o of cuts){panel(bottom,o.y-o.h/2);bottom=o.y+o.h/2;}
      panel(bottom,height);
    }
    for(const o of openings) {
      if(o.type==='door')door(b,o,frame);
      else if(o.type==='open-door')doorFrame(b,o,frame);
      else if(o.type==='arch-window')archedWindow(b,o,frame,o.wall,o.edge);
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
    if(o.domestic){
      const paint=o.paint||shutters[0];
      b.box(w,h,.10,paint,x,y,.015,null,f);
      for(const dx of[-w*.235,w*.235]){
        b.box(w*.38,h*.34,.025,trim,x+dx,y-h*.23,.08,null,f);
        b.box(w*.32,h*.29,.029,paint,x+dx,y-h*.23,.10,null,f);
      }
      const wy=y+h*.23;
      b.box(w*.72,h*.33,.015,dark,x,wy,.08,null,f);
      b.box(w*.61,h*.28,.012,lit,x,wy,.095,null,f);
      b.box(.025,h*.30,.035,trim,x,wy,.12,null,f);
      b.box(w*.64,.025,.035,trim,x,wy,.12,null,f);
      b.box(.045,.10,.055,metal,x+w*.35,y,.14,null,f);
      doorFrame(b,o,f);return;
    }
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
  function gable(b,d,eave,ridge,f,wall=siding,vent=true,aperture=null) {
    const p=[],u=[],idx=[],patch=wall.userData.patchMetres||1;
    for(const z of[-.09,.09])for(const [x,y]of[[-d/2,eave],[d/2,eave],[0,ridge]]){
      p.push(x,y,z);u.push(x/patch,y/patch);
    }
    idx.push(0,2,1,3,4,5,0,1,4,0,4,3,1,2,5,1,5,4,2,0,3,2,3,5);
    let g;
    if(aperture){
      const shape=new THREE.Shape();shape.moveTo(-d/2,eave);shape.lineTo(d/2,eave);shape.lineTo(0,ridge);shape.closePath();
      const opening=new THREE.Path();opening.absarc(aperture.x,aperture.y,aperture.r,0,Math.PI*2,true);shape.holes.push(opening);
      g=new THREE.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:false,curveSegments:24});g.translate(0,0,-.09);
      const pos=g.attributes.position,normal=g.attributes.normal,uv=g.attributes.uv;
      for(let i=0;i<pos.count;i++){
        const nx=Math.abs(normal.getX(i)),ny=Math.abs(normal.getY(i)),nz=Math.abs(normal.getZ(i));
        uv.setXY(i,(nx>nz&&nx>ny?pos.getZ(i):pos.getX(i))/patch,
          (ny>nz&&ny>nx?pos.getZ(i):pos.getY(i))/patch);
      }
    }else{
      g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
      g.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));g.setIndex(idx);g.computeVertexNormals();
    }
    b.geometry(g,wall,f);
    if(!vent)return;
    const ventY=eave+(ridge-eave)*.38,ventW=Math.min(.82,d*.25),ventH=.32;
    b.box(ventW,ventH,.025,dark,0,ventY,.107,null,f);
    for(let i=0;i<5;i++)b.box(ventW,.031,.068,trim,0,ventY-ventH/2+i*.07,.132,new THREE.Euler(.26,0,0),f);
  }
  function roofAssembly(b,w,d,eave,ridge,cottage=false,cover=roof) {
    const over=cottage?.24:.38,half=d/2+over,pitch=Math.atan2(ridge-eave,d/2);
    const low=ridge-half*Math.tan(pitch),length=half/Math.cos(pitch);
    for(const s of[-1,1]) {
      b.box(w+over*2,.12,length+.05,cover,0,(ridge+low)/2,s*half/2,new THREE.Euler(s*pitch,0,0));
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
  function stoneSkirt(b,w,d,doorWidth=1.25) {
    // Individually coursed plinth and corner quoins, leaving the doorway clear.
    for(const side of[-1,1])for(let row=0;row<2;row++){
      for(let x=-w/2+.23;x<w/2;x+=.46){
        if(side===1&&Math.abs(x)<doorWidth/2+.24)continue;
        b.box(.435,.185,.125,(row+Math.round(x*6))%3?stoneLight:stone,x,.24+row*.195,side*(d/2+.07));
      }
      for(let z=-d/2+.22;z<d/2;z+=.44)
        b.box(.125,.185,.415,stoneLight,side*(w/2+.07),.24+row*.195,z);
    }
    for(const x of[-1,1])for(const z of[-1,1])for(let row=0;row<6;row++)
      b.box(row%2?.16:.28,.19,row%2?.28:.16,stoneLight,x*(w/2+.01),.27+row*.215,z*(d/2+.01));
  }
  function dormer(b,x,width,eave,ridge,wall) {
    const front=1.10,depth=1.36,base=eave+.20,top=ridge-.42,peak=ridge+.15;
    const f=face(x,front,0),wh=top-base-.22;
    // Window is cut into the front wall; side cheeks disappear into the main roof.
    shellWall(b,width,top,f,[{x:0,y:(top+base)/2,w:width*.59,h:wh}],wall,base);
    gable(b,width,top,peak,f,wall,false);
    for(const side of[-1,1]){
      b.box(.10,top-base,depth,wall,x+side*width/2,(top+base)/2,front-depth/2);
      const half=width/2+.14,pitch=Math.atan2(peak-top,width/2),low=peak-half*Math.tan(pitch);
      b.box(half/Math.cos(pitch),.095,depth+.20,slate,x+side*half/2,(peak+low)/2,front-depth/2,new THREE.Euler(0,0,-side*pitch),null,true);
      b.beam([x,peak,front+.12],[x+side*half,low,front+.12],.085,.10,trim);
      b.box(.085,top-base,.12,trim,x+side*(width/2+.015),(top+base)/2,front+.065);
    }
    b.box(.12,.08,depth+.20,metal,x,peak+.035,front-depth/2);
  }
  function doorHood(b,z) {
    const half=.72,peak=2.72,low=2.39,pitch=Math.atan2(peak-low,half);
    for(const side of[-1,1]){
      b.box(half/Math.cos(pitch),.09,.92,slate,side*half/2,(peak+low)/2,z+.32,new THREE.Euler(0,0,-side*pitch),null,true);
      b.beam([0,peak,z+.79],[side*half,low,z+.79],.085,.10,trim);
      b.beam([side*.53,2.19,z+.1],[side*.53,2.42,z+.57],.065,.065,wood);
    }
  }
  function buildCottage({variant=0}={}) {
    const b=new Builder('Cottonwood cottage '+variant),w=3.4,d=2.8,h=2.82,ridge=4.55;
    const index=Math.abs(variant)%3,wall=cottageWalls[index],shutter=shutters[index];
    const windowBoxes=[];
    foundation(b,w,d);
    shellWall(b,w,h,face(0,d/2,0),[
      {type:'door',domestic:true,paint:shutter,x:0,y:1.15,w:.88,h:1.98},
      ...[-1.05,1.05].map(x=>({x,y:1.59,w:.68,h:1.04}))],wall);
    shellWall(b,w,h,face(0,-d/2,Math.PI),[{x:0,y:1.62,w:.98,h:1.10}],wall);
    for(const side of[-1,1]) {
      const f=face(side*w/2,0,side*Math.PI/2);
      // Ground-floor casements are recessed into the plaster shell.
      shellWall(b,d,h,f,[{x:-.20,y:1.65,w:.80,h:1.12}],wall);
      gable(b,d,h,ridge,f,wall,false,{x:0,y:3.52,r:.19});
      for(const x of[-.78,.38]){
        b.box(.25,1.14,.052,shutter,x,1.65,.15,null,f);
        for(let j=0;j<8;j++)b.box(.24,.038,.021,shutter,x,1.18+j*.135,.18,null,f);
      }
      // A round loft light is cut through the gable, with a stone surround.
      for(const [r,z,m]of[[.188,-.11,dark],[.174,-.085,lit],[.17,-.052,glass]])
        b.geometry(new THREE.CircleGeometry(r,24),m,new THREE.Matrix4().makeTranslation(0,3.52,z).premultiply(f));
      b.geometry(new THREE.TorusGeometry(.203,.031,6,24),stoneLight,
        new THREE.Matrix4().makeTranslation(0,3.52,.10).premultiply(f));
      b.box(.022,.34,.07,trim,0,3.52,-.01,null,f);
      b.box(.34,.022,.07,trim,0,3.52,-.01,null,f);
    }
    for(const x of[-1.05,1.05]){
      for(const side of[-1,1]){
        const sx=x+side*.48;b.box(.22,1.06,.055,shutter,sx,1.59,d/2+.15);
        for(let j=0;j<7;j++)b.box(.215,.03,.025,shutter,sx,1.17+j*.14,d/2+.19);
      }
      b.box(.80,.18,.24,wood,x,1.01,d/2+.21);
      b.box(.68,.03,.18,mortar,x,1.105,d/2+.22);
      windowBoxes.push({x,y:1.12,z:d/2+.21,width:.65,height:.22});
    }
    cornerPosts(b,w,d,h);stoneSkirt(b,w,d);roofAssembly(b,w,d,h,ridge,true,slate);
    dormer(b,variant%2?.52:0,variant%2?1.05:1.30,h,ridge,wall);
    doorHood(b,d/2);
    // Short flagstone threshold and planted stone tubs frame, rather than occupy, the entry.
    for(let row=0;row<3;row++)for(const x of[-.36,.36])
      b.box(.69,.045,.33,stoneLight,x,.024,d/2+.30+row*.35);
    for(const x of[-1.39,1.39]){
      b.box(.51,.34,.55,stoneLight,x,.17,d/2+.67);
      b.box(.54,.065,.58,stone,x,.33,d/2+.67);
      b.box(.41,.015,.45,mortar,x,.369,d/2+.67);
      windowBoxes.push({x,y:.38,z:d/2+.67,width:.38,height:.38});
    }
    // Masonry chimney, stone cap and twin terracotta pots.
    const chimneyX=variant%2?-1.06:1.10,chimneyZ=-.48,chimneyBase=4.00;
    for(let i=0;i<7;i++)b.box(.44+(i%2)*.018,.122,.44,brick,chimneyX,chimneyBase+i*.122,chimneyZ);
    b.box(.58,.055,.58,metal,chimneyX,chimneyBase+.04,chimneyZ);
    b.box(.60,.095,.60,stoneLight,chimneyX,4.84,chimneyZ);
    for(const dx of[-.13,.13]){
      b.pipe([chimneyX+dx,4.87,chimneyZ],[chimneyX+dx,5.12,chimneyZ],.085,brick);
      b.box(.10,.018,.10,dark,chimneyX+dx,5.135,chimneyZ);
    }
    lantern(b,.63,2.06,d/2+.18);
    return b.finish({kind:'cottage',variant,width:w,depth:d,wallHeight:h,ridgeHeight:ridge,
      windows:8,dormers:1,windowBoxes,suggestedLabelY:5.45});
  }
  function hippedRoof(b,w,d,eave,rise) {
    const x=w/2+.30,z=d/2+.30,r=Math.max(.15,(w-d)/2),peak=eave+rise;
    // Four watertight slopes, with metre-scaled tile rows along each eave.
    const faces=[
      [[-x,eave,z],[x,eave,z],[r,peak,0],[-r,peak,0]],
      [[x,eave,-z],[-x,eave,-z],[-r,peak,0],[r,peak,0]],
      [[x,eave,z],[x,eave,-z],[r,peak,0]],
      [[-x,eave,-z],[-x,eave,z],[-r,peak,0]],
    ];
    for(let side=0;side<faces.length;side++){
      const p=faces[side],g=new THREE.BufferGeometry(),uv=[];
      for(const v of p){const across=side<2?v[0]:v[2],run=side<2?z-Math.abs(v[2]):x-Math.abs(v[0]);
        uv.push(across/4,Math.hypot(run,v[1]-eave)/4);}
      g.setAttribute('position',new THREE.Float32BufferAttribute(p.flat(),3));
      g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      g.setIndex(p.length===4?[0,1,2,0,2,3]:[0,1,2]);g.computeVertexNormals();b.geometry(g,clay);
    }
    // Separate overlapping ridge and hip caps cast a small, real silhouette.
    const cap=(a,c)=>{const A=new THREE.Vector3(...a),B=new THREE.Vector3(...c),n=Math.ceil(A.distanceTo(B)/.30);
      for(let i=0;i<n;i++)b.pipe(A.clone().lerp(B,i/n).toArray(),A.clone().lerp(B,Math.min(1,(i+1.12)/n)).toArray(),.09,clayEdge);};
    cap([-r,peak+.025,0],[r,peak+.025,0]);
    for(const sx of[-1,1])for(const sz of[-1,1])cap([sx*x,eave+.025,sz*z],[sx*r,peak+.025,0]);
    for(const s of[-1,1]){
      b.box(w+.65,.14,.14,stoneLight,0,eave-.06,s*z);
      b.box(.14,.14,d+.65,stoneLight,s*x,eave-.06,0);
      b.pipe([s*(x-.10),eave-.15,z+.035],[s*(w/2+.12),.18,d/2+.11],.036,metal);
    }
  }
  function buildTownhouse({style,variant=0,width=5.8,depth=4.2,store=false,name='Cottonwood village house'}={}) {
    if(style==='coaching-inn')return buildCoachingInn({width,depth,name});
    const w=width,d=depth,h=6.25,split=3.25,ridge=h+1.18;
    if(![w,d].every(Number.isFinite)||w<5||d<3.5)throw new RangeError('Village houses need a full three-bay facade');
    const b=new Builder(name),index=Math.abs(variant)%3,wall=cottageWalls[index],paint=shutters[index];
    const dw=store?1.40:1.18,dh=2.68,front=face(0,d/2,0),bay=w*.30,windowBoxes=[];
    foundation(b,w,d);stoneSkirt(b,w,d,dw+.15);
    const groundWindows=[-bay,bay].map(x=>({x,y:1.73,w:store?1.20:.95,h:store?1.66:1.50}));
    const upper=[-bay,0,bay].map(x=>({x,y:4.65,w:.94,h:1.64}));
    shellWall(b,w,h,front,[{type:store?'open-door':'door',domestic:true,paint,x:0,y:dh/2+.08,w:dw,h:dh},...groundWindows,...upper],wall);
    shellWall(b,w,h,face(0,-d/2,Math.PI),[...[-bay,0,bay].map(x=>({x,y:1.73,w:.90,h:1.45})),...upper],wall);
    for(const side of[-1,1]){
      const f=face(side*w/2,0,side*Math.PI/2);
      shellWall(b,d,h,f,[...[-d*.25,d*.25].map(x=>({x,y:1.73,w:.86,h:1.45})),...[-d*.25,d*.25].map(x=>({x,y:4.65,w:.86,h:1.64}))],wall);
      for(const y of[split,h-.14])b.box(d+.26,.13,.14,stoneLight,0,y,.10,null,f);
      for(const x of[-d*.25,d*.25])for(const s of[-1,1])b.box(.24,1.66,.055,paint,x+s*.61,4.65,.14,null,f);
    }
    for(const z of[-d/2,d/2])for(const y of[split,h-.14])b.box(w+.30,.13,.16,stoneLight,0,y,z);
    for(const x of[-1,1])for(const z of[-1,1])for(let row=0;row<15;row++)
      b.box(row%2?.16:.30,.23,row%2?.30:.16,stoneLight,x*(w/2+.015),.60+row*.37,z*(d/2+.015));
    for(const win of upper)for(const s of[-1,1]){
      const x=win.x+s*.65;b.box(.28,1.66,.055,paint,x,win.y,d/2+.14);
      for(let k=0;k<10;k++)b.box(.26,.035,.025,paint,x,win.y-.70+k*.155,d/2+.177);
    }
    // A shallow iron balcony at the first-floor window keeps the street open below.
    const bw=store?2.25:2.70,bz=d/2+.68,by=3.62;
    b.box(bw,.13,.84,stoneLight,0,by,d/2+.37);
    for(const side of[-1,1]){
      b.beam([side*bw*.35,by-.65,d/2+.10],[side*bw*.35,by-.10,bz-.1],.12,.12,stoneLight);
      b.box(.045,.065,.76,metal,side*(bw/2-.05),by+.95,d/2+.36);
      for(let k=0;k<5;k++)b.box(.028,.80,.028,metal,side*(bw/2-.05),by+.49,d/2+.05+k*.15);
    }
    for(const y of[by+.16,by+.94])b.box(bw-.08,.055,.045,metal,0,y,bz);
    for(let i=0;i<16;i++)b.box(.026,.78,.026,metal,-bw/2+.08+i*(bw-.16)/15,by+.54,bz);
    for(const x of[-bay,bay]){
      b.box(1.03,.18,.28,wood,x,3.79,d/2+.21);b.box(.89,.025,.22,mortar,x,3.89,d/2+.21);
      windowBoxes.push({x,y:3.91,z:d/2+.21,width:.86,height:.23});
    }
    if(store){
      const aw=w-.35,ay=3.10;
      for(let i=0;i<18;i++){const x=-aw/2+(i+.5)*aw/18,m=i%2?canvas:paint;
        b.box(aw/18,.038,.92,m,x,ay,d/2+.44,new THREE.Euler(.14,0,0));
        b.box(aw/18,.12,.04,m,x,ay-.12,d/2+.89);}
      b.box(w-.20,.21,.10,paint,0,3.39,d/2+.13);
    }else{
      b.box(dw+.55,.13,.62,stoneLight,0,2.94,d/2+.24);
      for(const s of[-1,1])b.beam([s*(dw/2+.10),2.51,d/2+.12],[s*(dw/2+.10),2.86,d/2+.48],.08,.08,stoneLight);
    }
    for(const s of[-1,1]){
      lantern(b,s*(dw/2+.35),2.25,d/2+.18);
      b.box(.54,.43,.55,stoneLight,s*(w/2-.39),.22,d/2+.54);
      b.box(.43,.025,.44,mortar,s*(w/2-.39),.448,d/2+.54);
      windowBoxes.push({x:s*(w/2-.39),y:.47,z:d/2+.54,width:.39,height:.42});
    }
    hippedRoof(b,w,d,h,1.18);
    const cx=-w*.27,cz=-d*.19;
    b.box(.47,1.24,.52,brick,cx,ridge-.18,cz);b.box(.62,.10,.67,stoneLight,cx,ridge+.48,cz);
    for(const dx of[-.13,.13])b.pipe([cx+dx,ridge+.53,cz],[cx+dx,ridge+.82,cz],.078,clayEdge);
    return b.finish({kind:'townhouse',exterior:'village',variant,width:w,depth:d,wallHeight:h,ridgeHeight:ridge,
      store,storeys:2,roofStyle:'hipped-clay',windows:19,balconies:1,windowBoxes,suggestedLabelY:ridge+1.05,
      animatedDoorOpening:store?{x:0,width:dw,height:dh,bottomY:.08,frontZ:d/2}:null});
  }
  // Arches are open geometry with deep reveals, not dark panels on a flat wall.
  function archShape(x,bottom,r,spring){
    const s=new THREE.Shape();s.moveTo(x-r,bottom);s.lineTo(x+r,bottom);s.lineTo(x+r,spring);
    s.absarc(x,spring,r,0,Math.PI,false);s.closePath();return s;
  }
  function masonryUV(g,m){
    const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,scale=m.userData.patchMetres||1;
    // Project reveals along their own faces as well as the front. XY-only UVs
    // collapse across an arch's depth and stretch the photograph into stripes.
    for(let i=0;i<p.count;i++){
      const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
      uv.setXY(i,(nx>ny&&nx>nz?p.getZ(i):p.getX(i))/scale,(ny>nx&&ny>nz?p.getZ(i):p.getY(i))/scale);
    }
    return g;
  }
  function archMasonry(b,x,r,spring,top,z,depth,wall,frame=null){
    const s=new THREE.Shape();s.moveTo(x-r,spring);s.lineTo(x-r,top);s.lineTo(x+r,top);s.lineTo(x+r,spring);
    s.absarc(x,spring,r,0,Math.PI,false);s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:18});g.translate(0,0,z-depth/2);
    // A single bounding box spans the empty arch. Narrow proxies follow its
    // curve, preserving mounted headroom when the cobbled ground rises slightly.
    const f=frame||new THREE.Matrix4(),slices=24;
    for(let i=0;i<slices;i++){
      const left=-r+2*r*i/slices,right=-r+2*r*(i+1)/slices;
      const bottom=spring+Math.sqrt(Math.max(0,r*r-Math.max(left*left,right*right)));
      if(top-bottom<.02)continue;
      const proxy=new THREE.BoxGeometry(right-left,top-bottom,depth);
      const transform=new THREE.Matrix4().makeTranslation(x+(left+right)/2,(top+bottom)/2,z).premultiply(f);
      recordSolidPart(THREE,b.group,proxy,wall,transform);proxy.dispose();
    }
    b.geometry(masonryUV(g,wall),wall,f,false);
  }
  function archTrim(b,x,r,spring,z,depth,mat,frame=null){
    // Individual wedge stones leave small mortar seams and true keystone edges.
    const count=13,outer=r+.16;
    for(let i=0;i<count;i++){
      const a=i*Math.PI/count+.009,c=(i+1)*Math.PI/count-.009,s=new THREE.Shape();
      s.moveTo(x+Math.cos(a)*r,spring+Math.sin(a)*r);
      s.absarc(x,spring,r,a,c,false);s.lineTo(x+Math.cos(c)*outer,spring+Math.sin(c)*outer);
      s.absarc(x,spring,outer,c,a,true);s.closePath();
      const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:3});g.translate(0,0,z);
      b.geometry(masonryUV(g,mat),mat,frame||new THREE.Matrix4());
    }
  }
  function archedWindow(b,o,f,wall=cottageWalls[0],edge=stoneLight){
    const {x,y,w,h}=o,bottom=y-h/2,r=w/2,spring=y+h/2-r;
    archMasonry(b,x,r,spring,y+h/2,0,.18,wall,f);
    for(const [inset,z,m]of[[0,-.105,dark],[.035,-.084,lit],[.05,-.05,glass]]){
      const g=new THREE.ShapeGeometry(archShape(x,bottom+inset,r-inset,spring),18);
      b.geometry(g,m,new THREE.Matrix4().makeTranslation(0,0,z).premultiply(f));
    }
    archTrim(b,x,r,spring,.10,.12,edge,f);
    for(const side of[-1,1])b.box(.13,spring-bottom,.23,edge,x+side*(r+.065),(spring+bottom)/2,.13,null,f);
    b.box(w+.33,.12,.36,edge,x,bottom-.035,.15,null,f);
    b.box(.036,h-.10,.08,trim,x,y,-.005,null,f);b.box(w-.07,.036,.08,trim,x,spring-.25,-.005,null,f);
  }
  function buildCoachingInn({width=12,depth=7.6,name='Cottonwood | Blossom coaching inn'}={}){
    const w=width,d=depth,wing=2.9,centre=w-wing*2,wingHeight=8.85,hallHeight=7.35;
    if(w<11.5||w>14||d<7||d>9)throw new RangeError('The coaching inn needs a full courtyard frontage');
    const b=new Builder(name),wall=cottageWalls[0],paint=shutters[0],windowBoxes=[];
    const limestone=material('Village | carved cream limestone',{
      color:new THREE.Color('#e4d9c3').multiplyScalar(1.85),map:map('../village/painted_plaster_wall_diff.webp',true),roughness:1,
      normalMap:map('../village/painted_plaster_wall_nor_gl.webp'),normalScale:new THREE.Vector2(.14,.14),envMapIntensity:.5,
    },2.4);
    // A local frame lets each pavilion's long roof run front-to-back.
    const framed=(x,z,angle=0)=>{
      const f=face(x,z,angle),point=a=>new THREE.Vector3(...a).applyMatrix4(f).toArray();
      return {geometry:(g,m,matrix=new THREE.Matrix4())=>b.geometry(g,m,matrix.clone().premultiply(f)),
        box:(w,h,d,m,x=0,y=0,z=0,rotation=null,frame=null,turnUV=false)=>b.box(w,h,d,m,x,y,z,rotation,frame?frame.clone().premultiply(f):f,turnUV),
        pipe:(a,c,r,m)=>b.pipe(point(a),point(c),r,m)};
    };
    const wingCentres=[-(w-wing)/2,(w-wing)/2];
    for(const [index,cx]of wingCentres.entries()){
      const front=face(cx,d/2,0),back=face(cx,-d/2,Math.PI);
      b.box(wing+.16,.28,d+.16,mortar,cx,.07,0);
      const upper=[-.63,.63].map(x=>({type:'arch-window',x,y:6.12,w:.82,h:2.12,wall,edge:limestone}));
      shellWall(b,wing,wingHeight,front,[{x:0,y:1.9,w:1.07,h:1.74},...upper],wall);
      shellWall(b,wing,wingHeight,back,[{x:0,y:1.9,w:1.07,h:1.74},...upper],wall);
      const side=index===0?-1:1,f=face(side*w/2,0,side*Math.PI/2);
      shellWall(b,d,wingHeight,f,[-d*.28,0,d*.28].flatMap(x=>[{x,y:1.9,w:.95,h:1.74},{type:'arch-window',x,y:6.12,w:.95,h:2.12,wall,edge:limestone}]),wall);
      // Exposed inner faces rise above the lower gallery roof.
      b.box(.20,wingHeight-hallHeight, d,wall,cx-side*wing/2,(wingHeight+hallHeight)/2,0);
      for(const y of[.33,3.93,8.40,8.73]){
        b.box(wing+.24,y<.5?.30:.14,.23,limestone,cx,y,d/2+.055);
        b.box(wing+.24,y<.5?.30:.14,.23,limestone,cx,y,-d/2-.055);
        b.box(.23,y<.5?.30:.14,d+.24,limestone,side*(w/2+.055),y,0);
      }
      for(const z of[-d/2,d/2])for(const dx of[-wing/2,wing/2]){
        b.box(.27,8.35,.27,limestone,cx+dx,4.47,z);
        b.box(.39,.18,.38,limestone,cx+dx,8.57,z);
      }
      b.box(wing+.55,.12,d+.55,limestone,cx,wingHeight-.055,0);
      hippedRoof(framed(cx,0,Math.PI/2),d,wing,wingHeight,.85);
      // Deep timber corbels make the eaves legible from the square.
      for(const dx of[-1.05,-.52,0,.52,1.05])b.box(.12,.26,.54,wood,cx+dx,8.66,d/2+.13);
      b.box(1.18,.22,.34,limestone,cx,.78,d/2+.22);b.box(1.03,.025,.25,mortar,cx,.902,d/2+.23);
      windowBoxes.push({x:cx,y:.92,z:d/2+.23,width:.99,height:.24});
    }
    const back=face(0,-d/2,Math.PI),recess=d/2-2.0;
    const rearWindows=[-centre*.33,0,centre*.33].flatMap(x=>[{x,y:1.9,w:.9,h:1.7},{type:'arch-window',x,y:5.15,w:.92,h:1.95,wall,edge:limestone}]);
    shellWall(b,centre,hallHeight,back,rearWindows,wall);
    shellWall(b,centre,hallHeight,face(0,recess,0),[
      {type:'door',domestic:true,paint,x:0,y:1.50,w:1.65,h:2.84},
      ...[-centre*.34,centre*.34].map(x=>({x,y:1.83,w:.94,h:1.68})),
      ...[-centre*.33,0,centre*.33].map(x=>({type:'arch-window',x,y:5.26,w:.95,h:1.94,wall,edge:limestone})),
    ],wall);
    // Open front arcade over the existing ground-draped cobbles. No raised
    // decorative floor is inserted under the horse's hooves.
    const pier=.34,bay=centre/3,frontZ=d/2+.01,spring=2.78;
    for(let i=0;i<4;i++){
      const x=-centre/2+i*bay;
      b.box(pier,spring-.14,.47,limestone,x,(spring+.14)/2,frontZ);
      b.box(.47,.17,.59,limestone,x,.19,frontZ);
      b.box(.49,.16,.59,limestone,x,spring-.015,frontZ);
      // Upper gallery posts and iron balustrade sit over the lower stone piers.
      b.box(pier,1.70,.43,limestone,x,5.30,frontZ);
      b.box(.48,.14,.56,limestone,x,6.10,frontZ);
    }
    for(let i=0;i<3;i++){
      const x=-centre/2+(i+.5)*bay,r=(bay-pier)/2;
      archMasonry(b,x,r,spring,3.92,frontZ,.47,wall);archTrim(b,x,r,spring,frontZ+.245,.12,limestone);
      archMasonry(b,x,r,6.15,hallHeight,frontZ,.43,wall);archTrim(b,x,r,6.15,frontZ+.225,.12,limestone);
      for(const y of[4.38,5.20])b.box(bay-pier,.055,.055,metal,x,y,frontZ);
      for(let j=0;j<9;j++)b.box(.026,.77,.028,metal,x-r+.09+j*(r*2-.18)/8,4.78,frontZ);
    }
    b.box(centre+.08,.22,2.15,limestone,0,4.08,(frontZ+recess)/2);
    for(const y of[3.93,4.28,hallHeight-.11])b.box(centre+.26,.13,.22,limestone,0,y,frontZ+.075);
    b.box(centre+.55,.12,d+.55,limestone,0,hallHeight-.055,0);
    hippedRoof(b,centre,d,hallHeight,.83);
    // The pavilion side walls close the two ends of the gallery, leaving the
    // entire three-bay frontage open and sheltered.
    for(const side of[-1,1]){
      b.box(.20,hallHeight,2.05,wall,side*centre/2,hallHeight/2,(frontZ+recess)/2);
      lantern(b,side*1.22,2.32,recess+.18);
      const px=side*(centre/2+.28);
      b.box(.54,.42,.54,limestone,px,.22,d/2+.54);b.box(.42,.025,.42,mortar,px,.445,d/2+.54);
      windowBoxes.push({x:px,y:.47,z:d/2+.54,width:.40,height:.42});
    }
    const ridge=wingHeight+.85;
    return b.finish({kind:'townhouse',style:'coaching-inn',exterior:'village',variant:0,width:w,depth:d,wallHeight:wingHeight,ridgeHeight:ridge,
      store:false,storeys:2,roofStyle:'pavilion-clay',windows:35,arcadeBays:3,arcadeClearWidth:bay-pier,arcadeSpring:spring,
      galleryDepth:frontZ-recess,frontZ,doorZ:recess,windowBoxes,suggestedLabelY:ridge+.8});
  }

  function buildOutbuilding({width=4.6,depth=3.2,height=3.4,
    exterior='timber',variant=0,animatedDoorOpening={width:2.3,height:2.5},name='Meadowlark stable outbuilding'}={}) {
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
    const village=exterior==='village',wall=village?cottageWalls[Math.abs(variant)%3]:siding;
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
    shellWall(b,w,h,face(0,d/2,0),[opening,...frontWindows],wall);

    // Rear faces are prominent from the arrival arena; give them the same
    // recessed casements, sills, cladding and rainwater detailing as the front.
    const backWindows=(w>4?[-w*.24,w*.24]:[0]).map(x=>({x,
      y:Math.min(h-.75,h*.58),w:Math.min(1.02,w*.25),h:Math.min(1.02,h*.36)}));
    shellWall(b,w,h,face(0,-d/2,Math.PI),backWindows,wall);
    for(const s of[-1,1]) {
      const f=face(s*w/2,0,s*Math.PI/2);
      shellWall(b,d,h,f,[{x:0,y:Math.min(h-.75,h*.58),
        w:Math.min(.90,d*.32),h:Math.min(1.0,h*.36)}],wall);
      gable(b,d,h,ridge,f,wall);
    }
    cornerPosts(b,w,d,h);roofAssembly(b,w,d,h,ridge,true,village?slate:roof);
    if(village){
      stoneSkirt(b,w,d,dw+.22);
      const paint=shutters[Math.abs(variant)%3],awningY=Math.max(2.98,dh+.55),awningW=w-.30;
      // A continuous shop fascia and a shallow striped canopy, entirely above the approach.
      b.box(w-.22,.26,.11,paint,0,awningY+.34,d/2+.15);
      for(let i=0;i<12;i++){
        const x=-awningW/2+(i+.5)*awningW/12,m=i%2?canvas:paint;
        b.box(awningW/12,.042,.82,m,x,awningY,d/2+.43,new THREE.Euler(.15,0,0));
        b.box(awningW/12,.13,.04,m,x,awningY-.13,d/2+.83);
      }
      for(const side of[-1,1])b.beam([side*(w/2-.23),awningY-.45,d/2+.13],
        [side*(w/2-.23),awningY-.04,d/2+.77],.045,.045,metal);
      for(const win of frontWindows)b.box(win.w+.12,.51,.10,paint,win.x,.71,d/2+.13);
    }
    lantern(b,dx,Math.min(h-.30,dh+.36),d/2+.18);
    return b.finish({kind:'outbuilding',exterior,width:w,depth:d,wallHeight:h,
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
  return {buildBarn,buildCottage,buildTownhouse,buildCoachingInn,buildOutbuilding,buildOpenStall,detailRunIn,materials,maps,
    sidingMaterial:siding,roofMaterial:roof};
}

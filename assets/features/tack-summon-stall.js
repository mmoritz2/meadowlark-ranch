import {mergeGeometries} from '../vendor/three/examples/jsm/utils/BufferGeometryUtils.js';

// A permanent, quiet workbench in the nook north of the horse summoning stall.
// The pasture gate at (-33,-9), arena rail x=-25 and barn-row roof stay clear.
export const TACK_SUMMON_STALL=Object.freeze({
 x:-27.2,z:-11.55,rotation:Math.PI/2,radius:1.5,reach:3.2,
 width:2.5,depth:1.3,label:'Tack Summoning Stall',
});
const installed=new WeakMap();

/** Install static scenery and one ordinary E interaction; no frame hook or lights. */
export function installTackSummonStall(G,open){
 if(typeof open!=='function')throw new TypeError('Tack summoning stall needs an open callback');
 const previous=installed.get(G);
 if(previous){previous.open=open;return previous.handle;}
 const T=G.THREE,W=G.world,P=TACK_SUMMON_STALL;
 if(!T||typeof W?.addBuilding!=='function'||typeof W?.addThing!=='function')throw new TypeError('Tack summoning stall needs the world building API');
 const root=new T.Group();root.name='Tack Summoning Stall | silver-thread workbench';
 root.userData.tackSummonStall={version:1,static:true,footprint:{width:P.width,depth:P.depth},front:'+Z'};
 const material=(name,color,roughness=.75,metalness=0,extra={})=>new T.MeshStandardMaterial({name:'Tack stall | '+name,color,roughness,metalness,...extra});
 const oak=material('oiled timber','#817462',.9),dark=material('navy leather','#293f55',.82),stone=material('pale foundation','#aaa89c',1);
 const silver=material('brushed silver','#bec9ce',.42,.66),cloth=material('blue woven cloth','#587d9d',.98,0,{side:T.DoubleSide});
 const pink=material('rose stitching','#ca91ae',.92),ivory=material('ivory thread','#e2dfd1',.95);
 // Emissive material is a restrained colored detail, without another light or bloom pass.
 const blueGem=material('blue lantern glass','#96cce2',.34,.12,{emissive:'#609fb9',emissiveIntensity:.38});
 const pinkGem=material('rose lantern glass','#dfabc6',.36,.10,{emissive:'#b96e99',emissiveIntensity:.30});
 const parts=new Map();let primitives=0;
 function add(geometry,mat,x=0,y=0,z=0,rotation=null,scale=null){
  const geo=geometry.index?geometry.toNonIndexed():geometry;if(geo!==geometry)geometry.dispose();
  const q=new T.Quaternion();if(rotation)q.setFromEuler(new T.Euler(...rotation));
  geo.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),q,new T.Vector3(...(scale||[1,1,1]))));
  if(!parts.has(mat))parts.set(mat,[]);parts.get(mat).push(geo);primitives++;
 }
 const box=(w,h,d,m,x,y,z,rot)=>add(new T.BoxGeometry(w,h,d),m,x,y,z,rot);
 const ball=(rx,ry,rz,m,x,y,z)=>add(new T.SphereGeometry(1,16,10),m,x,y,z,null,[rx,ry,rz]);
 const ring=(r,thickness,m,x,y,z,rot)=>add(new T.TorusGeometry(r,thickness,5,24),m,x,y,z,rot);
 function cord(points,r,m){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));add(new T.TubeGeometry(curve,Math.max(10,points.length*5),r,5,false),m);}
 function beam(a,b,w,d,m){const from=new T.Vector3(...a),to=new T.Vector3(...b),direction=to.clone().sub(from),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.clone().normalize());const rot=new T.Euler().setFromQuaternion(q);box(w,direction.length(),d,m,...from.add(to).multiplyScalar(.5).toArray(),[rot.x,rot.y,rot.z]);}

 // A low stone plinth, joined timber trestle and real cloth hanging over its front.
 box(2.42,.08,1.12,stone,0,.02,0);
 for(const x of[-.95,.95])for(const z of[-.31,.31]){
  box(.105,1.02,.105,oak,x,.55,z);box(.12,.085,.12,silver,x,.10,z);
 }
 box(2.13,.10,.09,oak,0,.28,-.31);
 for(const x of[-.95,.95])beam([x,.28,-.31],[x,.85,.31],.065,.065,oak);
 box(2.25,.105,.94,oak,0,1.055,0);
 const drape=new T.PlaneGeometry(1.76,1,22,16),dp=drape.attributes.position;
 for(let i=0;i<dp.count;i++){
  const x=dp.getX(i),t=dp.getY(i)+.5;
  // First 65 cm lie on the tabletop; the remainder falls over the front edge.
  const z=t<=.65?-.16+t:.49+.026*Math.sin((t-.65)*Math.PI/.7);
  const y=t<=.65?1.116+.007*Math.sin(x*16):1.116-(t-.65);
  dp.setXYZ(i,x,y+.005*Math.cos(x*19),z);
 }
 drape.computeVertexNormals();add(drape,cloth);
 for(const side of[-1,1])cord([[side*.88,1.122,-.16],[side*.88,1.122,.46],[side*.88,.94,.518],[side*.88,.77,.516]],.012,pink);
 cord([[-.88,.769,.514],[-.42,.76,.519],[.42,.76,.519],[.88,.769,.514]],.012,ivory);
 // Stitched silver star on the front cloth, deliberately small and readable.
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2,b=a+Math.PI*4/5;beam([Math.cos(a)*.10,.925+Math.sin(a)*.10,.527],[Math.cos(b)*.10,.925+Math.sin(b)*.10,.527],.009,.008,silver);}

 // Slim rear posts support a lightly bowed cloth canopy, with open sides.
 for(const x of[-1.10,1.10]){
  box(.085,2.23,.085,oak,x,1.17,-.43);box(.105,.12,.105,silver,x,2.24,-.43);
  beam([x,1.94,-.43],[x,2.22,.44],.045,.055,oak);
 }
 box(2.42,.095,.08,oak,0,2.27,-.43);
 const roof=new T.PlaneGeometry(2.5,1.25,24,12),rp=roof.attributes.position;
 for(let i=0;i<rp.count;i++){const x=rp.getX(i),z=rp.getY(i);rp.setXYZ(i,x,2.31-.105*(1-(x/1.25)**2)+.024*Math.cos(z*5),z);}
 roof.computeVertexNormals();add(roof,cloth);
 for(const z of[-.625,.625])cord([[-1.25,2.31+.024*Math.cos(z*5),z],[-.65,2.23,z],[0,2.21,z],[.65,2.23,z],[1.25,2.31+.024*Math.cos(z*5),z]],.017,pink);
 // Three restrained woven tabs finish the canopy instead of a floating glow cloud.
 for(const x of[-.8,0,.8]){
  box(.14,.15,.016,cloth,x,2.10+.07*(x/1.25)**2,.626);
  box(.14,.018,.020,silver,x,2.024+.07*(x/1.25)**2,.63);
 }

 // A small display saddle on a wooden tree: raised seat, cantle, horn and irons.
 box(.06,.25,.08,oak,-.43,1.24,-.01);box(.44,.04,.30,oak,-.43,1.14,-.01);
 ball(.28,.075,.22,dark,-.43,1.39,0);
 ball(.255,.10,.048,dark,-.43,1.465,-.185);
 ball(.075,.075,.07,dark,-.43,1.46,.16);
 add(new T.CylinderGeometry(.025,.038,.08,12),silver,-.43,1.55,.16);
 ball(.053,.018,.036,dark,-.43,1.60,.16);
 for(const side of[-1,1]){
  const x=-.43+side*.25;box(.04,.20,.22,dark,x,1.29,-.025);
  cord([[x,1.36,.02],[x+side*.03,1.21,.025],[x+side*.015,1.17,.025]],.014,pink);
  ring(.053,.010,silver,x+side*.015,1.145,.025,[0,Math.PI/2,0]);
 }
 // A suspended bridle, including two bit rings and relaxed reins, at the other end.
 box(.11,.08,.17,oak,.64,1.99,-.31);
 cord([[.50,1.61,-.20],[.50,1.87,-.23],[.62,1.97,-.23],[.78,1.86,-.23],[.78,1.61,-.20]],.017,dark);
 cord([[.50,1.84,-.21],[.64,1.80,-.20],[.78,1.84,-.21]],.018,pink);
 cord([[.50,1.64,-.20],[.64,1.61,-.18],[.78,1.64,-.20]],.015,dark);
 for(const x of[.50,.78])ring(.031,.008,silver,x,1.60,-.19);
 cord([[.50,1.59,-.19],[.40,1.31,-.18],[.46,1.20,-.18],[.73,1.23,-.18],[.78,1.59,-.19]],.010,dark);
 // Spools, clasp tray and paired faceted lanterns complete a working saddlery.
 box(.28,.025,.18,silver,.63,1.129,.28);
 for(const [x,m] of[[.42,ivory],[.64,pink]]){
  add(new T.CylinderGeometry(.055,.055,.12,12),m,x,1.19,.05);
  for(const y of[1.135,1.255])add(new T.CylinderGeometry(.07,.07,.018,12),oak,x,y,.05);
 }
 for(const [x,m]of[[-1.08,blueGem],[1.08,pinkGem]]){
  box(.16,.026,.16,silver,x,1.78,-.23);
  add(new T.OctahedronGeometry(.12),m,x,1.92,-.23,null,[.7,1.1,.7]);
  ring(.025,.009,silver,x,2.065,-.23);
  cord([[x,2.07,-.23],[x,2.20,-.27],[x,2.23,-.43]],.009,silver);
 }

 let triangles=0;
 for(const [mat,geometries]of parts){
  const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
  if(!geometry)throw new Error('Tack stall geometry merge failed');
  const mesh=new T.Mesh(geometry,mat);mesh.name=mat.name;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);triangles+=geometry.attributes.position.count/3;
 }
 root.userData.tackSummonStall.stats={meshes:parts.size,triangles,primitives};
 // addBuilding supplies terrain placement, a blocker and follow-camera awareness.
 W.addBuilding({x:P.x,z:P.z,rot:P.rotation,r:P.radius,build:()=>root});
 if(typeof G.nameSprite==='function'){
  const sign=G.nameSprite(P.label);sign.name='Tack Summoning Stall label';sign.position.set(0,2.77,0);sign.scale.set(2.55,.6375,1);root.add(sign);
 }
 const state={open,handle:null};
 const thing=W.addThing({kind:'tack-summon',id:'tack-summon-stall',g:root,x:P.x,z:P.z,reach:P.reach,label:()=>'Summon tack (E)',use:()=>state.open()});
 const marker={x:P.x,z:P.z,glyph:'🪡',label:P.label};
 if(Array.isArray(W.mapMarkers))W.mapMarkers.push(marker);
 if(Array.isArray(W.miniMarkers))W.miniMarkers.push({x:P.x,z:P.z,col:'#aabdd9'});
 state.handle={root,thing,marker,placement:P};installed.set(G,state);return state.handle;
}

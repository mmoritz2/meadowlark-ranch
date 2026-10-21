// Explicitly opt-in wild-herd labels only. Permanent world/arena signs retain
// their existing manager and material behavior.
export const WILD_ACTOR_LABEL_PROFILE='wild-actor-label-1';
export const WILD_ACTOR_LABEL_ROLE='wild-actor';
export const WILD_ACTOR_LABEL_POLICY=Object.freeze({heightM:.36,maxWidthM:2.2,maxCssHeight:36});
const owners=new WeakMap();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Pure layout, also used by the actual before-render owner. Caller supplies its
// scratch result; no per-draw arrays, vectors, matrices or objects are created.
export function layoutWildActorLabel(out,{width,height,distance,depth,projectionY,cssViewportHeight,perspective=true,rotation=0,parentX=1,parentY=1}){
 const range=clamp(distance/12,.45,1),pixelScale=Math.abs(projectionY)*cssViewportHeight/(2*(perspective?Math.max(depth,1e-6):1));
 const projectedHeight=(Math.abs(Math.sin(rotation))*width+Math.abs(Math.cos(rotation))*height)*range*pixelScale;
 const valid=Number.isFinite(width)&&Number.isFinite(height)&&Number.isFinite(distance)&&Number.isFinite(depth)&&Number.isFinite(projectionY)&&Number.isFinite(cssViewportHeight)&&Number.isFinite(rotation)&&Number.isFinite(parentX)&&Number.isFinite(parentY)&&width>0&&height>0&&cssViewportHeight>0&&parentX>1e-10&&parentY>1e-10;
 const cap=valid?Math.min(1,WILD_ACTOR_LABEL_POLICY.maxCssHeight/Math.max(projectedHeight,1e-10)):0;
 out.x=valid?width*range*cap/parentX:0;out.y=valid?height*range*cap/parentY:0;
 out.range=range;out.cap=cap;out.projectedCssHeight=valid?projectedHeight*cap:0;
 return out;
}

export function configureWildActorLabel({THREE:T,sprite}){
 if(!sprite?.isSprite||!sprite.material?.isSpriteMaterial)throw Error('Wild actor label requires a SpriteMaterial sprite');
 const image=sprite.material.map?.image,aspect=image?.width/image?.height;
 if(!Number.isFinite(aspect)||aspect<=0)throw Error('Wild actor label requires finite image dimensions');
 const height=Math.min(WILD_ACTOR_LABEL_POLICY.heightM,WILD_ACTOR_LABEL_POLICY.maxWidthM/aspect),width=height*aspect;
 let own=owners.get(sprite);
 if(own){own.layout.width=width;own.layout.height=height;own.metadata.baseWidth=width;own.metadata.baseHeight=height;return sprite;}
 const previous=sprite.onBeforeRender,basis=new T.Matrix4(),rotation=new T.Matrix4(),viewport=new T.Vector4(),buffer=new T.Vector2(),logical=new T.Vector2();
 const metadata={role:WILD_ACTOR_LABEL_ROLE,profile:WILD_ACTOR_LABEL_PROFILE,baseWidth:width,baseHeight:height,maxCssHeight:WILD_ACTOR_LABEL_POLICY.maxCssHeight,lastRender:{}};
 const layout={width,height,distance:0,depth:0,projectionY:0,cssViewportHeight:0,perspective:true,rotation:0,parentX:1,parentY:1},result={};
 own={layout,metadata};owners.set(sprite,own);sprite.userData.labelRole=WILD_ACTOR_LABEL_ROLE;sprite.userData.actorLabelPolicy=metadata;
 // Sprite frustum tests precede onBeforeRender. A previous close-view cap must
 // not prevent this small opt-in set from regrowing in a later view at its edge.
 sprite.frustumCulled=false;sprite.renderOrder=3;
 sprite.scale.set(width,height,sprite.scale.z);
 sprite.onBeforeRender=function(renderer,scene,camera,geometry,material,group){
  previous.call(this,renderer,scene,camera,geometry,material,group);
  // Parent/actor may have moved or changed scale after the manager tick. Three
  // computes modelViewMatrix after this callback; update the same rendered owner.
  this.updateWorldMatrix(true,false);camera.updateWorldMatrix(true,false);
  const e=this.matrixWorld.elements,c=camera.matrixWorld.elements,v=camera.matrixWorldInverse.elements,x=e[12],y=e[13],z=e[14];
  rotation.makeRotationFromQuaternion(this.quaternion);
  if(this.parent)basis.multiplyMatrices(this.parent.matrixWorld,rotation);else basis.copy(rotation);
  const b=basis.elements;
  renderer.getCurrentViewport(viewport);renderer.getDrawingBufferSize(buffer);renderer.getSize(logical);
  const target=renderer.getRenderTarget(),fullHeight=target?.height||buffer.y,cssHeight=renderer.domElement?.clientHeight||logical.y;
  layout.cssViewportHeight=viewport.w*cssHeight/fullHeight;
  layout.depth=-(v[2]*x+v[6]*y+v[10]*z+v[14]);layout.distance=Math.hypot(x-c[12],y-c[13],z-c[14]);
  layout.projectionY=camera.projectionMatrix.elements[5];layout.perspective=camera.isPerspectiveCamera===true&&this.material.sizeAttenuation!==false;layout.rotation=this.material.rotation;
  layout.parentX=Math.hypot(b[0],b[1],b[2]);layout.parentY=Math.hypot(b[4],b[5],b[6]);
  layoutWildActorLabel(result,layout);this.scale.set(result.x,result.y,this.scale.z);this.updateWorldMatrix(false,false);
  const last=metadata.lastRender;last.camera=camera.uuid;last.depth=layout.depth;last.cssViewportHeight=layout.cssViewportHeight;last.projectedCssHeight=result.projectedCssHeight;last.cap=result.cap;
 };
 return sprite;
}

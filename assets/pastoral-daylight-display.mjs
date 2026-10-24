// Optional display art only. No environment/light/weather/controller assignments.
// The caller owns the texture; no texture means no shader, callback or uniform change.
export const DAYLIGHT_PHOTO_SETTINGS=Object.freeze({sourceSun:Object.freeze([.5542432542464257,.7418421629738802,.377471350378498]),exposure:1.5307518967427918,maskInnerDegrees:1.5,maskOuterDegrees:3.5,fadeInSeconds:1.2,fadeOutSeconds:.45});
export function attachPastoralDaylightDisplay({THREE:T,material,texture=null,initialStrength=0,settings=DAYLIGHT_PHOTO_SETTINGS}){
 if(!texture)return null;
 if(!Number.isFinite(initialStrength)||initialStrength<0||initialStrength>1)throw Error('Display strength must be between0and1');
 const U=material?.uniforms,oldFragment=material?.fragmentShader,oldBefore=material?.onBeforeRender,oldName=material?.name;
 if(!U||typeof oldFragment!=='string'||!['sunPosition','time','day','golden','rain'].every(k=>U[k])||!texture.isDataTexture||texture.image?.width!==2048||texture.image?.height!==1024||texture.colorSpace!==T.LinearSRGBColorSpace||texture.flipY!==true||![T.HalfFloatType,T.FloatType].includes(texture.type))throw Error('Exact linear2048x1024 Radiance display texture and original sky uniforms required');
 const sourceSun=new T.Vector3(...settings.sourceSun);if(settings.sourceSun.length!==3||![settings.exposure,settings.maskInnerDegrees,settings.maskOuterDegrees,settings.fadeInSeconds,settings.fadeOutSeconds].every(Number.isFinite)||!sourceSun.toArray().every(Number.isFinite)||Math.abs(sourceSun.length()-1)>1e-10||!Number.isFinite(settings.exposure)||settings.exposure<=0||!(settings.maskInnerDegrees>0&&settings.maskOuterDegrees>settings.maskInnerDegrees)||!(settings.fadeInSeconds>0&&settings.fadeOutSeconds>0))throw Error('Invalid daylight display settings');
 const declarations='uniform sampler2D daylightPhoto;uniform vec4 daylightWorldToPhoto;uniform vec3 daylightSourceSun;uniform float daylightPhotoWeight,daylightExposure,daylightVerticalScale;\n';
 const rotate='vec3 daylightPhotoDirection(vec3 d){vec3 q=daylightWorldToPhoto.xyz;vec3 yawD=d+2.*cross(q,cross(q,d)+daylightWorldToPhoto.w*d);return normalize(vec3(yawD.x,yawD.y*daylightVerticalScale,yawD.z));}\n';
 const blend=`        // Align azimuth, then remap elevation without tilting the source horizon;
        // retain the original procedural disc/glare inside the measured sun hole.
        if(daylightPhotoWeight>0.){
          vec3 pd=normalize(daylightPhotoDirection(d));
          vec2 puv=vec2(atan(pd.z,pd.x)/6.283185307179586+.5,asin(clamp(pd.y,-1.,1.))/3.141592653589793+.5);
          vec3 photo=max(texture2D(daylightPhoto,puv).rgb,vec3(0.))*daylightExposure;
          photo=photo/(vec3(1.)+photo);
          // Daylight display pigment, after photo Reinhard and before sunHole/photoMix.
          // Select blue chroma; neutral/bright photographed cloud pixels stay outside it.
          float photoBlueChroma=(photo.b-min(photo.r,photo.g))/max(photo.b,.00001);
          float photoBlueMask=smoothstep(.12,.36,photoBlueChroma)
            *smoothstep(.01,.06,min(photo.b-photo.r,photo.b-photo.g))
            *(1.-smoothstep(.62,.82,min(photo.r,min(photo.g,photo.b))));
          float photoBlueDay=smoothstep(.985,1.,day)
            *(1.-smoothstep(0.,.02,golden))*(1.-smoothstep(0.,.05,rain));
          if(photoBlueMask*photoBlueDay>0.){
            vec3 photoLumaWeights=vec3(.2126,.7152,.0722);
            float photoLuma=dot(photo,photoLumaWeights);
            vec3 bluePigment=photo*vec3(.68,.97,1.10);
            bluePigment*=photoLuma/max(dot(bluePigment,photoLumaWeights),.00001);
            float blueRoom=clamp((1.-photo.b)/max(bluePigment.b-photo.b,.00001),0.,1.);
            photo=mix(photo,bluePigment,.80*photoBlueMask*photoBlueDay*blueRoom);
          }
          float sunHole=1.-smoothstep(${Math.cos(settings.maskOuterDegrees*Math.PI/180).toPrecision(17)},${Math.cos(settings.maskInnerDegrees*Math.PI/180).toPrecision(17)},dot(pd,daylightSourceSun));
          float photoMix=daylightPhotoWeight*smoothstep(.85,1.,day)*(1.-smoothstep(.05,.4,golden))*smoothstep(.015,.09,d.y)*smoothstep(0.,.015,pd.y)*sunHole;
          sky=mix(sky,photo,photoMix);
        }
`;
 let fragment=oldFragment;const edits=[['uniform float day,golden,night,rain,time;',declarations],['      // The cloud field is world-anchored',rotate],['        float cloud=1.-(1.-high.a)*(1.-low.a);',blend]];
 for(const [marker,code]of edits){if(fragment.split(marker).length!==2)throw Error('Original sky shader marker changed');fragment=fragment.replace(marker,code+marker);}
 const worldSun=new T.Vector3(),rotation=new T.Quaternion(),up=new T.Vector3(0,1,0),sourceAzimuth=Math.atan2(sourceSun.z,sourceSun.x),sourceSlope=sourceSun.y/Math.hypot(sourceSun.x,sourceSun.z),added={daylightPhoto:{value:texture},daylightWorldToPhoto:{value:new T.Vector4(0,0,0,1)},daylightSourceSun:{value:sourceSun},daylightPhotoWeight:{value:0},daylightExposure:{value:settings.exposure},daylightVerticalScale:{value:1}};
 if(Object.keys(added).some(k=>k in U))throw Error('Daylight display already installed');
 let lastTime=null,weight=0,requestedStrength=initialStrength,disposed=false,updates=0;
 function update(){if(disposed)return false;const t=U.time.value,rain=U.rain.value,sun=U.sunPosition.value;if(!Number.isFinite(t)||!Number.isFinite(rain)||!sun||!worldSun.copy(sun).toArray().every(Number.isFinite)||worldSun.lengthSq()<1e-20){added.daylightPhotoWeight.value=0;return false;}
  const dt=lastTime===null?0:Math.max(0,Math.min(.25,t-lastTime));lastTime=t;
  // Existing time is read, never advanced here. Same-time reflection/draw passes
  // get the same fade; photos/static time cannot multiply the fade rate.
  const target=rain>0?0:requestedStrength,tau=target>weight?settings.fadeInSeconds:settings.fadeOutSeconds;weight+=(target-weight)*(1-Math.exp(-dt/tau));
  worldSun.normalize();
  // A yaw keeps horizon/zenith fixed. Positive vertical slope scale aligns the
  // sunny source elevation without rotating below-horizon fill into the sky.
  // The live game's contributing daylight is ~16.6..54deg, strictly inside
  // these finite numerical limits; night/horizon/zenith remain bounded/off.
  const horizontal=Math.hypot(worldSun.x,worldSun.z),liveSlope=worldSun.y/Math.max(horizontal,1e-8);
  rotation.setFromAxisAngle(up,Math.atan2(worldSun.z,worldSun.x)-sourceAzimuth);
  added.daylightWorldToPhoto.value.set(rotation.x,rotation.y,rotation.z,rotation.w);
  added.daylightVerticalScale.value=Math.max(.02,Math.min(64,sourceSlope/Math.max(liveSlope,1e-6)));
  added.daylightPhotoWeight.value=weight;updates++;return true;
 }
 function before(...args){if(oldBefore)oldBefore.apply(this,args);update();}
 Object.assign(U,added);material.fragmentShader=fragment;material.onBeforeRender=before;material.name=oldName+' | optional photographed daylight';material.needsUpdate=true;
 return{update,setStrength(value){if(!Number.isFinite(value)||value<0||value>1)throw Error('Display strength must be between0and1');requestedStrength=value;},stats:()=>({scope:'DISPLAY_ONLY_NOT_LIGHTING_OR_VISUAL_APPROVAL',requestedStrength,weight,updates,sourceSun:sourceSun.toArray(),worldToPhoto:added.daylightWorldToPhoto.value.toArray(),exposure:settings.exposure,maskInnerDegrees:settings.maskInnerDegrees,maskOuterDegrees:settings.maskOuterDegrees,verticalScale:added.daylightVerticalScale.value,horizonPolicy:'yaw plus positive vertical slope; world .015..09/source0..015',weatherTimeSource:'existing sky time; no advancement',disposed}),dispose(){if(disposed)return;disposed=true;material.fragmentShader=oldFragment;material.onBeforeRender=oldBefore;material.name=oldName;for(const k of Object.keys(added))delete U[k];material.needsUpdate=true;}};
}

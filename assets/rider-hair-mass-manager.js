/* TMP integration resources only. Art33 is rejected; waves gate is diagnostic. */
import {createHairMassDriver} from './rider-hair-mass-runtime.js?v=character-polish-20261009';
export function createHairMassResources({THREE:T,rig,restHeadWorld,allowedStyles=['waves'],parameters={coreBlendLength:.180}}){
 const allowed=new Set(allowedStyles),resources=new Set();let disposed=false;
 function createMesh({geometry,material,style,depthMaterial}){
  if(disposed||!allowed.has(style)||!geometry.userData.crownFallJoin||!geometry.userData.hairSections?.length)return null;
  const driver=createHairMassDriver({THREE:T,geometry,head:rig.kit.head,restHeadWorld,parameters});if(!driver)return null;
  const beauty=driver.material(material),depth=depthMaterial?driver.material(depthMaterial):null,mesh=new T.Mesh(geometry,beauty);let dead=false;
  const resource={driver,mesh,depth,dispose(){if(dead)return;dead=true;resources.delete(resource);driver.dispose();depth?.dispose();}};
  mesh.customDepthMaterial=depth;mesh.userData.hairMassResource=resource;mesh.userData.continuousHair=true;resources.add(resource);
  // put() transfers ownership of this freshly patched, non-shared material.
  material.dispose();return mesh;
 }
 function update(){if(disposed||!resources.size)return;rig.root.updateWorldMatrix(true,true);for(const r of resources)r.driver.updateFromRig(rig,{worldUpdated:true});}
 function evidence(){return{gate:[...allowed],active:resources.size,drivers:[...resources].map(r=>r.driver.evidence()),artAccepted:false,nativeFallbackPreserved:true};}
 function dispose(){if(disposed)return;disposed=true;for(const r of [...resources])r.dispose();}
 return{createMesh,update,evidence,dispose};
}

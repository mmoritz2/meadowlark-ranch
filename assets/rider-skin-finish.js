// The authored body is real skin under real garment meshes. Legacy painted
// clothing must not color exposed wrists or inflate this measured source mesh.
export function finishArtistSkin(material){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=shader=>{
  previous(shader);
  const inflation='transformed+=normal*(boot*(0.0055+rim*0.0022)+(1.0-boot)*cloth*0.0016)*(1.0-uOutfit);';
  const paint='diffuseColor.rgb=mix(cloth,skin,skinZ);',flags='rwSkinZ=skinZ; rwBoot=boot; rwSole=sole; rwMetal=buckle;';
  for(const[source,token]of[[shader.vertexShader,inflation],[shader.fragmentShader,paint],[shader.fragmentShader,flags]])if(source.split(token).length!==2)throw Error('Authored skin shader contract changed: '+token);
  shader.vertexShader=shader.vertexShader.replace(inflation,'/* Real garments supply their own thickness. */');
  shader.fragmentShader=shader.fragmentShader.replace(paint,'diffuseColor.rgb=uSkin;').replace(flags,'rwSkinZ=1.0; rwBoot=0.0; rwSole=0.0; rwMetal=0.0;');
 };
 material.roughness=.62;material.metalness=0;material.customProgramCacheKey=()=>key+'-authored-skin2';material.needsUpdate=true;
 material.userData.artistSkinMaterial2={actualVisibleSkin:true,legacyClothingPaint:false,legacyClothingInflation:false,authoredNormals:true};
}

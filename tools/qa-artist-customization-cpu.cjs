// Exercise the actual application's appearance-selection function without WebGL.
// Only TextureLoader and material construction are stubbed; Color comparison,
// source function, breed catalog and marking lookup functions come from the app.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
(async()=>{
 const RealThree=await import(pathToFileURL(path.resolve('assets/vendor/three/build/three.module.js')).href);
 const source=fs.readFileSync('ranch3d.html','utf8'),out=path.resolve(process.argv[2]||'output/artist-dye-cpu');fs.mkdirSync(out,{recursive:true});
 const block=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
 const arrayStart=source.indexOf('const BREEDS3=[')+14,roster=vm.runInNewContext(source.slice(arrayStart,source.indexOf('];',arrayStart)+1));
 const functionSource=block('function configureArtistCustomization(','function ensureCoatMat('),lookups=block('function markOf(h)','function inheritMark(a,b)');
 const loaded=[],made=[];const context={THREE:{...RealThree,TextureLoader:class{load(url){loaded.push(url);const texture=new RealThree.Texture();texture.name=url;return texture;}}},BREEDS3:roster,artistNeutralMap:null,MARKS:{none:0,dapple:1,appaloosa:2,pinto:3,roan:4,points:5,leopard:6,sooty:7,dun:8,metal:9},
  makeCoatMat(skin,base){const mat=new RealThree.MeshPhysicalMaterial({map:base.map});mat.userData={col:new RealThree.Color(),markCol:new RealThree.Color(),blend:0,mark:0,markTint:0,baseLum:0};made.push(mat);return mat;}};
 vm.createContext(context);vm.runInContext(lookups+functionSource+';this.configure=configureArtistCustomization;',context);
 const checks={},cases=[];
 const test=(name,key,changes)=>{const b=roster.find(b=>b[0]===key),h={id:901,breed:key,colors:{body:b[5],mane:b[6]},...changes};if(changes.colors)h.colors={body:b[5],mane:b[6],...changes.colors};const base=new RealThree.MeshStandardMaterial(),magic=key==='aether'?new RealThree.MeshStandardMaterial():null;if(magic)magic.userData.update=()=>{};let hair=null;const rig={profile:{artistBreed:true},baseMat:base,skin:{material:magic||base},fantasyAppearance:magic?{theme:'galaxy',material:magic}:null,groom:{setColors(args){hair=args;}}};context.configure(rig,h);const result={name,custom:!!rig.coatMat,materialIsBase:rig.skin.material===base,materialIsMagic:rig.skin.material===magic,mark:rig.coatMat?.userData.mark??null,body:rig.coatMat?'#'+rig.coatMat.userData.col.getHexString():null,neutralMap:rig.coatMat?.map?.name||null,hair};cases.push(result);return result;};
 const normal=test('Unmodified Shetland','chestnut',{});checks.unmodifiedKeepsAuthored=normal.materialIsBase&&!normal.custom&&!normal.hair.maneOverride&&!normal.hair.tailOverride;
 const roan=test('Explicit inherited catalog-matching roan','chestnut',{mark:'roan',markCol:'#e8dcc8'});checks.explicitRoanCreatesPattern=roan.custom&&roan.mark===4;checks.explicitRoanUsesNeutralTexture=roan.neutralMap.includes('bay-study-albedo.png');
 const none=test('Explicit ordinary no-mark inheritance','pinto',{mark:'none'});checks.explicitNoneClearsFoundationPattern=none.custom&&none.mark===0&&none.neutralMap.includes('bay-study-albedo.png');
 const fantasy=test('Fantasy foal ordinary mark none','aether',{coat:'galaxy',mark:'none',foal:true});checks.fantasyNoneRetainsMagic=fantasy.materialIsMagic&&!fantasy.custom;
 const override=test('Custom body on fantasy horse','aether',{coat:'galaxy',mark:'none',colors:{body:'#26262e'}});checks.explicitBodyOverrideStillWorks=override.custom&&override.body==='#26262e';
 const tail=test('Independent saved tail dye','chestnut',{tailCol:'#3b6fd6'});checks.tailDyeIndependent=tail.materialIsBase&&!tail.hair.maneOverride&&tail.hair.tailOverride&&tail.hair.tailColor==='#3b6fd6';
 const mane=test('Saved mane with matching tail','chestnut',{colors:{mane:'#e8b4c8'}});checks.maneDyeMatchesTail=mane.hair.maneOverride&&mane.hair.tailOverride&&mane.hair.tailColor==='#e8b4c8';
 const result={checks,cases,loadedTextures:loaded,functionSha256:crypto.createHash('sha256').update(functionSource).digest('hex'),validation:'Actual configureArtistCustomization selection logic with real Three.Color; no GPU rendering or shader compilation in this test.'};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(Object.values(checks).some(v=>!v))process.exitCode=1;
})();

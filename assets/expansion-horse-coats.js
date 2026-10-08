import {registerFantasyTheme,registerFantasyAppearance} from './equine-fantasy.js?v=artist-breeds-1';

/* Material artwork for the approved native Mustang and Lipizzaner foundations.
 * The shared coat shader supplies vMapUv, source diffuseColor/_l, _fres,
 * uTime/uGlow and uC0–2. It does not expose a bind-space position varying.
 * The source torso occupies the middle of this UV atlas; dark hoof texels
 * remain the original map color. Paint stays fixed while only highlights move.
 * No import-time installation, new textures, meshes, animation or event loops. */
const SEAGLASS_FX=`
 vec3 sgOriginal=diffuseColor.rgb;
 float sgRaw=dot(sgOriginal,vec3(.299,.587,.114));
 float sgSkin=smoothstep(.025,.12,sgRaw);
 float sgDetail=clamp(.36+.86*pow(_l,.80),.36,1.13);
 vec2 sgUV=vMapUv*vec2(11.0,8.0);
 float sgWash=.5+.5*sin(sgUV.x*.74+sin(sgUV.y*.82)*1.3);
 vec3 sgJade=mix(uC1,uC2,sgWash*.24)*sgDetail;
 // Interlacing wavelets make broken foam seams rather than straight bands.
 float sgWave=sin(sgUV.x*2.7+sin(sgUV.y*1.7)*1.25)+sin(sgUV.y*3.1+sin(sgUV.x*2.1)*.82);
 float sgFoam=(1.0-smoothstep(.025,.11,abs(sgWave-.18)));
 float sgPatch=.55+.45*sin(sgUV.x*.48-sgUV.y*.32+1.2);
 float sgTorso=smoothstep(.255,.32,vMapUv.x)*(1.0-smoothstep(.66,.73,vMapUv.x))*smoothstep(.20,.27,vMapUv.y)*(1.0-smoothstep(.73,.81,vMapUv.y));
 sgFoam*=sgTorso*smoothstep(.25,.62,sgPatch)*sgSkin;
 vec3 sgPearl=vec3(.67,.85,.73)*(.60+.40*sgDetail);
 sgJade=mix(sgJade,sgPearl,sgFoam*.55);
 _ramp=mix(sgOriginal,sgJade,sgSkin);
 // A slow, faint sheen catches the foam and silhouette; the body still uses
 // its ordinary rough PBR lighting and can fall into real shadow.
 float sgGlint=.55+.45*sin(uTime*.72+sgUV.x*.51+sgUV.y*.37);
 _emis=vec3(.23,.55,.46)*uGlow*(sgFoam*.13*sgGlint+pow(_fres,1.7)*.12)*sgSkin;
`;

const STARWEAVE_FX=`
 vec3 swOriginal=diffuseColor.rgb;
 float swRaw=dot(swOriginal,vec3(.299,.587,.114));
 float swSkin=smoothstep(.025,.12,swRaw);
 float swDetail=clamp(.34+.84*pow(_l,.75),.34,1.12);
 vec3 swPlum=mix(uC0,uC1,.68+.32*smoothstep(.10,.80,_l))*swDetail;
 float swTorso=smoothstep(.26,.33,vMapUv.x)*(1.0-smoothstep(.65,.73,vMapUv.x))*smoothstep(.22,.30,vMapUv.y)*(1.0-smoothstep(.70,.79,vMapUv.y));
 vec2 swGrid=vMapUv*vec2(24.0,19.0);
 vec2 swCell=floor(swGrid),swP=fract(swGrid)-.5;
 float swPick=_hash(swCell+vec2(8.3,31.7));
 // Small disconnected portions of a diagonal constellation net, sewn in
 // fine dashes. Selected junctions carry a four-point star, not a neon grid.
 float swDiagonal=min(abs(swP.y-swP.x),abs(swP.y+swP.x))*.7071;
 float swThread=(1.0-smoothstep(.012,.028,swDiagonal))*smoothstep(.51,.70,swPick);
 float swDash=smoothstep(-.20,.18,sin((abs(swP.x)+abs(swP.y))*67.0));
 swThread*=swDash;
 float swRayX=(1.0-smoothstep(.006,.018,abs(swP.y)))*(1.0-smoothstep(.045,.14,abs(swP.x)));
 float swRayY=(1.0-smoothstep(.006,.018,abs(swP.x)))*(1.0-smoothstep(.060,.18,abs(swP.y)));
 float swStar=max(swRayX,swRayY)*smoothstep(.69,.83,swPick);
 float swDust=(1.0-smoothstep(.020,.040,length(swP)))*smoothstep(.44,.72,swPick);
 swThread*=swTorso*swSkin;swStar*=swTorso*swSkin;swDust*=swTorso*swSkin;
 vec3 swGold=vec3(.62,.38,.16)*(.64+.36*swDetail);
 swPlum=mix(swPlum,swGold,clamp(swThread*.62+swStar*.86+swDust*.42,0.0,.9));
 _ramp=mix(swOriginal,swPlum,swSkin);
 float swTwinkle=.78+.22*sin(uTime*.85+swPick*6.28318);
 _emis=vec3(.58,.31,.12)*uGlow*(swStar*.20*swTwinkle+swThread*.025+swDust*.055);
`;

export const EXPANSION_HORSE_THEMES=Object.freeze({
 seaglass:{
  name:'Seaglass Mustang',alias:'palomino',mane:'#dff3df',horn:false,
  cfg:{ramp:['#193e43','#3c9895','#8ecab1'],glow:.18,rough:.46},fx:SEAGLASS_FX,
  base:'#3c9895',coat:{emissive:0x8ed9bd,ei:.035,rough:.46},
  wing:{a:'#c7e9d4',b:'#3c9895',e:'#8ed9bd',ei:.06},
  drg:{web:'#75b6a9',root:'#214c50',bone:'#193339',glow:'#badfd3',head:'#3c9895',ridge:'#c7e9d4'},elem:'water',
 },
 starweave:{
  name:'Starweave Unicorn',alias:'lipiz',mane:'#f0c2ad',horn:true,
  cfg:{ramp:['#17111f','#30233f','#6e526b'],glow:.16,rough:.53},fx:STARWEAVE_FX,
  base:'#30233f',coat:{emissive:0xd8aa68,ei:.025,rough:.53},
  wing:{a:'#f0c2ad',b:'#49334e',e:'#d8aa68',ei:.055},
  drg:{web:'#6e526b',root:'#30233f',bone:'#21182b',glow:'#d8aa68',head:'#49334e',ridge:'#f0c2ad'},elem:'arcane',
 },
});

let registered=false;
/** Safe to call before gallery model registration and again during game boot.
 * Each call may mirror the definitions into a different game's table object. */
export function registerExpansionHorseCoats(G=null){
 if(!registered){
  for(const [id,theme] of Object.entries(EXPANSION_HORSE_THEMES)){
   registerFantasyTheme(id,theme.cfg,theme.fx);
   registerFantasyAppearance(id,{theme:id,mane:theme.mane,horn:theme.horn});
  }
  registered=true;
 }
 const tables=G?.tables;
 if(tables)for(const [id,theme] of Object.entries(EXPANSION_HORSE_THEMES)){
  for(const [table,field] of [['FANTASY_CFG','cfg'],['FANTASY_FX','fx'],['COAT_BASE','base'],['FANTASY_COAT','coat'],['WING_TINT','wing'],['DRAGON_TINT','drg'],['ELEM_OF','elem']]){
   if(!tables[table])tables[table]={};tables[table][id]=theme[field];
  }
 }
 return EXPANSION_HORSE_THEMES;
}

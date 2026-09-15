/* Feature package 'look-grade'. Owned by that package: edit only this file and the inline hot
   spots assigned to it. See index.js for the contract. Nothing runs at import time.

   ============================================================================================
   THE GRADE AND THE LIGHT — why this file exists
   ============================================================================================
   Star Equestrian's store shots hold a very tight band: mean HSV saturation around 0.50, mean
   value around 0.58, and about 55% of the pixels vivid (S>0.45). They hold it everywhere —
   open clay yard, shaded wood, autumn hillside. This game did the opposite. Measured the same
   way, the open ranch yard came out 0.24 / 0.67 / 14% (pale, washed, colourless) and deep
   woodland came out 0.47 / 0.28 / 78% (nearly black). The average was not the problem; the
   SPREAD was. The open half of the world was blowing out to grey and the shaded half was
   crushing to black, and no single exposure number can fix both at once.

   Three things cause it, and this package answers each one.

   1. ACES. renderer.toneMapping was ACESFilmicToneMapping, which is a film-print emulation:
      it deliberately desaturates on the way to white and it deliberately toes into black. On a
      stylised cartoon world lit by one hard sun that is precisely the wrong curve — ranch3d.html
      already carries a comment at :2448 saying the same thing about the sky shader. It is
      replaced with Cineon, which was the only one of the five curves three.js offers that beat
      it on every part of the measure. See the note on DEF.tone for the whole table.

   2. The fill. The day cycle settles on sun 2.65 against a hemisphere fill of 1.24 at noon.
      Better than two to one means anything the sun cannot reach falls off a cliff. Star
      Equestrian's shade is open and blue-grey, never black. So a fraction of the key is handed
      to the fill — the same total light, redistributed.

   3. Nothing was grading the final picture at all. There is a composer with a bloom pass on
      it and nowhere in the chain did anybody touch saturation.

   ---- Where each lever lands, which is the thing to know before changing anything ----------
     renderer.toneMapping / .toneMappingExposure   flat screen AND VR AND the Low tier
     the lights (borrowed per draw, below)         flat screen AND VR AND the Low tier
     the grade pass on G.composer                  flat screen only
   ranch3d.html:2350 sets useBloom=false when an XR session starts, because EffectComposer
   cannot drive the XR framebuffer, and applyQuality does the same on the Low tier. Both then
   call renderer.render directly and the composer — and therefore the pass — is skipped
   entirely. That is why the exposure and the fill carry most of the correction and the pass
   only finishes it: a headset and a cheap laptop get the large half of the change, and the
   flat screen on High gets all of it.
   ============================================================================================ */
export const id='look-grade';

/* Everything the grade does, in one table, because a look that lives in scattered magic
   numbers cannot be tuned and cannot be explained. Every one of these was swept against the
   metric rather than chosen by eye — and then the eye overruled the metric twice, on the
   shadow gain and on the vibrance ceiling, both noted where they sit. A number in the band
   with an ugly picture is not the job. */
const DEF={
 on:true,
 /* Cineon, not ACES. Swept against the metric with everything else held still and neutral:
    ACES 0.302/0.604/29%, Cineon 0.341/0.550/34%, and every other curve three offers was far
    worse — AgX, Reinhard, Linear and no tone mapping at all each collapsed the vivid fraction
    to between 1% and 7%, because they all desaturate or clip on their way to white and this
    world is authored bright. Cineon also came in with the narrowest value spread of the five,
    which is the defect this package exists to fix. */
 tone:'cineon',
 exposure:0.62,        // Cineon is a much hotter curve than ACES; 1.05 through it blows the yard out
 /* The light, as a redistribution rather than a boost. shift is the fraction of the key light
    handed over to the fill; the total the day cycle asked for is left alone. See the note by
    the render wrapper for why it has to work this way and not by multiplying the fill. */
 shift:0.45, fillGain:1.00, keyGain:1.00,
 /* Neither half of the hemisphere fill has its HUE touched, and both of those 1.00s were
    bought the hard way. Saturating the fill is the obvious second move after redistributing
    it — SE's shade is a distinct blue — and it is a trap at both ends of the day. The
    ground side, C_GROUND_DAY 0x898467, is an olive, so pushing it off grey pushes it green.
    The sky side is worse: after dark the cycle settles it on C_HEMI_NIGHT 0x65789c and the
    fill is then five times the key, so saturating it at 1.30 painted the entire arena floor
    mint green at dusk and dawn and lifted the frame's value from 0.19 to 0.25 — a dusk that
    reads as an overcast afternoon. The metric PREFERRED that version, by a wide margin, which
    is the clearest single reminder in this file that the number is the guide and not the job.
    What was actually wanted from the fill was warmth, and warmth has no hue to get wrong. */
 skySat:1.00, gndSat:1.00, gndWarm:0.12,
 sunSat:1.20,          // #fff0d2 is very nearly white; SE's key light is unmistakably warm
 /* The grade pass, in display space, after the tone map. See the shader for what each does.
    lift and liftKnee are deliberately half of what the metric wanted: at lift 1.4 / knee 0.65
    the value spread across six cameras fell to 0.047, which is a better number than anything
    here, and the wood turned into a flat lime wall with no depth in it, because the shading
    inside a tree IS the darkness the gain was eating. This is the setting where the spread
    comes down and the wood is still a wood. */
 lift:1.20, liftKnee:0.48,
 gamma:1.00,
 contrast:1.05, pivot:0.44,
 sat:1.32, vib:0.95, cap:0.34,
 lo:0.030, hi:0.16,   // the floor guard: no grade below lo, all of it above hi
 warm:0.015, split:0.012, tint:0.045,   // tint: the green-axis pull, see step 6 of the shader
 mix:1.0,
 bloom:0.060,          // up from 0.045; SE has a soft glow on the sunlit edges and this is it
};

/* The grade, in display space, applied after OutputPass has tone-mapped and sRGB-encoded.
   Display space is deliberate: the metric is measured on these exact numbers, a lift here is
   a lift a player can see rather than a lift of the bottom four thousandths of a linear
   signal, and ACES has already done its damage by this point so this is where the damage is.
   The ordering is the ordering a colourist uses — open the shadows, set the midtone, set the
   contrast, and only then put the colour back, because saturating before lifting saturates
   noise in the shade and saturating before contrast fights the contrast. */
const FRAG=`
uniform sampler2D tDiffuse;
uniform float uLift,uKnee,uGamma,uContrast,uPivot,uSat,uVib,uCap,uWarm,uSplit,uTint,uMix,uLo,uHi;
varying vec2 vUv;
const vec3 LUMA=vec3(0.2126,0.7152,0.0722);
void main(){
 vec4 tex=texture2D(tDiffuse,vUv);
 vec3 src=clamp(tex.rgb,0.0,1.0);
 vec3 c=src;
 /* 0. A floor guard. Below uLo this pixel gets no grade at all and above uHi it gets all of
       it, which keeps true black true black: no washed-out shadows, and no hue dragged out of
       what is really just the quantisation floor, where a one-bit difference between channels
       would otherwise come back as a fully saturated colour. The window is deliberately
       NARROW — 0.03 to 0.16. A wide one was tried first, up to 0.42, on the theory that it
       would also tame the night; it did not need taming (see the commit message: the night
       came out deeper and better, and the alarming saturation number at midnight is a deep
       blue at value 0.13, where the statistic means nothing), and all the wide window did was
       switch the grade off across the daytime shade, which is the half of the world this
       package exists to rescue. It put the value spread back up from 0.21 to 0.31. */
 float lit=smoothstep(uLo,uHi,dot(c,LUMA));
 /* 1. Open the shade, and do it by MULTIPLYING rather than by adding. Adding a constant to
       three channels is what a lift normally is, and it is wrong here for a reason worth
       writing down: saturation is (max-min)/max, so adding the same number to every channel
       drags every shadow toward grey — it would have bought value at the direct cost of the
       other half of the target. A gain is scale-invariant, so it leaves hue and saturation
       exactly where they were and only moves brightness. It is also the more honest picture
       of what is happening: there is more light in the shade, not fog in it.
       The weight is one in black and zero by uKnee, so the sunlit half of the frame does not
       move at all. */
 float l=dot(c,LUMA);
 c*=1.0+uLift*(1.0-smoothstep(0.0,uKnee,l))*lit;
 /* 2. Midtone. */
 c=pow(max(c,0.0),vec3(1.0/uGamma));
 /* 3. Contrast about a pivot below middle grey, so it firms up the picture without dragging
       the shadows back down to where step 1 found them. */
 c=clamp((c-uPivot)*uContrast+uPivot,0.0,1.0);
 /* 4. Colour. uSat is flat; uVib is weighted by the SQUARE of how little colour a pixel
       already has, and by saturation rather than by chroma. Chroma is the obvious measure and
       it is useless here: chroma is S*V, and the washed-out meadow and the near-black wood
       both sit at about 0.15 of it, so a chroma-weighted vibrance cannot tell them apart. By
       saturation they are 0.24 and 0.45, which is the difference that matters — the pale
       sand, pale sky and bleached grass get the whole push and the wood, which is already
       vivid, keeps its colour instead of turning into a poster. */
 float l2=dot(c,LUMA);
 float mx=max(c.r,max(c.g,c.b));
 float sat0=mx>0.0001?(mx-min(c.r,min(c.g,c.b)))/mx:0.0;
 float pale=(1.0-sat0)*(1.0-sat0);   // 'flat' is a reserved interpolation qualifier in GLSL ES 3.00 and will not compile
 vec3 d=(c-vec3(l2))*(1.0+(uSat-1.0+uVib*pale)*lit);
 /* A ceiling on how far from grey any one pixel may end up. Without it the vibrance found the
    tree bark — dull brown, and therefore 'pale' by the test above — and, with the shadow gain
    having already brightened it, turned every branch in the valley fluorescent coral. The
    metric was delighted; the picture was a disgrace. This is the guard rail that lets the
    boost be strong enough for the grass and the sky without that happening.
    The curve is m/(1+(m/cap)^4)^(1/4): flat identity while a pixel is well inside the ceiling
    — a half-ceiling colour loses 1.5% and nothing else — and it bends over only in the last
    stretch. The obvious 1-exp(-m/cap) is NOT that; it starts compressing at zero and takes a
    third off the grass on its way past, which is how the first attempt at this managed to
    drop mean saturation by 0.14 while claiming to be a ceiling. */
 float m=max(abs(d.r),max(abs(d.g),abs(d.b)));
 float q=m/uCap; q=q*q; q=q*q;                   // (m/cap)^4 without a pow
 if(m>0.0001)d*=inversesqrt(sqrt(1.0+q));
 c=vec3(l2)+d;
 /* 5. A whisper of split tone: warm into the light, cool into the shade. It is what the
       reference does — sunlit clay reads orange, shadow reads blue — and it costs two mads. */
 float sh=1.0-smoothstep(0.15,0.65,l2);
 c.r+=uWarm*l2-uSplit*sh*0.6;
 c.b-=uWarm*l2*0.8-uSplit*sh;
 /* 6. And the green axis, which is here for one specific fault. This world's ambient after
       the sun is down is already slightly green — the bare arena floor measures six points
       more green than red at dusk with the grade switched off entirely — and step 4's whole
       purpose is to find pale pixels and give them their colour back, so it found that and
       tripled it, to twenty-three points, which is a mint-green riding arena. The cast is not
       ours to fix at the source; the hemisphere colours and the environment bake belong to
       ranch3d.html. So it is corrected where it shows. Weighted by 'pale' as well as by
       shadow, because a colour cast is by definition a tint on things that ought to be
       neutral: the sand loses the green and the grass three feet away, which is meant to be
       green, keeps all of it. */
 c.g-=uTint*sh*pale;
 gl_FragColor=vec4(clamp(mix(src,c,uMix),0.0,1.0),tex.a);
}`;

const VERT=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;

export function install(G){
 const THREE=G.THREE, scene=G.scene, renderer=G.renderer, composer=G.composer;
 /* Feature-detect before anything: a headless or software boot can hand us a context with no
    composer, and a look package that throws takes its own settings row down with it. */
 if(!THREE||!renderer||!scene)return;

 const P=Object.assign({},DEF);
 G.look={params:P};

 /* ---- 1. the lights ---------------------------------------------------------------------
    The day cycle at ranch3d.html:13519 writes sun.intensity, hemi.intensity and all three
    light colours every single frame, and it does it AFTER G.run('tick') at :13253 — so a
    package that sets a light in the tick hook is overwritten before the frame is drawn. The
    only place downstream of the cycle that a package can reach is the draw itself. So the
    grade borrows the lights for the length of one render and hands them straight back: the
    cycle keeps ownership of the numbers and never sees ours, the renderer only ever sees
    ours, and dawn, dusk, night and rain keep every bit of their shape because we scale what
    the cycle decided rather than replacing it.

    And the scaling is a REDISTRIBUTION, not a boost, which matters more than it sounds. The
    obvious fix for black shade is to multiply the hemisphere fill by two and be done. Do that
    and midnight is lit like an overcast afternoon: the cycle settles the fill at 0.82 after
    dark against a moon of 0.88, so a flat multiplier lands on the night with its full weight
    and there is no night left. Moving a fraction of the key into the fill instead leaves the
    sum of the two exactly as the cycle set it at every hour — noon, golden, dusk, moonlight,
    rain — so the day keeps its whole shape and only the ratio of hard light to soft changes,
    which is the one thing actually wrong with it. At noon that turns 2.65 against 1.24 into
    1.46 against 2.43: SE's open, shadowless-looking shade, out of the same light budget. */
 let sun=null,hemi=null;
 scene.traverse(o=>{
  if(o.isDirectionalLight&&o.castShadow&&!sun)sun=o;
  if(o.isHemisphereLight&&!hemi)hemi=o;
 });
 const C={sky:new THREE.Color(),gnd:new THREE.Color(),sun:new THREE.Color()};
 /* Pull a colour away from its own grey. Saturation in the HSL sense, done on the colour
    object in place, because this runs twice a frame and must not allocate. */
 const punch=(col,k)=>{const g=col.r*0.2126+col.g*0.7152+col.b*0.0722;
  col.setRGB(g+(col.r-g)*k,g+(col.g-g)*k,g+(col.b-g)*k);
  col.r=Math.min(1,Math.max(0,col.r));col.g=Math.min(1,Math.max(0,col.g));col.b=Math.min(1,Math.max(0,col.b));};

 const rawRender=renderer.render.bind(renderer);
 let borrowed=false;
 let hI=0,sI=0;
 renderer.render=function(sc,cam){
  /* Only the game's own scene, and only once: the composer's own passes come back through
     here with a full-screen quad for a scene, and clubs-boards.js:541 renders a portrait of a
     horse into a little scene of its own. Neither wants the world's lights touched. */
  if(!P.on||borrowed||sc!==scene||!hemi||!sun)return rawRender(sc,cam);
  borrowed=true;
  hI=hemi.intensity; sI=sun.intensity;
  C.sky.copy(hemi.color); C.gnd.copy(hemi.groundColor); C.sun.copy(sun.color);
  const moved=sI*P.shift;
  hemi.intensity=(hI+moved)*P.fillGain; sun.intensity=(sI-moved)*P.keyGain;
  punch(hemi.color,P.skySat);
  punch(hemi.groundColor,P.gndSat);
  hemi.groundColor.r=Math.min(1,hemi.groundColor.r*(1+P.gndWarm));
  hemi.groundColor.b=Math.max(0,hemi.groundColor.b*(1-P.gndWarm));
  punch(sun.color,P.sunSat);
  try{ rawRender(sc,cam); }
  finally{
   hemi.intensity=hI; sun.intensity=sI;
   hemi.color.copy(C.sky); hemi.groundColor.copy(C.gnd); sun.color.copy(C.sun);
   borrowed=false;
  }
 };

 /* ---- 2. tone mapping -------------------------------------------------------------------
    Changing this recompiles every material once, which is why it happens here at install and
    not on a toggle. CustomToneMapping is deliberately not on the menu: OutputShader.js has no
    branch for it, so on the composer path a custom curve would silently apply NO tone mapping
    at all and the picture would blow out to white. */
 const TONES={aces:THREE.ACESFilmicToneMapping,agx:THREE.AgXToneMapping,cineon:THREE.CineonToneMapping,
  reinhard:THREE.ReinhardToneMapping,linear:THREE.LinearToneMapping,none:THREE.NoToneMapping};
 /* What the page shipped with, kept so that turning the grade off really does give back the
    plain render rather than half of it. */
 const TONE0=renderer.toneMapping, EXP0=renderer.toneMappingExposure;
 const applyTone=()=>{
  const t=P.on?TONES[P.tone]:TONE0;
  if(t!==undefined&&renderer.toneMapping!==t)renderer.toneMapping=t;
  renderer.toneMappingExposure=P.on?P.exposure:EXP0;
 };

 /* ---- 3. the grade pass -----------------------------------------------------------------
    Appended LAST, after OutputPass, and that order is the whole point. Bloom is a lens
    effect and belongs where it already is: in scene-linear light, before the tone map, so it
    blooms on real highlight energy rather than on display values. The grade is the opposite —
    it is a correction to the printed picture, so it belongs after the print. Put the grade
    before OutputPass and it would be lifting linear radiance that ACES then re-crushes, which
    is the same argument as putting a colour cast on a negative and hoping the lab misses it.
    A duck-typed pass rather than the addons ShaderPass because ranch3d.html does not import
    ShaderPass and this package may not add an import to it; EffectComposer only ever asks a
    pass for enabled, needsSwap, clear, renderToScreen, setSize and render. */
 let pass=null,gradeMat=null;
 if(composer&&composer.addPass){
  const mat=gradeMat=new THREE.ShaderMaterial({
   uniforms:{tDiffuse:{value:null},uLift:{value:0},uKnee:{value:0.4},uGamma:{value:1},uContrast:{value:1},
    uPivot:{value:0.44},uSat:{value:1},uVib:{value:0},uCap:{value:1},uWarm:{value:0},uSplit:{value:0},uTint:{value:0},uMix:{value:1},uLo:{value:0.03},uHi:{value:0.16}},
   vertexShader:VERT,fragmentShader:FRAG,depthWrite:false,depthTest:false});
  /* One triangle, not two: it covers the viewport with no seam down the diagonal and one
     fewer vertex to transform. Same trick three's own FullScreenQuad plays. */
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,2,0,0,2],2));
  const quad=new THREE.Mesh(geo,mat); quad.frustumCulled=false;
  const qScene=new THREE.Scene(); qScene.add(quad);
  const qCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  pass={
   enabled:true, needsSwap:true, clear:false, renderToScreen:false,
   setSize(){},
   dispose(){mat.dispose();geo.dispose();},
   render(r,writeBuffer,readBuffer){
    mat.uniforms.tDiffuse.value=readBuffer.texture;
    r.setRenderTarget(this.renderToScreen?null:writeBuffer);
    if(this.clear&&!this.renderToScreen)r.clear();
    rawRender(qScene,qCam);
   },
  };
  composer.addPass(pass);
 }

 /* Bloom is already in the chain at a very shy 0.045. It is not on the contract by name, so
    find it by the shape of it rather than by an index that another package could shift. */
 let bloomPass=null;
 if(composer&&composer.passes)for(const p of composer.passes)
  if(p&&typeof p.strength==='number'&&typeof p.radius==='number'&&!bloomPass)bloomPass=p;
 const bloomWas=bloomPass?bloomPass.strength:0;

 /* One place, and only one, that copies the table onto the renderer and the GPU. Everything
    that changes a parameter — install, the settings toggle, a QA sweep — ends up here, so
    there is no way for the picture and the table to disagree. */
 const sync=()=>{
  applyTone();
  if(pass)pass.enabled=!!P.on;
  if(gradeMat){const u=gradeMat.uniforms;
   u.uLift.value=P.lift; u.uKnee.value=P.liftKnee; u.uGamma.value=P.gamma;
   u.uContrast.value=P.contrast; u.uPivot.value=P.pivot;
   u.uSat.value=P.sat; u.uVib.value=P.vib; u.uCap.value=P.cap;
   u.uWarm.value=P.warm; u.uSplit.value=P.split; u.uTint.value=P.tint; u.uMix.value=P.mix;
   u.uLo.value=P.lo; u.uHi.value=P.hi;}
  if(bloomPass)bloomPass.strength=P.on?P.bloom:bloomWas;
 };
 sync();

 /* ---- 4. the player's way out -----------------------------------------------------------
    On by default, and behind the Graphics tab the settings screen already has rather than a
    new piece of chrome. account-economy.js owns that panel and this package may not edit it,
    so the row is spliced into the html the panel already returns — G.ui.defs is on the
    contract for exactly this. If the panel is ever renamed this quietly does nothing, which
    is the right failure. */
 const S=G.save, U=G.ui;
 if(S&&S.ensure)S.ensure(s=>{if(s.lookGrade===undefined)s.lookGrade=1;});
 const setOn=v=>{P.on=!!v;sync();if(S&&S.sync)S.sync(s=>{s.lookGrade=v?1:0;});};
 G.look.setOn=setOn;
 G.look.get=()=>Object.assign({},P);
 G.look.set=o=>{Object.assign(P,o||{});sync();};

 if(U&&U.defs&&U.defs.settingsPanel&&typeof U.defs.settingsPanel.render==='function'){
  const D=U.defs.settingsPanel, inner=D.render;
  D.render=function(p,s){
   let h=inner.call(this,p,s);
   /* The bloom row is the marker for 'this render was the Graphics tab'; on every other tab
      the string is simply absent and the row is not offered. */
   if(typeof h!=='string')return h;
   const i=h.indexOf('acct:bloom'); if(i<0)return h;
   const j=h.indexOf('</div>',i); if(j<0)return h;
   const row='<div class="setRow"><span class="lbl">Colour grade<span class="sub">Warmer, brighter shade, stronger colour</span></span>'
    +'<button data-fx="look:toggle">'+(P.on?'🎨 On — turn off':'Off — turn on')+'</button></div>';
   return h.slice(0,j+6)+row+h.slice(j+6);
  };
 }
 if(U&&U.action)U.action('look',a=>{
  if(a[0]==='toggle'){setOn(!P.on);if(U.rerender)U.rerender('settingsPanel');
   if(G.toast)G.toast(P.on?'🎨 Colour grade on.':'🎨 Colour grade off — the plain render.');}
 });

 G.on('boot',s=>{ if(s&&s.lookGrade===0){P.on=false;sync();} });
 /* QA reads the whole table out of render_game_to_text, so a screenshot run can say which
    grade it photographed instead of trusting that the file on disk was the file served. */
 G.on('state',o=>{o.look=Object.assign({},P,{pass:!!pass,bloomFound:!!bloomPass});});
}

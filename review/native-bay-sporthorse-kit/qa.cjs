const fs=require('node:fs'),path=require('node:path');
const QA=require('../../tools/qa-platform.cjs'),{chromium}=QA;
const HERE=__dirname,OUT=path.resolve(HERE,'../../output/native-bay-sporthorse-kit'),URL=QA.BASE+'/review/native-bay-sporthorse-kit/review.html';fs.mkdirSync(OUT,{recursive:true});

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROMIUM,args:QA.gpuArgs(['--no-sandbox'])});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(URL);await page.waitForFunction(()=>window.nativeReinsInspect?.()?.sides?.left?.hand||window.nativeTravelError,null,{timeout:60000});
  const rows=[];
  for(const gait of ['walk','trot','canterLeft','canterRight'])for(let k=0;k<64;k++){
   const phase=k/64;
   const row=await page.evaluate(({phase,gait})=>{
    const travel=nativeMountedSet(gait,phase),rein=nativeReinsInspect(),body=nativeReinsBody(),T=nativeReinsThree;
    const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
    const pos=new Float32Array(body.geometry.attributes.position.count*3),v=new T.Vector3();body.skeleton.update();
    for(let i=0;i<pos.length/3;i++){body.getVertexPosition(i,v);v.applyMatrix4(body.matrixWorld);pos.set(v.toArray(),i*3);}
    const index=body.geometry.index.array;
    // Intersect a horizontal X-ray at each sampled ribbon center. The first
    // outer body intersection is a conservative signed neck-surface check;
    // positive means the ribbon center remains outside the skinned horse.
    function clearance(p,side){let outer=side==='left'?Infinity:-Infinity,hits=0;const [px,py,pz]=p;
     for(let i=0;i<index.length;i+=3){const ai=3*index[i],bi=3*index[i+1],ci=3*index[i+2];const ay=pos[ai+1],az=pos[ai+2],by=pos[bi+1],bz=pos[bi+2],cy=pos[ci+1],cz=pos[ci+2];
      if(py<Math.min(ay,by,cy)||py>Math.max(ay,by,cy)||pz<Math.min(az,bz,cz)||pz>Math.max(az,bz,cz))continue;
      const den=(by-cy)*(az-cz)+(cz-bz)*(ay-cy);if(Math.abs(den)<1e-10)continue;
      const u=((by-cy)*(pz-cz)+(cz-bz)*(py-cy))/den,w=((cy-ay)*(pz-cz)+(az-cz)*(py-cy))/den,q=1-u-w;
      if(u<-.00001||w<-.00001||q<-.00001)continue;
      const x=u*pos[ai]+w*pos[bi]+q*pos[ci];outer=side==='left'?Math.min(outer,x):Math.max(outer,x);hits++;
     }
     return hits?(side==='left'?outer-px:px-outer):null;
    }
    const sides={};for(const side of ['left','right']){const r=rein.sides[side],surface=r.mainCenterline.map((p,i)=>({i,clearanceM:clearance(p,side)})),onNeck=surface.filter(x=>x.i>=3&&x.i<=34&&x.clearanceM!==null);
      sides[side]={bitGapM:distance(r.bit,r.mainStart),handGapM:distance(r.hand,r.mainEnd),looseHandGapM:distance(r.hand,r.looseStart),widthM:r.mainWidthM,minOutsideBodyM:Math.min(...onNeck.map(x=>x.clearanceM)),insideSamples:onNeck.filter(x=>x.clearanceM<-.001),validSurfaceSamples:onNeck.length,surface};}
    return {gait,phase,travel:{rider:travel.rider,tack:travel.tack,horseBones:travel.horseBones,riderBones:travel.riderBones,clip:travel.clip,animation:travel.animation},triangles:rein.triangles,hidden:rein.hiddenComponents,protected:rein.protectedComponents,nonReinComponentsIntact:rein.nonReinComponentsIntact,sides};
   },{phase,gait});
   rows.push(row);
   if(![12,24].includes(k))continue;
   for(const view of ['side','quarter']){await page.click('#'+view);await page.evaluate(()=>nativeTravelRender());await page.screenshot({path:path.join(OUT,`mounted-${gait}-${view}-${k}.png`)});}
  }
  const gaps=rows.flatMap(r=>Object.values(r.sides).flatMap(s=>[s.bitGapM,s.handGapM,s.looseHandGapM]));
  const surfaces=rows.flatMap(r=>Object.values(r.sides));
  const summary={url:URL,phasesPerGait:64,sideAndQuarterImages:16,combinedKitSha256:JSON.parse(fs.readFileSync(path.join(HERE,'anchors.json'))).combinedKitSha256,horseBones:rows[0].travel.horseBones,riderBones:rows[0].travel.riderBones,clips:[...new Set(rows.map(r=>r.travel.clip))],triangles:rows[0].triangles,hiddenComponents:rows[0].hidden,protectedComponents:rows[0].protected,allOtherComponentsIntact:rows.every(r=>r.nonReinComponentsIntact),leatherWidthM:[Math.min(...surfaces.map(s=>s.widthM)),Math.max(...surfaces.map(s=>s.widthM))],maxAttachmentGapM:Math.max(...gaps),minOutsideBodyM:Math.min(...surfaces.map(s=>s.minOutsideBodyM)),insideNeckSamples:surfaces.flatMap(s=>s.insideSamples).length,minimumValidNeckSurfaceSamples:Math.min(...surfaces.map(s=>s.validSurfaceSamples)),maxBootTreadGapM:Math.max(...rows.flatMap(r=>[r.travel.rider.leftSoleToTreadM,r.travel.rider.rightSoleToTreadM])),elbowDegrees:[Math.min(...rows.flatMap(r=>[r.travel.rider.leftElbowDegrees,r.travel.rider.rightElbowDegrees])),Math.max(...rows.flatMap(r=>[r.travel.rider.leftElbowDegrees,r.travel.rider.rightElbowDegrees]))],perGait:Object.fromEntries(['walk','trot','canterLeft','canterRight'].map(g=>{const q=rows.filter(r=>r.gait===g);return [g,{maxBootTreadGapM:Math.max(...q.flatMap(r=>[r.travel.rider.leftSoleToTreadM,r.travel.rider.rightSoleToTreadM])),minOutsideBodyM:Math.min(...q.flatMap(r=>Object.values(r.sides).map(s=>s.minOutsideBodyM))),insideNeckSamples:q.flatMap(r=>Object.values(r.sides).flatMap(s=>s.insideSamples)).length,elbowDegrees:[Math.min(...q.flatMap(r=>[r.travel.rider.leftElbowDegrees,r.travel.rider.rightElbowDegrees])),Math.max(...q.flatMap(r=>[r.travel.rider.leftElbowDegrees,r.travel.rider.rightElbowDegrees]))]}]})),errors};
  summary.technicalPass=summary.allOtherComponentsIntact&&summary.triangles.removed===1640&&summary.maxAttachmentGapM<1e-5&&summary.insideNeckSamples===0&&summary.maxBootTreadGapM<.006&&summary.horseBones===677&&summary.riderBones===65&&errors.length===0;
  fs.writeFileSync(path.join(OUT,'qa-report.json'),JSON.stringify({summary,rows},null,2)+'\n');fs.writeFileSync(path.join(OUT,'qa-summary.json'),JSON.stringify(summary,null,2)+'\n');fs.writeFileSync(path.join(HERE,'viewer-qa-summary.json'),JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify(summary,null,2));if(!summary.technicalPass)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

// Original procedural horse-hair atlas. No source photography or external image.
// Run: node assets/textures/horse-hair/generate-atlas.cjs
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage();
 const result=await page.evaluate(()=>{
  const W=2048,H=1024,columns=8,tile=W/columns,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
  let state=704821;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
  const coverage=[];
  for(let col=0;col<columns;col++){
   ctx.save();ctx.beginPath();ctx.rect(col*tile+4,1,tile-8,H-2);ctx.clip();
   const n=col===7?80:col===6?140:260;
   for(let i=0;i<n;i++){
    const x0=20+rand()*(tile-40),clump=Math.floor(x0/32)*32+16;
    const end=H*(.68+rand()*.30),endX=x0*.62+clump*.38+(rand()-.5)*34;
    const phase=col*.72,curve=(col===2||col===5?13:5)*(rand()*.4+.8),stray=i%17===0;
    const thickness=(stray?.48:.74+rand()*.80)*(col===7?.75:1),shade=Math.round(180+rand()*73),opacity=.72+rand()*.28;
    for(let k=0;k<72;k++){
     const a=k/72,b=(k+1)/72;
     const at=t=>{const x=x0+(endX-x0)*t*t+Math.sin(t*Math.PI*1.55+phase)*Math.sin(t*Math.PI)*curve+(stray?Math.sin(t*4+phase)*t*t*20:0);return [col*tile+x,2+t*end]};
     const p=at(a),q=at(b);ctx.lineCap='round';ctx.strokeStyle=`rgba(${shade},${shade},${shade},${opacity*(1-Math.pow(a,10))})`;
     ctx.lineWidth=Math.max(.13,thickness*(1-.86*Math.pow(a,1.85)));ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke();
    }
   }
   ctx.restore();
  }
  const image=ctx.getImageData(0,0,W,H),pixels=image.data;
  // Fill transparent texels with neutral strand RGB. Mips never pull a black or
  // white matte into the edge; only alpha controls hair coverage.
  for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]===0)pixels[i]=pixels[i+1]=pixels[i+2]=220;
  ctx.putImageData(image,0,0);
  for(let col=0;col<columns;col++){let covered=0;for(let y=0;y<H;y++)for(let x=col*tile;x<(col+1)*tile;x++)if(pixels[(y*W+x)*4+3]>=72)covered++;coverage.push(+(covered/(tile*H)).toFixed(4));}
  const rgba=canvas.toDataURL('image/png');
  const preview=document.createElement('canvas');preview.width=W;preview.height=H;const pc=preview.getContext('2d');pc.fillStyle='#6d8079';pc.fillRect(0,0,W,H);pc.drawImage(canvas,0,0);return {rgba,preview:preview.toDataURL('image/png'),coverage};
 });
 const dir=__dirname;for(const [key,file]of [['rgba','strand-atlas.png'],['preview','strand-atlas-preview.png']])fs.writeFileSync(path.join(dir,file),Buffer.from(result[key].split(',')[1],'base64'));
 fs.writeFileSync(path.join(dir,'atlas.json'),JSON.stringify({generator:'generate-atlas.cjs',seed:704821,width:2048,height:1024,columns:8,alphaTest:.28,coverage:result.coverage},null,2));
 console.log(JSON.stringify({coverage:result.coverage}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

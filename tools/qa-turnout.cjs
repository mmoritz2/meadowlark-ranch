// Prove the fix: a granted horse is out to grass immediately, and the pasture gate
// turns waiting horses out when you ride up to it.
const {chromium}=require('playwright');
const BASE=process.env.QA_URL||'http://127.0.0.1:8477';
const checks=[];const ck=(n,ok,d)=>{checks.push({n,ok});console.log((ok?'PASS ':'FAIL ')+n+(d!==undefined?' — '+JSON.stringify(d):''));};
(async()=>{
 const b=await chromium.launch({headless:true,args:['--disable-background-timer-throttling','--use-angle=metal','--ignore-gpu-blocklist']});
 const p=await b.newPage({viewport:{width:1280,height:800}});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160));});
 await p.goto(BASE+'/ranch3d.html?qa=turnout&fresh='+Date.now(),{waitUntil:'load',timeout:120000});
 await p.waitForFunction(()=>{try{const s=JSON.parse(render_game_to_text());return s.graphics.horseReady&&!s.graphics.horseLoading}catch(e){return false}},null,{timeout:150000,polling:300});

 const a=await p.evaluate(()=>{const G=window.__features;let h=null;
  G.save.sync(s=>{h=G.horse.grantHorse(s,'friesian',{name:'Tamed1',bond:20,src:'wild'});});
  const s=JSON.parse(localStorage.getItem('starRanchFable_v1'));
  const g=s.horses.find(x=>x.name==='Tamed1');
  return {hasFlag:'out' in g, out:g.out, turnedOut:s.horses.filter(x=>x.out).length};});
 ck('a tamed horse gets a turnout flag at once',a.hasFlag===true,a);
 ck('and it is out to grass, not stranded',a.out===true,a);

 // fill the pasture so the next horse must wait in the barn, then use the gate
 const c=await p.evaluate(()=>{const G=window.__features;
  G.save.sync(s=>{ for(let i=0;i<3;i++)G.horse.grantHorse(s,'shire',{name:'Barn'+i,src:'wild'});
                   s.horses.forEach((h,i)=>{ if(i>0) h.out=false; }); });
  const before=JSON.parse(localStorage.getItem('starRanchFable_v1')).horses.filter(x=>x.out).length;
  const gate=(G.world.things||[]).find(t=>t.id==='pasturegate');
  const label=gate&&gate.label?gate.label(gate):null;
  if(gate&&gate.use)gate.use(gate);
  const after=JSON.parse(localStorage.getItem('starRanchFable_v1')).horses.filter(x=>x.out).length;
  return {gateExists:!!gate,label,before,after};});
 ck('the pasture gate exists as an interactable',c.gateExists===true,{label:c.label});
 ck('its prompt offers to turn horses out',/Turn .* out to grass/.test(c.label||''),c.label);
 ck('using it puts the waiting horses in the field',c.after>c.before,{before:c.before,after:c.after});

 ck('no console or page errors',errs.length===0,errs.slice(0,3));
 await b.close();
 const bad=checks.filter(x=>!x.ok);
 console.log(bad.length?('FAILED '+bad.length+'/'+checks.length):('ALL '+checks.length+' CHECKS PASSED'));
 process.exit(bad.length?1:0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(2)});

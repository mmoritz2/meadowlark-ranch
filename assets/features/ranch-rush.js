/* Install after course-engine/events-pvp and before events2-disciplines. This package adds
   obstacle rows and observes the standard engine; it does not move the horse, grade a jump,
   advance a course, or pay a second purse. UI lives in ranch-rush-ui.js. */
import {RUSH_DEFINITIONS,RUSH_ROUTE_OVERRIDES,sanitizeRushSave,createRushRun,scoreRushCrossing,scoreRushRefusal,finishRushRun,recordRushResult,medalForScore,nextRushMedal} from './ranch-rush-rules.mjs?v=ranch-rush-1';
export const id='ranch-rush';
export function install(G) {
  const T=G.tables, W=G.world, player=G.horse.player, THREE=G.THREE;
  const definitions=RUSH_DEFINITIONS;
  const byId=new Map(definitions.map(d=>[d.id,d]));
  let active=null, lastResult=null, serial=0, records={};
  const handled=new WeakSet();
  G.save.ensure(s=>{s.ranchRush=sanitizeRushSave(s.ranchRush);});
  function refreshRecords(){records=sanitizeRushSave(G.save.fresh()?.ranchRush).records;}
  refreshRecords();
  T.RACE_ROUTES=T.RACE_ROUTES||{};
  for(const [key,points] of Object.entries(RUSH_ROUTE_OVERRIDES))T.RACE_ROUTES[key]=points.map(p=>p.slice());
  // Rush has its own fixed-difficulty entry UI. Keeping these rows out of EVENTS3
  // also keeps them out of ticketed PvP pools, formal difficulty cards and venue
  // qualification counts. The ordinary course engine accepts an event directly.
  const events=new Map(definitions.map(d=>[d.id,{id:d.id,name:d.name,town:d.town,
    rush:true,race:true,route:d.route,lvl:1,reward:d.reward,par:d.targetTime,time:d.targetTime*2}]));
  const evById=id=>events.get(id);
  function removeSceneGroup(group){
    if(!group)return;
    G.scene.remove(group);
    group.traverse?.(o=>{if(o.isMesh&&o.geometry)o.geometry.dispose();});
  }
  function makeLog(x,z,heading,number) {
    const g=new THREE.Group(),mat=W.mats.plankBrownMat;
    g.name='ranch-rush-log';
    const log=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,3.4,10),mat);
    log.rotation.z=Math.PI/2;log.position.y=.57;g.add(log);
    for(const side of [-1,1]) W.box(.18,.86,.18,W.mats.whitePaintMat,side*1.62,.43,0,g);
    const n=G.nameSprite(String(number));n.position.y=1.55;n.scale.set(1.1,.34,1);g.add(n);
    g.position.set(x,W.groundH(x,z),z);g.rotation.y=heading;G.scene.add(g);
    return g;
  }
  function layoutOf(c){return c.jumps.map(j=>`${j.kind}:${j.x.toFixed(1)},${j.z.toFixed(1)}`).join('|');}
  G.on('courseGate',ev=>{
    if(!ev?.rush)return;
    if(player.flying||(player.y||0)>.15){G.toast('Land before starting a Ranch Rush.');return true;}
    if(G.worldPkg?.vehicle?.()){G.toast('Finish your ferry or balloon ride first.');return true;}
  });
  G.on('courseStart',c=>{
    active=null;
    const def=byId.get(c?.ev?.id);
    if(!c?.ev?.rush||!def||!c.ce)return;
    // Low logs use existing open riding corridors. Never add a closing leg beyond the last gate.
    const gates=c.jumps.slice(),out=[];
    gates.forEach((gate,i)=>{
      out.push(gate);
      const next=gates[i+1];
      if(next&&def.fenceLegs.includes(i)){
        const x=(gate.x+next.x)/2,z=(gate.z+next.z)/2;
        const rotY=Math.atan2(next.x-gate.x,next.z-gate.z);
        out.push({x,z,rotY,g:makeLog(x,z,rotY,out.length+1),kind:'fence',prevSide:0,refuseCd:0,fenceLabel:'low log'});
      }
    });
    c.jumps.length=0;c.jumps.push(...out);
    for(const [index,j] of c.jumps.entries()){
      if(j.kind!=='gate')continue;
      for(const old of j.g.children.filter(o=>o.isSprite)){
        j.g.remove(old);old.material?.map?.dispose();old.material?.dispose();
      }
      const number=G.nameSprite(String(index+1));
      number.position.y=3;number.scale.set(1.1,.34,1);j.g.add(number);
    }
    // Hazards are not numbered course targets. Keep the challenge's actual fences readable.
    for(const hazard of c.hazards||[])removeSceneGroup(hazard.g);
    c.hazards=[];
    // Rush records real riding time. An ordinary race's -1.5 s pickup changes c.t
    // only, so remove that misleading pickup; carrots, second winds and pads work.
    c.items=(c.items||[]).filter(item=>{
      if(item.pad||item.type!=='time')return true;
      G.scene.remove(item.m);
      // Base race pickups own these resources (unlike shared log/pad materials).
      item.m?.geometry?.dispose();
      item.m?.material?.dispose();
      return false;
    });
    // Keep the normal engine's novice purse/fence grading, with one fixed timing target.
    c.par=def.targetTime;c.ce.timeAllowed=def.targetTime*2;c.ce.laps=1;c.ce.lap=1;
    c.cd=3;c.rush=true;
    refreshRecords();
    const layout=layoutOf(c),runId=`${Date.now().toString(36)}-${(++serial).toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    active={c,def,run:createRushRun(def.id,{runId,layout,total:c.jumps.length,best:records[def.id]}),idx:0,grades:0,pending:[]};
    lastResult=null;
    G.run('rushStart',snapshot().active);
  });
  // This runs before the standard course update, including its final crossing, and does not
  // inherit time-pickup deductions or jump bonuses from c.t.
  G.on('ride',(_ride,dt)=>{
    if(active&&active.c===G.course.get()&&active.c.started&&Number.isFinite(dt)&&dt>0)
      active.run.elapsed+=dt;
  });
  function cleanGate(c,index) {
    const gate=c.jumps[index],previous=c.jumps[index-1];
    const heading=previous?Math.atan2(gate.x-previous.x,gate.z-previous.z):gate.rotY;
    const dx=player.pos.x-gate.x,dz=player.pos.z-gate.z;
    const lateral=Math.abs(dx*Math.cos(heading)-dz*Math.sin(heading));
    return lateral<=2.6&&Math.cos(player.heading-heading)>.05;
  }
  function observe(c) {
    if(!active||active.c!==c)return;
    const A=active,grades=c.ce?.grades||[];
    for(;A.grades<grades.length;A.grades++) {
      const grade=grades[A.grades];
      if(grade==='refusal')A.run=scoreRushRefusal(A.run);
      else A.pending.push(grade);
    }
    while(A.idx<Math.min(c.idx,c.jumps.length)) {
      const j=c.jumps[A.idx];
      const grade=j.kind==='fence'?(A.pending.shift()||'fault'):'good';
      A.run=scoreRushCrossing(A.run,{kind:j.kind,grade,clean:cleanGate(c,A.idx),time:A.run.elapsed});
      A.idx++;
    }
  }
  G.on('courseFinish',({c,ev,pay})=>{
    if(!ev?.rush||!active||active.c!==c||handled.has(c))return;
    observe(c);
    const result=finishRushRun(active.run,{pay});
    if(!result)return;
    handled.add(c);
    let recorded=false;
    G.save.sync(s=>{const applied=recordRushResult(s.ranchRush,result);s.ranchRush=applied.save;recorded=applied.recorded;});
    refreshRecords();
    active=null;
    if(recorded){lastResult=Object.freeze(result);G.run('rushFinish',result);}
  });
  G.on('tick',()=>{
    if(active&&G.course.get()!==active.c)active=null;
    else if(active)observe(active.c);
  });
  function start(id) {
    const ev=evById(id);
    if(!ev)return false;
    const current=G.course.get();
    if(current&&!current.ev?.rush){G.toast('Finish or leave your current event before starting a Ranch Rush.');return false;}
    if(player.flying||(player.y||0)>.15){G.toast('Land before starting a Ranch Rush.');return false;}
    if(G.worldPkg?.vehicle?.()){G.toast('Finish your ferry or balloon ride first.');return false;}
    G.course.startCourse(ev,0);
    const started=G.course.get()!==current&&G.course.get()?.ev?.id===id&&active?.c===G.course.get();
    if(started){if(G.onFoot?.on)G.onFoot.mount({here:true});G.hidePanels();}
    return !!started;
  }
  function snapshot() {
    const A=active&&active.c===G.course.get()?active:null,run=A?.run,def=A?.def,c=A?.c;
    const next=c?.jumps[c.idx];
    return {definitions,records,lastResult,
      active:run?{id:def.id,name:def.name,started:!!c.started,countdown:Math.max(0,c.cd),
        elapsed:Math.round(run.elapsed*100)/100,score:run.score,combo:run.combo,bestCombo:run.bestCombo,
        completed:run.completed,total:run.total,next:next?{kind:next.kind,label:next.kind==='fence'?'Low log · jump':'Glowing gate'}:null,
        lastCue:run.lastCue,splitDelta:run.splitDelta,bestTime:run.best?.bestTime||null,
        medal:medalForScore(def,run.score),nextMedal:nextRushMedal(def,run.score)}:null};
  }
  G.ranchRush={definitions,start,snapshot,get lastResult(){return lastResult;}};
  G.on('state',state=>{state.ranchRush=snapshot();});
}

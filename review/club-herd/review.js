const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
if(location.protocol!=='http:'||!['localhost','127.0.0.1'].includes(location.hostname)||location.port!=='18796')throw Error('Use http://127.0.0.1:18796/review/club-herd/review.html');
const code=params.get('code')||'qah-'+crypto.randomUUID().replaceAll('-','').slice(0,16);
if(!/^qah-[a-z0-9]{6,20}$/.test(code)||code.length>24)throw Error('Use a QA-only code: qah- plus 6–20 lowercase letters or digits.');
params.set('code',code);history.replaceState(null,'','?'+params);
const roles=['host','guest'],origins={host:location.origin,guest:'http://'+location.hostname+':18797'},ids={host:'p'+code.replaceAll('-','')+'h',guest:'p'+code.replaceAll('-','')+'g'};
const latest={},historyRows={host:[],guest:[]},report={code,ids,status:'Ready',checks:[],verifications:[],clients:{},errors:[]};let loaded=false;
$('identity').textContent='Private anonymous QA club '+code+' · Host '+ids.host+' · Guest '+ids.guest;
const wrapperCommands=new Set(['boot','connect','club','drive','stop','disconnect','reportNow']);
const herdActions=new Set(['host','join','ready','start','leave','stop','again','save','result','activities','close','return'].map(a=>'clubherd:'+a));
const proxyNodes={host:new Map(),guest:new Map()};
function allowedCommand(c){return c?.kind==='wrapper'&&wrapperCommands.has(c.command)||c?.kind==='herd'&&herdActions.has(c.action)&&typeof c.herdId==='string'&&c.herdId.length<=96||c?.kind==='hud'&&c.command==='leave';}
function commandKey(c){return c.kind+':'+(c.command||c.action)+':'+(c.herdId||'');}
function renderControls(role){
 const row=latest[role],controls=row?.controls,nodes=proxyNodes[role],seen=new Set();if(!controls)return;
 $(role+'ProxyStatus').textContent=row.status+(controls.lastCommand?' · Last click: '+(controls.lastCommand.ok?controls.lastCommand.label:controls.lastCommand.reason):'');
 for(const c of [...(controls.wrapper||[]),...(controls.game||[])]){
  if(!allowedCommand(c))continue;const key=commandKey(c);if(seen.has(key))continue;seen.add(key);let button=nodes.get(key);
  if(!button){button=document.createElement('button');button.type='button';button.dataset.proxyRole=role;button.dataset.proxyKey=key;button.onclick=()=>{const live=latest[role]?.controls,list=[...(live?.wrapper||[]),...(live?.game||[])],actual=list.find(v=>commandKey(v)===key);if(!actual||actual.disabled||!allowedCommand(actual))return;const command=actual.kind==='herd'?{kind:'herd',action:actual.action,herdId:actual.herdId}:{kind:actual.kind,command:actual.command};$(role).contentWindow.postMessage({type:'club-herd-qa-command',code,command},origins[role]);};nodes.set(key,button);$(role+(c.kind==='wrapper'?'WrapperControls':'GameControls')).appendChild(button);}
  button.textContent=c.label;button.disabled=!!c.disabled;
 }
 for(const [key,button]of nodes)if(!seen.has(key)){button.remove();nodes.delete(key);}
}
function show(){report.clients=latest;$('report').textContent=JSON.stringify(report,null,2);for(const role of roles)renderControls(role);}
function request(){for(const role of roles)$(role).contentWindow.postMessage({type:'club-herd-qa-request',code,action:'report'},origins[role]);}
window.addEventListener('message',e=>{
 const role=roles.find(r=>e.source===$(r).contentWindow&&e.origin===origins[r]);if(!role||e.data?.type!=='club-herd-qa-report'||e.data.code!==code||e.data.role!==role||!e.data.report)return;
 const row=e.data.report;latest[role]=row;historyRows[role].push(row);if(historyRows[role].length>180)historyRows[role].shift();show();
});
$('load').onclick=()=>{if(loaded)return;loaded=true;for(const role of roles)$(role).src=origins[role]+'/review/club-herd/client.html?'+new URLSearchParams({role,code,v:'club-herd-proxy-1'});$('load').disabled=true;$('verify').disabled=false;$('snapshot').disabled=false;report.status='Boot each visible client, then use their real Club controls.';show();};
$('snapshot').onclick=request;
const moved=(rows,field)=>{const sid=rows.at(-1)?.shared?.sessionId,live=rows.filter(r=>sid&&r.shared?.sessionId===sid&&r.shared.active),first=live[0],last=live.at(-1);if(!first||!last)return 0;if(field==='player')return Math.hypot((last.player?.x||0)-(first.player?.x||0),(last.player?.z||0)-(first.player?.z||0));return first.shared.horses.filter((h,i)=>{const end=last.shared.horses[i];return end&&Math.hypot(end.x-h.x,end.z-h.z)>.3;}).length;};
function verify(){
 const phase=$('phase').value,h=latest.host,g=latest.guest,checks=[];
 const check=(ok,label,data)=>checks.push({ok:!!ok,label,...(data===undefined?{}:{data})});
 check(!!h&&!!g,'Both allowlisted client reports received');
 if(h&&g){
  check(Date.now()-h.at<2500&&Date.now()-g.at<2500,'Both reports are fresh');
  check(h.net?.id===ids.host&&g.net?.id===ids.guest&&h.net.id!==g.net.id,'Two independent production network identities');
  check(roles.every(r=>latest[r].save?.qaHerd?.code===code&&latest[r].save?.club?.pub===false),'Both saves belong to this private QA club');
  check(roles.every(r=>!latest[r].errors?.length&&!latest[r].runtimeErrors?.length),'No feature or uncaught runtime errors');
  if(phase==='lobby'||phase==='riding'||phase==='pause')check(h.net?.connected&&g.net?.connected,'Both real MQTT clients connected');
  if(phase==='lobby'){
   check(h.controller?.current?.id&&h.controller.current.id===g.controller?.current?.id,'Both joined the same live herd lobby');
   check(roles.every(r=>{const roster=latest[r].controller?.current?.roster||[];return roster.length===2&&Object.values(ids).every(id=>roster.some(m=>m.id===id&&m.ready&&m.online));}),'Both actual riders are ready in both rosters');
   check(h.controller?.current?.canStart,'The host can start after both riders are ready');
  }
  if(phase==='riding'||phase==='pause'){
   check(h.shared?.sessionId&&h.shared.sessionId===g.shared?.sessionId&&h.shared.host===true&&g.shared.host===false,'Host and guest hold the same shared production herd');
   check(h.shared?.horses?.length===5&&g.shared?.horses?.length===5,'Both clients render five shared horses');
   const delta=h.shared&&g.shared?Math.max(...h.shared.horses.map((a,i)=>{const b=g.shared.horses[i];return b&&a.name===b.name?Math.hypot(a.x-b.x,a.z-b.z):Infinity;})):Infinity;
   check(Number.isFinite(delta)&&delta<3&&Math.abs((h.shared?.elapsed||0)-(g.shared?.elapsed||0))<2,'Received herd positions agree within live frame/interpolation tolerance',{maxPositionDelta:delta,elapsedDelta:Math.abs((h.shared?.elapsed||0)-(g.shared?.elapsed||0))});
   if(phase==='riding'){
    check(moved(historyRows.host,'player')>.5&&moved(historyRows.guest,'player')>.5,'Both riders physically moved after staging',{hostDistance:moved(historyRows.host,'player'),guestDistance:moved(historyRows.guest,'player')});
    check(moved(historyRows.host,'horses')>=2&&moved(historyRows.guest,'horses')>=2,'At least two shared horses changed position on both clients',{hostCount:moved(historyRows.host,'horses'),guestCount:moved(historyRows.guest,'horses')});
   }else check(h.shared?.paused&&g.shared?.paused,'Host pause is visible in both production shared states');
  }
  if(phase==='left')check(historyRows.host.some(r=>r.shared)&&historyRows.guest.some(r=>r.shared)&&!h.shared&&!g.shared&&!h.controller?.current&&!g.controller?.current,'Both clients released their previously running herd');
  if(phase==='finished'){
   const a=h.controller?.lastResult,b=g.controller?.lastResult;check(a?.saved&&b?.saved&&a.runId===b.runId&&a.penned===5&&b.penned===5&&a.elapsed===b.elapsed,'Both clients saved the same completed five-horse time');
  }
 }
 report.checks=checks;report.verifications.push({at:Date.now(),phase,checks});if(report.verifications.length>20)report.verifications.shift();report.status=checks.every(c=>c.ok)?'PASSED: '+phase+' checks only':'NOT YET VERIFIED: '+phase;show();
}
$('verify').onclick=()=>{request();$('verify').disabled=true;setTimeout(()=>{verify();$('verify').disabled=false;},600);};show();

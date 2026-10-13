const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
if(location.protocol!=='http:'||!['localhost','127.0.0.1'].includes(location.hostname)||location.port!=='18822')throw Error('Use the dedicated host origin on port 18822.');
const token=params.get('token')||'regroup-'+crypto.randomUUID().replaceAll('-','').slice(0,20);if(!/^regroup-[a-z0-9]{12,24}$/.test(token))throw Error('Invalid local review token.');params.set('token',token);history.replaceState(null,'','?'+params);
const roles=['host','guest'],origins={host:location.origin,guest:'http://'+location.hostname+':18823'},latest={},nodes={host:new Map(),guest:new Map()},report={token,status:'Ready',checks:[],verifications:[],clients:{},limits:['Local diagnostics include anonymous production IDs/private room code; do not publish this raw download.','No full save, seed, position/time/progression mutation, synthetic regroup packet or controller action endpoint.','A normal-input driver is not a human usability study or device benchmark.']};let loaded=false,diagnosticRequest=null;const lastDiagnostics={};
const wrappers=new Set(['boot','reload','club','room','escape','drive','stop','jump','forward','left','right','brake','leftFine','rightFine','forwardLong','brakeLong','walk','trot','canter','phone','landscape','reportNow']),forms=new Set(['characterName','createClub','joinRoom']);
$('identity').textContent='Disposable origins: host 18822 · guest 18823 · '+token;
function permitted(c){return c?.kind==='wrapper'&&wrappers.has(c.command)||c?.kind==='form'&&forms.has(c.command)||c?.kind==='game'&&typeof c.key==='string'&&c.key.length<=400;}
function commandKey(c){return c.kind+':'+(c.command||c.key);}
function send(role,command){$(role).contentWindow.postMessage({type:'club-regroup-review-command',token,command},origins[role]);}
function renderControls(role){const row=latest[role],controls=row?.controls;if(!controls)return;const contentHeight=row.layout?.contentHeight;if(Number.isFinite(contentHeight)&&contentHeight>0){const height=Math.max(1800,Math.min(3200,Math.ceil(contentHeight)));if($(role).style.height!==height+'px')$(role).style.height=height+'px';}$(role+'Status').textContent=row.status+(controls.lastCommand?' · '+(controls.lastCommand.ok?controls.lastCommand.label:controls.lastCommand.reason):'');const seen=new Set();for(const c of [...controls.wrapper,...controls.forms,...controls.game]){if(!permitted(c))continue;const key=commandKey(c);if(seen.has(key))continue;seen.add(key);let button=nodes[role].get(key);if(!button){button=document.createElement('button');button.type='button';button.onclick=()=>{const live=latest[role]?.controls,actual=[...(live?.wrapper||[]),...(live?.forms||[]),...(live?.game||[])].find(x=>commandKey(x)===key);if(!actual||actual.disabled||!permitted(actual))return;let command={kind:actual.kind};if(actual.kind==='game')command.key=actual.key;else command.command=actual.command;if(actual.kind==='form')command.values=actual.command==='characterName'?{name:$(role+'Name').value}:actual.command==='createClub'?{name:$(role+'ClubName').value}:{code:$(role+'RoomCode').value};send(role,command);};nodes[role].set(key,button);$(role+(c.kind==='game'?'Game':c.kind==='form'?'Forms':'Wrappers')).append(button);}button.textContent=c.label;button.disabled=!!c.disabled;}for(const [key,b]of nodes[role])if(!seen.has(key)){b.remove();nodes[role].delete(key);}}
function show(){report.clients=latest;$('report').textContent=JSON.stringify({...report,verifications:report.verifications.slice(-8)},null,2);for(const role of roles)renderControls(role);}
function request({full=false,requestId=null}={}){for(const role of roles)$(role).contentWindow.postMessage({type:'club-regroup-review-request',token,full,requestId},origins[role]);}
window.addEventListener('message',e=>{const role=roles.find(r=>e.source===$(r).contentWindow&&e.origin===origins[r]);if(!role||e.data?.type!=='club-regroup-review-report'||e.data.token!==token||e.data.role!==role||!e.data.report)return;if(e.data.full===true){if(!diagnosticRequest||e.data.requestId!==diagnosticRequest.id)return;diagnosticRequest.rows[role]=e.data.report;lastDiagnostics[role]=e.data.report;const {trace,transitions,...compact}=e.data.report;latest[role]=compact;show();if(roles.every(r=>diagnosticRequest?.rows[r]))finishDownload();}else{latest[role]=e.data.report;show();}});
$('load').onclick=()=>{if(loaded)return;loaded=true;for(const role of roles)$(role).src=origins[role]+'/review/club-regroup/client.html?'+new URLSearchParams({role,token});$('load').disabled=true;$('snapshot').disabled=false;$('verify').disabled=false;show();};$('snapshot').onclick=request;
$('copyRoom').onclick=()=>{const code=latest.host?.clubIdentity?.code;if(typeof code==='string'&&/^mr-[a-z0-9-]{3,21}$/.test(code)&&code.length<=24)$('guestRoomCode').value=code;};
function verify(){
 const phase=$('phase').value,index=Number($('stopIndex').value),h=latest.host,g=latest.guest,checks=[],check=(ok,label)=>checks.push({ok:!!ok,label});
 check(!!h&&!!g,'Both source/origin/token-checked reports received');
 if(h&&g){
  check(Date.now()-h.at<3000&&Date.now()-g.at<3000,'Both reports are fresh');
  check(roles.every(r=>latest[r].origin===origins[r]&&latest[r].ownership?.markerMatches&&latest[r].ownership.token===token),'Independent origins have the exact review ownership marker');
  check(h.network?.id&&g.network?.id&&h.network.id!==g.network.id,'Distinct production-generated rider identities');
  check(roles.every(r=>!latest[r].errors?.length&&!latest[r].runtimeErrors?.length),'No captured feature or runtime errors; fixture diagnostics remain separate');
  check(h.clubIdentity?.code&&h.clubIdentity.code===g.clubIdentity?.code&&h.clubIdentity.pub===false&&g.clubIdentity.pub===false&&!h.clubIdentity.pendingJoin&&!g.clubIdentity.pendingJoin,'Both normally joined the same private club');
  const a=h.clubRides?.current,b=g.clubRides?.current;
  if(!['setup','alone','reload'].includes(phase)){check(h.network.connected&&g.network.connected,'Both real clients connected');check(a?.id&&a.id===b?.id&&a.mode==='regroup-v1'&&b.mode==='regroup-v1','Same actual Basin regroup session');}
  if(phase==='lobby'){
   check(a?.status==='waiting'&&b?.status==='waiting'&&a.roster.length===2&&b.roster.length===2&&a.roster.every(p=>p.ready&&p.online!==false)&&b.roster.every(p=>p.ready&&p.online!==false)&&a.canStart,'Both actual lobby riders are ready');
   if(checks.every(c=>c.ok)){report.baseline={host:h.save,guest:g.save};report.sessionId=a.id;}
  }
  if(['stop','ready','continued'].includes(phase)){
   check(Number.isInteger(index)&&index>=0&&index<4,'Selected stop index is valid');
   if(phase==='continued')check(roles.every(r=>latest[r].trail?.idx===index+1||index===3&&!latest[r].trail&&latest[r].clubRides.current.finished&&latest[r].clubRides.current.progress===4),'Both ordinary local trail loops advanced exactly one stop after Continue');
   else{
    check(roles.every(r=>latest[r].trail?.idx===index&&latest[r].clubRides.current.regroup.stopIndex===index),'Both actual trail cursors remain at this uncredited meeting stop');
    check(roles.every(r=>{const row=latest[r],p=row.player,target=row.clubRides.current.regroup.target;return p?.mounted&&p.ready&&!p.flying&&!p.landing&&p.y<.1&&Math.abs(p.speed)<1.2&&target&&Math.hypot(p.x-target.x,p.z-target.z)<8&&row.clubRides.current.regroup.arrived;}),'Both physically mounted, grounded and stopped inside the published8m meeting radius');
    if(phase==='ready')check(a.regroup.ready&&b.regroup.ready&&a.regroup.canContinue,'Both explicit Ready controls registered and host can Continue');
   }
  }
  if(phase==='alone')check(!g.clubRides.current&&!!g.trail&&!g.trail.clubRegroup&&!g.trail.clubRideId,'Guest has the same ordinary trail without group coordination after Continue alone');
  if(['finished','reload'].includes(phase)){
   check(!!report.baseline&&!!report.sessionId,'A successful pre-ride lobby observation recorded the local baselines');
   check(roles.every(r=>{const before=report.baseline?.[r],after=latest[r].save;return before&&after&&after.trails===before.trails+1&&(after.expDone?.basin||0)===(before.expDone?.basin||0)+1&&after.coins>before.coins;}),'Each own save has one additional actual trail/Basin completion and positive usual coins');
   if(phase==='finished'){check(a?.finished&&b?.finished&&!h.trail&&!g.trail,'Both actual local trail loops finished');if(checks.every(c=>c.ok))report.completedSessionId=report.sessionId;}
   else check(report.completedSessionId===report.sessionId,'Reload retained the previously observed earned completion');
  }
 }
 report.checks=checks;report.verifications.push({at:Date.now(),phase,index,checks});if(report.verifications.length>30)report.verifications.shift();report.status=checks.every(c=>c.ok)?'PASSED: selected '+phase+' observations only':'NOT YET VERIFIED: '+phase;show();
}
$('verify').onclick=()=>{request();$('verify').disabled=true;setTimeout(()=>{verify();$('verify').disabled=false;},650);};
function finishDownload(){const pending=diagnosticRequest;if(!pending)return;clearTimeout(pending.timer);diagnosticRequest=null;$('download').disabled=false;const missing=roles.filter(r=>!pending.rows[r]),output={...report,clients:Object.fromEntries(roles.map(r=>[r,pending.rows[r]||latest[r]||null])),diagnostics:{capturedAt:Date.now(),fullTraceRoles:roles.filter(r=>pending.rows[r]),missingFullTraceRoles:missing}};const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='club-regroup-local-diagnostics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('download').onclick=()=>{if(diagnosticRequest)return;diagnosticRequest={id:crypto.randomUUID(),rows:{},timer:setTimeout(finishDownload,2500)};$('download').disabled=true;request({full:true,requestId:diagnosticRequest.id});};
// Read-only cached diagnostics. Full trace capture happens only through the explicit Download button.
window.clubRegroupReviewDiagnosticSnapshot=()=>JSON.parse(JSON.stringify({...report,clients:Object.fromEntries(roles.map(r=>[r,lastDiagnostics[r]||latest[r]||null]))}));show();

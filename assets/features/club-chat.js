/* The clubhouse follows membership even when the rider visits the Commons.
   Messages share the existing club chat topic; they are never retained remotely. */
export const id='club-chat';
const MAX_LINES=50,MAX_TEXT=120;
const safe=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v);
export function install(G){
 const S=G.save,N=G.net;
 const code=(s=S.fresh())=>G.clubs.identity(s).code;
 const clean=t=>String(G.social?.filter?.clean(String(t||'').slice(0,MAX_TEXT))?.text??t??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').trim().slice(0,MAX_TEXT);
 let sentAt=0;
 S.ensure(s=>{s.clubMessages=Object.assign(Object.create(null),s.clubMessages||{});});
 function rows(s=S.fresh()){
  const c=code(s);if(!safe(c))return [];
  return (s.clubMessages?.[c]||[]).slice(-MAX_LINES).map(x=>({...x}));
 }
 function append(c,row){
  if(!safe(c))return false;let added=false;
  S.sync(s=>{if(code(s)!==c)return;const list=s.clubMessages[c]||(s.clubMessages[c]=[]);
   if(list.some(x=>x.id===row.id))return;list.push(row);s.clubMessages[c]=list.slice(-MAX_LINES);added=true;});
  if(added)G.run('clubChatChanged');return added;
 }
 function online(){return !!N.net.client?.connected;}
 function send(value){
  const c=code(),t=clean(value),at=Date.now();
  if(!safe(c))return {ok:false,reason:'Join a club to use club chat.'};
  if(!t)return {ok:false,reason:'Write a message first.'};
  if(!online())return {ok:false,reason:'Connect in Ride & chat before sending.'};
  if(at-sentAt<800)return {ok:false,reason:'Give your last message a moment.'};
  const mid=N.net.id+'-'+at.toString(36)+'-'+Math.random().toString(36).slice(2,7);
  if(!N.publish('srf1/'+c+'/chat',{t,mid,at,clubChat:true},{retain:false}))return {ok:false,reason:'The message could not be sent. Please reconnect.'};
  sentAt=at;append(c,{id:mid,n:N.myName(),t,at,mine:true});return {ok:true};
 }
 function subscribe(){const c=code();if(safe(c))N.subscribe('srf1/'+c+'/chat');}
 G.on('message',(topic,m)=>{
  const c=code(),s=S.fresh();
  if(!safe(c)||topic!=='srf1/'+c+'/chat'||!m||m.id===N.net.id||typeof m.t!=='string'||m.to)return;
  const n=String(m.n||'Rider').slice(0,14),t=clean(m.t);
  if(!t||s.muteList?.[n]||s.blocked?.[n])return;
  const at=Number.isFinite(m.at)?Math.min(Date.now()+30000,m.at):Date.now();
  if(at<Date.now()-86400000)return;
  const mid=typeof m.mid==='string'?m.mid.slice(0,128):String(m.id||n)+'|'+at+'|'+t;
  append(c,{id:mid,n,t,at,mine:false});
  // The normal room dispatcher still supplies its ticker, bubble and ride invites.
 });
 G.on('boot',subscribe);G.on('connect',subscribe);G.on('clubChanged',()=>{sentAt=0;subscribe();G.run('clubChatChanged');});
 G.clubChat={rows,send,online,MAX_TEXT};subscribe();
}

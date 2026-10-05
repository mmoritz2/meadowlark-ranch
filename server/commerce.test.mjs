import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac, randomUUID} from 'node:crypto';
import {mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync, unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {Commerce, createCommerceServer} from './commerce.mjs';

const password = 'testing-ranch-account-123';
function fixture(t, options = {}) {
  let time = 1800000000000;
  const s = new Commerce({dbPath: ':memory:', stripeKey:'sk_test_fixture', webhookSecret:'whsec_fixture', now:()=>time, ...options});
  t.after(()=>s.close());
  const login = s.register({username:'rider_one', password});
  const user = s.authenticate(login.session);
  return {s,user,login,advance:ms=>time+=ms};
}
function paid(s,user,product='gems_40',id=randomUUID()) {
  const p=s.catalog().products.find(p=>p.id===product);
  s.run('INSERT INTO orders(id,user_id,request_id,product,cents,currency,gems,days,created) VALUES(?,?,?,?,?,?,?,?,?)',id,user.id,randomUUID(),product,p.cents,p.currency,p.gems,p.days,s.now());
  return {id:'cs_test_'+id.replaceAll('-',''),object:'checkout.session',livemode:false,mode:'payment',status:'complete',payment_status:'paid',client_reference_id:id,metadata:{order_id:id},amount_total:p.cents,currency:p.currency,payment_intent:'pi_'+id};
}
function event(s,type,object,id='evt_'+randomUUID(),options={}) {
  const raw=Buffer.from(JSON.stringify({id,type,livemode:false,data:{object},...options}));
  const ts=Math.floor(s.now()/1000);
  const signature='t='+ts+',v1='+createHmac('sha256',s.webhookSecret).update(ts+'.').update(raw).digest('hex');
  return {raw,signature,send:()=>s.webhook(raw,signature)};
}
const code = status => e => e.status===status;

test('accounts hash credentials, isolate sessions, and reject incorrect login',t=>{
  const {s,user,login}=fixture(t);
  const stored=s.one('SELECT * FROM users WHERE id=?',user.id);
  assert.notEqual(stored.password,password);assert.notEqual(stored.recovery,login.recoveryCode);
  assert.notEqual(s.one('SELECT hash FROM sessions').hash,login.session);
  assert.equal(s.authenticate(s.login({username:'RIDER_ONE',password}).session).id,user.id);
  assert.throws(()=>s.login({username:'rider_one',password:'wrong-password-123'}),code(401));
  assert.throws(()=>s.register({username:'RIDER_ONE',password}),code(409));
  assert.equal(s.authenticate('made-up-token'),null);
});
test('recovery rotates the code and invalidates every previous session',t=>{
  const {s,user,login}=fixture(t);
  const fresh=s.recover({username:user.username,password:'replacement-password-123',recoveryCode:login.recoveryCode});
  assert.equal(s.authenticate(login.session),null);assert.equal(s.authenticate(fresh.session).id,user.id);
  assert.throws(()=>s.recover({username:user.username,password,recoveryCode:login.recoveryCode}),code(401));
});
test('sessions expire and login attempts are limited',t=>{
  const {s,login,advance}=fixture(t);advance(8*86400000);assert.equal(s.authenticate(login.session),null);
  for(let i=0;i<15;i++)assert.throws(()=>s.login({username:'missing_user',password}),code(401));
  assert.throws(()=>s.login({username:'missing_user',password}),code(429));
});
test('secret, restricted, and temporary sandbox test keys enable checkout',t=>{
  for (const stripeKey of ['sk_test_fixture','rk_test_fixture','rkcs_test_fixture']) {
    const service=new Commerce({dbPath:':memory:',stripeKey,webhookSecret:'whsec_fixture'});
    t.after(()=>service.close());
    assert.equal(service.stripeKey,stripeKey);
    assert.equal(service.catalog().checkoutEnabled,true);
    assert.equal(service.catalog().mode,'test');
  }
});
test('live, public, empty-prefix, and unknown server keys are refused',()=>{
  for (const stripeKey of ['sk_live_fixture','rk_live_fixture','rkcs_live_fixture','pk_test_fixture','pk_live_fixture',
    'whsec_fixture','unknown_test_fixture','sk_test_','rk_test_','rkcs_test_','sk_test_ ','rk_test_fixture\n',null,123]) {
    assert.throws(()=>new Commerce({dbPath:':memory:',stripeKey}),/Only Stripe test/);
  }
});
test('unsafe public origins are refused',()=>{
  assert.throws(()=>new Commerce({dbPath:':memory:',origin:'http://public.example'}),/HTTPS/);
});
test('checkout stays disabled without both test secrets',async t=>{
  const {s,user}=fixture(t,{stripeKey:''});
  assert.equal(s.catalog().checkoutEnabled,false);
  await assert.rejects(s.checkout(user.id,{product:'gems_40',requestId:randomUUID()}),code(503));
});
test('approved local CLI transport enables checkout and reconciliation without copying an API key',async t=>{
  let session;
  const paths=[];
  const {s,user}=fixture(t,{stripeKey:'',stripeTransport:async(path,fields,key)=>{
    paths.push(path);
    if(fields){
      assert.equal(fields['line_items[0][price_data][unit_amount]'],'299');
      assert.equal(key,'checkout:'+fields.client_reference_id);
      session={id:'cs_test_cli',livemode:false,mode:'payment',status:'complete',payment_status:'paid',client_reference_id:fields.client_reference_id,
        metadata:{order_id:fields.client_reference_id},amount_total:299,currency:'usd',payment_intent:'pi_cli',url:'https://checkout.stripe.com/c/pay/cs_test_cli'};
    }
    return session;
  }});
  assert.equal(s.catalog().checkoutEnabled,true);
  await s.checkout(user.id,{product:'gems_40',requestId:randomUUID()});
  assert.equal(s.wallet(user.id).gems,0);
  assert.equal((await s.reconcile(user.id,session.id)).fulfilled,true);
  assert.equal(s.wallet(user.id).gems,40);
  await s.reconcile(user.id,session.id);
  assert.equal(s.wallet(user.id).gems,40);
  assert.deepEqual(paths,['checkout/sessions','checkout/sessions/cs_test_cli','checkout/sessions/cs_test_cli']);
});
test('CLI transport cannot be enabled on a hosted origin or without webhook verification',t=>{
  assert.throws(()=>new Commerce({dbPath:':memory:',origin:'https://ranch.example',stripeTransport:async()=>({})}),/only available for local testing/);
  const {s}=fixture(t,{stripeKey:'',webhookSecret:'',stripeTransport:async()=>({})});
  assert.equal(s.catalog().checkoutEnabled,false);
});
test('checkout uses server prices and retries the same Stripe session',async t=>{
  let calls=0,fields,key;
  const {s,user}=fixture(t,{fetchImpl:async(url,opts)=>{
    calls++;fields=new URLSearchParams(opts.body);key=opts.headers['Idempotency-Key'];
    assert.equal(url,'https://api.stripe.com/v1/checkout/sessions');
    return {ok:true,json:async()=>({id:'cs_test_checkout',livemode:false,url:'https://checkout.stripe.com/c/pay/cs_test_checkout'})};
  }});
  const request={product:'gems_40',requestId:randomUUID(),cents:1,gems:999999};
  const first=await s.checkout(user.id,request),second=await s.checkout(user.id,request);
  assert.deepEqual(first,second);assert.equal(calls,1);assert.equal(fields.get('line_items[0][price_data][unit_amount]'),'299');
  assert.equal(fields.get('managed_payments[enabled]'),'false');
  assert.ok(key.startsWith('checkout:'));assert.equal(s.wallet(user.id).gems,0);
  await assert.rejects(s.checkout(user.id,{...request,product:'vip_30'}),code(409));
});
test('unknown products and unsafe Stripe redirects are rejected',async t=>{
  const {s,user}=fixture(t,{fetchImpl:async()=>({ok:true,json:async()=>({id:'cs_test_bad',livemode:false,url:'https://evil.example'})})});
  await assert.rejects(s.checkout(user.id,{product:'__proto__',requestId:randomUUID()}),code(400));
  await assert.rejects(s.checkout(user.id,{product:'gems_40',requestId:randomUUID()}),code(502));
});
test('signed fulfillment is atomic and exactly once across duplicate event IDs',t=>{
  const {s,user}=fixture(t),session=paid(s,user),first=event(s,'checkout.session.completed',session);
  first.send();first.send();event(s,'checkout.session.completed',session).send();
  assert.equal(s.wallet(user.id).gems,40);assert.equal(s.one('SELECT count(*) AS n FROM ledger').n,1);
});
test('invalid, stale, changed-body, and live webhooks cannot grant gems',t=>{
  const {s,user,advance}=fixture(t),e=event(s,'checkout.session.completed',paid(s,user));
  assert.throws(()=>s.webhook(e.raw,e.signature+'bad'),code(400));
  assert.throws(()=>s.webhook(Buffer.from('{}'),e.signature),code(400));
  advance(301000);assert.throws(()=>e.send(),code(400));
  assert.throws(()=>event(s,'checkout.session.completed',paid(s,user),undefined,{livemode:true}).send(),code(400));
  assert.equal(s.wallet(user.id).gems,0);
});
test('unpaid checkout does not deliver, later paid notification does',t=>{
  const {s,user}=fixture(t),session=paid(s,user);
  event(s,'checkout.session.completed',{...session,payment_status:'unpaid'}).send();assert.equal(s.wallet(user.id).gems,0);
  event(s,'checkout.session.async_payment_succeeded',session).send();assert.equal(s.wallet(user.id).gems,40);
});
test('amount, currency, and order mismatches roll back delivery',t=>{
  const {s,user}=fixture(t),session=paid(s,user);
  for(const change of [{amount_total:1},{currency:'eur'},{metadata:{order_id:'wrong'}},{client_reference_id:'wrong'}]){
    assert.throws(()=>event(s,'checkout.session.completed',{...session,...change}).send(),code(400));
  }
  assert.equal(s.wallet(user.id).gems,0);assert.equal(s.one('SELECT count(*) AS n FROM events').n,0);
});
test('VIP redemption deducts once and blocks overspending and replay changes',t=>{
  const {s,user}=fixture(t);event(s,'checkout.session.completed',paid(s,user)).send();
  const req={reward:'vip_month',requestId:randomUUID()};
  const w=s.redeem(user.id,req);assert.equal(w.gems,8);assert.equal(w.vipUntil,s.now()+30*86400000);
  assert.deepEqual(s.redeem(user.id,req),w);
  assert.throws(()=>s.redeem(user.id,{...req,reward:'vip_week'}),code(409));
  assert.throws(()=>s.redeem(user.id,{reward:'vip_week',requestId:randomUUID()}),code(409));
});
test('independent accounts cannot spend each other’s gems',t=>{
  const {s,user}=fixture(t);event(s,'checkout.session.completed',paid(s,user)).send();
  const other=s.authenticate(s.register({username:'rider_two',password}).session);
  assert.equal(s.wallet(other.id).gems,0);
  assert.throws(()=>s.redeem(other.id,{reward:'vip_week',requestId:randomUUID()}),code(409));
});
test('paid VIP stacks, expires by server time, and full refunds revoke it',t=>{
  const {s,user,advance}=fixture(t),first=paid(s,user,'vip_30');
  event(s,'checkout.session.completed',first).send();
  event(s,'checkout.session.completed',paid(s,user,'vip_30')).send();
  assert.equal(s.wallet(user.id).vipUntil,s.now()+60*86400000);
  event(s,'charge.refunded',{payment_intent:first.payment_intent,amount_refunded:499}).send();
  assert.equal(s.wallet(user.id).vipUntil,s.now()+30*86400000);
  advance(31*86400000);assert.ok(s.wallet(user.id).vipUntil<s.now());
});
test('partial and repeated refunds reverse only the cumulative amount',t=>{
  const {s,user}=fixture(t),session=paid(s,user);event(s,'checkout.session.completed',session).send();
  const refund=amount=>event(s,'charge.refunded',{payment_intent:session.payment_intent,amount_refunded:amount}).send();
  refund(100);assert.equal(s.wallet(user.id).gems,26);refund(100);refund(50);assert.equal(s.wallet(user.id).gems,26);
  refund(299);assert.equal(s.wallet(user.id).gems,0);
});
test('refund arriving before fulfillment is not lost',t=>{
  const {s,user}=fixture(t),session=paid(s,user);
  event(s,'charge.refunded',{payment_intent:session.payment_intent,amount_refunded:299}).send();
  event(s,'checkout.session.completed',session).send();assert.equal(s.wallet(user.id).gems,0);
});
test('refund of spent gems creates a hold and suspends paid VIP',t=>{
  const {s,user}=fixture(t),session=paid(s,user);event(s,'checkout.session.completed',session).send();
  s.redeem(user.id,{reward:'vip_month',requestId:randomUUID()});
  event(s,'charge.refunded',{payment_intent:session.payment_intent,amount_refunded:299}).send();
  assert.deepEqual(s.wallet(user.id),{gems:-32,vipUntil:0,held:true});
});
test('disputes suspend account purchases and won disputes restore access',t=>{
  const {s,user}=fixture(t),session=paid(s,user,'vip_30');event(s,'checkout.session.completed',session).send();
  const dispute={payment_intent:session.payment_intent,status:'needs_response'};
  event(s,'charge.dispute.created',dispute).send();assert.equal(s.wallet(user.id).held,true);
  event(s,'charge.dispute.closed',{...dispute,status:'won'}).send();assert.equal(s.wallet(user.id).held,false);
  event(s,'charge.dispute.created',dispute).send();assert.equal(s.wallet(user.id).held,false);
});
test('cloud saves preserve ranches, reject conflicts, and cannot mint paid currency',t=>{
  const {s,user}=fixture(t),save={v:2,horses:[{id:1,name:'Clover'}],gems:999999,vip:{until:9999999999999},premium:{gems:999999},wallet:{gems:999999}};
  assert.equal(s.saveCloud(user.id,{save,revision:0}).revision,1);
  const stored=JSON.parse(s.one('SELECT body FROM saves WHERE user_id=?',user.id).body);
  assert.equal(stored.horses[0].name,'Clover');assert.equal(stored.premium,undefined);assert.equal(stored.wallet,undefined);
  assert.deepEqual(s.wallet(user.id),{gems:0,vipUntil:0,held:false});
  assert.throws(()=>s.saveCloud(user.id,{save,revision:0}),code(409));
  assert.throws(()=>s.saveCloud(user.id,{save:{v:2,horses:[]},revision:1}),code(400));
  assert.equal(s.saveCloud(user.id,{save,revision:1}).revision,2);
});
test('reconcile verifies ownership with Stripe before crediting anything',async t=>{
  let session;
  const {s,user}=fixture(t,{fetchImpl:async()=>({ok:true,json:async()=>session})});session=paid(s,user);
  const other=s.authenticate(s.register({username:'rider_two',password}).session);
  await assert.rejects(s.reconcile(other.id,session.id),code(404));assert.equal(s.wallet(user.id).gems,0);
  assert.equal((await s.reconcile(user.id,session.id)).fulfilled,true);assert.equal(s.wallet(user.id).gems,40);
  event(s,'checkout.session.completed',session).send();assert.equal(s.wallet(user.id).gems,40);
});
test('ledger, sessions and cloud saves survive a service restart',t=>{
  const dir=mkdtempSync(join(tmpdir(),'meadowlark-commerce-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const options={dbPath:join(dir,'db.sqlite'),stripeKey:'sk_test_fixture',webhookSecret:'whsec_fixture'};
  let s=new Commerce(options);const login=s.register({username:'rider_one',password}),user=s.authenticate(login.session);
  event(s,'checkout.session.completed',paid(s,user)).send();s.saveCloud(user.id,{revision:0,save:{v:2,horses:[{name:'Clover'}]}});s.close();
  s=new Commerce(options);assert.equal(s.authenticate(login.session).id,user.id);assert.equal(s.wallet(user.id).gems,40);assert.equal(s.account(user).cloud.revision,1);s.close();
});
test('HTTP protects account data, enforces origin, blocks private files, and expires logout cookie',async t=>{
  const {s}=fixture(t);const server=createCommerceServer(s);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));s.origin='http://127.0.0.1:'+server.address().port;
  const request=(path,body,headers={})=>fetch(s.origin+path,{...(body!==undefined?{method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json',Origin:s.origin,...headers}}:{headers})});
  assert.equal((await request('/api/me')).status,401);
  assert.equal((await request('/api/login',{username:'rider_one',password},{Origin:'https://evil.example'})).status,403);
  assert.equal((await request('/api/login',{username:'rider_one',password},{Origin:''})).status,403);
  const login=await request('/api/login',{username:'rider_one',password});assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Lax/);
  const headers={Cookie:cookie.split(';')[0]};const me=await request('/api/me',undefined,headers);assert.equal(me.status,200);assert.equal(me.headers.get('cache-control'),'no-store');
  for(const path of ['/server/data/commerce.sqlite','/.env','/.git/config','/server/commerce.mjs','/output/secret.json','/assets/../server/commerce.mjs']) assert.equal((await request(path)).status,404,path);
  const store=await request('/store.html');assert.equal(store.status,200);assert.match(store.headers.get('content-security-policy'),/script-src 'self'/);
  assert.equal((await request('/api/logout',{},headers)).status,200);assert.equal((await request('/api/me',undefined,headers)).status,401);
});


test('HTTP serves runtime review assets while blocking other review files and symlink substitutions',async t=>{
  const {NATIVE_BREED_PROFILES}=await import('../assets/native-breed-profiles.js');
  const names=[...new Set(Object.values(NATIVE_BREED_PROFILES).flatMap(p=>[p.file,p.nativeAnchorFile,p.nativeCoordinateFile])
    .filter(name=>name?.startsWith('../review/')).map(name=>name.slice(3)))];
  assert.ok(names.length>0);
  const root=mkdtempSync(join(tmpdir(),'ranch-runtime-static-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const write=(name,data)=>{const file=join(root,name);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,data);};
  for(const name of names)write(name,name.endsWith('.json')?'{}':'public model fixture');
  for(const name of ['review/private.json','review/native-trot-reference-kit/white/private.json','server/private.json'])write(name,'private fixture');
  const {s}=fixture(t),server=createCommerceServer(s,root);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  s.origin='http://127.0.0.1:'+server.address().port;
  for(const name of names){
    const response=await fetch(s.origin+'/'+name+'?build=fixture',{method:'HEAD'});
    assert.equal(response.status,200,name);
    assert.equal(response.headers.get('content-type'),name.endsWith('.glb')?'model/gltf-binary':'application/json',name);
  }
  const json=names.find(name=>name.endsWith('.json'));
  assert.deepEqual(await (await fetch(s.origin+'/'+json)).json(),{});
  for(const name of ['review/private.json','review/native-trot-reference-kit/white/private.json','server/private.json']){
    assert.equal((await fetch(s.origin+'/'+name)).status,404,name);
  }
  unlinkSync(join(root,json));symlinkSync(join(root,'server/private.json'),join(root,json));
  assert.equal((await fetch(s.origin+'/'+json)).status,404,'Allowed name must not expose a private symlink target');
});

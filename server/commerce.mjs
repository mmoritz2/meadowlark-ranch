import {DatabaseSync} from 'node:sqlite';
import {createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual, createHmac} from 'node:crypto';
import {mkdirSync, realpathSync, statSync, createReadStream} from 'node:fs';
import {dirname, resolve, extname, sep} from 'node:path';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {PRODUCTS, REWARDS} from './catalog.mjs';

const DAY = 86400000;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DB = resolve(homedir(), '.local/share/meadowlark-ranch/commerce.sqlite');
const digest = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const fail = (status, message) => {throw Object.assign(new Error(message), {status});};
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const keyOK = s => typeof s === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(s);
const usernameOf = s => {
  if (typeof s !== 'string' || !/^[a-zA-Z0-9_]{3,24}$/.test(s)) fail(400, 'Use 3–24 letters, numbers or underscores for your username.');
  return s.toLowerCase();
};
const passwordOK = p => {if (typeof p !== 'string' || p.length < 12 || p.length > 128) fail(400, 'Use a password of 12–128 characters.');};
function hashPassword(p, salt = randomBytes(16).toString('hex')) {
  return 'scrypt-17:' + salt + ':' + scryptSync(p, salt, 64, {N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024}).toString('hex');
}
function passwordMatches(p, stored) {
  const [scheme, salt] = stored.split(':');
  return scheme === 'scrypt-17' && same(hashPassword(p, salt), stored);
}

export class Commerce {
  constructor({dbPath = DEFAULT_DB, origin = 'http://127.0.0.1:8432', stripeKey = '', webhookSecret = '', stripeTransport = null, fetchImpl = fetch, now = Date.now} = {}) {
    const u = new URL(origin);
    if (u.origin !== origin || u.username || u.password || (u.protocol !== 'https:' && !['http://127.0.0.1', 'http://localhost'].includes(u.protocol + '//' + u.hostname))) throw Error('APP_ORIGIN must be an HTTPS origin or localhost origin, without a trailing slash.');
    if (stripeKey !== '' && (typeof stripeKey !== 'string' || !/^(?:sk|rk|rkcs)_test_[A-Za-z0-9_]+$/.test(stripeKey))) throw Error('Only Stripe test server keys (sk_test_, rk_test_, rkcs_test_) are supported. Live purchases are disabled.');
    if (webhookSecret && !webhookSecret.startsWith('whsec_')) throw Error('Invalid webhook secret format.');
    if (stripeTransport !== null && (typeof stripeTransport !== 'function' || !['http://127.0.0.1', 'http://localhost'].includes(u.protocol + '//' + u.hostname))) throw Error('The Stripe CLI transport is only available for local testing.');
    Object.assign(this, {origin, stripeKey, webhookSecret, stripeTransport, fetchImpl, now});
    this.secure = u.protocol === 'https:';
    if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), {recursive: true, mode: 0o700});
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, recovery TEXT NOT NULL, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY, start INTEGER NOT NULL, count INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), request_id TEXT NOT NULL,
        product TEXT NOT NULL, cents INTEGER NOT NULL, currency TEXT NOT NULL, gems INTEGER NOT NULL, days INTEGER NOT NULL,
        created INTEGER NOT NULL, session TEXT UNIQUE, url TEXT, payment_intent TEXT UNIQUE, fulfilled INTEGER, refunded INTEGER NOT NULL DEFAULT 0,
        UNIQUE(user_id, request_id));
      CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), delta INTEGER NOT NULL,
        reason TEXT NOT NULL, reference TEXT UNIQUE NOT NULL, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS redemptions(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), request_id TEXT NOT NULL,
        reward TEXT NOT NULL, cost INTEGER NOT NULL, created INTEGER NOT NULL, UNIQUE(user_id, request_id));
      CREATE TABLE IF NOT EXISTS vip_grants(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), days INTEGER NOT NULL,
        revoked_days INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS refunds(payment_intent TEXT PRIMARY KEY, cents INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS disputes(payment_intent TEXT PRIMARY KEY, blocked INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS saves(user_id TEXT PRIMARY KEY REFERENCES users(id), revision INTEGER NOT NULL, body TEXT NOT NULL, updated INTEGER NOT NULL);
    `);
    this.dummyPassword = hashPassword(token());
  }
  close() {this.db.close();}
  one(sql, ...args) {return this.db.prepare(sql).get(...args);}
  all(sql, ...args) {return this.db.prepare(sql).all(...args);}
  run(sql, ...args) {return this.db.prepare(sql).run(...args);}
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {const result = fn(); this.db.exec('COMMIT'); return result;}
    catch (e) {this.db.exec('ROLLBACK'); throw e;}
  }
  limit(key, max = 10, window = 900000) {
    const now = this.now();
    const n = this.transaction(() => {
      this.run('DELETE FROM limits WHERE start < ?', now - DAY);
      const old = this.one('SELECT * FROM limits WHERE key=?', key);
      const start = old && now - old.start < window ? old.start : now;
      const count = start === old?.start ? old.count + 1 : 1;
      this.run('INSERT OR REPLACE INTO limits VALUES(?,?,?)', key, start, count);
      return count;
    });
    if (n > max) fail(429, 'Too many attempts. Please try again later.');
  }
  session(userId) {
    const raw = token();
    this.run('DELETE FROM sessions WHERE expires<=?', this.now());
    this.run('INSERT INTO sessions VALUES(?,?,?)', digest(raw), userId, this.now() + 7 * DAY);
    return raw;
  }
  authenticate(raw) {
    if (!raw || raw.length > 100) return null;
    return this.one('SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>?', digest(raw), this.now()) || null;
  }
  register(body) {
    const username = usernameOf(body.username); passwordOK(body.password);
    const recovery = token(), id = randomUUID(), password = hashPassword(body.password);
    return this.transaction(() => {
      if (this.one('SELECT id FROM users WHERE username=?', username)) fail(409, 'That username is unavailable.');
      this.run('INSERT INTO users VALUES(?,?,?,?,?)', id, username, password, digest(recovery), this.now());
      return {session: this.session(id), recoveryCode: recovery};
    });
  }
  login(body) {
    const username = usernameOf(body.username); passwordOK(body.password);
    this.limit('login:' + username, 15);
    const user = this.one('SELECT * FROM users WHERE username=?', username);
    if (!passwordMatches(body.password, user?.password || this.dummyPassword) || !user) fail(401, 'Username or password is incorrect.');
    return {session: this.session(user.id)};
  }
  recover(body) {
    const username = usernameOf(body.username); passwordOK(body.password);
    this.limit('recover:' + username, 5);
    const u = this.one('SELECT * FROM users WHERE username=?', username);
    if (!keyOK(body.recoveryCode) || !same(digest(body.recoveryCode), u?.recovery || '0'.repeat(64))) fail(401, 'Username or recovery code is incorrect.');
    const recoveryCode = token(), password = hashPassword(body.password);
    return this.transaction(() => {
      this.run('UPDATE users SET password=?,recovery=? WHERE id=?', password, digest(recoveryCode), u.id);
      this.run('DELETE FROM sessions WHERE user_id=?', u.id);
      return {session: this.session(u.id), recoveryCode};
    });
  }
  wallet(userId) {
    const gems = this.one('SELECT COALESCE(SUM(delta),0) AS n FROM ledger WHERE user_id=?', userId).n;
    const disputed = !!this.one('SELECT o.id FROM orders o JOIN disputes d ON d.payment_intent=o.payment_intent WHERE o.user_id=? AND d.blocked=1 LIMIT 1', userId);
    let vipUntil = 0;
    for (const g of this.all('SELECT * FROM vip_grants WHERE user_id=? ORDER BY created,id', userId)) {
      if (g.days > g.revoked_days) vipUntil = Math.max(vipUntil, g.created) + (g.days - g.revoked_days) * DAY;
    }
    return {gems, vipUntil: gems < 0 || disputed ? 0 : vipUntil, held: gems < 0 || disputed};
  }
  account(user) {
    const save = this.one('SELECT revision,updated FROM saves WHERE user_id=?', user.id);
    return {user, wallet: this.wallet(user.id), cloud: save || {revision: 0, updated: null},
      history: this.all('SELECT delta,reason,created FROM ledger WHERE user_id=? ORDER BY id DESC LIMIT 30', user.id),
      orders: this.all('SELECT product,cents,currency,created,fulfilled,refunded FROM orders WHERE user_id=? ORDER BY created DESC LIMIT 20', user.id)};
  }
  catalog() {
    return {mode: 'test', checkoutEnabled: !!((this.stripeKey || this.stripeTransport) && this.webhookSecret),
      products: Object.entries(PRODUCTS).map(([id, p]) => ({id, ...p, currency: 'usd'})),
      rewards: Object.entries(REWARDS).map(([id, p]) => ({id, ...p}))};
  }
  redeem(userId, body) {
    if (!Object.hasOwn(REWARDS, body.reward) || !keyOK(body.requestId)) fail(400, 'Choose a valid VIP pass.');
    return this.transaction(() => {
      const old = this.one('SELECT reward FROM redemptions WHERE user_id=? AND request_id=?', userId, body.requestId);
      if (old) {if (old.reward !== body.reward) fail(409, 'This request was already used.'); return this.wallet(userId);}
      const reward = REWARDS[body.reward], wallet = this.wallet(userId);
      if (wallet.held) fail(409, 'Purchases are on hold. Please contact support.');
      if (wallet.gems < reward.gems) fail(409, 'Not enough purchased gems for this pass.');
      const id = randomUUID(), now = this.now();
      this.run('INSERT INTO redemptions VALUES(?,?,?,?,?,?)', id, userId, body.requestId, body.reward, reward.gems, now);
      this.run('INSERT INTO ledger(user_id,delta,reason,reference,created) VALUES(?,?,?,?,?)', userId, -reward.gems, reward.name, 'spend:' + id, now);
      this.run('INSERT INTO vip_grants(id,user_id,days,created) VALUES(?,?,?,?)', 'spend:' + id, userId, reward.days, now);
      return this.wallet(userId);
    });
  }
  async stripe(path, fields, idempotencyKey) {
    if (this.stripeTransport) return this.stripeTransport(path, fields, idempotencyKey);
    const response = await this.fetchImpl('https://api.stripe.com/v1/' + path, {
      method: fields ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: {Authorization: 'Bearer ' + this.stripeKey, ...(fields ? {'Content-Type': 'application/x-www-form-urlencoded'} : {}),
        ...(idempotencyKey ? {'Idempotency-Key': idempotencyKey} : {})},
      ...(fields ? {body: new URLSearchParams(fields)} : {})});
    if (!response.ok) fail(502, 'Checkout is temporarily unavailable. Please retry.');
    return response.json();
  }
  async checkout(userId, body) {
    if (!this.catalog().checkoutEnabled) fail(503, 'Test checkout is waiting for the server’s Stripe test configuration.');
    if (!Object.hasOwn(PRODUCTS, body.product) || !keyOK(body.requestId)) fail(400, 'Choose a valid product.');
    if (this.wallet(userId).held) fail(409, 'Purchases are on hold. Please contact support.');
    const order = this.transaction(() => {
      let o = this.one('SELECT * FROM orders WHERE user_id=? AND request_id=?', userId, body.requestId);
      if (o) {if (o.product !== body.product) fail(409, 'This request was already used.'); return o;}
      const p = PRODUCTS[body.product], id = randomUUID();
      this.run('INSERT INTO orders(id,user_id,request_id,product,cents,currency,gems,days,created) VALUES(?,?,?,?,?,?,?,?,?)', id, userId, body.requestId, body.product, p.cents, 'usd', p.gems, p.days, this.now());
      return this.one('SELECT * FROM orders WHERE id=?', id);
    });
    if (order.fulfilled || this.now() - order.created >= 23 * 3600000) fail(409, 'This checkout has ended. Refresh the store to start another.');
    if (order.url) return {url: order.url};
    const p = PRODUCTS[order.product];
    const s = await this.stripe('checkout/sessions', {
      mode: 'payment', 'payment_method_types[0]': 'card',
      // Keep this fixed-price test store on standard Checkout even when a new
      // sandbox defaults to Stripe Managed Payments and adds tax automatically.
      'managed_payments[enabled]': 'false',
      'line_items[0][price_data][currency]': order.currency,
      'line_items[0][price_data][unit_amount]': String(order.cents),
      'line_items[0][price_data][product_data][name]': 'Meadowlark — ' + p.name,
      'line_items[0][quantity]': '1', client_reference_id: order.id,
      'metadata[order_id]': order.id, 'payment_intent_data[metadata][order_id]': order.id,
      success_url: this.origin + '/store.html?checkout=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: this.origin + '/store.html?checkout=cancelled',
    }, 'checkout:' + order.id);
    if (s.livemode !== false || !/^cs_test_/.test(s.id) || !s.url || new URL(s.url).origin !== 'https://checkout.stripe.com') fail(502, 'Unexpected checkout response.');
    this.run('UPDATE orders SET session=?,url=? WHERE id=?', s.id, s.url, order.id);
    return {url: s.url};
  }
  fulfill(s) {
    if (s.livemode !== false || s.mode !== 'payment' || s.status !== 'complete' || s.payment_status !== 'paid') return false;
    const order = this.one('SELECT * FROM orders WHERE id=?', s.client_reference_id || '');
    if (!order || s.metadata?.order_id !== order.id || (order.session && order.session !== s.id) || !/^cs_test_/.test(s.id) ||
        s.amount_total !== order.cents || s.currency !== order.currency || typeof s.payment_intent !== 'string' || !/^pi_/.test(s.payment_intent)) fail(400, 'Payment does not match an order.');
    if (order.fulfilled) return true;
    const now = this.now();
    this.run('UPDATE orders SET fulfilled=?,session=?,payment_intent=? WHERE id=?', now, s.id, s.payment_intent, order.id);
    if (order.gems) this.run('INSERT INTO ledger(user_id,delta,reason,reference,created) VALUES(?,?,?,?,?)', order.user_id, order.gems, PRODUCTS[order.product].name, 'order:' + order.id, now);
    if (order.days) this.run('INSERT INTO vip_grants(id,user_id,days,created) VALUES(?,?,?,?)', 'order:' + order.id, order.user_id, order.days, now);
    const refund = this.one('SELECT cents FROM refunds WHERE payment_intent=?', s.payment_intent);
    if (refund) this.applyRefund(order.id, refund.cents);
    return true;
  }
  applyRefund(id, cents) {
    const o = this.one('SELECT * FROM orders WHERE id=?', id);
    const refunded = Math.min(o.cents, Math.max(o.refunded, cents));
    if (refunded === o.refunded || !o.fulfilled) return;
    const reversal = Math.ceil(o.gems * refunded / o.cents) - Math.ceil(o.gems * o.refunded / o.cents);
    if (reversal) this.run('INSERT INTO ledger(user_id,delta,reason,reference,created) VALUES(?,?,?,?,?)', o.user_id, -reversal, 'Refund adjustment', 'refund:' + id + ':' + refunded, this.now());
    if (o.days) this.run('UPDATE vip_grants SET revoked_days=? WHERE id=?', Math.ceil(o.days * refunded / o.cents), 'order:' + id);
    this.run('UPDATE orders SET refunded=? WHERE id=?', refunded, id);
  }
  webhook(raw, signature) {
    if (!this.webhookSecret) fail(503, 'Webhook is not configured.');
    const parts = String(signature || '').split(',').map(x => x.split('='));
    const t = parts.find(([k]) => k === 't')?.[1];
    if (!/^\d+$/.test(t || '') || Math.abs(this.now() / 1000 - Number(t)) > 300) fail(400, 'Invalid webhook signature.');
    const expected = createHmac('sha256', this.webhookSecret).update(t + '.').update(raw).digest('hex');
    if (!parts.some(([k, v]) => k === 'v1' && /^[0-9a-f]{64}$/.test(v || '') && same(v, expected))) fail(400, 'Invalid webhook signature.');
    let e;
    try {e = JSON.parse(raw);} catch {fail(400, 'Invalid webhook.');}
    if (e.livemode !== false || typeof e.id !== 'string' || !e.id.startsWith('evt_') || !e.data?.object) fail(400, 'Only test events are accepted.');
    return this.transaction(() => {
      if (this.one('SELECT id FROM events WHERE id=?', e.id)) return {received: true};
      const obj = e.data.object;
      if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(e.type)) this.fulfill(obj);
      if (e.type === 'charge.refunded') {
        if (typeof obj.payment_intent !== 'string' || !Number.isSafeInteger(obj.amount_refunded) || obj.amount_refunded < 0) fail(400, 'Invalid refund.');
        const old = this.one('SELECT cents FROM refunds WHERE payment_intent=?', obj.payment_intent);
        const cents = Math.max(old?.cents || 0, obj.amount_refunded);
        this.run('INSERT OR REPLACE INTO refunds VALUES(?,?)', obj.payment_intent, cents);
        const o = this.one('SELECT id FROM orders WHERE payment_intent=?', obj.payment_intent);
        if (o) this.applyRefund(o.id, cents);
      }
      if (e.type === 'charge.dispute.created' || e.type === 'charge.dispute.closed') {
        if (typeof obj.payment_intent !== 'string') fail(400, 'Invalid dispute.');
        // A late "created" event must not overwrite the terminal state of a won dispute.
        if (e.type.endsWith('.closed')) this.run('INSERT OR REPLACE INTO disputes VALUES(?,?)', obj.payment_intent, obj.status === 'won' ? 0 : 1);
        else this.run('INSERT OR IGNORE INTO disputes VALUES(?,1)', obj.payment_intent);
      }
      this.run('INSERT INTO events VALUES(?,?)', e.id, this.now());
      return {received: true};
    });
  }
  async reconcile(userId, sessionId) {
    if ((!this.stripeKey && !this.stripeTransport) || typeof sessionId !== 'string' || !/^cs_test_[a-zA-Z0-9_]{1,200}$/.test(sessionId)) fail(400, 'Invalid checkout.');
    const s = await this.stripe('checkout/sessions/' + encodeURIComponent(sessionId));
    const o = this.one('SELECT user_id FROM orders WHERE id=?', s.client_reference_id || '');
    if (!o || o.user_id !== userId) fail(404, 'Checkout was not found.');
    return {fulfilled: this.transaction(() => this.fulfill(s)), wallet: this.wallet(userId)};
  }
  saveCloud(userId, body) {
    const s = body.save;
    if (!Number.isSafeInteger(body.revision) || body.revision < 0 || !s || typeof s !== 'object' || Array.isArray(s) ||
        !Number.isFinite(s.v) || !Array.isArray(s.horses) || !s.horses.length || s.horses.length > 1000 ||
        !s.horses.every(h => h && typeof h === 'object' && !Array.isArray(h))) fail(400, 'This is not a valid ranch save.');
    const clean = {...s};
    // Backups are untrusted gameplay data, NEVER a source of paid balances or entitlements.
    for (const key of ['commerce', 'premium', 'purchases', 'wallet', 'account', 'paidVipUntil', '__proto__', 'constructor', 'prototype']) delete clean[key];
    const json = JSON.stringify(clean);
    if (Buffer.byteLength(json) > 1000000) fail(413, 'This ranch save is too large.');
    return this.transaction(() => {
      const prev = this.one('SELECT revision FROM saves WHERE user_id=?', userId);
      if ((prev?.revision || 0) !== body.revision) fail(409, 'A newer cloud save exists. Refresh and review it before saving again.');
      const revision = body.revision + 1, updated = this.now();
      this.run('INSERT OR REPLACE INTO saves VALUES(?,?,?,?)', userId, revision, json, updated);
      return {revision, updated};
    });
  }
}

const mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg'};
// The live horse profiles reference these public runtime assets outside assets/.
// Keep review tooling and every other review file private to this server.
const PUBLIC_RUNTIME_FILES = new Set([
  'review/native-trot-reference-kit/sporthorse/model.glb',
  'review/native-trot-reference-kit/white/model.glb',
  'review/native-trot-reference-kit/bay/model.glb',
  'review/native-bay-sporthorse-kit/anchors.json',
  'review/native-bay-sporthorse-kit/actual-coordinates.json',
  'review/native-rider-reins/anchors.json',
  'review/native-bay-rollover/rider-prerequisites/actual-coordinates.json',
]);
async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {size += chunk.length; if (size > 1100000) fail(413, 'Request is too large.'); chunks.push(chunk);}
  return Buffer.concat(chunks);
}
function sessionCookie(req) {
  return /(?:^|;\s*)mr_session=([a-zA-Z0-9_-]+)/.exec(req.headers.cookie || '')?.[1] || '';
}
export function createCommerceServer(service, root = ROOT) {
  root = realpathSync(root);
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    if (service.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    const json = (status, obj) => {res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(obj));};
    try {
      const url = new URL(req.url, service.origin), path = url.pathname;
      if (path.startsWith('/api/')) {
        if (!['GET', 'POST'].includes(req.method)) fail(405, 'Method not allowed.');
        const ip = req.socket.remoteAddress || 'unknown'; // never trust a client-supplied proxy IP
        if (path === '/api/stripe/webhook' && req.method === 'POST') {
          return json(200, service.webhook(await readBody(req), req.headers['stripe-signature']));
        }
        if (req.headers.host !== new URL(service.origin).host) fail(403, 'Invalid request host.');
        if (req.method === 'POST' && (req.headers.origin !== service.origin || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || ''))) fail(403, 'Use this site to make account changes.');
        service.limit('api:' + ip, 300, 60000);
        let body = {};
        if (req.method === 'POST') {
          try {body = JSON.parse(await readBody(req));} catch (e) {if (e.status) throw e; fail(400, 'Invalid JSON.');}
          if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Invalid request.');
        }
        if (path === '/api/catalog' && req.method === 'GET') return json(200, service.catalog());
        if (['/api/register', '/api/login', '/api/recover'].includes(path) && req.method === 'POST') {
          service.limit('auth:' + ip, 20);
          const result = service[path.slice(5)](body);
          res.setHeader('Set-Cookie', `mr_session=${result.session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${service.secure ? '; Secure' : ''}`);
          return json(200, {recoveryCode: result.recoveryCode, ...service.account(service.authenticate(result.session))});
        }
        const raw = sessionCookie(req), user = service.authenticate(raw);
        if (!user) fail(401, 'Sign in to your ranch account.');
        if (path === '/api/me' && req.method === 'GET') return json(200, service.account(user));
        if (path === '/api/logout' && req.method === 'POST') {
          service.run('DELETE FROM sessions WHERE hash=?', digest(raw));
          res.setHeader('Set-Cookie', `mr_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${service.secure ? '; Secure' : ''}`);
          return json(200, {ok: true});
        }
        if (path === '/api/checkout' && req.method === 'POST') {service.limit('checkout:' + user.id, 20); return json(200, await service.checkout(user.id, body));}
        if (path === '/api/reconcile' && req.method === 'POST') {service.limit('reconcile:' + user.id, 30); return json(200, await service.reconcile(user.id, body.sessionId));}
        if (path === '/api/redeem' && req.method === 'POST') return json(200, {wallet: service.redeem(user.id, body)});
        if (path === '/api/save' && req.method === 'POST') return json(200, service.saveCloud(user.id, body));
        if (path === '/api/save' && req.method === 'GET') {
          const save = service.one('SELECT * FROM saves WHERE user_id=?', user.id);
          if (!save) fail(404, 'No cloud save yet.');
          return json(200, {save: JSON.parse(save.body), revision: save.revision, updated: save.updated});
        }
        fail(404, 'Not found.');
      }
      if (!['GET', 'HEAD'].includes(req.method)) fail(405, 'Method not allowed.');
      const decoded = decodeURIComponent(path);
      const name = decoded === '/' ? 'index.html' : decoded.slice(1);
      if (name.split('/').some(p => p.startsWith('.')) || (!name.startsWith('assets/') && !['index.html', 'ranch3d.html', 'store.html', 'sw.js', 'manifest.webmanifest'].includes(name) && !PUBLIC_RUNTIME_FILES.has(name))) fail(404, 'Not found.');
      if (!mime[extname(name)]) fail(404, 'Not found.');
      let file;
      try {file = realpathSync(resolve(root, name));} catch {fail(404, 'Not found.');}
      if (!file.startsWith(root + sep) || (name.startsWith('assets/') && !file.startsWith(resolve(root, 'assets') + sep))) fail(404, 'Not found.');
      if (PUBLIC_RUNTIME_FILES.has(name) && file !== resolve(root, name)) fail(404, 'Not found.'); // No symlink substitutions.
      const st = statSync(file);
      if (!st.isFile()) fail(404, 'Not found.');
      if (name === 'store.html') res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
      res.writeHead(200, {'Content-Type': mime[extname(file)], 'Content-Length': st.size, 'Cache-Control': 'no-cache'});
      if (req.method === 'HEAD') return res.end();
      createReadStream(file).on('error', () => res.destroy()).pipe(res);
    } catch (e) {
      if (res.headersSent) return res.destroy();
      if (!e.status) console.error('Commerce request failed:', e.name); // never log request bodies, cookies, keys or Stripe responses
      json(e.status || 500, {error: e.status ? e.message : 'The account service is temporarily unavailable.'});
    }
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 15000;
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  const port = Number(process.env.PORT || 8432);
  const bindHost = process.env.BIND_HOST || '127.0.0.1';
  let stripeTransport = null;
  if (process.env.STRIPE_CLI_PROJECT) {
    if (bindHost !== '127.0.0.1') throw Error('The Stripe CLI test server must bind to 127.0.0.1.');
    const {createStripeCliTransport} = await import('./stripe-cli.mjs');
    stripeTransport = createStripeCliTransport({project: process.env.STRIPE_CLI_PROJECT, accountId: process.env.STRIPE_CLI_ACCOUNT});
  }
  const service = new Commerce({dbPath: process.env.COMMERCE_DB || DEFAULT_DB, origin: process.env.APP_ORIGIN || `http://127.0.0.1:${port}`, stripeKey: process.env.STRIPE_SECRET_KEY || '', webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '', stripeTransport});
  const server = createCommerceServer(service);
  server.listen(port, bindHost, () => console.log(`Meadowlark test store: ${service.origin}/store.html\nCheckout ${service.catalog().checkoutEnabled ? 'enabled (Stripe TEST mode)' : 'disabled until Stripe test credentials are configured'}.`));
  const stop = () => server.close(() => {service.close(); process.exit(0);});
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}

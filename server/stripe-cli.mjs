import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const execFileAsync = promisify(execFile);
const SESSION_ID = /^cs_test_[A-Za-z0-9_]{1,200}$/;
const unavailable = () => Object.assign(new Error('Stripe test connection is unavailable. Check the local Stripe sign-in and retry.'), {status: 502});

function options(config = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw unavailable();
  const {project, accountId, run = execFileAsync} = config;
  if (typeof project !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(project) ||
      typeof accountId !== 'string' || !/^acct_[A-Za-z0-9]{1,100}$/.test(accountId) || typeof run !== 'function') throw unavailable();
  return {project, accountId, run};
}

async function command(config, args) {
  // Use the CLI's approved login. An inherited API key must never override it.
  const env = {...process.env};
  delete env.STRIPE_API_KEY;
  delete env.STRIPE_SECRET_KEY;
  delete env.STRIPE_WEBHOOK_SECRET;
  try {
    const {stdout} = await config.run('stripe', [...args, '--project-name', config.project, '--color', 'off', '--log-level', 'error'], {
      env, encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024,
      windowsHide: true, shell: false,
    });
    const value = JSON.parse(stdout);
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.hasOwn(value, 'error')) throw unavailable();
    return value;
  } catch {
    // CLI errors can include authentication details or complete API responses.
    // Do not attach the original error, stdout, stderr, or command arguments.
    throw unavailable();
  }
}

export async function verifyStripeCli(config) {
  const validated = options(config);
  const identity = await command(validated, ['whoami', '--format', 'json']);
  if (identity.mode !== 'test' || identity.account_id !== validated.accountId) throw unavailable();
  return {accountId: validated.accountId, mode: 'test'};
}

// Local development only. Hosted deployments continue to use server API keys.
export function createStripeCliTransport(config) {
  const validated = options(config);
  return async (path, fields, idempotencyKey) => {
    let args;
    let requestedSession;
    if (path === 'checkout/sessions' && fields && typeof fields === 'object' && !Array.isArray(fields)) {
      const entries = Object.entries(fields);
      if (!entries.length || typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9:_-]{1,255}$/.test(idempotencyKey) ||
          entries.some(([key, value]) => !/^[A-Za-z0-9_\[\]]{1,200}$/.test(key) || typeof value !== 'string' || value.includes('\0'))) throw unavailable();
      args = ['post', '/v1/checkout/sessions', '--confirm', '--idempotency', idempotencyKey];
      for (const [key, value] of entries) args.push('--data', `${key}=${value}`);
    } else if (typeof path === 'string' && path.startsWith('checkout/sessions/') && fields === undefined && idempotencyKey === undefined) {
      requestedSession = path.slice('checkout/sessions/'.length);
      if (!SESSION_ID.test(requestedSession)) throw unavailable();
      args = ['get', '/v1/checkout/sessions/' + requestedSession];
    } else {
      throw unavailable();
    }
    await verifyStripeCli(validated);
    const session = await command(validated, args);
    if (session.object !== 'checkout.session' || session.livemode !== false || !SESSION_ID.test(session.id) ||
        (requestedSession && session.id !== requestedSession)) throw unavailable();
    return session;
  };
}

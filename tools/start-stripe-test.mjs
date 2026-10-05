import {readFileSync, realpathSync, statSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';
import {spawn} from 'node:child_process';
import {verifyStripeCli} from '../server/stripe-cli.mjs';

// Credentials stay in a private file, outside the publicly served game folder.
const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const configPath = resolve(homedir(), '.config/meadowlark-ranch/stripe-test.env');
const events = 'checkout.session.completed,checkout.session.async_payment_succeeded,charge.refunded,charge.dispute.created,charge.dispute.closed';
let config;
try {
  const path = realpathSync(configPath);
  if (path === root || path.startsWith(root + sep)) throw Error('Keep the configuration outside the game folder.');
  if (statSync(path).mode & 0o077) throw Error('The private configuration must have file permissions 600.');
  config = parseEnv(readFileSync(path, 'utf8'));
} catch (error) {
  console.error(error.code === 'ENOENT' ? `Private Stripe settings are not ready: ${configPath}` : error.message);
  process.exit(1);
}
const project = config.STRIPE_CLI_PROJECT || 'meadowlark-test';
const accountId = config.STRIPE_CLI_ACCOUNT;
if (config.STRIPE_SECRET_KEY && !/^(?:sk|rk|rkcs)_test_[A-Za-z0-9_]+$/.test(config.STRIPE_SECRET_KEY)) {
  console.error('This launcher only accepts Stripe TEST API keys.');
  process.exit(1);
}
try {
  await verifyStripeCli({project, accountId});
} catch {
  console.error('The approved Stripe test account is not connected. Complete Stripe CLI sign-in for the configured sandbox.');
  process.exit(1);
}
const port = Number(config.PORT || 57875);
const origin = `http://127.0.0.1:${port}`;
if (!Number.isInteger(port) || port < 1024 || port > 65535 || config.APP_ORIGIN !== origin || config.BIND_HOST !== '127.0.0.1') {
  console.error('This launcher only supports a matching local port and http://127.0.0.1 origin.');
  process.exit(1);
}

// The CLI uses its own approved test account. Never pass API keys as arguments
// or print raw CLI output: it contains the webhook signing secret.
const cliEnv = {...process.env};
delete cliEnv.STRIPE_API_KEY;
delete cliEnv.STRIPE_SECRET_KEY;
delete cliEnv.STRIPE_WEBHOOK_SECRET;
const listener = spawn('stripe', ['listen', '--project-name', project, '--skip-update', '--color', 'off', '--events', events, '--events-from', '@self', '--forward-to', `${origin}/api/stripe/webhook`], {env: cliEnv, stdio: ['ignore', 'pipe', 'pipe']});
let server;
let stopping = false;
let signingSecret;
let tail = '';
let ready = false;
const timeout = setTimeout(() => stop('Stripe did not become ready. Complete Stripe CLI sign-in, then try again.', 1), 60000);
function stop(message, code = 0) {
  if (stopping) return;
  stopping = true;
  clearTimeout(timeout);
  if (message) console.error(message);
  listener.kill('SIGTERM');
  server?.kill('SIGTERM');
  process.exitCode = code;
}
function output(data) {
  tail = (tail + data.toString()).slice(-8192);
  signingSecret ||= tail.match(/whsec_[A-Za-z0-9]+/)?.[0];
  ready ||= tail.includes('Ready!');
  if (!signingSecret || !ready || server || stopping) return;
  clearTimeout(timeout);
  console.log('Stripe test events connected. Starting the local store…');
  server = spawn(process.execPath, [resolve(root, 'server/commerce.mjs')], {
    cwd: root,
    env: {...process.env, ...config, STRIPE_SECRET_KEY: '', STRIPE_CLI_PROJECT: project, STRIPE_CLI_ACCOUNT: accountId, STRIPE_WEBHOOK_SECRET: signingSecret},
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  server.on('error', () => stop('The game server could not start.', 1));
  server.on('exit', code => stop(stopping ? undefined : 'The game server stopped. If the port is busy, stop the existing preview first.', code || 0));
}
listener.stdout.on('data', output);
listener.stderr.on('data', output);
listener.on('error', () => stop('Stripe CLI could not start. Check that it is installed.', 1));
listener.on('exit', code => stop(stopping ? undefined : 'The Stripe connection stopped. Sign in to the meadowlark-test CLI profile and try again.', code || 1));
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
console.log('Connecting to Stripe TEST mode. No real payments are enabled.');

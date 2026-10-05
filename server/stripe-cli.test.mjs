import test from 'node:test';
import assert from 'node:assert/strict';
import {createStripeCliTransport, verifyStripeCli} from './stripe-cli.mjs';

const project = 'meadowlark-test';
const accountId = 'acct_ApprovedSandbox';
const identity = {account_id: accountId, mode: 'test', email: 'private@example.invalid'};
const session = {id: 'cs_test_checkout123', object: 'checkout.session', livemode: false, url: 'https://checkout.stripe.com/c/pay/cs_test_checkout123'};
function fixture(responses = [identity, session]) {
  const calls = [];
  const run = async (file, args, options) => {
    calls.push({file, args, options});
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return typeof response === 'string' ? {stdout: response, stderr: ''} : {stdout: JSON.stringify(response), stderr: ''};
  };
  return {calls, config: {project, accountId, run}, transport: createStripeCliTransport({project, accountId, run})};
}
const isGenericError = error => error.status === 502 && error.message === 'Stripe test connection is unavailable. Check the local Stripe sign-in and retry.';

test('verifies the configured sandbox and returns no private identity details', async () => {
  const {config, calls} = fixture([identity]);
  assert.deepEqual(await verifyStripeCli(config), {accountId, mode: 'test'});
  assert.deepEqual(calls[0].args, ['whoami', '--format', 'json', '--project-name', project, '--color', 'off', '--log-level', 'error']);
});

test('creates test checkout with literal data, stable idempotency, and no shell', async () => {
  const {transport, calls} = fixture();
  const literal = 'Ranch; $(touch /tmp/should-not-exist) `id` --live';
  const fields = {mode: 'payment', 'line_items[0][price_data][product_data][name]': literal, success_url: 'http://127.0.0.1:57875/store.html?x=1&session_id={CHECKOUT_SESSION_ID}'};
  assert.deepEqual(await transport('checkout/sessions', fields, 'checkout:order-123'), session);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].file, 'stripe');
  assert.deepEqual(calls[1].args, ['post', '/v1/checkout/sessions', '--confirm', '--idempotency', 'checkout:order-123',
    '--data', 'mode=payment', '--data', 'line_items[0][price_data][product_data][name]=' + literal,
    '--data', 'success_url=' + fields.success_url, '--project-name', project, '--color', 'off', '--log-level', 'error']);
  for (const call of calls) {
    assert.equal(call.options.shell, false);
    assert.equal(call.options.timeout, 10000);
    assert.equal(call.options.killSignal, 'SIGKILL');
    assert.equal(call.options.maxBuffer, 1024 * 1024);
    assert.equal(call.args.includes('--live'), false);
  }
});

test('removes inherited API and webhook secrets from every CLI subprocess', async t => {
  const names = ['STRIPE_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'];
  const before = Object.fromEntries(names.map(name => [name, process.env[name]]));
  t.after(() => {for (const name of names) {if (before[name] === undefined) delete process.env[name]; else process.env[name] = before[name];}});
  for (const name of names) process.env[name] = 'test-private-value';
  const {transport, calls} = fixture();
  await transport('checkout/sessions/' + session.id);
  for (const call of calls) for (const name of names) assert.equal(Object.hasOwn(call.options.env, name), false);
  for (const name of names) assert.equal(process.env[name], 'test-private-value');
});

test('retrieves only the requested test checkout and rechecks identity every time', async () => {
  const {transport, calls} = fixture([identity, session, {...identity, account_id: 'acct_OtherSandbox'}]);
  assert.deepEqual(await transport('checkout/sessions/' + session.id), session);
  assert.deepEqual(calls[1].args.slice(0, 2), ['get', '/v1/checkout/sessions/' + session.id]);
  await assert.rejects(transport('checkout/sessions/' + session.id), isGenericError);
  assert.equal(calls.length, 3);
  assert.equal(calls[2].args[0], 'whoami');
});

test('refuses wrong, live, missing, or malformed identities before any payment API request', async () => {
  for (const response of [{...identity, account_id: 'acct_OtherSandbox'}, {...identity, mode: 'live'}, {}, 'not json', null, []]) {
    const {transport, calls} = fixture([response]);
    await assert.rejects(transport('checkout/sessions', {mode: 'payment'}, 'checkout:test'), isGenericError);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].args[0], 'whoami');
  }
});

test('rejects unintended paths and methods without starting the CLI', async () => {
  const invalid = [
    ['customers', {name: 'bad'}, 'checkout:test'], ['checkout/sessions'],
    ['checkout/sessions', {}, 'checkout:test'], ['checkout/sessions', {mode: 'payment'}],
    ['checkout/sessions', {mode: 'payment'}, '--live;evil'],
    ['checkout/sessions', {'--live': 'true'}, 'checkout:test'],
    ['checkout/sessions', {mode: 'pay\0ment'}, 'checkout:test'],
    ['checkout/sessions/cs_live_checkout123'], ['checkout/sessions/cs_test_'],
    ['checkout/sessions/cs_test_a/../../customers'], ['checkout/sessions/cs_test_a?expand[]=customer'],
    ['https://api.stripe.com/v1/checkout/sessions'], ['checkout/sessions/' + session.id, {mode: 'payment'}, 'checkout:test'],
  ];
  for (const args of invalid) {
    const {transport, calls} = fixture();
    await assert.rejects(transport(...args), isGenericError);
    assert.equal(calls.length, 0);
  }
});

test('rejects live, mismatched, malformed, or error API responses', async () => {
  for (const response of [{...session, livemode: true}, {...session, livemode: undefined}, {...session, id: 'cs_live_checkout123'},
    {...session, id: 'cs_test_another'}, {...session, object: 'customer'}, {error: {message: 'private API details'}}, 'not json', null, []]) {
    const {transport} = fixture([identity, response]);
    await assert.rejects(transport('checkout/sessions/' + session.id), isGenericError);
  }
});

test('does not expose raw CLI errors, output, or causes', async () => {
  const rawError = Object.assign(new Error('private API key and process failure'), {stdout: 'private checkout', stderr: 'private login token'});
  for (const responses of [[rawError], [identity, rawError]]) {
    const {transport} = fixture(responses);
    await assert.rejects(transport('checkout/sessions/' + session.id), error => {
      assert.equal(isGenericError(error), true);
      assert.equal(error.cause, undefined);
      assert.equal(error.stdout, undefined);
      assert.equal(error.stderr, undefined);
      assert.equal(JSON.stringify(error).includes('private'), false);
      return true;
    });
  }
});

test('requires an explicit safe CLI profile and expected account', () => {
  for (const config of [undefined, null, [], {}, {project, accountId: ''}, {project: '--live', accountId}, {project: '../../other', accountId}, {project, accountId, run: 'shell'}]) {
    assert.throws(() => createStripeCliTransport(config), isGenericError);
  }
});

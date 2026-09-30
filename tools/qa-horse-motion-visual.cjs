/* Capture real Studio poses for visual review. A pass here means the captures
 * completed; it does not certify animation quality. */
const fs = require('node:fs');
const path = require('node:path');
const QA = require('./qa-platform.cjs');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'output', process.env.VISUAL_QA_LABEL || 'horse-motion-visual');
const keys = (process.env.VISUAL_QA_KEYS || 'bay,sunset,fjord,shire,opaline,pegasus,emberdrake').split(',');
const gaits = (process.env.VISUAL_QA_GAITS || 'rest,walk,trot,canter,gallop,jump').split(',');
const times = {rest: 0, walk: 520, trot: 380, canter: 400, gallop: 330, jump: 630};
const injection = `
window.__visualQA = {
  async selectHorse(key) { await select(key); paused = true; controls.autoRotate = false; draw(); return JSON.parse(render_game_to_text()); },
  pose(gait, ms, side) {
    paused = false; motion.reset?.(); motion.set(gait, {lead: 'left'}); advanceTime(ms); paused = true;
    frameBody(side); draw();
    return {state: JSON.parse(render_game_to_text()), geometry: breedStudioInspect()};
  }
};`;

(async () => {
  fs.mkdirSync(out, {recursive: true});
  const browser = await QA.chromium.launch({headless: true, executablePath: process.env.QA_CHROMIUM || undefined, args: QA.gpuArgs()});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
    const errors = [], blocked = [], records = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {if (message.type() === 'error' && !message.text().includes('net::ERR_FAILED')) errors.push(message.text());});
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (['blob:', 'data:'].includes(url.protocol) || url.hostname === '127.0.0.1') return route.continue();
      blocked.push(url.origin + url.pathname); return route.abort();
    });
    await page.route('**/breeds.html*', route => {
      const html = fs.readFileSync(path.join(root, 'breeds.html'), 'utf8');
      return route.fulfill({contentType: 'text/html', body: html.replace('</script></body>', injection + '\n</script></body>')});
    });
    await page.goto(QA.BASE + '/breeds.html?horse=bay', {waitUntil: 'load', timeout: 120000});
    await page.waitForFunction(() => window.__visualQA && JSON.parse(render_game_to_text()).modelReady, null, {timeout: 120000});
    for (const key of keys) {
      await page.evaluate(k => window.__visualQA.selectHorse(k), key);
      for (const gait of gaits) for (const side of [true, false]) {
        const value = await page.evaluate(([g, ms, s]) => window.__visualQA.pose(g, ms, s), [gait, times[gait] ?? 400, side]);
        if (value.state.breed !== key || !value.geometry.finite) throw Error('Invalid visual capture ' + key + '/' + gait);
        const file = `${key}-${gait}-${side ? 'side' : 'quarter'}.png`;
        await page.locator('#stage').screenshot({path: path.join(out, file)});
        records.push({key, gait, view: side ? 'side' : 'quarter', file, assetSha256: value.state.asset.sha256, clip: value.state.clip});
      }
      console.log(JSON.stringify({key, captures: records.filter(r => r.key === key).length}));
    }
    const report = {scope: 'Actual Studio pose captures for human visual review; numerical completion is not artistic approval.', keys, gaits, records, errors, blockedExternalRequests: [...new Set(blocked)]};
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    if (errors.length || blocked.length) throw Error(JSON.stringify({errors, blocked}));
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});

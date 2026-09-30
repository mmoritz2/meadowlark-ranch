/* Read-only visual inventory of one representative per distinct imported body.
 * Captures prove that a pose rendered; a person must judge artistic quality. */
const fs = require('node:fs');
const path = require('node:path');
const QA = require('./qa-platform.cjs');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/models/horse-imports/prepared-manifest.json')));
const byFile = new Map();
for (const [key, spec] of Object.entries(manifest.breeds)) {
  if (!byFile.has(spec.file)) byFile.set(spec.file, key);
}
const extras = ['pegasus', 'alicorn', 'opaline', 'emberdrake', 'tidedrake', 'gloomdrake'];
const defaultKeys = [...new Set([...byFile.values(), ...extras])];
const keys = process.env.VISUAL_GATE_KEYS?.split(',').map(s => s.trim()).filter(Boolean) || defaultKeys;
const out = path.join(root, 'output', process.env.VISUAL_GATE_LABEL || 'roster-visual-gate');
const injection = `
window.__rosterGate = {
  async selectHorse(key) {
    await select(key); paused = true; controls.autoRotate = false; draw();
    return JSON.parse(render_game_to_text());
  },
  pose(gait, ms, side) {
    paused = false; motion.reset?.(); motion.set(gait, {lead: 'left'});
    advanceTime(ms); paused = true; frameBody(side); draw();
    return JSON.parse(render_game_to_text());
  }
};`;

(async () => {
  fs.mkdirSync(out, {recursive: true});
  const browser = await QA.chromium.launch({
    headless: true,
    executablePath: process.env.QA_CHROMIUM || undefined,
    args: QA.gpuArgs(),
  });
  const report = {
    scope: 'One Studio sample per distinct physical body, plus selected fantasy variants. Screenshot creation is not visual approval.',
    generatedAt: new Date().toISOString(),
    manifestBodyCount: byFile.size,
    selectedKeys: keys,
    captures: [],
    errors: [],
    blockedExternalRequests: [],
  };
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', m => {
      if (m.type() === 'error' && !m.text().includes('net::ERR_FAILED')) report.errors.push(m.text());
    });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (['blob:', 'data:'].includes(url.protocol) || url.hostname === '127.0.0.1') return route.continue();
      report.blockedExternalRequests.push(url.origin + url.pathname);
      return route.abort();
    });
    await page.route('**/breeds.html*', route => {
      const html = fs.readFileSync(path.join(root, 'breeds.html'), 'utf8');
      return route.fulfill({contentType: 'text/html', body: html.replace('</script></body>', injection + '\n</script></body>')});
    });
    await page.goto(QA.BASE + '/breeds.html?horse=bay', {waitUntil: 'load', timeout: 120000});
    await page.waitForFunction(() => window.__rosterGate && JSON.parse(render_game_to_text()).modelReady, null, {timeout: 120000});
    const allPoses = [
      {gait: 'rest', ms: 0, view: 'side', side: true},
      {gait: 'rest', ms: 0, view: 'quarter', side: false},
      {gait: 'walk', ms: 250, view: 'side', side: true},
      {gait: 'walk', ms: 550, view: 'quarter', side: false},
    ];
    const requestedPoses = process.env.VISUAL_GATE_POSES?.split(',').map(s => s.trim()).filter(Boolean);
    const poses = requestedPoses ? allPoses.filter(p => requestedPoses.includes(`${p.gait}-${p.view}`)) : allPoses;
    if (!poses.length) throw Error('No known poses selected');
    for (const key of keys) {
      const selected = await page.evaluate(k => window.__rosterGate.selectHorse(k), key);
      if (!selected.modelReady || selected.breed !== key) throw Error(`Failed to select ${key}: ${JSON.stringify(selected)}`);
      for (const pose of poses) {
        const state = await page.evaluate(p => window.__rosterGate.pose(p.gait, p.ms, p.side), pose);
        if (!state.modelReady || state.breed !== key) throw Error(`Invalid ${key}/${pose.gait}/${pose.view}`);
        const file = `${key}-${pose.gait}-${pose.view}.png`;
        await page.locator('#stage').screenshot({path: path.join(out, file)});
        report.captures.push({key, file, gait: pose.gait, ms: pose.ms, view: pose.view,
          sourceFile: manifest.breeds[key].file, sha256: state.asset?.sha256,
          clip: state.clip, bones: state.asset?.bones, sourceTack: state.sourceTack,
          status: state.status});
      }
      fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
      console.log(JSON.stringify({key, captures: report.captures.length, body: manifest.breeds[key].file}));
    }
    report.blockedExternalRequests = [...new Set(report.blockedExternalRequests)];
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    if (report.errors.length || report.blockedExternalRequests.length) throw Error(JSON.stringify({errors: report.errors, blocked: report.blockedExternalRequests}));
  } finally {
    await browser.close();
  }
})().catch(e => {console.error(e); process.exitCode = 1;});

/* The three things every QA script in here got wrong about the machine it runs on.

   1. The GPU backend. Almost every script launched chromium with a literal
      '--use-angle=d3d11'. That is the Direct3D 11 backend and it exists only on Windows.
      Pass it on a Mac and chromium does not complain, does not warn, and does not fail — it
      quietly falls back to SwiftShader and rasterises the whole scene on the CPU. Every
      number those scripts ever printed on this machine about frame time, and every check
      gated on a frame budget or a timeout, was measuring a software rasteriser:
      tools/qa-horse-performance.cjs reported 6483 ms a frame against a true median of
      16.7 ms, a 388x error that reads as a catastrophic regression and means nothing.
      Then a second wave of scripts overcorrected and hardcoded '--use-angle=metal', which
      is the same bug pointing the other way — this project's owner develops on Windows,
      where metal is not a thing. ANGLE is the one flag that is genuinely per-platform, so
      it is derived from process.platform here and nowhere else.

   2. The port. Fifty scripts hardcoded 127.0.0.1:8431, so two of them could never run at
      the same time against two different checkouts without silently testing each other's
      build. QA_URL (a whole base URL) or QA_PORT (just the number) now override it, and
      8431 stays the default so a bare invocation behaves as it always did.

   3. The absolute paths. A handful of scripts required playwright from
      'C:/Users/msmor/node_modules/playwright' and imported a helper from
      'C:/Users/msmor/.codex/skills/...'. Those resolve on exactly one computer. The
      package name resolves on all of them, and the skill path is the home directory plus a
      relative tail, which is what the C: spelling meant in the first place. In the same
      family, tools/review-hero-motion.cjs reached for playwright's bundled ffmpeg through
      %LOCALAPPDATA% and the name ffmpeg-win64.exe, which off Windows is not a wrong path
      but an undefined one — path.join threw before anything could report a nicer problem.

   Usage, matching the shape the scripts already had:
     const QA=require('./qa-platform.cjs'), {chromium}=QA;
     const browser=await chromium.launch({headless:true,args:[QA.ANGLE,'--ignore-gpu-blocklist']});
     await page.goto(QA.BASE+'/ranch3d.html');
*/
const os=require('node:os'),path=require('node:path');

/* ANGLE's own backend names. Linux has no vendor backend worth naming, and 'gl' there means
   the real driver rather than the software fallback, so it is the honest third case. */
/* QA_ANGLE exists so the difference this file is about can be measured rather than asserted:
   run a script once with QA_ANGLE=d3d11 and once without, and the software fallback shows up
   as two numbers instead of an argument. It is deliberately not something a script sets for
   itself — anything that hardcodes a backend again is the bug coming back. */
const GPU=process.env.QA_ANGLE||(process.platform==='darwin'?'metal':process.platform==='win32'?'d3d11':'gl');

/* Playwright is usually a global install reached through NODE_PATH, which is why the scripts
   ask for it by bare name. PLAYWRIGHT_PATH is the escape hatch for a machine where it is
   neither global nor a sibling, and it exists mostly so the failure is a sentence a human
   can act on instead of a MODULE_NOT_FOUND naming somebody else's C: drive. */
function loadPlaywright(){
 const tries=[process.env.PLAYWRIGHT_PATH,'playwright'].filter(Boolean);
 for(const t of tries){try{return require(t);}catch(e){}}
 throw Error('playwright not resolvable. Install it globally and run with NODE_PATH=$(npm root -g), or set PLAYWRIGHT_PATH to the package directory.');
}
const playwright=loadPlaywright();

/* QA_URL wins because it can point at a different host entirely; QA_PORT is the common case
   of "same server, my own port". The trailing slash goes so callers can always concatenate. */
function baseUrl(){
 const u=process.env.QA_URL;
 if(u)return u.replace(/\/+$/,'');
 return 'http://127.0.0.1:'+(process.env.QA_PORT||'8431');
}

/* The skill client used to be imported from an absolute C:\Users\msmor path. That path is the
   home directory plus '.codex/skills/...', so spelling it that way is both the same file on
   the original machine and a file that can exist on this one. */
function skillScript(rel){
 return process.env.WEB_GAME_SKILL||path.join(os.homedir(),'.codex','skills','develop-web-game','scripts',rel);
}

/* Playwright keeps its browsers and its ffmpeg in a per-user cache whose location is a
   different convention on each OS, and names the binary after the platform inside. Rather
   than spell any of that twice, find the newest ffmpeg-* directory and take whatever
   executable is in it. Returns null when there is none, so callers can say so themselves. */
function ffmpegPath(){
 const fs=require('node:fs');
 const explicit=process.env.PLAYWRIGHT_BROWSERS_PATH;
 const root=explicit&&explicit!=='0'?explicit:
  process.platform==='win32'?path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'ms-playwright'):
  process.platform==='darwin'?path.join(os.homedir(),'Library','Caches','ms-playwright'):
  path.join(process.env.XDG_CACHE_HOME||path.join(os.homedir(),'.cache'),'ms-playwright');
 /* Newest build first, and numerically — a lexicographic sort would rank ffmpeg-999 above
    ffmpeg-1011 and quietly hand back the older binary. */
 let dirs=[];try{dirs=fs.readdirSync(root).filter(n=>n.startsWith('ffmpeg-')).sort((a,b)=>parseInt(b.slice(7),10)-parseInt(a.slice(7),10));}catch(e){return null;}
 for(const d of dirs){
  const hit=fs.readdirSync(path.join(root,d)).filter(n=>/^ffmpeg/.test(n)).map(n=>path.join(root,d,n)).find(p=>{try{return fs.statSync(p).isFile();}catch(e){return false;}});
  if(hit)return hit;
 }
 return null;
}

module.exports={
 GPU,
 ffmpegPath,
 ANGLE:'--use-angle='+GPU,
 /* The flags every 3D script wants, with room for its own. Kept as a function rather than a
    frozen array so no caller can push into a shared one and surprise the next. */
 gpuArgs:(extra=[])=>['--use-angle='+GPU,'--enable-gpu-rasterization','--ignore-gpu-blocklist','--disable-background-timer-throttling',...extra],
 get BASE(){return baseUrl();},
 baseUrl,
 skillScript,
 playwright,
 chromium:playwright.chromium,
};

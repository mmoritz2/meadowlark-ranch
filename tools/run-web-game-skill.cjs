// Run the installed game skill client on the machine's own GPU. The bundled SwiftShader
// backend is too slow for this scene and differs from whatever the player will have, which
// is why chromium.launch is wrapped at all — the point was never Windows in particular.
const QA=require('./qa-platform.cjs');
const {chromium}=QA,{pathToFileURL}=require('node:url');
const launch=chromium.launch.bind(chromium);
chromium.launch=async options=>{
 const browser=await launch({...options,args:[QA.ANGLE]});const newPage=browser.newPage.bind(browser);
 browser.newPage=async options=>{
  const page=await newPage(options),goto=page.goto.bind(page);
  page.goto=async(...args)=>{const response=await goto(...args);await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(render_game_to_text()).graphics.horseReady&&!JSON.parse(render_game_to_text()).graphics.horseLoading,null,{timeout:120000});await page.waitForTimeout(2000);return response;};return page;
 };return browser;
};
const url=process.argv[2]||QA.BASE+'/ranch3d.html',out=process.argv[3]||'output/visual-quality-skill';
process.argv=['node','web_game_playwright_client.js','--url',url,'--actions-json',JSON.stringify({steps:[{buttons:['left'],frames:6},{buttons:['up'],frames:12},{buttons:['space'],frames:3},{buttons:[],frames:50}]}),'--iterations','2','--pause-ms','250','--screenshot-dir',out];
import(pathToFileURL(QA.skillScript('web_game_playwright_client.js')).href);

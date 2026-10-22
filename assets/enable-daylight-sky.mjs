import {RGBELoader} from './vendor/three/examples/jsm/loaders/RGBELoader.js';
import {attachPastoralDaylightDisplay} from './pastoral-daylight-display.mjs';
// Explicit optional caller, after its normal world/startup has settled. Uncalled
// or failed load leaves the exact existing sky material active; no global flags.
export async function enablePastoralDaylightDisplay({THREE,material,url,initialStrength=0}){
 if(!url)return null;
 const texture=await new RGBELoader().loadAsync(url);
 let display;try{display=attachPastoralDaylightDisplay({THREE,material,texture,initialStrength});}catch(error){texture.dispose();throw error;}
 return{stats:display.stats,setStrength:display.setStrength,dispose(){display.dispose();texture.dispose();}};
}

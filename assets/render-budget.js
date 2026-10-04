// Keep Retina/large windows from multiplying every shadow, cloud and AO pass.
// Scene detail remains controlled by the selected graphics tier.
export function renderPixelRatio(width,height,deviceRatio,tier='high') {
 const budget={high:{pixels:1650000,ratio:1.5},medium:{pixels:1100000,ratio:1.25},low:{pixels:850000,ratio:1}}[tier]||{pixels:1650000,ratio:1.5};
 return Math.min(Math.max(.1,deviceRatio||1),budget.ratio,Math.sqrt(budget.pixels/(Math.max(1,width)*Math.max(1,height))));
}

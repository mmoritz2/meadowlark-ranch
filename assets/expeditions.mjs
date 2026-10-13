/* Authored expedition definitions shared by solo and online trail entry.
   This catalogue has no network, save, or feature-installation side effects. */
export const EXPEDITIONS=[
  {id:'basin',   name:'Kestrel Basin Loop',      icon:'🌾',regions:2,km:0.3,
   stops:[['🏠 Meadowlark Ranch',0,5],['🌊 Loon Lake',20,16],['🐴 Home Pasture',-70,-10],['🏠 Meadowlark Ranch',0,5]],
   blurb:'An easy morning circuit — the lake, the pasture and home for lunch.',r:{c:300,g:1,p:20}},
  {id:'cottonwood',name:'Cottonwood Post Run',   icon:'🏘️',regions:3,km:0.5,
   stops:[['🏠 Meadowlark Ranch',0,5],['🌲 Hollowpeak Pines',-30,-58],['🏘️ Cottonwood Village',47,-50],['🏠 Meadowlark Ranch',0,5]],
   blurb:'Collect Wren’s post, ride through the pines, and bring Ada’s reply home.',r:{c:450,g:2,p:28}},
  {id:'riverside',name:'Riverside Crossing',     icon:'🌉',regions:3,km:0.7,
   stops:[['🏠 Meadowlark Ranch',0,5],['🌊 Loon Lake',20,16],['🌉 River bridge',0,118],['🌉 Riverside Crossing',0,120]],
   blurb:'North along the water to the old bridge at Riverside.',r:{c:550,g:2,k:1,p:34}},
  {id:'barleyfold',name:'Barleyfold Harvest Haul',icon:'🌾',regions:3,km:1.2,
   stops:[['🏠 Meadowlark Ranch',0,5],['🏘️ Cottonwood Village',47,-50],['🌾 Barleyfold Farms',220,-110],['🏘️ Cottonwood Village',47,-50]],
   blurb:'Out to Otto at Barleyfold for the harvest, and back before dark.',r:{c:700,g:3,k:1,p:42}},
  {id:'coyote',  name:'Coyote Canyon Expedition',icon:'🏜️',regions:3,km:1.4,
   stops:[['🏠 Meadowlark Ranch',0,5],['🐴 Home Pasture',-70,-10],['🏜️ Coyote Canyon',-220,130],['🐴 Home Pasture',-70,-10]],
   blurb:'The long haul south-west into the canyon. Take water.',r:{c:850,g:4,k:1,p:50}},
  {id:'hollowpeak',name:'Hollowpeak Falls Ascent',icon:'🏔️',regions:4,km:1.8,
   stops:[['🏠 Meadowlark Ranch',0,5],['🌲 Hollowpeak Pines',-30,-58],['🏔️ Hollowpeak Heights',-160,-210],['💦 Hollowpeak Falls',-150,-232]],
   blurb:'The hardest ride in the Basin: up through the pines to the falls.',r:{c:1100,g:5,k:2,p:64}},
 ];

/* Pure ranch progress shared by the Build screen and regional entry rules.
   Supply the live catalogue and land-building total: neither belongs in the save
   as a second cached level, and reading progress must not grant or migrate it. */
export function decorBuilderPoints(piece){
 if(!piece)return 0;
 return piece.pts!=null?piece.pts:Math.max(1,Math.round((piece.price||0)/10+(piece.gems||0)*3));
}

export function ranchProgress(save={},catalog={},levels=[0],extraPoints=0){
 const points=(save.decor||[]).reduce((total,decor)=>total+decorBuilderPoints(catalog[decor.t]),0)+(save.builderBonus||0)+extraPoints;
 let level=1;
 for(let i=1;i<levels.length;i++)if(points>=levels[i])level=i+1;
 return {points,level};
}

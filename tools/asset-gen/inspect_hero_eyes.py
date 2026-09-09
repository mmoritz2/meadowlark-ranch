exec(open('tools/asset-gen/inspect_hero_pigment.py').read().split("for side in (1,-1):")[0])
tri=np.array(g.accessor(p['indices']),dtype=int).reshape(-1,3);cen=pos[tri].mean(1);tuv=uv[tri].mean(1)
for flip in (False,True):
    colors=a[np.clip(((1-tuv[:,1] if flip else tuv[:,1])*(a.shape[0]-1)).astype(int),0,a.shape[0]-1),np.clip((tuv[:,0]*(a.shape[1]-1)).astype(int),0,a.shape[1]-1)]
    print('FLIP',flip,'TOTALRGB',colors.mean(0))
    for eye in ((.824,.596,.193),(.811,.610,.027)):
        ids=np.where(np.linalg.norm(cen-np.array(eye),axis=1)<.045)[0];ids=ids[np.argsort(colors[ids].mean(1))[:20]]; print('POINT',cen[ids].mean(0),'RGB',colors[ids].mean(0),'BOUNDS',cen[ids].min(0),cen[ids].max(0))

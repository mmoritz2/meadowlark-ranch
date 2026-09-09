exec(open('tools/asset-gen/inspect_hero_eyes.py').read().split('for flip in (False,True):')[0])
colors=a[np.clip((tuv[:,1]*(a.shape[0]-1)).astype(int),0,a.shape[0]-1),np.clip((tuv[:,0]*(a.shape[1]-1)).astype(int),0,a.shape[1]-1)]
for n,center,rad in [('NEYE',(.802,.612,.208),.030),('FEYE',(.811,.628,.012),.030),('NNOS',(.952,.388,.208),.058),('FNOS',(.967,.4,.1),.060)]:
    ids=np.where(np.linalg.norm(cen-np.array(center),axis=1)<rad)[0]; good=ids[np.argsort(colors[ids].mean(1))[:max(8,len(ids)//5)]]; print(n,len(ids),cen[good].mean(0),colors[good].mean(0),cen[good].min(0),cen[good].max(0))

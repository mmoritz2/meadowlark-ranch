import bpy,json,numpy as np,pathlib
root=pathlib.Path('C:/Users/msmor/Desktop/star_ranch_fable/assets/models/horse-candidates/b2przemo')
bpy.ops.wm.open_mainfile(filepath=str(root/'horse-finished-study.blend'))
o=bpy.data.objects.get('Artist body — preserved quad topology');p=np.array([v.co[:] for v in o.data.vertices]);print('bounds',p.min(0),p.max(0))
for front in [True,False]:
 print('FRONT' if front else 'HIND')
 for h in [.05,.12,.22,.35,.5,.65,.8,.95,1.1,1.25,1.4]:
  q=p[(abs(p[:,2]-h)<.03)&((p[:,1]<-.1) if front else (p[:,1]>.2))]
  if not len(q):continue
  for side in [-1,1]:
   r=q[q[:,0]*side>.06];print(h,side,len(r),np.round(np.median(r,0),3).tolist() if len(r) else None,np.round(np.ptp(r,axis=0),3).tolist() if len(r) else None)

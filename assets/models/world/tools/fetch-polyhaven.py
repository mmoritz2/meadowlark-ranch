import json,os,sys,urllib.request,hashlib
ASSETS=sys.argv[2:]
RES=sys.argv[1]
def get(u):
    r=urllib.request.Request(u,headers={'User-Agent':'meadowlark-ranch-asset-fetch/1.0'})
    return urllib.request.urlopen(r,timeout=120).read()
for a in ASSETS:
    try:
        f=json.loads(get('https://api.polyhaven.com/files/%s'%a))
    except Exception as e:
        print('FILES FAIL',a,e); continue
    g=f.get('gltf',{}).get(RES,{}).get('gltf')
    if not g: print('NO GLTF',a); continue
    base=os.path.join('/tmp/phdl',a); os.makedirs(base,exist_ok=True)
    total=0
    main=os.path.join(base,os.path.basename(g['url']))
    d=get(g['url']); open(main,'wb').write(d); total+=len(d)
    for rel,info in (g.get('include') or {}).items():
        p=os.path.join(base,rel); os.makedirs(os.path.dirname(p),exist_ok=True)
        dd=get(info['url']); open(p,'wb').write(dd); total+=len(dd)
    print('OK %-28s %-4s %8.2f MB  files=%d  %s'%(a,RES,total/1048576,1+len(g.get('include') or {}),os.path.basename(main)))

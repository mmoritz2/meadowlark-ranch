"""Generate an isolated hero-horse reference and high-detail Hunyuan shape."""
import argparse,json,pathlib,shutil,time,urllib.request,uuid
import comfy
from gen_image import flux_graph
from gen_model import shape_graph_21,find_latest_glb

ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/models/hero-horse';OUT.mkdir(parents=True,exist_ok=True)
PROMPT='''A professional equine conformation photograph of one real adult bay Dutch Warmblood sporthorse gelding, a beautiful athletic mature riding horse with correct natural equine anatomy, standing calmly on all four hooves. Full horse in frame from ear tips to hoof soles and tail tip. Facing right, photographed at horse chest height, a mostly side view turned 22 degrees toward the camera so all four legs are clearly separated and visible. The far front hoof stands one hoof-width forward and the far hind hoof one hoof-width back, no crossed legs. A naturally proportioned substantial long equine head, broad bony cheek and lower jaw, alert dark brown eyes placed on the sides of the skull, a straight nasal bridge, soft gray-brown muzzle with realistic nostrils and closed relaxed lips, pointed cupped ears. A graceful strong neck tapered from shoulder to poll, defined throatlatch, visible sloping shoulder, realistic withers, firm topline, deep ribcage with athletic tucked flank, defined hocks and knees, lean straight cannon bones, short angled pasterns and solid sloped hoof walls with flat soles. Natural rich reddish bay coat and black points, fine short hair, subtle muscles under skin. Short neatly pulled black mane that does not conceal the neck contour. A natural black tail hanging behind and clearly separated from the hind legs. No tack, no bridle, no halter, no saddle, no rider, no humans, no text. Clean seamless pure white studio background, broad even diffuse daylight, subtle contact shadow only, sharp realistic camera detail, natural unretouched photograph, restrained highlights, neutral pose. This is a real horse, not a toy, sculpture, statue, illustration or cartoon.'''

def upload(path):
    boundary='hero-'+uuid.uuid4().hex
    header=f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{path.name}"\r\nContent-Type: image/png\r\n\r\n'.encode()
    body=header+path.read_bytes()+f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--{boundary}--\r\n'.encode()
    request=urllib.request.Request(comfy.HOST+'/upload/image',data=body,headers={'Content-Type':'multipart/form-data; boundary='+boundary})
    with urllib.request.urlopen(request,timeout=60) as response:return json.load(response)['name']

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--references',action='store_true');parser.add_argument('--mesh',type=pathlib.Path);parser.add_argument('--resolution',type=int,default=768);parser.add_argument('--steps',type=int,default=60)
    args=parser.parse_args();comfy.wait_up()
    if args.references:
        for index,seed in enumerate((5809283,9809137),1):
            graph=flux_graph(PROMPT,1024,1024,28,4.0,seed,1,prefix='hero-horse/reference')
            (OUT/f'reference-{index}-workflow.json').write_text(json.dumps(graph,indent=2))
            images=comfy.run(graph,OUT,basename=f'reference-{index}')
            print('REFERENCE_READY',images,flush=True)
        (OUT/'reference-prompt.txt').write_text(PROMPT)
    if args.mesh:
        ref=args.mesh.resolve();shutil.copy2(ref,OUT/'reference.png')
        filename=upload(OUT/'reference.png')
        comfy.free()
        graph=shape_graph_21(filename,'hero_horse_raw',5.5,args.steps,args.resolution,300000)
        # Keep a dense original for inspecting actual anatomy before choosing
        # game topology. Smoothing/decimation belongs in the Blender review.
        graph['5']['inputs'].update({'reduce_faces':False,'remove_floaters':False})
        (OUT/'shape-workflow.json').write_text(json.dumps(graph,indent=2))
        started=time.time();pid=comfy.submit(graph);(OUT/'shape-job.json').write_text(json.dumps({'prompt_id':pid,'started':started},indent=2));print('SHAPE_JOB',pid,flush=True)
        result=comfy.monitor(pid);(OUT/'shape-history.json').write_text(json.dumps(result,indent=2))
        if result.get('status',{}).get('status_str')!='success':raise RuntimeError(result.get('status'))
        source=find_latest_glb('hero_horse_raw',started)
        if not source:raise RuntimeError('Mesh exporter completed without its GLB')
        shutil.copy2(source,OUT/'source-high.glb');print('SHAPE_READY',OUT/'source-high.glb',flush=True)

if __name__=='__main__':main()

"""Publish only the candidate-owned eight-identity/five-body handoff manifest."""
from pathlib import Path
import sys,json,hashlib
ROOT=Path(__file__).resolve().parents[2];C=ROOT/'assets/models/horse-imports/bluemesh-draft';O=C/'game/breeds'
CORE='2e8f59448248aa947261f2587d47786eb3ef15ceef1a93281d970af4280b3594'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(ROOT/'assets/artist-horse-motion.js')==CORE,'Core changed after certified bake; rebake against the actual new frozen revision.'
ground=json.loads((O/'baked-ground-validation.json').read_text());assert all(ground['checks'].values())
ground_by_id={row['id']:row for row in ground['bodies']}
equivalence=json.loads((O/'default-core-equivalence-validation.json').read_text());assert equivalence['motionModuleSha256']==CORE and equivalence['allSixByteIdentical']
mapping={'vanner':'vanner','percheron':'percheron','shire':'shire','clyde':'clyde','tempest':'clyde','glacier':'percheron','rimewalker':'percheron','suffolk':'suffolk'}
physical={};breeds={};final='--final' in sys.argv
for key in ['vanner','percheron','shire','clyde','suffolk']:
 folder=O/key;p=json.loads((folder/'profile.json').read_text());assert sha(folder/p['file'])==p['sha256'];assert p['physicalScale'] and p['fitScale']==1 and p['fitY']==0
 audit=json.loads((folder/'motion-validation.json').read_text());assert audit['motionModuleSha256']==CORE and not audit['failures'] and all(audit['checks'].values())
 skin=json.loads((folder/'actual-playback-skin-validation.json').read_text());assert skin['passed'] and skin['animatedSha256']==p['sha256']
 assert ground_by_id[key]['modelSha256']==p['sha256'] and all(ground_by_id[key]['checks'].values())
 assert any(row['body']==key and row['byteIdentical'] and row['afterSha256']==p['sha256'] for row in equivalence['bodies'])
 render=json.loads((folder/'breed-render-report.json').read_text());render_ready=render['renderedGlbSha256']==p['sha256'] and {'Rest','Walk','Gallop_Left','Jump'}<=set(r['pose'] for r in render['renders'])
 if final:
  assert render_ready and render.get('visualReview','').startswith('passed'),key+' final actual PNG review missing'
  assert all(row['renderedGlbSha256']==p['sha256'] and sha(ROOT/row['png'])==row['sha256'] for row in render['renders']),key+' stale PNG/report mismatch'
  p['visualReview']='passed actual Rest/Walk/Gallop/Jump PNG inspection; runtime mounted/browser review pending'
 p['actualPlaybackSkinValidation']='actual-playback-skin-validation.json';p['attachmentCoatCalibration']='attachment-coat-calibration.json';p['bakedHoofPlaybackValidation']='../baked-ground-validation.json';p['finalMotionModuleSha256']=CORE;p['runtimeBrowserReview']='pending integrated site QA';p['mountedTackReview']='pending integrated runtime/rider visual verification of measured saddle/stirrup anchors'
 (folder/'profile.json').write_text(json.dumps(p,indent=2)+'\n')
 physical[key]={'foundation':key,'profile':key+'/profile.json','file':key+'/'+p['file'],'sha256':p['sha256'],'rigSha256':p['rigSha256'],'withersM':p['withersM'],'heightM':p['heightM'],'physicalScale':True,'fitScale':1,'fitY':0,'normalizedShapeSha256':json.loads((folder/'conformation-report.json').read_text())['bodyNormalizedShapeSha256'],'sourcePrimitiveTriangles':p['triangles'],'clips':p['clips'],'motionPassed':True,'actualPlaybackSkinPassed':True,'visualReviewComplete':bool(final and render_ready)}
 for identity,foundation in mapping.items():
  if foundation!=key:continue
  row=dict(p);row.update(id=identity,foundation=key,file=key+'/'+p['file'],sourceCandidate='bluemesh-draft',isFantasyOverlay=identity in ['tempest','glacier','rimewalker'],bodyShapeIsExplicitSourceDerivative=True)
  if row['isFantasyOverlay']:row['identityAppearanceScope']='Existing named fantasy coat/effects overlay on this explicitly mapped real draft body; no claim of a separate source species or physical conformation.'
  breeds[identity]=row
assert len({p['normalizedShapeSha256'] for p in physical.values()})==5
receipt=C/'source/receipt.json';registered=json.loads(receipt.read_text());source=ROOT/registered['path'];assert sha(source)==registered['sha256']
result={'version':1,'candidate':'bluemesh-draft','sourceAuthor':'BlueMesh','license':'CC BY4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','sourceUrl':'https://sketchfab.com/3d-models/horse-draft-horse-725065392aad4b04b7a172f8cd965497','sourceSha256':registered['sha256'],'sourceOriginalAndReceiptUnmodified':True,'coordinates':'+Z forward/+Y up,physical metres,groundY0','finalMotionModuleSha256':CORE,'physicalBodies':physical,'breeds':breeds,'identities':{identity:{'foundation':foundation,'profile':foundation+'/profile.json','physicalScale':True,'fitScale':1,'fitY':0,'isFantasyOverlay':identity in ['tempest','glacier','rimewalker']} for identity,foundation in mapping.items()},'physicalModelCount':5,'identityCount':8,'motionStatus':'All five delivered shapes: actual live gait/sole/contact/length checks passed; nine own clips; six-pose every-vertex actual AnimationMixer/reference validation passed.','visualStatus':'passed actual four-pose offline PBR geometry inspection' if final else 'rest inspection complete; final locomotion PNG inspection pending','runtimeBrowserQA':'pending integrated site/browser/mounted rider review','derivativeScope':'Five distinct body/neck/head/leg/hoof conformations, clearly authored coats and source groom modifications. Original encoded normal/MR and eye maps are deduplicated unchanged; four real coats and one neutral grayscale atlas are explicit original derivative atlases. Clydesdale base coat retains source encoded bytes. Suffolk has its own compact round-ribbed short-legged clean chestnut body. Source Sphere issue and socket repair are retained in conformation reports.','reports':{'bind':'batch-bind-validation.json','actualPlayback':'batch-actual-playback-validation.json','coatAndAttachments':'coat-attachment-calibration.json','bakedHoofPlayback':'baked-ground-validation.json','defaultCoreEquivalence':'default-core-equivalence-validation.json'}}
(O/'manifest.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'manifest':str(O/'manifest.json'),'identities':len(breeds),'physicalModels':len(physical),'finalOfflineVisualQA':final}))
